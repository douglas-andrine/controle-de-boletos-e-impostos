import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { formatDocument, supplierInputSchema, type SupplierDTO } from "@tributoleao/shared";
import { ApiError } from "../../lib/api";
import { applyServerErrors } from "../../lib/forms";
import { maskDocument, maskPhone } from "../../lib/masks";
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

const emptyForm: FormInput = { legalName: "", tradeName: "", document: "", email: "", phone: "", category: "" };

function toFormValues(supplier: SupplierDTO): FormInput {
  return {
    legalName: supplier.legalName,
    tradeName: supplier.tradeName ?? "",
    document: formatDocument(supplier.document),
    email: supplier.email ?? "",
    phone: supplier.phone ? maskPhone(supplier.phone) : "",
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

  // Aplica a máscara antes de o react-hook-form ler o valor
  const withMask = (name: "document" | "phone", mask: (v: string) => string) => {
    const field = register(name);
    return {
      ...field,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = mask(e.target.value);
        return field.onChange(e);
      },
    };
  };

  const onSubmit = handleSubmit((input) => {
    setFormError(null);
    save.mutate(
      { id: supplier?.id, input },
      {
        onSuccess: (saved) => {
          toast({ message: supplier ? "Fornecedor atualizado." : `“${saved.legalName}” cadastrado.` });
          onClose();
        },
        onError: (err) => {
          // CPF/CNPJ duplicado: mostra o erro no próprio campo
          if (err instanceof ApiError && err.status === 409) {
            setError("document", { message: err.message });
            return;
          }
          setFormError(applyServerErrors(err, setError));
        },
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

        <Field label="Razão social *" error={errors.legalName?.message} {...register("legalName")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia" error={errors.tradeName?.message} {...register("tradeName")} />
          <Field
            label="CPF ou CNPJ *"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
            maxLength={18}
            error={errors.document?.message}
            {...withMask("document", maskDocument)}
          />
          <Field label="Email" type="email" placeholder="financeiro@empresa.com.br" error={errors.email?.message} {...register("email")} />
          <Field
            label="Telefone"
            type="tel"
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            maxLength={15}
            error={errors.phone?.message}
            {...withMask("phone", maskPhone)}
          />
        </div>
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
