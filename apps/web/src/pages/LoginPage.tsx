import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlayCircle } from "lucide-react";
import { loginSchema, type LoginInput } from "@tributoleao/shared";
import { useDemoLogin, useLogin, useSlowRequest } from "../lib/auth";
import { applyServerErrors } from "../lib/forms";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

  const login = useLogin();
  const demo = useDemoLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const slow = useSlowRequest(login.isPending || demo.isPending);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSuccess = () => navigate(redirectTo, { replace: true });
  const onError = (err: unknown) => setFormError(applyServerErrors(err, setError));

  const onSubmit = handleSubmit((data) => {
    setFormError(null);
    login.mutate(data, { onSuccess, onError });
  });

  const enterDemo = () => {
    setFormError(null);
    demo.mutate(undefined, { onSuccess, onError });
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-navy">Bem-vindo de volta</h1>
      <p className="mt-1 text-sm text-slate-500">Entre para acompanhar seus vencimentos.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {formError && <Alert>{formError}</Alert>}
        {slow && <Alert tone="info">Acordando o servidor… no plano gratuito isso pode levar até 1 minuto.</Alert>}

        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Field
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" className="w-full" loading={login.isPending} disabled={demo.isPending}>
          Entrar
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        ou
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Button variant="gold" className="w-full" onClick={enterDemo} loading={demo.isPending} disabled={login.isPending}>
        {!demo.isPending && <PlayCircle className="size-4" aria-hidden />}
        Entrar como demonstração
      </Button>
      <p className="mt-2 text-center text-xs text-slate-400">Explore o sistema com dados fictícios, sem cadastro.</p>

      <p className="mt-8 text-center text-sm text-slate-600">
        Não tem conta?{" "}
        <Link to="/cadastro" className="font-medium text-emerald-brand hover:underline">
          Criar conta
        </Link>
      </p>
    </>
  );
}
