import { CircleCheckBig, Landmark, PartyPopper, Receipt } from "lucide-react";
import { formatBRL, type AgendaItemDTO } from "@tributoleao/shared";
import { formatDate, formatDueDistance } from "../../lib/format";
import { useTogglePaid } from "../../lib/dashboard";
import { StatusBadge } from "../../components/StatusBadge";
import { CopyButton } from "../../components/CopyButton";
import { useToast } from "../../components/ui/Toast";

function AgendaRow({ item }: { item: AgendaItemDTO }) {
  const togglePaid = useTogglePaid();
  const toast = useToast();
  const TypeIcon = item.type === "TAX" ? Landmark : Receipt;
  const overdue = item.status === "ATRASADO";

  const pay = () =>
    togglePaid.mutate(
      { item, paid: true },
      {
        onSuccess: () =>
          toast({
            message: `“${item.title}” marcado como pago.`,
            // Desfazer em vez de pedir confirmação: a ação é reversível
            action: { label: "Desfazer", onClick: () => togglePaid.mutate({ item, paid: false }) },
          }),
        onError: () => toast({ message: "Não foi possível registrar o pagamento.", tone: "error" }),
      },
    );

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-surface p-2" title={item.type === "TAX" ? "Imposto" : "Boleto"}>
          <TypeIcon className="size-4 text-slate-500" aria-hidden />
          <span className="sr-only">{item.type === "TAX" ? "Imposto" : "Boleto"}</span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
          <p className="truncate text-xs text-slate-500">{item.subtitle ?? "—"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-left sm:w-40 sm:text-right">
          <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatBRL(item.amountCents)}</p>
          <p className={`text-xs whitespace-nowrap ${overdue ? "font-medium text-danger" : "text-slate-500"}`}>
            <time dateTime={item.dueDate} title={formatDate(item.dueDate)}>
              {formatDate(item.dueDate).slice(0, 5)}
            </time>{" "}
            · {formatDueDistance(item.daysUntilDue)}
          </p>
        </div>
        <div className="sm:w-24">
          <StatusBadge status={item.status} />
        </div>
      </div>

      <div className="flex gap-2 sm:w-auto">
        {item.paymentCode && <CopyButton value={item.paymentCode} />}
        <button
          type="button"
          onClick={pay}
          disabled={togglePaid.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-brand/90 disabled:opacity-60"
        >
          <CircleCheckBig className="size-4" aria-hidden />
          Dar baixa
        </button>
      </div>
    </li>
  );
}

export function AgendaList({ items }: { items: AgendaItemDTO[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <header>
        <h2 className="font-semibold text-navy">Atrasados e próximos vencimentos</h2>
        <p className="text-xs text-slate-500">Pendências vencidas e o que vence nos próximos 15 dias</p>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
          <PartyPopper className="size-6 text-emerald-brand" aria-hidden />
          Tudo em dia! Nada vencido ou vencendo nos próximos 15 dias.
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {items.map((item) => (
            <AgendaRow key={`${item.type}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
