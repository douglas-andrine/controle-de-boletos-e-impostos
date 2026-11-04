import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createUserSchema } from "@tributoleao/shared";
import { applyServerErrors } from "../../lib/forms";
import { useCreateUser } from "../../lib/users";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";

type FormInput = z.input<typeof createUserSchema>;
type FormOutput = z.output<typeof createUserSchema>;

const emptyForm: FormInput = { name: "", email: "", password: "" };

export function UserFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateUser();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(createUserSchema), defaultValues: emptyForm });

  useEffect(() => {
    if (!open) return;
    reset(emptyForm);
    setFormError(null);
  }, [open, reset]);

  const onSubmit = handleSubmit((input) => {
    setFormError(null);
    create.mutate(input, {
      onSuccess: (user) => {
        toast({ message: `Usuário ${user.email} criado.` });
        onClose();
      },
      onError: (err) => setFormError(applyServerErrors(err, setError)),
    });
  });

  return (
    <Dialog open={open} onClose={onClose} title="Novo usuário" description="A pessoa entra com este email e senha.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}

        <Field label="Nome" autoComplete="off" error={errors.name?.message} {...register("name")} />
        <Field label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register("email")} />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Criar usuário
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
