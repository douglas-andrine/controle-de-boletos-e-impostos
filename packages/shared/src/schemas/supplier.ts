import { z } from "zod";
import { isValidDocument, onlyDigits } from "../document";

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || undefined)
  .optional();

// Vazio vira undefined; preenchido precisa ser email válido
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v || undefined)
  .pipe(z.email("Email inválido").optional())
  .optional();

export const supplierInputSchema = z.object({
  legalName: z.string().trim().min(2, "Informe a razão social"),
  tradeName: optionalText,
  document: z
    .string()
    .transform(onlyDigits)
    .refine(isValidDocument, "CPF ou CNPJ inválido"),
  email: optionalEmail,
  phone: optionalText,
  category: optionalText,
});
export type SupplierInput = z.infer<typeof supplierInputSchema>;
