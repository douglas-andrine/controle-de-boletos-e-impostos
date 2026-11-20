import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { onlyDigits, supplierInputSchema, supplierListQuerySchema, type SupplierInput, type SupplierRefDTO } from "@tributoleao/shared";
import { prisma } from "../lib/prisma";
import { conflict, isUniqueViolation, notFound } from "../lib/errors";
import { pageArgs, pageMeta } from "../lib/pagination";
import { serializeSupplier } from "../lib/serializers";

const idParams = z.object({ id: z.string().min(1) });

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

/**
 * Soma os boletos e impostos só dos fornecedores informados, pelo índice de supplierId.
 * Não usa `include: { _count }` porque o Prisma gera um GROUP BY sobre a tabela inteira,
 * de todos os usuários, antes do JOIN: a listagem ficava mais lenta conforme a base crescia.
 */
async function withCounts<T extends { id: string }>(suppliers: T[]) {
  if (suppliers.length === 0) return [];
  const where = { supplierId: { in: suppliers.map((s) => s.id) } };
  const [boletos, taxes] = await Promise.all([
    prisma.boleto.groupBy({ by: ["supplierId"], where, _count: { _all: true } }),
    prisma.tax.groupBy({ by: ["supplierId"], where, _count: { _all: true } }),
  ]);
  const boletoCount = new Map(boletos.map((r) => [r.supplierId, r._count._all]));
  const taxCount = new Map(taxes.map((r) => [r.supplierId, r._count._all]));
  return suppliers.map((s) => ({ ...s, _count: { boletos: boletoCount.get(s.id) ?? 0, taxes: taxCount.get(s.id) ?? 0 } }));
}

async function findOwnedSupplier(userId: string, id: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id, userId } });
  if (!supplier) throw notFound("Fornecedor");
  const [counted] = await withCounts([supplier]);
  return counted!;
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
      prisma.supplier.findMany({ where, orderBy: [{ tradeName: "asc" }, { legalName: "asc" }], ...pageArgs(page, pageSize) }),
      prisma.supplier.count({ where }),
    ]);

    return { data: (await withCounts(suppliers)).map(serializeSupplier), meta: pageMeta(page, pageSize, total) };
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
      // Recém-criado: não tem boletos nem impostos, a contagem sai 0
      const supplier = await prisma.supplier.create({ data: { ...toSupplierData(input), userId: request.user.sub } });
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
      const supplier = await prisma.supplier.update({ where: { id }, data: toSupplierData(input) });
      const [counted] = await withCounts([supplier]);
      return serializeSupplier(counted!);
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
