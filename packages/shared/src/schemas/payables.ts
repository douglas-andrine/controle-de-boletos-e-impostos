import { z } from "zod";

const cents = z.number().int("Valor em centavos deve ser inteiro");
export const isoDateSchema = z.iso.date("Data inválida (use AAAA-MM-DD)");
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido (use AAAA-MM)");
const optionalCode = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

export const TAX_NAMES = ["DARF", "DAS", "DAS-MEI", "GPS", "IPTU", "IPVA", "ISS", "ICMS", "IRPF", "FGTS", "OUTRO"] as const;

export const taxInputSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do imposto"),
  revenueCode: optionalCode,
  amountCents: cents.positive("O valor deve ser maior que zero"),
  dueDate: isoDateSchema,
  referenceMonth: monthSchema, // período de apuração
  paymentCode: optionalCode,
});
export type TaxInput = z.infer<typeof taxInputSchema>;

export const boletoInputSchema = z
  .object({
    supplierId: z.string().min(1, "Selecione o fornecedor"),
    description: z.string().trim().min(2, "Descreva o boleto"),
    amountCents: cents.positive("O valor deve ser maior que zero"),
    feesCents: cents.nonnegative("Juros/multa não podem ser negativos").default(0),
    issueDate: isoDateSchema,
    dueDate: isoDateSchema,
    barcode: optionalCode,
  })
  .refine((b) => b.dueDate >= b.issueDate, {
    path: ["dueDate"],
    message: "O vencimento não pode ser anterior à emissão",
  });
export type BoletoInput = z.infer<typeof boletoInputSchema>;

/** Corpo opcional de PATCH /:id/pay; sem data, a baixa é registrada hoje. */
export const payInputSchema = z.object({ paidAt: isoDateSchema.optional() });
export type PayInput = z.infer<typeof payInputSchema>;
