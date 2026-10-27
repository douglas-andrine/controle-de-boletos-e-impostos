import type { ReactNode } from "react";
import { CalendarClock, Landmark, Receipt, Wallet } from "lucide-react";
import { formatBRL, type DashboardStatsDTO } from "@tributoleao/shared";
import { formatDate, formatDueDistance, formatMonthName } from "../../lib/format";

type KpiCardProps = {
  label: string;
  Icon: typeof Wallet;
  value: ReactNode;
  detail: ReactNode;
  highlight?: boolean;
};

function KpiCard({ label, Icon, value, detail, highlight }: KpiCardProps) {
  return (
    <div className={`rounded-lg border bg-white p-5 ${highlight ? "border-gold ring-1 ring-gold/40" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className="rounded-lg bg-surface p-2">
          <Icon className="size-4 text-navy" aria-hidden />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-navy">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

export function KpiCards({ stats }: { stats: DashboardStatsDTO }) {
  const { monthTotals, taxesYearToDate, pendingBoletos, nextDue } = stats;
  const urgent = nextDue !== null && nextDue.daysUntilDue <= 3;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label={`A pagar em ${formatMonthName(stats.month)}`}
        Icon={Wallet}
        value={formatBRL(monthTotals.pendingCents)}
        detail={`${formatBRL(monthTotals.paidCents)} pagos de ${formatBRL(monthTotals.totalCents)}`}
      />
      <KpiCard
        label={`Impostos em ${taxesYearToDate.year}`}
        Icon={Landmark}
        value={formatBRL(taxesYearToDate.totalCents)}
        detail={`${formatBRL(taxesYearToDate.paidCents)} pagos · ${formatBRL(taxesYearToDate.pendingCents)} pendentes`}
      />
      <KpiCard
        label="Boletos pendentes"
        Icon={Receipt}
        value={pendingBoletos.count}
        detail={
          <>
            {formatBRL(pendingBoletos.totalCents)}
            {pendingBoletos.overdueCount > 0 && (
              <span className="font-medium text-danger"> · {pendingBoletos.overdueCount} atrasado(s)</span>
            )}
          </>
        }
      />
      <KpiCard
        label="Próximo vencimento"
        Icon={CalendarClock}
        highlight={urgent}
        value={nextDue ? formatBRL(nextDue.amountCents) : "—"}
        detail={
          nextDue ? (
            <>
              <span className="font-medium text-slate-700">{nextDue.title}</span> ·{" "}
              <span className={urgent ? "font-medium text-navy" : undefined}>{formatDueDistance(nextDue.daysUntilDue)}</span>{" "}
              ({formatDate(nextDue.dueDate)})
            </>
          ) : (
            "Nenhum pagamento pendente"
          )
        }
      />
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-[124px] animate-pulse rounded-lg border border-slate-200 bg-white" />
      ))}
    </div>
  );
}
