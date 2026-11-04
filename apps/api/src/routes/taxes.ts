import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { deliveryInputSchema, payInputSchema, taxInputSchema, taxListQuerySchema, todayISO, type TaxInput, type TaxListSummary } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { conflict, notFound } from "../lib/errors";
import { dateFromISO, monthFromISO } from "../lib/dates";
import { pageArgs, pageMeta } from "../lib/pagination";
import { assertSupplierOwned, lateDeliveryWhere, payableConditions } from "../lib/payables";
import { serializeTax } from "../lib/serializers";

const idParams = z.object({ id: z.string().min(1) });
const withSupplier = { supplier: { select: { id: true, legalName: true, tradeName: true } } } as const;

// Código de receita e código de pagamento saíram do formulário: só mudam quando
// vêm no corpo, para a edição não apagar os de impostos antigos.
function toTaxData(input: TaxInput) {
  return {
    name: input.name,
    amountCents: input.amountCents,
    dueDate: dateFromISO(input.dueDate),
    referenceMonth: monthFromISO(input.referenceMonth),
    ...(input.revenueCode !== undefined && { revenueCode: input.revenueCode }),
    ...(input.paymentCode !== undefined && { paymentCode: input.paymentCode }),
    invoiceNumber: input.invoiceNumber ?? null,
    supplierId: input.supplierId ?? null,
    goodsDelivered: input.goodsDelivered,
  };
}

async function findOwnedTax(userId: string, id: string) {
  const tax = await prisma.tax.findFirst({ where: { id, userId }, include: withSupplier });
  if (!tax) throw notFound("Imposto");
  return tax;
}

export async function taxRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/taxes", async (request) => {
    const { page, pageSize, search, referenceMonth, goodsDelivered, deliveryLate, ...filters } = taxListQuerySchema.parse(request.query);

    const where: Prisma.TaxWhereInput = {
      userId: request.user.sub,
      AND: [...payableConditions(filters), ...(deliveryLate ? [lateDeliveryWhere()] : [])],
      ...(referenceMonth && { referenceMonth: monthFromISO(referenceMonth) }),
      ...(goodsDelivered !== undefined && { goodsDelivered }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { revenueCode: { contains: search, mode: "insensitive" } },
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { supplier: { legalName: { contains: search, mode: "insensitive" } } },
          { supplier: { tradeName: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const sum = { _sum: { amountCents: true } } as const;
    const [taxes, total, pending, paid, deliveryPendingCount, deliveryLateCount] = await prisma.$transaction([
      prisma.tax.findMany({
        where,
        include: withSupplier,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        ...pageArgs(page, pageSize),
      }),
      prisma.tax.count({ where }),
      prisma.tax.aggregate({ where: { AND: [where, { status: "PENDENTE" }] }, ...sum }),
      prisma.tax.aggregate({ where: { AND: [where, { status: "PAGO" }] }, ...sum }),
      prisma.tax.count({ where: { AND: [where, { goodsDelivered: false }] } }),
      prisma.tax.count({ where: { AND: [where, lateDeliveryWhere()] } }),
    ]);

    const pendingCents = pending._sum.amountCents ?? 0;
    const paidCents = paid._sum.amountCents ?? 0;
    const summary: TaxListSummary = {
      totalCents: pendingCents + paidCents,
      pendingCents,
      paidCents,
      deliveryPending: deliveryPendingCount,
      deliveryLate: deliveryLateCount,
    };
    return { data: taxes.map(serializeTax), meta: pageMeta(page, pageSize, total), summary };
  });

  app.get("/taxes/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return serializeTax(await findOwnedTax(request.user.sub, id));
  });

  app.post("/taxes", async (request, reply) => {
    const input = taxInputSchema.parse(request.body);
    if (input.supplierId) await assertSupplierOwned(request.user.sub, input.supplierId);
    const tax = await prisma.tax.create({ data: { ...toTaxData(input), userId: request.user.sub }, include: withSupplier });
    return reply.status(201).send(serializeTax(tax));
  });

  app.put("/taxes/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const input = taxInputSchema.parse(request.body);
    await findOwnedTax(request.user.sub, id);
    if (input.supplierId) await assertSupplierOwned(request.user.sub, input.supplierId);
    return serializeTax(await prisma.tax.update({ where: { id }, data: toTaxData(input), include: withSupplier }));
  });

  app.delete("/taxes/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await findOwnedTax(request.user.sub, id);
    await prisma.tax.delete({ where: { id } });
    return reply.status(204).send();
  });

  app.patch("/taxes/:id/pay", async (request) => {
    const { id } = idParams.parse(request.params);
    const { paidAt } = payInputSchema.parse(request.body ?? {});
    const tax = await findOwnedTax(request.user.sub, id);
    if (tax.status === "PAGO") throw conflict("Este imposto já está pago");

    const updated = await prisma.tax.update({
      where: { id },
      data: { status: "PAGO", paidAt: dateFromISO(paidAt ?? todayISO()) },
      include: withSupplier,
    });
    return serializeTax(updated);
  });

  // Marca (ou desmarca) a entrega da mercadoria sem passar pelo formulário
  app.patch("/taxes/:id/delivery", async (request) => {
    const { id } = idParams.parse(request.params);
    const { delivered } = deliveryInputSchema.parse(request.body);
    const tax = await findOwnedTax(request.user.sub, id);
    if (tax.goodsDelivered === null) throw conflict("Este imposto não tem entrega de mercadoria");

    return serializeTax(await prisma.tax.update({ where: { id }, data: { goodsDelivered: delivered }, include: withSupplier }));
  });

  // Estorno da baixa, para corrigir pagamentos marcados por engano
  app.patch("/taxes/:id/unpay", async (request) => {
    const { id } = idParams.parse(request.params);
    const tax = await findOwnedTax(request.user.sub, id);
    if (tax.status !== "PAGO") throw conflict("Este imposto não está pago");

    const updated = await prisma.tax.update({ where: { id }, data: { status: "PENDENTE", paidAt: null }, include: withSupplier });
    return serializeTax(updated);
  });
}
