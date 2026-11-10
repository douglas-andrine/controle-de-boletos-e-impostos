// Peças comuns às listagens de impostos e boletos (contas a pagar).
import type { ReactNode } from "react";
import { CircleCheckBig, Ellipsis, Pencil, Trash2, Undo2 } from "lucide-react";
import type { EffectiveStatus } from "@tributoleao/shared";
import { daysUntil, formatDate, formatDueDistance } from "../lib/format";
import { CopyButton } from "./CopyButton";
import { Menu, type MenuItem } from "./ui/Menu";

const STATUS_TABS: { value: EffectiveStatus | undefined; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "ATRASADO", label: "Atrasados" },
  { value: "PAGO", label: "Pagos" },
];

export function StatusTabs({ value, onChange }: { value?: EffectiveStatus; onChange: (status?: EffectiveStatus) => void }) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-card p-1" role="group" aria-label="Filtrar por status">
      {STATUS_TABS.map((tab) => (
        <button
          key={tab.label}
          type="button"
          onClick={() => onChange(tab.value)}
          aria-pressed={value === tab.value}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            value === tab.value ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

type DueCellProps = { dueDate: string; status: EffectiveStatus; paidAt: string | null };

export function DueCell({ dueDate, status, paidAt }: DueCellProps) {
  return (
    <div>
      <p className="text-slate-700 tabular-nums">{formatDate(dueDate)}</p>
      {status === "PAGO" && paidAt ? (
        <p className="text-xs text-slate-500">pago em {formatDate(paidAt)}</p>
      ) : (
        <p className={`text-xs ${status === "ATRASADO" ? "font-medium text-danger" : "text-slate-500"}`}>
          {formatDueDistance(daysUntil(dueDate))}
        </p>
      )}
    </div>
  );
}

type PayableActionsProps = {
  label: string; // nome do item, para os rótulos acessíveis
  status: EffectiveStatus;
  paymentCode: string | null;
  onPay: () => void;
  onUnpay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Ação principal quando já está pago (ex.: marcar entrega); sem ela, só o menu. */
  paidAction?: ReactNode;
  /** Itens extras do menu, antes de Editar. */
  menuItems?: MenuItem[];
};

/** Só a ação da etapa atual fica visível; editar, estornar e excluir ficam no menu ⋯. */
export function PayableActions({ label, status, paymentCode, onPay, onUnpay, onEdit, onDelete, paidAction, menuItems = [] }: PayableActionsProps) {
  const paid = status === "PAGO";
  return (
    <div className="flex items-center justify-end gap-1">
      {paymentCode && !paid && <CopyButton value={paymentCode} />}
      {paid ? (
        paidAction
      ) : (
        <button
          type="button"
          onClick={onPay}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-brand px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white hover:bg-emerald-brand/90"
        >
          <CircleCheckBig className="size-4" aria-hidden />
          Dar baixa
        </button>
      )}
      <Menu
        trigger={<Ellipsis className="size-4" />}
        triggerLabel={`Mais ações de ${label}`}
        triggerClassName="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-heading"
        items={[
          ...menuItems,
          { label: "Editar", Icon: Pencil, onSelect: onEdit },
          ...(paid ? [{ label: "Estornar pagamento", Icon: Undo2, onSelect: onUnpay }] : []),
          { label: "Excluir", Icon: Trash2, onSelect: onDelete, danger: true },
        ]}
      />
    </div>
  );
}
