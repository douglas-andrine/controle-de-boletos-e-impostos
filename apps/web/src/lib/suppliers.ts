import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Paginated, SupplierDTO, SupplierInput } from "@tributoleao/shared";
import { api } from "./api";

export const SUPPLIERS_PAGE_SIZE = 10;

export function useSuppliers({ page, search }: { page: number; search: string }) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(SUPPLIERS_PAGE_SIZE) });
  if (search) params.set("search", search);

  return useQuery({
    queryKey: ["suppliers", { page, search }],
    queryFn: () => api<Paginated<SupplierDTO>>(`/suppliers?${params}`),
    placeholderData: keepPreviousData,
  });
}

/** Cria (sem id) ou atualiza (com id) um fornecedor. */
export function useSaveSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SupplierInput }) =>
      id
        ? api<SupplierDTO>(`/suppliers/${id}`, { method: "PUT", body: input })
        : api<SupplierDTO>("/suppliers", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}
