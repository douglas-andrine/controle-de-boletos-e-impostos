// Regras comuns a impostos e boletos: filtros por status efetivo/vencimento e baixa.
import type { EffectiveStatus } from "@tributoleao/shared";
import { dateFromISO, today } from "./dates";

type PayableFilters = { status?: EffectiveStatus; dueFrom?: string; dueTo?: string };

/**
 * Traduz o status efetivo (que inclui ATRASADO, não persistido) em condições do banco.
 * Retorna uma lista para ser usada em `AND`, combinando com o intervalo de vencimento.
 */
export function payableConditions({ status, dueFrom, dueTo }: PayableFilters) {
  const conditions: Array<{ status?: "PENDENTE" | "PAGO"; dueDate?: { gte?: Date; lt?: Date; lte?: Date } }> = [];

  if (dueFrom) conditions.push({ dueDate: { gte: dateFromISO(dueFrom) } });
  if (dueTo) conditions.push({ dueDate: { lte: dateFromISO(dueTo) } });

  if (status === "PAGO") conditions.push({ status: "PAGO" });
  if (status === "PENDENTE") conditions.push({ status: "PENDENTE", dueDate: { gte: today() } });
  if (status === "ATRASADO") conditions.push({ status: "PENDENTE", dueDate: { lt: today() } });

  return conditions;
}
