import { z } from "zod";
import { isValidDocument, onlyDigits } from "../document";

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

export const supplierInputSchema = z.object({
  legalName: z.string().trim().min(2, "Informe a razão social"),
  tradeName: optionalText,
  document: z
    .string()
    .transform(onlyDigits)
    .refine(isValidDocument, "CPF ou CNPJ inválido"),
  email: z.union([z.email("Email inválido"), z.literal("")]).optional(),
  phone: optionalText,
  category: optionalText,
});
export type SupplierInput = z.infer<typeof supplierInputSchema>;
