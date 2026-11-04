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

// Entrega da mercadoria: depois de pago, o imposto tem um prazo para a mercadoria
// chegar. Também é derivado na leitura, como o ATRASADO do pagamento.
export const DELIVERY_DEADLINE_DAYS = 15;

export const DELIVERY_STATUSES = ["ENTREGUE", "AGUARDANDO", "ATRASADA"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Soma dias a uma data AAAA-MM-DD. */
export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/** Último dia para entregar a mercadoria; só existe depois do pagamento. */
export function getDeliveryDeadline(item: { goodsDelivered: boolean | null; paidAt: Date | string | null }): string | null {
  if (item.goodsDelivered !== false || item.paidAt === null) return null;
  return addDaysISO(toISODate(item.paidAt), DELIVERY_DEADLINE_DAYS);
}

/** null quando a entrega não se aplica ao imposto. */
export function getDeliveryStatus(
  item: { goodsDelivered: boolean | null; paidAt: Date | string | null },
  today = todayISO(),
): DeliveryStatus | null {
  if (item.goodsDelivered === null) return null;
  if (item.goodsDelivered) return "ENTREGUE";
  const deadline = getDeliveryDeadline(item);
  return deadline !== null && deadline < today ? "ATRASADA" : "AGUARDANDO";
}
