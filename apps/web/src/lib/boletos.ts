import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { BoletoDTO, BoletoInput, EffectiveStatus, Paginated } from "@tributoleao/shared";
import { api } from "./api";

export const BOLETOS_PAGE_SIZE = 15;

export type BoletoFilters = {
  page: number;
  status?: EffectiveStatus;
  supplierId?: string;
  dueMonth?: string; // AAAA-MM: vira o intervalo dueFrom/dueTo do mês
  search?: string;
};

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { dueFrom: `${month}-01`, dueTo: `${month}-${String(lastDay).padStart(2, "0")}` };
}

// Boletos afetam o dashboard e a contagem de boletos de cada fornecedor
const invalidate = (queryClient: QueryClient) =>
  Promise.all(["boletos", "dashboard", "suppliers"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

export function useBoletos({ page, status, supplierId, dueMonth, search }: BoletoFilters) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(BOLETOS_PAGE_SIZE) });
  if (status) params.set("status", status);
  if (supplierId) params.set("supplierId", supplierId);
  if (dueMonth) {
    const { dueFrom, dueTo } = monthRange(dueMonth);
    params.set("dueFrom", dueFrom);
    params.set("dueTo", dueTo);
  }
  if (search) params.set("search", search);

  return useQuery({
    queryKey: ["boletos", { page, status, supplierId, dueMonth, search }],
    queryFn: () => api<Paginated<BoletoDTO>>(`/boletos?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useSaveBoleto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: BoletoInput }) =>
      id
        ? api<BoletoDTO>(`/boletos/${id}`, { method: "PUT", body: input })
        : api<BoletoDTO>("/boletos", { method: "POST", body: input }),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteBoleto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/boletos/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(queryClient),
  });
}

/** `paidAt` definido dá baixa nessa data; `null` estorna o pagamento. */
export function useSetBoletoPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt: string | null }) =>
      paidAt
        ? api<BoletoDTO>(`/boletos/${id}/pay`, { method: "PATCH", body: { paidAt } })
        : api<BoletoDTO>(`/boletos/${id}/unpay`, { method: "PATCH" }),
    onSuccess: () => invalidate(queryClient),
  });
}
