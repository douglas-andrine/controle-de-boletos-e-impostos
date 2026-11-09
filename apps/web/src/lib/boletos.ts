import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { BoletoDTO, BoletoInput, EffectiveStatus, Paginated } from "@tributoleao/shared";
import { api } from "./api";

export const BOLETOS_PAGE_SIZE = 15;

export type BoletoFilters = {
  page: number;
  status?: EffectiveStatus;
  supplierId?: string;
  dueMonth?: string; // AAAA-MM: vira o intervalo dueFrom/dueTo do mês
  dueDay?: number; // dia do mês em dueMonth: o intervalo vira só esse dia
  boletoReceived?: boolean;
  search?: string;
};

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const dayOf = (month: string, day: number) => `${month}-${String(day).padStart(2, "0")}`;

function dueRange(month: string, day?: number) {
  if (day) return { dueFrom: dayOf(month, day), dueTo: dayOf(month, day) };
  return { dueFrom: dayOf(month, 1), dueTo: dayOf(month, daysInMonth(month)) };
}

// Boletos afetam o dashboard e a contagem de boletos de cada fornecedor
const invalidate = (queryClient: QueryClient) =>
  Promise.all(["boletos", "dashboard", "suppliers"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

export function useBoletos({ page, status, supplierId, dueMonth, dueDay, boletoReceived, search }: BoletoFilters) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(BOLETOS_PAGE_SIZE) });
  if (status) params.set("status", status);
  if (supplierId) params.set("supplierId", supplierId);
  if (dueMonth) {
    const { dueFrom, dueTo } = dueRange(dueMonth, dueDay);
    params.set("dueFrom", dueFrom);
    params.set("dueTo", dueTo);
  }
  if (boletoReceived !== undefined) params.set("boletoReceived", String(boletoReceived));
  if (search) params.set("search", search);

  return useQuery({
    queryKey: ["boletos", { page, status, supplierId, dueMonth, dueDay, boletoReceived, search }],
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

export function useSetBoletoReceived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, received }: { id: string; received: boolean }) =>
      api<BoletoDTO>(`/boletos/${id}/received`, { method: "PATCH", body: { received } }),
    onSuccess: () => invalidate(queryClient),
  });
}
