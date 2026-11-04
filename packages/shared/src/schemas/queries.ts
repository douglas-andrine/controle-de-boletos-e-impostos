import { z } from "zod";
import { EFFECTIVE_STATUSES } from "../status";
import { isoDateSchema, monthSchema } from "./payables";

// Query strings chegam como texto: z.coerce converte page/pageSize em número
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalSearch = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined);

export const supplierListQuerySchema = paginationSchema.extend({
  search: optionalSearch, // razão social, nome fantasia ou CPF/CNPJ
});
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;

const payableFilters = {
  status: z.enum(EFFECTIVE_STATUSES).optional(),
  dueFrom: isoDateSchema.optional(),
  dueTo: isoDateSchema.optional(),
  search: optionalSearch,
};

export const taxListQuerySchema = paginationSchema.extend({
  ...payableFilters,
  referenceMonth: monthSchema.optional(),
  goodsDelivered: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  /** Só os pagos com a mercadoria fora do prazo de entrega. */
  deliveryLate: z
    .enum(["true"])
    .optional()
    .transform((v) => v === "true"),
});
export type TaxListQuery = z.infer<typeof taxListQuerySchema>;

export const boletoListQuerySchema = paginationSchema.extend({
  ...payableFilters,
  supplierId: z.string().min(1).optional(),
});
export type BoletoListQuery = z.infer<typeof boletoListQuerySchema>;

export const dashboardQuerySchema = z.object({
  month: monthSchema.optional(), // padrão: mês atual
});
