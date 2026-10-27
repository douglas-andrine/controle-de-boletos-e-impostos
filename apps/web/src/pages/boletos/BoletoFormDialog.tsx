import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { boletoInputSchema, formatBRL, todayISO, type BoletoDTO } from "@tributoleao/shared";
import { applyServerErrors } from "../../lib/forms";
import { useSaveBoleto } from "../../lib/boletos";
import { useSupplierOptions } from "../../lib/suppliers";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { MoneyField } from "../../components/ui/MoneyField";
import { SelectField } from "../../components/ui/SelectField";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";

type FormInput = z.input<typeof boletoInputSchema>;
type FormOutput = z.output<typeof boletoInputSchema>;

const emptyForm = (supplierId = ""): FormInput => ({
  supplierId,
  description: "",
  amountCents: 0,
  feesCents: 0,
  issueDate: todayISO(),
  dueDate: "",
  barcode: "",
});

function toFormValues(b: BoletoDTO): FormInput {
  return {
    supplierId: b.supplier.id,
    description: b.description,
    amountCents: b.amountCents,
    feesCents: b.feesCents,
    issueDate: b.issueDate,
    dueDate: b.dueDate,
    barcode: b.barcode ?? "",
  };
}

type Props = {
  open: boolean;
  boleto: BoletoDTO | null;
  /** Fornecedor pré-selecionado em novos boletos (ex.: filtro ativo na listagem) */
  defaultSupplierId?: string;
  onClose: () => void;
};

export function BoletoFormDialog({ open, boleto, defaultSupplierId, onClose }: Props) {
  const save = useSaveBoleto();
  const toast = useToast();
  const suppliers = useSupplierOptions();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(boletoInputSchema), defaultValues: emptyForm() });

  useEffect(() => {
    if (!open) return;
    reset(boleto ? toFormValues(boleto) : emptyForm(defaultSupplierId));
    setFormError(null);
  }, [open, boleto, defaultSupplierId, reset]);

  const [amountCents = 0, feesCents = 0] = useWatch({ control, name: ["amountCents", "feesCents"] });

  const onSubmit = handleSubmit((input) => {
    setFormError(null);
    save.mutate(
      { id: boleto?.id, input },
      {
        onSuccess: () => {
          toast({ message: boleto ? "Boleto atualizado." : "Boleto cadastrado." });
          onClose();
        },
        onError: (err) => setFormError(applyServerErrors(err, setError)),
      },
    );
  });

  const noSuppliers = suppliers.data?.length === 0;

  return (
    <Dialog open={open} onClose={onClose} title={boleto ? "Editar boleto" : "Novo boleto"} description="Campos com * são obrigatórios.">
      {noSuppliers ? (
        <div className="space-y-4">
          <Alert tone="info">Cadastre um fornecedor antes de lançar boletos.</Alert>
          <div className="flex justify-end">
            <Link to="/fornecedores" onClick={onClose} className="text-sm font-medium text-emerald-brand hover:underline">
              Ir para Fornecedores →
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert>{formError}</Alert>}

          <SelectField label="Fornecedor *" error={errors.supplierId?.message} disabled={suppliers.isPending} {...register("supplierId")}>
            <option value="">{suppliers.isPending ? "Carregando…" : "Selecione o fornecedor"}</option>
            {suppliers.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.tradeName ? `${s.tradeName} — ${s.legalName}` : s.legalName}
              </option>
            ))}
          </SelectField>

          <Field label="Descrição *" placeholder="Ex.: Conta de energia de outubro" error={errors.description?.message} {...register("description")} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="amountCents"
              render={({ field }) => (
                <MoneyField label="Valor original *" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.amountCents?.message} />
              )}
            />
            <Controller
              control={control}
              name="feesCents"
              render={({ field }) => (
                <MoneyField label="Juros / multa" name={field.name} value={field.value ?? 0} onChange={field.onChange} onBlur={field.onBlur} error={errors.feesCents?.message} />
              )}
            />
            <Field label="Emissão *" type="date" error={errors.issueDate?.message} {...register("issueDate")} />
            <Field label="Vencimento *" type="date" error={errors.dueDate?.message} {...register("dueDate")} />
          </div>

          {feesCents > 0 && (
            <p className="rounded-lg bg-surface px-3 py-2 text-sm text-slate-600">
              Total a pagar: <strong className="text-slate-800 tabular-nums">{formatBRL(amountCents + feesCents)}</strong>
            </p>
          )}

          <Field
            label="Linha digitável / código de barras"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Cole aqui a linha digitável do boleto"
            error={errors.barcode?.message}
            {...register("barcode")}
          />

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {boleto ? "Salvar alterações" : "Cadastrar boleto"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
