import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { supplierInputSchema, supplierName, type SupplierDTO } from "@tributoleao/shared";
import { applyServerErrors } from "../../lib/forms";
import { useSaveSupplier } from "../../lib/suppliers";
import { Dialog } from "../../components/ui/Dialog";
import { Field } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";

type FormInput = z.input<typeof supplierInputSchema>;
type FormOutput = z.output<typeof supplierInputSchema>;

const CATEGORY_SUGGESTIONS = [
  "Aluguel",
  "Água e saneamento",
  "Contabilidade",
  "Energia",
  "Internet e Telefonia",
  "Manutenção",
  "Material de escritório",
  "Serviços",
  "Software",
];

// Só nome fantasia e categoria: razão social, CPF/CNPJ e contato de fornecedores
// antigos não são enviados, e a API os preserva.
const emptyForm: FormInput = { tradeName: "", category: "" };

function toFormValues(supplier: SupplierDTO): FormInput {
  return {
    // Fornecedor antigo sem nome fantasia: sugere a razão social
    tradeName: supplierName(supplier),
    category: supplier.category ?? "",
  };
}

type Props = {
  open: boolean;
  supplier: SupplierDTO | null; // null = novo fornecedor
  onClose: () => void;
};

export function SupplierFormDialog({ open, supplier, onClose }: Props) {
  const save = useSaveSupplier();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(supplierInputSchema), defaultValues: emptyForm });

  // Recarrega o formulário a cada abertura (novo ou edição de outro fornecedor)
  useEffect(() => {
    if (!open) return;
    reset(supplier ? toFormValues(supplier) : emptyForm);
    setFormError(null);
  }, [open, supplier, reset]);

  const onSubmit = handleSubmit((input) => {
    setFormError(null);
    save.mutate(
      { id: supplier?.id, input },
      {
        onSuccess: (saved) => {
          toast({ message: supplier ? "Fornecedor atualizado." : `“${supplierName(saved)}” cadastrado.` });
          onClose();
        },
        onError: (err) => setFormError(applyServerErrors(err, setError)),
      },
    );
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={supplier ? "Editar fornecedor" : "Novo fornecedor"}
      description="Campos com * são obrigatórios."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}

        <Field label="Nome fantasia *" placeholder="Ex.: Atacadão Central" error={errors.tradeName?.message} {...register("tradeName")} />
        <Field label="Categoria" list="supplier-categories" placeholder="Ex.: Energia" error={errors.category?.message} {...register("category")} />
        <datalist id="supplier-categories">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {supplier ? "Salvar alterações" : "Cadastrar fornecedor"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
