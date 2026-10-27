// Formato das respostas da API: o back serializa para estes tipos e o front os consome.
// Datas de calendário trafegam como "AAAA-MM-DD"; valores, em centavos.
import type { EffectiveStatus } from "./status";

export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type Paginated<T> = { data: T[]; meta: PageMeta };

export type SupplierDTO = {
  id: string;
  legalName: string;
  tradeName: string | null;
  document: string;
  email: string | null;
  phone: string | null;
  category: string | null;
  boletoCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TaxDTO = {
  id: string;
  name: string;
  revenueCode: string | null;
  amountCents: number;
  dueDate: string;
  referenceMonth: string; // AAAA-MM
  paymentCode: string | null;
  status: EffectiveStatus;
  paidAt: string | null;
  hasReceipt: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BoletoDTO = {
  id: string;
  supplier: { id: string; legalName: string; tradeName: string | null };
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
