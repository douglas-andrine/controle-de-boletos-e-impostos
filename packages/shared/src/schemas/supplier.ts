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

// Vazio vira undefined; preenchido precisa ser CPF/CNPJ válido (guardado só com dígitos)
const optionalDocument = z
  .string()
  .transform((v) => onlyDigits(v) || undefined)
  .pipe(z.string().refine(isValidDocument, "CPF ou CNPJ inválido").optional())
  .optional();

// O cadastro pede só nome fantasia e categoria. Razão social, CPF/CNPJ e contato
// continuam aceitos pela API para não perder os dados de fornecedores antigos.
export const supplierInputSchema = z.object({
  tradeName: z.string().trim().min(2, "Informe o nome fantasia"),
  category: optionalText,
  legalName: optionalText,
  document: optionalDocument,
  email: optionalEmail,
  phone: optionalText,
});
export type SupplierInput = z.infer<typeof supplierInputSchema>;
