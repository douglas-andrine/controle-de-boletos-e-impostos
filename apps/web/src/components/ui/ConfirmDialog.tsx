import type { ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Alert } from "./Alert";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  danger?: boolean;
};

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onClose, loading, error, danger }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="text-sm text-slate-600">{children}</div>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
