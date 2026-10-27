import { z } from "zod";

const cents = z.number().int("Valor em centavos deve ser inteiro");
const isoDate = z.iso.date("Data inválida (use AAAA-MM-DD)");
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
  dueDate: isoDate,
  // Período de apuração no formato AAAA-MM
  referenceMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido (use AAAA-MM)"),
  paymentCode: optionalCode,
});
export type TaxInput = z.infer<typeof taxInputSchema>;

export const boletoInputSchema = z
  .object({
    supplierId: z.string().min(1, "Selecione o fornecedor"),
    description: z.string().trim().min(2, "Descreva o boleto"),
    amountCents: cents.positive("O valor deve ser maior que zero"),
    feesCents: cents.nonnegative().default(0),
    issueDate: isoDate,
    dueDate: isoDate,
    barcode: optionalCode,
  })
  .refine((b) => b.dueDate >= b.issueDate, {
    path: ["dueDate"],
    message: "O vencimento não pode ser anterior à emissão",
  });
export type BoletoInput = z.infer<typeof boletoInputSchema>;
