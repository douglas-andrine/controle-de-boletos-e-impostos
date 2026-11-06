import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { setPasswordSchema } from "@tributoleao/shared";
import { applyServerErrors } from "../lib/forms";
import { useSetPassword } from "../lib/auth";
import { Dialog } from "./ui/Dialog";
import { Field } from "./ui/Field";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Alert";
import { useToast } from "./ui/Toast";

// Confirmação só existe no front; a senha atual é obrigatória para quem já tem uma
const formSchema = (hasPassword: boolean) =>
  setPasswordSchema
    .extend({ confirmPassword: z.string() })
    .refine((d) => !hasPassword || !!d.currentPassword, { path: ["currentPassword"], message: "Informe a senha atual" })
    .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem" });

type FormInput = z.input<ReturnType<typeof formSchema>>;
type FormOutput = z.output<ReturnType<typeof formSchema>>;

const emptyForm: FormInput = { currentPassword: "", password: "", confirmPassword: "" };

/** Define a senha de quem entrou só pelo Google, ou troca a senha atual. */
export function PasswordDialog({ open, onClose, hasPassword }: { open: boolean; onClose: () => void; hasPassword: boolean }) {
  const setPassword = useSetPassword();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(formSchema(hasPassword)), defaultValues: emptyForm });

  useEffect(() => {
    if (!open) return;
    reset(emptyForm);
    setFormError(null);
  }, [open, reset]);

  const onSubmit = handleSubmit(({ confirmPassword: _, currentPassword, password }) => {
    setFormError(null);
    setPassword.mutate(hasPassword ? { currentPassword, password } : { password }, {
      onSuccess: () => {
        toast({ message: hasPassword ? "Senha alterada." : "Senha definida. Agora você também entra com email e senha." });
        onClose();
      },
      onError: (err) => setFormError(applyServerErrors(err, setError)),
    });
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={hasPassword ? "Alterar senha" : "Definir senha"}
      description={
        hasPassword
          ? "Informe a senha atual e escolha uma nova."
          : "Sua conta entra pelo Google. Com uma senha, você também pode entrar com email e senha."
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}

        {hasPassword && (
          <Field
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register("currentPassword")}
          />
        )}
        <Field
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          error={errors.password?.message}
          {...register("password")}
        />
        <Field
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={setPassword.isPending}>
            {hasPassword ? "Alterar senha" : "Definir senha"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
