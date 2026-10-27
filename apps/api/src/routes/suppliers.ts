import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { onlyDigits, supplierInputSchema, supplierListQuerySchema, type SupplierInput } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { conflict, isUniqueViolation, notFound } from "../lib/errors";
import { pageArgs, pageMeta } from "../lib/pagination";
import { serializeSupplier } from "../lib/serializers";

const idParams = z.object({ id: z.string().min(1) });
const withBoletoCount = { _count: { select: { boletos: true } } } as const;

// PUT substitui o registro inteiro: campos opcionais ausentes viram null
function toSupplierData(input: SupplierInput) {
  return {
    legalName: input.legalName,
    tradeName: input.tradeName ?? null,
    document: input.document,
    email: input.email ?? null,
    phone: input.phone ?? null,
    category: input.category ?? null,
  };
}

async function findOwnedSupplier(userId: string, id: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id, userId }, include: withBoletoCount });
  if (!supplier) throw notFound("Fornecedor");
  return supplier;
}

const duplicateDocument = () => conflict("Já existe um fornecedor com este CPF/CNPJ");

export async function supplierRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/suppliers", async (request) => {
    const { page, pageSize, search } = supplierListQuerySchema.parse(request.query);

    const where: Prisma.SupplierWhereInput = { userId: request.user.sub };
    if (search) {
      const digits = onlyDigits(search);
      where.OR = [
        { legalName: { contains: search, mode: "insensitive" } },
        { tradeName: { contains: search, mode: "insensitive" } },
        ...(digits ? [{ document: { contains: digits } }] : []),
      ];
    }

    const [suppliers, total] = await prisma.$transaction([
      prisma.supplier.findMany({ where, include: withBoletoCount, orderBy: { legalName: "asc" }, ...pageArgs(page, pageSize) }),
      prisma.supplier.count({ where }),
    ]);

    return { data: suppliers.map(serializeSupplier), meta: pageMeta(page, pageSize, total) };
  });

  app.get("/suppliers/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    return serializeSupplier(await findOwnedSupplier(request.user.sub, id));
  });

  app.post("/suppliers", async (request, reply) => {
    const input = supplierInputSchema.parse(request.body);
    try {
      const supplier = await prisma.supplier.create({
        data: { ...toSupplierData(input), userId: request.user.sub },
        include: withBoletoCount,
      });
      return reply.status(201).send(serializeSupplier(supplier));
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicateDocument();
      throw err;
    }
  });

  app.put("/suppliers/:id", async (request) => {
    const { id } = idParams.parse(request.params);
    const input = supplierInputSchema.parse(request.body);
    await findOwnedSupplier(request.user.sub, id);
    try {
      const supplier = await prisma.supplier.update({ where: { id }, data: toSupplierData(input), include: withBoletoCount });
      return serializeSupplier(supplier);
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicateDocument();
      throw err;
    }
  });

  app.delete("/suppliers/:id", async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const supplier = await findOwnedSupplier(request.user.sub, id);
    // Preserva o histórico financeiro: o banco também bloqueia (onDelete: Restrict)
    if (supplier._count.boletos > 0) {
      throw conflict("Este fornecedor possui boletos vinculados e não pode ser excluído");
    }
    await prisma.supplier.delete({ where: { id } });
    return reply.status(204).send();
  });
}
