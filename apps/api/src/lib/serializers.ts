// Converte linhas do Prisma nos DTOs públicos: sem userId, datas como "AAAA-MM-DD"
// e status efetivo (com ATRASADO) calculado no momento da leitura.
import type { Boleto, Supplier, Tax } from "@prisma/client";
import { getEffectiveStatus, toISODate, type BoletoDTO, type SupplierDTO, type TaxDTO } from "@tributoleao/shared";
import { toISOMonth } from "./dates";

export function serializeSupplier(s: Supplier & { _count?: { boletos: number } }): SupplierDTO {
  return {
    id: s.id,
    legalName: s.legalName,
    tradeName: s.tradeName,
    document: s.document,
    email: s.email,
    phone: s.phone,
    category: s.category,
    boletoCount: s._count?.boletos ?? 0,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function serializeTax(t: Tax): TaxDTO {
  return {
    id: t.id,
    name: t.name,
    revenueCode: t.revenueCode,
    amountCents: t.amountCents,
    dueDate: toISODate(t.dueDate),
    referenceMonth: toISOMonth(t.referenceMonth),
    paymentCode: t.paymentCode,
    status: getEffectiveStatus(t),
    paidAt: t.paidAt ? toISODate(t.paidAt) : null,
    hasReceipt: t.receiptPath !== null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeBoleto(b: Boleto & { supplier: Pick<Supplier, "id" | "legalName" | "tradeName"> }): BoletoDTO {
  return {
    id: b.id,
    supplier: { id: b.supplier.id, legalName: b.supplier.legalName, tradeName: b.supplier.tradeName },
    description: b.description,
    amountCents: b.amountCents,
    feesCents: b.feesCents,
    totalCents: b.amountCents + b.feesCents,
    issueDate: toISODate(b.issueDate),
    dueDate: toISODate(b.dueDate),
    barcode: b.barcode,
    status: getEffectiveStatus(b),
    paidAt: b.paidAt ? toISODate(b.paidAt) : null,
    hasReceipt: b.receiptPath !== null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}
