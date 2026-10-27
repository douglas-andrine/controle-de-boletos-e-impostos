import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api";

/**
 * Leva os erros por campo devolvidos pela API (400) para o formulário.
 * Retorna a mensagem geral a exibir quando o erro não é de um campo específico.
 */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>): string | null {
  if (!(err instanceof ApiError)) return "Erro inesperado. Tente novamente.";
  if (!err.issues) return err.message;

  for (const [field, messages] of Object.entries(err.issues)) {
    if (messages?.[0]) setError(field as Path<T>, { message: messages[0] });
  }
  return null;
}
