import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { onlyDigits, supplierInputSchema, supplierListQuerySchema, type SupplierInput, type SupplierRefDTO } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { conflict, isUniqueViolation, notFound } from "../lib/errors";
import { pageArgs, pageMeta } from "../lib/pagination";
import { serializeSupplier } from "../lib/serializers";

const idParams = z.object({ id: z.string().min(1) });
const withBoletoCount = { _count: { select: { boletos: true, taxes: true } } } as const;

// Nome fantasia e categoria são o cadastro: ausente vira null. Razão social, CPF/CNPJ e
// contato não estão mais no formulário, então só mudam quando vêm no corpo (preserva o antigo).
function toSupplierData(input: SupplierInput) {
  return {
    tradeName: input.tradeName,
    category: input.category ?? null,
    ...(input.legalName !== undefined && { legalName: input.legalName }),
    ...(input.document !== undefined && { document: input.document }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.phone !== undefined && { phone: input.phone }),
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
      prisma.supplier.findMany({ where, include: withBoletoCount, orderBy: [{ tradeName: "asc" }, { legalName: "asc" }], ...pageArgs(page, pageSize) }),
      prisma.supplier.count({ where }),
    ]);

    return { data: suppliers.map(serializeSupplier), meta: pageMeta(page, pageSize, total) };
  });

  // Todos os fornecedores, só com id e nomes, para os selects de filtro e formulário:
  // sem paginação (não some fornecedor da lista) e sem as contagens da listagem
  app.get("/suppliers/options", async (request): Promise<SupplierRefDTO[]> => {
    return prisma.supplier.findMany({
      where: { userId: request.user.sub },
      select: { id: true, legalName: true, tradeName: true },
      orderBy: [{ tradeName: "asc" }, { legalName: "asc" }],
    });
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
    if (supplier._count.taxes > 0) {
      throw conflict("Este fornecedor possui impostos vinculados e não pode ser excluído");
    }
    await prisma.supplier.delete({ where: { id } });
    return reply.status(204).send();
  });
}
