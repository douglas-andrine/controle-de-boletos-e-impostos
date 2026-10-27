import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { useCurrentUser, useSlowRequest } from "../lib/auth";
import { Button } from "./ui/Button";

function FullScreenLoader() {
  const slow = useSlowRequest(true);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center text-slate-500">
      <Loader2 className="size-8 animate-spin text-navy" aria-hidden />
      <p className="text-sm">
        {slow ? "Acordando o servidor… no plano gratuito isso pode levar até 1 minuto." : "Carregando…"}
      </p>
    </div>
  );
}

/** Rotas que exigem sessão: sem usuário, redireciona para /login guardando a origem. */
export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <FullScreenLoader />;
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-slate-600">Não foi possível conectar ao servidor.</p>
        <Button variant="navy" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}

/** Login e cadastro: quem já está logado vai direto para o app. */
export function GuestOnly() {
  const { data: user, isPending } = useCurrentUser();

  if (isPending) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}
