import { z } from "zod";
import { todayISO } from "../status";

const cents = z.number().int("Valor em centavos deve ser inteiro");
export const isoDateSchema = z.iso.date("Informe uma data válida");
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe um período válido");
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
  invoiceNumber: optionalCode, // número da nota fiscal
  supplierId: optionalCode, // empresa do imposto, do cadastro de fornecedores
  goodsDelivered: z.boolean().nullable().default(null), // null = não se aplica
});
export type TaxInput = z.infer<typeof taxInputSchema>;

// O cadastro pede fornecedor, vencimento, valor, a nota (opcional), se o boleto veio com a nota e se já foi pago. Descrição, juros, emissão
// e linha digitável seguem aceitos pela API (registros antigos) e só mudam quando enviados.
export const boletoInputSchema = z
  .object({
    supplierId: z.string().min(1, "Selecione o fornecedor"),
    invoiceNumber: optionalCode, // número da nota fiscal
    amountCents: cents.positive("O valor deve ser maior que zero"),
    dueDate: isoDateSchema,
    description: optionalCode,
    feesCents: cents.nonnegative("Juros/multa não podem ser negativos").optional(),
    issueDate: isoDateSchema.optional(),
    barcode: optionalCode,
    boletoReceived: z.boolean().default(true), // false = buscar no portal do fornecedor
    // Data do pagamento informada no cadastro; null = não pago. Ausente, a edição não mexe no pagamento.
    paidAt: isoDateSchema.nullable().optional(),
  })
  .refine((b) => !b.issueDate || b.dueDate >= b.issueDate, {
    path: ["dueDate"],
    message: "O vencimento não pode ser anterior à emissão",
  })
  .refine((b) => !b.paidAt || b.paidAt <= todayISO(), {
    path: ["paidAt"],
    message: "A data do pagamento não pode ser no futuro",
  });
export type BoletoInput = z.infer<typeof boletoInputSchema>;

/** Corpo opcional de PATCH /:id/pay; sem data, a baixa é registrada hoje. */
export const payInputSchema = z.object({ paidAt: isoDateSchema.optional() });
export type PayInput = z.infer<typeof payInputSchema>;

export const deliveryInputSchema = z.object({ delivered: z.boolean() });
export type DeliveryInput = z.infer<typeof deliveryInputSchema>;

export const boletoReceivedInputSchema = z.object({ received: z.boolean() });
export type BoletoReceivedInput = z.infer<typeof boletoReceivedInputSchema>;
