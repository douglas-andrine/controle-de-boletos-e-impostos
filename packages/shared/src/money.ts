// Valores monetários trafegam e são persistidos como inteiros em centavos
// para evitar erros de ponto flutuante (0.1 + 0.2 !== 0.3).

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/** Converte texto digitado ("1.234,56", "R$ 10", "10,5") em centavos. */
export function parseBRL(input: string): number | null {
  const normalized = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (normalized === "" || normalized === "-") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}
