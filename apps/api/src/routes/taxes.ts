import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { payInputSchema, taxInputSchema, taxListQuerySchema, todayISO, type TaxInput } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { conflict, notFound } from "../lib/errors";
import { dateFromISO, monthFromISO } from "../lib/dates";
import { pageArgs, pageMeta } from "../lib/pagination";
import { payableConditions } from "../lib/payables";
import { serializeTax } from "../lib/serializers";

const idParams = z.object({ id: z.string().min(1) });

function toTaxData(input: TaxInput) {
  return {
    name: input.name,
    revenueCode: input.revenueCode ?? null,
    amountCents: input.amountCents,
    dueDate: dateFromISO(input.dueDate),
    referenceMonth: monthFromISO(input.referenceMonth),
    paymentCode: input.paymentCode ?? null,
  };
}

async function findOwnedTax(userId: string, id: string) {
  const tax = await prisma.tax.findFirst({ where: { id, userId } });
  if (!tax) throw notFound("Imposto");
  return tax;
}

export async function taxRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/taxes", async (request) => {
    const { page, pageSize, search, referenceMonth, ...filters } = taxListQuerySchema.parse(request.query);

    const where: Prisma.TaxWhereInput = {
      userId: request.user.sub,
      AND: payableConditions(filters),
      ...(referenceMonth && { referenceMonth: monthFromISO(referenceMonth) }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { revenueCode: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [taxes, total] = await prisma.$transaction([
      prisma.tax.findMany({ where, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }], ...pageArgs(page, pageSize) }),
      prisma.tax.count({ where }),
    ]);

    return { data: taxes.map(serializeTax), meta: pageMeta(page, pageSize, total) };
  });

  app.get("/taxes/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return serializeTax(await findOwnedTax(request.user.sub, id));
  });

  app.post("/taxes", async (request, reply) => {
    const input = taxInputSchema.parse(request.body);
    const tax = await prisma.tax.create({ data: { ...toTaxData(input), userId: request.user.sub } });
    return reply.status(201).send(serializeTax(tax));
  });

  app.put("/taxes/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const input = taxInputSchema.parse(request.body);
    await findOwnedTax(request.user.sub, id);
    return serializeTax(await prisma.tax.update({ where: { id }, data: toTaxData(input) }));
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
    });
    return serializeTax(updated);
  });

  // Estorno da baixa, para corrigir pagamentos marcados por engano
  app.patch("/taxes/:id/unpay", async (request) => {
    const { id } = idParams.parse(request.params);
    const tax = await findOwnedTax(request.user.sub, id);
    if (tax.status !== "PAGO") throw conflict("Este imposto não está pago");

    const updated = await prisma.tax.update({ where: { id }, data: { status: "PENDENTE", paidAt: null } });
    return serializeTax(updated);
  });
}
