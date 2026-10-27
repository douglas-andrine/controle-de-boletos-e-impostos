import type { FastifyInstance } from "fastify";
import type { Boleto, Prisma, Supplier, Tax } from "@prisma/client";
import {
  dashboardQuerySchema,
  getEffectiveStatus,
  todayISO,
  toISODate,
  type AgendaItemDTO,
  type DashboardStatsDTO,
} from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { monthFromISO, today } from "../lib/dates";

const AGENDA_WINDOW_DAYS = 15; // agenda: atrasados + vencimentos dos próximos 15 dias
const AGENDA_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

type BoletoWithSupplier = Boleto & { supplier: Pick<Supplier, "legalName" | "tradeName"> };
type BoletoSum = { _sum: { amountCents: number | null; feesCents: number | null } };

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const boletoTotal = (agg: BoletoSum) => (agg._sum.amountCents ?? 0) + (agg._sum.feesCents ?? 0);
const percent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 1000) / 10);

function taxToAgenda(t: Tax, now: Date): AgendaItemDTO {
  return {
    type: "TAX",
    id: t.id,
    title: t.name,
    subtitle: t.revenueCode,
    amountCents: t.amountCents,
    dueDate: toISODate(t.dueDate),
    daysUntilDue: Math.round((t.dueDate.getTime() - now.getTime()) / DAY_MS),
    status: getEffectiveStatus(t),
    paymentCode: t.paymentCode,
  };
}

function boletoToAgenda(b: BoletoWithSupplier, now: Date): AgendaItemDTO {
  return {
    type: "BOLETO",
    id: b.id,
    title: b.description,
    subtitle: b.supplier.tradeName ?? b.supplier.legalName,
    amountCents: b.amountCents + b.feesCents,
    dueDate: toISODate(b.dueDate),
    daysUntilDue: Math.round((b.dueDate.getTime() - now.getTime()) / DAY_MS),
    status: getEffectiveStatus(b),
    paymentCode: b.barcode,
  };
}

async function buildStats(userId: string, month: string): Promise<DashboardStatsDTO> {
  const now = today();
  const monthStart = monthFromISO(month);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const year = monthStart.getUTCFullYear();
  const yearRange = { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
  const monthRange = { gte: monthStart, lt: monthEnd };

  const pending = { userId, status: "PENDENTE" } as const;
  const paid = { userId, status: "PAGO" } as const;
  const sumTax = { _sum: { amountCents: true } } as const;
  const sumBoleto = { _sum: { amountCents: true, feesCents: true }, _count: { _all: true } } as const;
  const supplierName = { supplier: { select: { legalName: true, tradeName: true } } } as const;
  const overdueWhere = { ...pending, dueDate: { lt: now } } satisfies Prisma.TaxWhereInput & Prisma.BoletoWhereInput;
  const agendaWhere = { ...pending, dueDate: { lte: addDays(now, AGENDA_WINDOW_DAYS) } };
  const nextWhere = { ...pending, dueDate: { gte: now } };

  const [
    taxMonthPaid,
    taxMonthPending,
    boletoMonthPaid,
    boletoMonthPending,
    taxYearPaid,
    taxYearPending,
    boletoPending,
    taxOverdue,
    boletoOverdue,
    taxAgenda,
    boletoAgenda,
    nextTax,
    nextBoleto,
  ] = await Promise.all([
    prisma.tax.aggregate({ where: { ...paid, dueDate: monthRange }, ...sumTax }),
    prisma.tax.aggregate({ where: { ...pending, dueDate: monthRange }, ...sumTax }),
    prisma.boleto.aggregate({ where: { ...paid, dueDate: monthRange }, ...sumBoleto }),
    prisma.boleto.aggregate({ where: { ...pending, dueDate: monthRange }, ...sumBoleto }),
    prisma.tax.aggregate({ where: { ...paid, dueDate: yearRange }, ...sumTax }),
    prisma.tax.aggregate({ where: { ...pending, dueDate: yearRange }, ...sumTax }),
    prisma.boleto.aggregate({ where: pending, ...sumBoleto }),
    prisma.tax.aggregate({ where: overdueWhere, ...sumTax, _count: { _all: true } }),
    prisma.boleto.aggregate({ where: overdueWhere, ...sumBoleto }),
    prisma.tax.findMany({ where: agendaWhere, orderBy: { dueDate: "asc" }, take: AGENDA_LIMIT }),
    prisma.boleto.findMany({ where: agendaWhere, include: supplierName, orderBy: { dueDate: "asc" }, take: AGENDA_LIMIT }),
    prisma.tax.findFirst({ where: nextWhere, orderBy: { dueDate: "asc" } }),
    prisma.boleto.findFirst({ where: nextWhere, include: supplierName, orderBy: { dueDate: "asc" } }),
  ]);

  // Impostos e boletos vêm de tabelas diferentes: junta, ordena e corta
  const agenda = [...taxAgenda.map((t) => taxToAgenda(t, now)), ...boletoAgenda.map((b) => boletoToAgenda(b, now))]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, AGENDA_LIMIT);

  const nextCandidates = [
    ...(nextTax ? [taxToAgenda(nextTax, now)] : []),
    ...(nextBoleto ? [boletoToAgenda(nextBoleto, now)] : []),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const taxMonthPaidCents = taxMonthPaid._sum.amountCents ?? 0;
  const taxMonthPendingCents = taxMonthPending._sum.amountCents ?? 0;
  const boletoMonthPaidCents = boletoTotal(boletoMonthPaid);
  const boletoMonthPendingCents = boletoTotal(boletoMonthPending);
  const taxesMonthCents = taxMonthPaidCents + taxMonthPendingCents;
  const boletosMonthCents = boletoMonthPaidCents + boletoMonthPendingCents;
  const taxYearPaidCents = taxYearPaid._sum.amountCents ?? 0;
  const taxYearPendingCents = taxYearPending._sum.amountCents ?? 0;

  return {
    month,
    monthTotals: {
      totalCents: taxesMonthCents + boletosMonthCents,
      paidCents: taxMonthPaidCents + boletoMonthPaidCents,
      pendingCents: taxMonthPendingCents + boletoMonthPendingCents,
    },
    taxesYearToDate: {
      year,
      totalCents: taxYearPaidCents + taxYearPendingCents,
      paidCents: taxYearPaidCents,
      pendingCents: taxYearPendingCents,
    },
    pendingBoletos: {
      count: boletoPending._count._all,
      totalCents: boletoTotal(boletoPending),
      overdueCount: boletoOverdue._count._all,
    },
    overdue: {
      count: taxOverdue._count._all + boletoOverdue._count._all,
      totalCents: (taxOverdue._sum.amountCents ?? 0) + boletoTotal(boletoOverdue),
    },
    nextDue: nextCandidates[0] ?? null,
    agenda,
    distribution: {
      taxesCents: taxesMonthCents,
      boletosCents: boletosMonthCents,
      taxesPercent: percent(taxesMonthCents, taxesMonthCents + boletosMonthCents),
      boletosPercent: percent(boletosMonthCents, taxesMonthCents + boletosMonthCents),
    },
  };
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/dashboard/stats", async (request) => {
    const { month } = dashboardQuerySchema.parse(request.query);
    return buildStats(request.user.sub, month ?? todayISO().slice(0, 7));
  });
}
