import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { boletoInputSchema, supplierName, type BoletoDTO } from "@tributoleao/shared";
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

// Só fornecedor, nota, vencimento e valor: descrição, juros, emissão e linha
// digitável de boletos antigos não são enviados, e a API os preserva.
const emptyForm = (supplierId = ""): FormInput => ({ supplierId, invoiceNumber: "", dueDate: "", amountCents: 0 });

function toFormValues(b: BoletoDTO): FormInput {
  return { supplierId: b.supplier.id, invoiceNumber: b.invoiceNumber ?? "", dueDate: b.dueDate, amountCents: b.amountCents };
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
                {supplierName(s)}
              </option>
            ))}
          </SelectField>

          {/* "Nota fiscal" e não "Número": evita o Chrome tratar o campo como cartão */}
          <Field
            label="Nota fiscal"
            placeholder="Ex.: 123456"
            autoComplete="off"
            error={errors.invoiceNumber?.message}
            {...register("invoiceNumber")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vencimento *" type="date" error={errors.dueDate?.message} {...register("dueDate")} />
            <Controller
              control={control}
              name="amountCents"
              render={({ field }) => (
                <MoneyField label="Valor *" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.amountCents?.message} />
              )}
            />
          </div>

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
