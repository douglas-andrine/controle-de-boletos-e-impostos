import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { boletoInputSchema, boletoListQuerySchema, payInputSchema, todayISO, type BoletoInput } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { conflict, HttpError, notFound } from "../lib/errors";
import { dateFromISO } from "../lib/dates";
import { pageArgs, pageMeta } from "../lib/pagination";
import { payableConditions } from "../lib/payables";
import { serializeBoleto } from "../lib/serializers";

const idParams = z.object({ id: z.string().min(1) });
const withSupplier = { supplier: { select: { id: true, legalName: true, tradeName: true } } } as const;

function toBoletoData(input: BoletoInput) {
  return {
    supplierId: input.supplierId,
    description: input.description,
    amountCents: input.amountCents,
    feesCents: input.feesCents,
    issueDate: dateFromISO(input.issueDate),
    dueDate: dateFromISO(input.dueDate),
    barcode: input.barcode ?? null,
  };
}

async function findOwnedBoleto(userId: string, id: string) {
  const boleto = await prisma.boleto.findFirst({ where: { id, userId }, include: withSupplier });
  if (!boleto) throw notFound("Boleto");
  return boleto;
}

/** Impede vincular um boleto a fornecedor de outro usuário. */
async function assertSupplierOwned(userId: string, supplierId: string) {
  const exists = await prisma.supplier.count({ where: { id: supplierId, userId } });
  if (!exists) throw new HttpError(400, "Fornecedor não encontrado");
}

export async function boletoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/boletos", async (request) => {
    const { page, pageSize, search, supplierId, ...filters } = boletoListQuerySchema.parse(request.query);

    const where: Prisma.BoletoWhereInput = {
      userId: request.user.sub,
      AND: payableConditions(filters),
      ...(supplierId && { supplierId }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: "insensitive" } },
          { supplier: { legalName: { contains: search, mode: "insensitive" } } },
          { supplier: { tradeName: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [boletos, total] = await prisma.$transaction([
      prisma.boleto.findMany({
        where,
        include: withSupplier,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        ...pageArgs(page, pageSize),
      }),
      prisma.boleto.count({ where }),
    ]);

    return { data: boletos.map(serializeBoleto), meta: pageMeta(page, pageSize, total) };
  });

  app.get("/boletos/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return serializeBoleto(await findOwnedBoleto(request.user.sub, id));
  });

  app.post("/boletos", async (request, reply) => {
    const input = boletoInputSchema.parse(request.body);
    await assertSupplierOwned(request.user.sub, input.supplierId);
    const boleto = await prisma.boleto.create({
      data: { ...toBoletoData(input), userId: request.user.sub },
      include: withSupplier,
    });
    return reply.status(201).send(serializeBoleto(boleto));
  });

  app.put("/boletos/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const input = boletoInputSchema.parse(request.body);
    await findOwnedBoleto(request.user.sub, id);
    await assertSupplierOwned(request.user.sub, input.supplierId);
    const boleto = await prisma.boleto.update({ where: { id }, data: toBoletoData(input), include: withSupplier });
    return serializeBoleto(boleto);
  });

  app.delete("/boletos/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    await findOwnedBoleto(request.user.sub, id);
    await prisma.boleto.delete({ where: { id } });
    return reply.status(204).send();
  });

  app.patch("/boletos/:id/pay", async (request) => {
    const { id } = idParams.parse(request.params);
    const { paidAt } = payInputSchema.parse(request.body ?? {});
    const boleto = await findOwnedBoleto(request.user.sub, id);
    if (boleto.status === "PAGO") throw conflict("Este boleto já está pago");

    const updated = await prisma.boleto.update({
      where: { id },
      data: { status: "PAGO", paidAt: dateFromISO(paidAt ?? todayISO()) },
      include: withSupplier,
    });
    return serializeBoleto(updated);
  });

  // Estorno da baixa, para corrigir pagamentos marcados por engano
  app.patch("/boletos/:id/unpay", async (request) => {
    const { id } = idParams.parse(request.params);
    const boleto = await findOwnedBoleto(request.user.sub, id);
    if (boleto.status !== "PAGO") throw conflict("Este boleto não está pago");

    const updated = await prisma.boleto.update({
      where: { id },
      data: { status: "PENDENTE", paidAt: null },
      include: withSupplier,
    });
    return serializeBoleto(updated);
  });
}
