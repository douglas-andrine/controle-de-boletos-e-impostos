// Entrega da mercadoria, comum a impostos e boletos: depois do pagamento há um
// prazo para a mercadoria chegar (DELIVERY_DEADLINE_DAYS).
import type { FocusEventHandler } from "react";
import { Clock, PackageCheck, PackageX, TriangleAlert, Truck } from "lucide-react";
import { DELIVERY_DEADLINE_DAYS, type DeliveryStatus } from "@tributoleao/shared";
import { daysUntil, formatDate } from "../lib/format";
import { SelectField } from "./ui/SelectField";

// Filtro de entrega na URL: ?entrega=sim|nao|atrasada
export const DELIVERY_FILTERS = [
  { value: "sim", label: "Mercadoria entregue", chip: "entregue" },
  { value: "nao", label: "Não entregue", chip: "não entregue" },
  { value: "atrasada", label: `Entrega atrasada (+${DELIVERY_DEADLINE_DAYS} dias)`, chip: "atrasada" },
] as const;
export type DeliveryFilter = (typeof DELIVERY_FILTERS)[number];

/** Lê o filtro da URL e o traduz nos parâmetros da API. */
export function parseDeliveryFilter(param: string | null) {
  const delivery = DELIVERY_FILTERS.find((f) => f.value === param);
  return {
    delivery,
    goodsDelivered: delivery?.value === "sim" ? true : delivery?.value === "nao" ? false : undefined,
    deliveryLate: delivery?.value === "atrasada",
  };
}

const URGENT_DELIVERY_DAYS = 3; // a partir daqui o prazo de entrega fica em destaque

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** "Faltam 3 dias", "Vence hoje"… para o prazo de entrega. */
function formatDeliveryCountdown(days: number) {
  if (days === 0) return "Vence hoje";
  return days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`;
}

type DeliveryInfo = { deliveryStatus: DeliveryStatus | null; deliveryDeadline: string | null };

/** Situação da entrega da mercadoria, com o prazo contado a partir do pagamento. */
export function DeliveryCell({ item }: { item: DeliveryInfo }) {
  const { deliveryStatus, deliveryDeadline } = item;
  if (deliveryStatus === null) return <span className="text-slate-400">—</span>;

  if (deliveryStatus === "ENTREGUE") {
    return (
      <span className={`${pill} bg-emerald-brand/10 text-emerald-brand`}>
        <PackageCheck className="size-3.5" aria-hidden />
        Entregue
      </span>
    );
  }

  // Ainda não pago: o prazo só começa a contar na baixa
  if (!deliveryDeadline) {
    return (
      <div>
        <span className={`${pill} bg-slate-100 text-slate-700`}>
          <PackageX className="size-3.5" aria-hidden />
          Não entregue
        </span>
        <p className="mt-0.5 text-xs text-slate-500">prazo conta após o pagamento</p>
      </div>
    );
  }

  const days = daysUntil(deliveryDeadline);
  if (deliveryStatus === "ATRASADA") {
    return (
      <div title={`Prazo era ${formatDate(deliveryDeadline)}`}>
        <span className={`${pill} bg-danger/10 text-danger`}>
          <TriangleAlert className="size-3.5" aria-hidden />
          Atrasada
        </span>
        <p className="mt-0.5 text-xs font-medium text-danger">{-days === 1 ? "há 1 dia" : `há ${-days} dias`}</p>
      </div>
    );
  }

  const urgent = days <= URGENT_DELIVERY_DAYS;
  const Icon = urgent ? Clock : Truck;
  return (
    <div title={`Entregar até ${formatDate(deliveryDeadline)}`}>
      <span className={`${pill} ${urgent ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
        <Icon className="size-3.5" aria-hidden />
        {formatDeliveryCountdown(days)}
      </span>
      <p className="mt-0.5 text-xs text-slate-500 tabular-nums">até {formatDate(deliveryDeadline).slice(0, 5)}</p>
    </div>
  );
}

/** Ação principal de um item pago e não entregue: mostra a situação; o clique registra a entrega. */
export function NotDeliveredButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-danger hover:bg-danger/10"
      aria-label={`Mercadoria de ${label} não entregue: marcar como entregue`}
      title="Clique para marcar como entregue"
    >
      <PackageX className="size-4" aria-hidden />
      Não entregue
    </button>
  );
}

type DeliverySelectProps = {
  name: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
  onBlur: FocusEventHandler<HTMLSelectElement>;
};

/** Campo "Mercadoria entregue?" dos formulários; vazio = não se aplica. */
export function DeliverySelect({ name, value, onChange, onBlur }: DeliverySelectProps) {
  return (
    <SelectField
      label="Mercadoria entregue?"
      name={name}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
      onBlur={onBlur}
    >
      <option value="">Não se aplica</option>
      <option value="true">Sim, entregue</option>
      <option value="false">Não, ainda não entregue</option>
    </SelectField>
  );
}
