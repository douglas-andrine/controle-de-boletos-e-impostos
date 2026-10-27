const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
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

/** Distância até o vencimento em linguagem natural. */
export function formatDueDistance(days: number): string {
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days > 1) return `vence em ${days} dias`;
  if (days === -1) return "venceu ontem";
  return `venceu há ${-days} dias`;
}
