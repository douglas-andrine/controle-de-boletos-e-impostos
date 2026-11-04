import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateUserInput, UserDTO } from "@tributoleao/shared";
import { api } from "./api";

/** Todos os usuários do sistema (só o admin acessa). */
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ data: UserDTO[] }>("/admin/users"),
    select: (res) => res.data,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api<UserDTO>("/admin/users", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
