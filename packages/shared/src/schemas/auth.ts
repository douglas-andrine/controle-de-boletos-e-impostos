import { z } from "zod";

// trim/lowercase antes de validar: z.email() sozinho recusa " a@b.com "
const emailField = z.string().trim().toLowerCase().pipe(z.email("Email inválido"));

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome"),
  email: emailField,
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;
