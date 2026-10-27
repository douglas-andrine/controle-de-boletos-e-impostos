import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { TAX_NAMES, taxInputSchema, todayISO, type TaxDTO } from "@tributoleao/shared";
import { applyServerErrors } from "../../lib/forms";
import { shiftMonth } from "../../lib/format";
import { useSaveTax } from "../../lib/taxes";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { MoneyField } from "../../components/ui/MoneyField";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";

type FormInput = z.input<typeof taxInputSchema>;
type FormOutput = z.output<typeof taxInputSchema>;

function emptyForm(): FormInput {
  return {
    name: "",
    revenueCode: "",
    amountCents: 0,
    dueDate: "",
    // Tributos costumam ser apurados no mês anterior ao pagamento
    referenceMonth: shiftMonth(todayISO().slice(0, 7), -1),
    paymentCode: "",
  };
}

function toFormValues(tax: TaxDTO): FormInput {
  return {
    name: tax.name,
    revenueCode: tax.revenueCode ?? "",
    amountCents: tax.amountCents,
    dueDate: tax.dueDate,
    referenceMonth: tax.referenceMonth,
    paymentCode: tax.paymentCode ?? "",
  };
}

type Props = { open: boolean; tax: TaxDTO | null; onClose: () => void };

export function TaxFormDialog({ open, tax, onClose }: Props) {
  const save = useSaveTax();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(taxInputSchema), defaultValues: emptyForm() });

  useEffect(() => {
    if (!open) return;
    reset(tax ? toFormValues(tax) : emptyForm());
    setFormError(null);
  }, [open, tax, reset]);

  const onSubmit = handleSubmit((input) => {
    setFormError(null);
    save.mutate(
      { id: tax?.id, input },
      {
        onSuccess: (saved) => {
          toast({ message: tax ? "Imposto atualizado." : `${saved.name} cadastrado.` });
          onClose();
        },
        onError: (err) => setFormError(applyServerErrors(err, setError)),
      },
    );
  });

  return (
    <Dialog open={open} onClose={onClose} title={tax ? "Editar imposto" : "Novo imposto"} description="Campos com * são obrigatórios.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Imposto *" list="tax-names" placeholder="Ex.: DARF, DAS, IPTU" error={errors.name?.message} {...register("name")} />
          <datalist id="tax-names">
            {TAX_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Field label="Código de receita / guia" placeholder="Ex.: 0561" error={errors.revenueCode?.message} {...register("revenueCode")} />

          <Controller
            control={control}
            name="amountCents"
            render={({ field }) => (
              <MoneyField
                label="Valor *"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.amountCents?.message}
              />
            )}
          />
          <Field label="Vencimento *" type="date" error={errors.dueDate?.message} {...register("dueDate")} />
          <Field label="Período de apuração *" type="month" error={errors.referenceMonth?.message} {...register("referenceMonth")} />
        </div>

        <Field
          label="Código de barras / linha digitável / PIX copia e cola"
          placeholder="Cole aqui o código para pagamento"
          autoComplete="off"
          error={errors.paymentCode?.message}
          {...register("paymentCode")}
        />

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {tax ? "Salvar alterações" : "Cadastrar imposto"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
