import type { FastifyInstance } from "fastify";
import { reportQuerySchema, type EffectiveStatus, type ReportQuery, type ReportTotalsDTO } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { payableConditions } from "../lib/payables";
import { serializeBoleto, serializeTax } from "../lib/serializers";

const withSupplier = { supplier: { select: { id: true, legalName: true, tradeName: true } } } as const;
const orderBy = [{ dueDate: "asc" }, { createdAt: "asc" }] as const;

/** Intervalo de vencimento do relatório: o próprio dia, ou do dia 1 ao último dia do mês. */
function reportRange({ day, month }: ReportQuery) {
  if (day) return { from: day, to: day };
  const [y, m] = month!.split("-").map(Number) as [number, number];
  return { from: `${month}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

function sumTotals(items: Array<{ status: EffectiveStatus; cents: number }>): ReportTotalsDTO {
  const sum = (filter: (s: EffectiveStatus) => boolean) => items.reduce((acc, i) => (filter(i.status) ? acc + i.cents : acc), 0);
  return {
    count: items.length,
    totalCents: sum(() => true),
    paidCents: sum((s) => s === "PAGO"),
    pendingCents: sum((s) => s !== "PAGO"),
    overdueCents: sum((s) => s === "ATRASADO"),
  };
}

// Sem paginação: o relatório é para imprimir o período inteiro
export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/reports/boletos", async (request) => {
    const query = reportQuerySchema.parse(request.query);
    const { from, to } = reportRange(query);
    const boletos = await prisma.boleto.findMany({
      where: { userId: request.user.sub, AND: payableConditions({ status: query.status, dueFrom: from, dueTo: to }) },
      include: withSupplier,
      orderBy: [...orderBy],
    });
    const items = boletos.map(serializeBoleto);
    return { from, to, items, totals: sumTotals(items.map((b) => ({ status: b.status, cents: b.totalCents }))) };
  });

  app.get("/reports/taxes", async (request) => {
    const query = reportQuerySchema.parse(request.query);
    const { from, to } = reportRange(query);
    const taxes = await prisma.tax.findMany({
      where: { userId: request.user.sub, AND: payableConditions({ status: query.status, dueFrom: from, dueTo: to }) },
      include: withSupplier,
      orderBy: [...orderBy],
    });
    const items = taxes.map(serializeTax);
    return { from, to, items, totals: sumTotals(items.map((t) => ({ status: t.status, cents: t.amountCents }))) };
  });
}
