import { todayISO } from "@tributoleao/shared";

const monthFormatter =new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthNameFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const percentFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "2026-10-29" → "29/10/2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-10" → "outubro de 2026" */
export function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

/** "2026-10" → "outubro" */
export function formatMonthName(month: string): string {
  return monthNameFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

/** Soma `delta` meses a "AAAA-MM". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

/** "2026-09" → "09/2026" */
export function formatMonthShort(month: string): string {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

/** Dias de hoje até a data (negativo se já passou). */
export function daysUntil(iso: string, today = todayISO()): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** 123456 → "1.234,56" (sem o símbolo, para campos com prefixo R$) */
export function formatCentsPlain(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Distância até o vencimento em linguagem natural. */
export function formatDueDistance(days: number): string {
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days > 1) return `vence em ${days} dias`;
  if (days === -1) return "venceu ontem";
  return `venceu há ${-days} dias`;
}
