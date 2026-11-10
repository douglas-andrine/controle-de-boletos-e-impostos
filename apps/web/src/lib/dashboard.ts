import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardStatsDTO } from "@tributoleao/shared";
import { api } from "./api";

export function useDashboardStats(month: string) {
  return useQuery({
    queryKey: ["dashboard", month],
    queryFn: () => api<DashboardStatsDTO>(`/dashboard/stats?month=${month}`),
    // Mantém o mês anterior na tela enquanto o novo carrega (sem "piscar")
    placeholderData: keepPreviousData,
  });
}
