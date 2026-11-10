import type { FastifyInstance } from "fastify";
import type { Boleto, Prisma, Supplier, Tax } from "@prisma/client";
import {
  dashboardQuerySchema,
  getEffectiveStatus,
  supplierName,
  todayISO,
  toISODate,
  type AgendaItemDTO,
  type DashboardStatsDTO,
  type MonthSeriesPointDTO,
  type SupplierSpendDTO,
} from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { monthFromISO, today } from "../lib/dates";
import { lateDeliveryWhere } from "../lib/payables";

const AGENDA_WINDOW_DAYS = 15; // agenda: atrasados + vencimentos dos próximos 15 dias
const AGENDA_LIMIT = 10;
const TOP_SUPPLIERS = 6;
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
    title: b.supplier.tradeName ?? b.supplier.legalName ?? "Boleto",
    subtitle: b.invoiceNumber ? `NF ${b.invoiceNumber}` : b.description,
    amountCents: b.amountCents + b.feesCents,
    dueDate: toISODate(b.dueDate),
    daysUntilDue: Math.round((b.dueDate.getTime() - now.getTime()) / DAY_MS),
    status: getEffectiveStatus(b),
    paymentCode: b.barcode,
  };
}

/** Soma dos vencimentos de cada mês do ano, de impostos e de boletos (um GROUP BY por tabela). */
async function yearByMonth(userId: string, year: number): Promise<MonthSeriesPointDTO[]> {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  type Row = { month: string; cents: bigint };
  const [taxes, boletos] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT to_char("dueDate", 'YYYY-MM') AS month, SUM("amountCents")::bigint AS cents
      FROM taxes WHERE "userId" = ${userId} AND "dueDate" >= ${from} AND "dueDate" < ${to} GROUP BY 1`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char("dueDate", 'YYYY-MM') AS month, SUM("amountCents" + "feesCents")::bigint AS cents
      FROM boletos WHERE "userId" = ${userId} AND "dueDate" >= ${from} AND "dueDate" < ${to} GROUP BY 1`,
  ]);
  const byMonth = (rows: Row[]) => new Map(rows.map((r) => [r.month, Number(r.cents)]));
  const taxCents = byMonth(taxes);
  const boletoCents = byMonth(boletos);

  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { month, taxesCents: taxCents.get(month) ?? 0, boletosCents: boletoCents.get(month) ?? 0 };
  });
}

/** Fornecedores com mais valor vencendo no período, somando boletos e impostos ligados a eles. */
async function topSuppliers(userId: string, dueDate: { gte: Date; lt: Date }): Promise<SupplierSpendDTO[]> {
  const [boletos, taxes] = await Promise.all([
    prisma.boleto.groupBy({ by: ["supplierId"], where: { userId, dueDate }, _sum: { amountCents: true, feesCents: true }, _count: { _all: true } }),
    prisma.tax.groupBy({ by: ["supplierId"], where: { userId, dueDate, supplierId: { not: null } }, _sum: { amountCents: true }, _count: { _all: true } }),
  ]);

  const totals = new Map<string, { totalCents: number; count: number }>();
  const add = (id: string | null, cents: number, count: number) => {
    if (!id) return;
    const current = totals.get(id) ?? { totalCents: 0, count: 0 };
    totals.set(id, { totalCents: current.totalCents + cents, count: current.count + count });
  };
  for (const b of boletos) add(b.supplierId, (b._sum.amountCents ?? 0) + (b._sum.feesCents ?? 0), b._count._all);
  for (const t of taxes) add(t.supplierId, t._sum.amountCents ?? 0, t._count._all);

  const top = [...totals].sort((a, b) => b[1].totalCents - a[1].totalCents).slice(0, TOP_SUPPLIERS);
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, legalName: true, tradeName: true },
  });
  const names = new Map(suppliers.map((s) => [s.id, supplierName(s)]));
  return top.map(([id, t]) => ({ id, name: names.get(id) || "Fornecedor", ...t }));
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
  const withSupplierName = { supplier: { select: { legalName: true, tradeName: true } } } as const;
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
    lateDeliveries,
    taxMonthOverdue,
    boletoMonthOverdue,
    series,
    suppliers,
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
    prisma.boleto.findMany({ where: agendaWhere, include: withSupplierName, orderBy: { dueDate: "asc" }, take: AGENDA_LIMIT }),
    prisma.tax.findFirst({ where: nextWhere, orderBy: { dueDate: "asc" } }),
    prisma.boleto.findFirst({ where: nextWhere, include: withSupplierName, orderBy: { dueDate: "asc" } }),
    prisma.tax.count({ where: { userId, ...lateDeliveryWhere() } }),
    prisma.tax.aggregate({ where: { ...pending, dueDate: { gte: monthStart, lt: monthEnd < now ? monthEnd : now } }, ...sumTax, _count: { _all: true } }),
    prisma.boleto.aggregate({ where: { ...pending, dueDate: { gte: monthStart, lt: monthEnd < now ? monthEnd : now } }, ...sumBoleto }),
    yearByMonth(userId, year),
    topSuppliers(userId, monthRange),
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
    monthOverdue: {
      count: taxMonthOverdue._count._all + boletoMonthOverdue._count._all,
      totalCents: (taxMonthOverdue._sum.amountCents ?? 0) + boletoTotal(boletoMonthOverdue),
    },
    yearByMonth: series,
    topSuppliers: suppliers,
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
    lateDeliveries: { count: lateDeliveries },
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
