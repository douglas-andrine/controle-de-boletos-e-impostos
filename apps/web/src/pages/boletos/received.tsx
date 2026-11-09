// Recebimento do boleto: o fornecedor manda junto com a nota ou é preciso buscá-lo
// no portal dele para imprimir. Não tem prazo próprio: o alerta é o atraso do pagamento.
import type { FocusEventHandler } from "react";
import { FileCheck, FileSearch } from "lucide-react";
import { SelectField } from "../../components/ui/SelectField";

// Filtro na URL: ?boleto=recebido|portal
export const RECEIVED_FILTERS = [
  { value: "recebido", label: "Boleto recebido" },
  { value: "portal", label: "Buscar no portal" },
] as const;

/** Lê o filtro da URL e o traduz no parâmetro da API. */
export function parseReceivedFilter(param: string | null) {
  const received = RECEIVED_FILTERS.find((f) => f.value === param);
  return { received, boletoReceived: received ? received.value === "recebido" : undefined };
}

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** "Recebido", ou o botão "Buscar no portal" que registra o recebimento. */
export function ReceivedCell({ received, label, onMarkReceived }: { received: boolean; label: string; onMarkReceived: () => void }) {
  if (received) {
    return (
      <span className={`${pill} bg-emerald-brand/10 text-emerald-brand`}>
        <FileCheck className="size-3.5" aria-hidden />
        Recebido
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onMarkReceived}
      className={`${pill} bg-amber-100 text-amber-800 hover:bg-amber-200`}
      aria-label={`Boleto de ${label} não recebido: marcar como recebido`}
      title="Clique quando tiver o boleto em mãos"
    >
      <FileSearch className="size-3.5" aria-hidden />
      Buscar no portal
    </button>
  );
}

type ReceivedSelectProps = {
  name: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  onBlur: FocusEventHandler<HTMLSelectElement>;
};

/** Campo "O boleto veio com a nota?" do formulário. */
export function ReceivedSelect({ name, value, onChange, onBlur }: ReceivedSelectProps) {
  return (
    <SelectField
      label="O boleto veio com a nota?"
      name={name}
      value={String(value ?? true)}
      onChange={(e) => onChange(e.target.value === "true")}
      onBlur={onBlur}
    >
      <option value="true">Sim, recebido</option>
      <option value="false">Não, buscar no portal do fornecedor</option>
    </SelectField>
  );
}
