import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import type { EffectiveStatus } from "@tributoleao/shared";

// Status sempre com ícone + texto: nunca só a cor
const styles: Record<EffectiveStatus, { label: string; className: string; Icon: typeof Clock }> = {
  PAGO: { label: "Pago", className: "bg-emerald-brand/10 text-emerald-brand", Icon: CircleCheck },
  PENDENTE: { label: "Pendente", className: "bg-slate-100 text-slate-700", Icon: Clock },
  ATRASADO: { label: "Atrasado", className: "bg-danger/10 text-danger", Icon: CircleAlert },
};

export function StatusBadge({ status }: { status: EffectiveStatus }) {
  const { label, className, Icon } = styles[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
