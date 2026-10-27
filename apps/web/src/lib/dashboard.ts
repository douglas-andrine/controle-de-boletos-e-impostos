import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgendaItemDTO, DashboardStatsDTO } from "@tributoleao/shared";
import { api } from "./api";

const resourcePath = (item: Pick<AgendaItemDTO, "type" | "id">) =>
  `/${item.type === "TAX" ? "taxes" : "boletos"}/${item.id}`;

export function useDashboardStats(month: string) {
  return useQuery({
    queryKey: ["dashboard", month],
    queryFn: () => api<DashboardStatsDTO>(`/dashboard/stats?month=${month}`),
    // Mantém o mês anterior na tela enquanto o novo carrega (sem "piscar")
    placeholderData: keepPreviousData,
  });
}

/** Dá baixa (pay) ou estorna (unpay) um imposto/boleto e atualiza o painel. */
export function useTogglePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, paid }: { item: Pick<AgendaItemDTO, "type" | "id">; paid: boolean }) =>
      api(`${resourcePath(item)}/${paid ? "pay" : "unpay"}`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}
