import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { EffectiveStatus, Paginated, TaxDTO, TaxInput } from "@tributoleao/shared";
import { api } from "./api";

export const TAXES_PAGE_SIZE = 15;

export type TaxFilters = { page: number; status?: EffectiveStatus; referenceMonth?: string; search?: string };

// Baixas e edições mudam os KPIs: a lista e o dashboard são recarregados juntos
const invalidate = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["taxes"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);

export function useTaxes({ page, status, referenceMonth, search }: TaxFilters) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(TAXES_PAGE_SIZE) });
  if (status) params.set("status", status);
  if (referenceMonth) params.set("referenceMonth", referenceMonth);
  if (search) params.set("search", search);

  return useQuery({
    queryKey: ["taxes", { page, status, referenceMonth, search }],
    queryFn: () => api<Paginated<TaxDTO>>(`/taxes?${params}`),
    placeholderData: keepPreviousData,
  });
}

export function useSaveTax() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TaxInput }) =>
      id
        ? api<TaxDTO>(`/taxes/${id}`, { method: "PUT", body: input })
        : api<TaxDTO>("/taxes", { method: "POST", body: input }),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteTax() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/taxes/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(queryClient),
  });
}

/** `paidAt` definido dá baixa nessa data; `null` estorna o pagamento. */
export function useSetTaxPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt: string | null }) =>
      paidAt
        ? api<TaxDTO>(`/taxes/${id}/pay`, { method: "PATCH", body: { paidAt } })
        : api<TaxDTO>(`/taxes/${id}/unpay`, { method: "PATCH" }),
    onSuccess: () => invalidate(queryClient),
  });
}
