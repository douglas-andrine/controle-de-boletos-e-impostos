import { z } from "zod";

// trim/lowercase antes de validar: z.email() sozinho recusa " a@b.com "
const emailField = z.string().trim().toLowerCase().pipe(z.email("Email inválido"));

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome"),
  email: emailField,
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Admin criando um usuário: mesmos campos do cadastro. */
export const createUserSchema = registerSchema;
export type CreateUserInput = RegisterInput;

/** Definir (conta só Google) ou trocar a própria senha. A senha atual só é exigida de quem já tem uma. */
export const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  password: registerSchema.shape.password,
});
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;
