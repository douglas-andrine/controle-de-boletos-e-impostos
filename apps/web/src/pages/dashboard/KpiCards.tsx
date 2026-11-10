import type { ReactNode } from "react";
import { ArrowRight, CalendarRange, CircleCheckBig, Landmark, Receipt, Wallet } from "lucide-react";
import { formatBRL, type DashboardStatsDTO } from "@tributoleao/shared";
import { formatDueDistance, formatMonthName, formatPercent } from "../../lib/format";

type FlowCardProps = { label: string; Icon: typeof Wallet; value: ReactNode; detail: ReactNode; accent?: boolean };

/** Cartão do fluxo do mês; o valor fica em tinta de texto, a cor só no ícone e na borda. */
function FlowCard({ label, Icon, value, detail, accent }: FlowCardProps) {
  return (
    <div className={`flex-1 rounded-xl bg-white p-4 text-slate-800 shadow-sm ${accent ? "ring-2 ring-emerald-brand" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className={`size-4 ${accent ? "text-emerald-brand" : "text-navy"}`} aria-hidden />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold text-navy">{value}</p>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <span className="hidden shrink-0 items-center text-white/60 md:flex" aria-hidden>
      <ArrowRight className="size-5" />
    </span>
  );
}

/** Indicador menor, empilhado ao lado do fluxo. */
function MiniStat({ label, Icon, value, detail }: { label: string; Icon: typeof Wallet; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 text-slate-800 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="size-3.5 text-navy" aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-navy">{value}</p>
      <div className="text-xs text-slate-500">{detail}</div>
    </div>
  );
}

export function KpiCards({ stats }: { stats: DashboardStatsDTO }) {
  const { month, monthTotals, monthOverdue, taxesYearToDate, pendingBoletos, nextDue } = stats;

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_15rem]">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <FlowCard
          label={`Total de ${formatMonthName(month)}`}
          Icon={CalendarRange}
          value={formatBRL(monthTotals.totalCents)}
          detail="impostos e boletos que vencem no mês"
        />
        <FlowArrow />
        <FlowCard
          label="Pago"
          Icon={CircleCheckBig}
          accent
          value={formatBRL(monthTotals.paidCents)}
          detail={
            monthTotals.totalCents > 0
              ? `${formatPercent(Math.round((monthTotals.paidCents / monthTotals.totalCents) * 1000) / 10)} do total do mês`
              : "nada vence neste mês"
          }
        />
        <FlowArrow />
        <FlowCard
          label="A pagar"
          Icon={Wallet}
          value={formatBRL(monthTotals.pendingCents)}
          detail={
            monthOverdue.count > 0 ? (
              <span className="font-medium text-danger">
                {formatBRL(monthOverdue.totalCents)} já vencido ({monthOverdue.count})
              </span>
            ) : nextDue ? (
              <>
                próximo: <span className="font-medium text-slate-700">{nextDue.title}</span>, {formatDueDistance(nextDue.daysUntilDue)}
              </>
            ) : (
              "nenhum pagamento pendente"
            )
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MiniStat
          label="Boletos pendentes"
          Icon={Receipt}
          value={pendingBoletos.count}
          detail={
            <>
              {formatBRL(pendingBoletos.totalCents)}
              {pendingBoletos.overdueCount > 0 && <span className="font-medium text-danger"> · {pendingBoletos.overdueCount} atrasado(s)</span>}
            </>
          }
        />
        <MiniStat
          label={`Impostos em ${taxesYearToDate.year}`}
          Icon={Landmark}
          value={formatBRL(taxesYearToDate.totalCents)}
          detail={`${formatBRL(taxesYearToDate.paidCents)} pagos`}
        />
      </div>
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-[104px] animate-pulse rounded-xl bg-white/15" />
      ))}
    </div>
  );
}
