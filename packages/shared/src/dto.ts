// Formato das respostas da API: o back serializa para estes tipos e o front os consome.
// Datas de calendário trafegam como "AAAA-MM-DD"; valores, em centavos.
import type { DeliveryStatus, EffectiveStatus } from "./status";

export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type Paginated<T> = { data: T[]; meta: PageMeta };

export type SupplierDTO = {
  id: string;
  legalName: string | null;
  tradeName: string | null; // nulo só em fornecedores antigos: exibir com supplierName()
  document: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  boletoCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierRefDTO = { id: string; legalName: string | null; tradeName: string | null };

export type TaxDTO = {
  id: string;
  name: string;
  revenueCode: string | null;
  amountCents: number;
  dueDate: string;
  referenceMonth: string; // AAAA-MM
  paymentCode: string | null;
  invoiceNumber: string | null;
  supplier: SupplierRefDTO | null; // empresa do imposto
  goodsDelivered: boolean | null; // null = não se aplica
  /** Derivado: ATRASADA quando passou o prazo de entrega contado do pagamento. */
  deliveryStatus: DeliveryStatus | null;
  deliveryDeadline: string | null; // pagamento + DELIVERY_DEADLINE_DAYS, enquanto não entregue
  status: EffectiveStatus;
  paidAt: string | null;
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BoletoDTO = {
  id: string;
  supplier: SupplierRefDTO;
  description: string;
  amountCents: number;
  feesCents: number;
  totalCents: number;
  issueDate: string;
  dueDate: string;
  barcode: string | null;
  status: EffectiveStatus;
  paidAt: string | null;
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Item da agenda de vencimentos do dashboard (imposto ou boleto). */
export type AgendaItemDTO = {
  type: "TAX" | "BOLETO";
  id: string;
  title: string; // nome do imposto ou descrição do boleto
  subtitle: string | null; // código de receita ou fornecedor
  amountCents: number; // boletos: valor + juros/multa
  dueDate: string;
  daysUntilDue: number; // negativo quando atrasado
  status: EffectiveStatus;
  paymentCode: string | null; // linha digitável / PIX, para "copiar código"
};

type Totals = { totalCents: number; paidCents: number; pendingCents: number };

export type DashboardStatsDTO = {
  month: string; // AAAA-MM de referência dos KPIs mensais
  /** Tudo que vence no mês; `pendingCents` é o "Total a pagar no mês". */
  monthTotals: Totals;
  /** Impostos com vencimento no ano do mês de referência. */
  taxesYearToDate: Totals & { year: number };
  pendingBoletos: { count: number; totalCents: number; overdueCount: number };
  overdue: { count: number; totalCents: number };
  /** Impostos pagos cuja mercadoria passou do prazo de entrega. */
  lateDeliveries: { count: number };
  nextDue: AgendaItemDTO | null;
  /** Atrasados + vencimentos dos próximos dias, por data. */
  agenda: AgendaItemDTO[];
  /** Distribuição do mês: impostos vs. boletos operacionais. */
  distribution: { taxesCents: number; boletosCents: number; taxesPercent: number; boletosPercent: number };
};
