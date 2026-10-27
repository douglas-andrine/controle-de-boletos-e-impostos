import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, RegisterInput } from "@tributoleao/shared";
import { api, ApiError } from "./api";

export type User = {
  id: string;
  name: string;
  email: string;
  provider: "LOCAL" | "GOOGLE";
};

export const DEMO_EMAIL = "demo@tributoleao.app";

const ME_KEY = ["auth", "me"] as const;

/** Usuário da sessão atual; `null` quando não há sessão (401). */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await api<{ user: User }>("/auth/me")).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: 1,
  });
}

function useSessionMutation<TInput>(request: (input: TInput) => Promise<{ user: User }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: ({ user }) => queryClient.setQueryData(ME_KEY, user),
  });
}

export const useLogin = () =>
  useSessionMutation((input: LoginInput) => api("/auth/login", { method: "POST", body: input }));

export const useRegister = () =>
  useSessionMutation((input: RegisterInput) => api("/auth/register", { method: "POST", body: input }));

export const useDemoLogin = () => useSessionMutation(() => api("/auth/demo", { method: "POST" }));

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, null);
    },
  });
}

/**
 * Fica `true` quando uma requisição demora mais que `delayMs`: o plano gratuito
 * do Render hiberna a API e o primeiro acesso pode levar até ~1 minuto.
 */
export function useSlowRequest(isPending: boolean, delayMs = 3000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [isPending, delayMs]);
  return slow;
}
