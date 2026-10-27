import type { SupplierDTO } from "@tributoleao/shared";
import { ApiError } from "../../lib/api";
import { useDeleteSupplier } from "../../lib/suppliers";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { useToast } from "../../components/ui/Toast";

export function DeleteSupplierDialog({ supplier, onClose }: { supplier: SupplierDTO | null; onClose: () => void }) {
  const remove = useDeleteSupplier();
  const toast = useToast();
  const blocked = (supplier?.boletoCount ?? 0) > 0;

  const close = () => {
    remove.reset();
    onClose();
  };

  const confirm = () => {
    if (!supplier) return;
    remove.mutate(supplier.id, {
      onSuccess: () => {
        toast({ message: `“${supplier.legalName}” excluído.` });
        close();
      },
    });
  };

  return (
    <Dialog open={supplier !== null} onClose={close} size="sm" title={blocked ? "Não é possível excluir" : "Excluir fornecedor?"}>
      {supplier && (
        <div className="space-y-5">
          {blocked ? (
            <p className="text-sm text-slate-600">
              <strong className="text-slate-800">{supplier.legalName}</strong> tem {supplier.boletoCount} boleto(s) vinculado(s). Para
              preservar o histórico de pagamentos, fornecedores com boletos não podem ser excluídos.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              <strong className="text-slate-800">{supplier.legalName}</strong> será excluído permanentemente. Esta ação não pode ser
              desfeita.
            </p>
          )}

          {remove.error && (
            <Alert>{remove.error instanceof ApiError ? remove.error.message : "Não foi possível excluir o fornecedor."}</Alert>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close}>
              {blocked ? "Entendi" : "Cancelar"}
            </Button>
            {!blocked && (
              <Button variant="danger" onClick={confirm} loading={remove.isPending}>
                Excluir
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
