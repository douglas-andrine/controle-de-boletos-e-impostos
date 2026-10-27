// O banco guarda apenas PENDENTE ou PAGO. "ATRASADO" é derivado da data de
// vencimento no momento da leitura, então nunca fica desatualizado.

export const PAYMENT_STATUSES = ["PENDENTE", "PAGO"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const EFFECTIVE_STATUSES = ["PENDENTE", "PAGO", "ATRASADO"] as const;
export type EffectiveStatus = (typeof EFFECTIVE_STATUSES)[number];

export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso da aplicação. */
export function todayISO(timeZone = APP_TIME_ZONE, now = new Date()): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** Datas @db.Date chegam do Prisma como meia-noite UTC; usamos só a parte da data. */
export function toISODate(date: Date | string): string {
  return typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
}

export function getEffectiveStatus(
  item: { status: PaymentStatus; dueDate: Date | string },
  today = todayISO(),
): EffectiveStatus {
  if (item.status === "PAGO") return "PAGO";
  return toISODate(item.dueDate) < today ? "ATRASADO" : "PENDENTE";
}
