import { useEffect, useState } from "react";
import { formatBRL, todayISO } from "@tributoleao/shared";
import { Dialog } from "./ui/Dialog";
import { Field } from "./ui/Field";
import { Button } from "./ui/Button";
import { Alert } from "./ui/Alert";

type PayDialogProps = {
  item: { title: string; amountCents: number } | null;
  onConfirm: (paidAt: string) => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
};

/** Registro de pagamento com data editável (padrão: hoje), para baixas feitas depois. */
export function PayDialog({ item, onConfirm, onClose, loading, error }: PayDialogProps) {
  const [paidAt, setPaidAt] = useState(todayISO());

  useEffect(() => {
    if (item) setPaidAt(todayISO());
  }, [item]);

  return (
    <Dialog open={item !== null} onClose={onClose} title="Registrar pagamento" size="sm">
      {item && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (paidAt) onConfirm(paidAt);
          }}
        >
          <p className="text-sm text-slate-600">
            <strong className="text-slate-800">{item.title}</strong> · {formatBRL(item.amountCents)}
          </p>
          <Field
            label="Data do pagamento"
            type="date"
            value={paidAt}
            max={todayISO()}
            required
            onChange={(e) => setPaidAt(e.target.value)}
          />
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading} disabled={!paidAt}>
              Confirmar pagamento
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
