import { formatBRL, type DashboardStatsDTO } from "@tributoleao/shared";
import { formatMonthName, formatPercent } from "../../lib/format";

// Medidor em meio círculo: quanto do que vence no mês já foi pago. pathLength=100
// deixa o traço proporcional ao percentual sem calcular o comprimento do arco.
const ARC = "M 20 100 A 80 80 0 0 1 180 100";

export function PaidGauge({ stats }: { stats: DashboardStatsDTO }) {
  const { totalCents, paidCents } = stats.monthTotals;
  const percent = totalCents === 0 ? 0 : Math.round((paidCents / totalCents) * 1000) / 10;

  return (
    <div className="flex h-full flex-col rounded-xl bg-card p-4 text-slate-800 shadow-sm">
      <p className="text-center text-sm font-semibold text-heading">Pago em {formatMonthName(stats.month)}</p>
      <div className="relative mx-auto mt-2 w-full max-w-56">
        <svg viewBox="0 0 200 112" className="w-full" role="img" aria-label={`${formatPercent(percent)} do mês pago`}>
          <path d={ARC} pathLength={100} fill="none" strokeWidth={18} strokeLinecap="round" className="stroke-slate-200" />
          {percent > 0 && (
            <path
              d={ARC}
              pathLength={100}
              fill="none"
              strokeWidth={18}
              strokeLinecap="round"
              strokeDasharray={`${percent} 100`}
              className="stroke-emerald-brand transition-[stroke-dasharray] duration-500"
            />
          )}
        </svg>
        <p className="absolute inset-x-0 bottom-1 text-center text-2xl font-semibold text-heading">{formatPercent(percent)}</p>
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500 tabular-nums">
        <span>R$ 0</span>
        <span>{formatBRL(totalCents)}</span>
      </div>
      <p className="mt-auto pt-2 text-center text-xs text-slate-500">
        {formatBRL(paidCents)} pagos de {formatBRL(totalCents)}
      </p>
    </div>
  );
}
