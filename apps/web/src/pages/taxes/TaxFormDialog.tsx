import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Link } from "react-router";
import { TAX_NAMES, supplierName, taxInputSchema, todayISO, type TaxDTO } from "@tributoleao/shared";
import { applyServerErrors } from "../../lib/forms";
import { shiftMonth } from "../../lib/format";
import { useSaveTax } from "../../lib/taxes";
import { useSupplierOptions } from "../../lib/suppliers";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { MoneyField } from "../../components/ui/MoneyField";
import { SelectField } from "../../components/ui/SelectField";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";

type FormInput = z.input<typeof taxInputSchema>;
type FormOutput = z.output<typeof taxInputSchema>;

function emptyForm(): FormInput {
  return {
    name: "",
    amountCents: 0,
    dueDate: "",
    // Tributos costumam ser apurados no mês anterior ao pagamento
    referenceMonth: shiftMonth(todayISO().slice(0, 7), -1),
    invoiceNumber: "",
    supplierId: "",
    goodsDelivered: null,
  };
}

function toFormValues(tax: TaxDTO): FormInput {
  return {
    name: tax.name,
    amountCents: tax.amountCents,
    dueDate: tax.dueDate,
    referenceMonth: tax.referenceMonth,
    invoiceNumber: tax.invoiceNumber ?? "",
    supplierId: tax.supplier?.id ?? "",
    goodsDelivered: tax.goodsDelivered,
  };
}

const deliveryValue = (v: boolean | null | undefined) => (v == null ? "" : String(v));

type Props = { open: boolean; tax: TaxDTO | null; onClose: () => void };

export function TaxFormDialog({ open, tax, onClose }: Props) {
  const save = useSaveTax();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const suppliers = useSupplierOptions();

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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nota fiscal" placeholder="Ex.: 123456" autoComplete="off" error={errors.invoiceNumber?.message} {...register("invoiceNumber")} />
          <Controller
            control={control}
            name="goodsDelivered"
            render={({ field }) => (
              <SelectField
                label="Mercadoria entregue?"
                name={field.name}
                value={deliveryValue(field.value)}
                onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value === "true")}
                onBlur={field.onBlur}
              >
                <option value="">Não se aplica</option>
                <option value="true">Sim, entregue</option>
                <option value="false">Não, ainda não entregue</option>
              </SelectField>
            )}
          />

          <div className="sm:col-span-2">
            <SelectField label="Empresa (fornecedor)" disabled={suppliers.isPending} error={errors.supplierId?.message} {...register("supplierId")}>
              <option value="">{suppliers.isPending ? "Carregando…" : "Nenhuma"}</option>
              {suppliers.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {supplierName(s)}
                </option>
              ))}
            </SelectField>
            <p className="mt-1 text-xs text-slate-500">
              Não está na lista?{" "}
              <Link to="/fornecedores" onClick={onClose} className="font-medium text-emerald-brand hover:underline">
                Cadastre em Fornecedores
              </Link>
            </p>
          </div>
        </div>

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
