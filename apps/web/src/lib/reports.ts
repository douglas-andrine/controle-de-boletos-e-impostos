import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { BoletoReportDTO, EffectiveStatus, TaxReportDTO } from "@tributoleao/shared";
import { api } from "./api";

export type ReportKind = "boletos" | "taxes";
export type ReportPeriod = "day" | "month";

export type ReportFilters = {
  kind: ReportKind;
  period: ReportPeriod;
  /** AAAA-MM-DD no diário, AAAA-MM no mensal. */
  date: string;
  status?: EffectiveStatus;
};

type ReportOf<K extends ReportKind> = K extends "boletos" ? BoletoReportDTO : TaxReportDTO;

export function useReport<K extends ReportKind>({ kind, period, date, status }: ReportFilters & { kind: K }) {
  const params = new URLSearchParams({ [period]: date });
  if (status) params.set("status", status);
  return useQuery({
    // "boletos"/"taxes" na chave: dar baixa ou editar invalida o relatório junto com a listagem
    queryKey: [kind, "report", period, date, status],
    queryFn: () => api<ReportOf<K>>(`/reports/${kind}?${params}`),
    // Mantém o relatório anterior enquanto troca a data, mas nunca mostra boletos no lugar de impostos
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[0] === kind ? keepPreviousData(previous) : undefined),
  });
}
