import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerSchema } from "@tributoleao/shared";
import { useRegister, useSlowRequest } from "../lib/auth";
import { applyServerErrors } from "../lib/forms";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";

// Confirmação de senha só existe no front; a API recebe o registerSchema puro
const formSchema = registerSchema
  .extend({ confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const registerUser = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  const slow = useSlowRequest(registerUser.isPending);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(formSchema) });

  const onSubmit = handleSubmit(({ confirmPassword: _, ...data }) => {
    setFormError(null);
    registerUser.mutate(data, {
      onSuccess: () => navigate("/", { replace: true }),
      onError: (err) => setFormError(applyServerErrors(err, setError)),
    });
  });

  return (
    <>
      <h1 className="text-2xl font-semibold text-navy">Criar conta</h1>
      <p className="mt-1 text-sm text-slate-500">Comece a organizar boletos e impostos em minutos.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        {formError && <Alert>{formError}</Alert>}
        {slow && <Alert tone="info">Acordando o servidor… no plano gratuito isso pode levar até 1 minuto.</Alert>}

        <Field label="Nome" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          error={errors.password?.message}
          {...register("password")}
        />
        <Field
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <Button type="submit" className="w-full" loading={registerUser.isPending}>
          Criar conta
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Já tem conta?{" "}
        <Link to="/login" className="font-medium text-emerald-brand hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
