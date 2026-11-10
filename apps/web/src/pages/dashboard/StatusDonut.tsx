import { useState } from "react";
import { CircleAlert, CircleCheckBig, Clock } from "lucide-react";
import { formatBRL, type DashboardStatsDTO } from "@tributoleao/shared";
import { formatMonthName, formatPercent } from "../../lib/format";
import { DashboardCard } from "./DashboardCard";

// Parte-de-um-todo com 3 estados: rosca. As cores são de status (pago = bom,
// atrasado = crítico, a pagar = neutro) e sempre vêm com ícone, rótulo e valor.

const RADIUS = 42;
const GAP = 1.2; // % da volta entre as fatias (o "respiro" de 2px)

export function StatusDonut({ stats }: { stats: DashboardStatsDTO }) {
  const [active, setActive] = useState<string | null>(null);
  const { monthTotals, monthOverdue, month } = stats;
  const total = monthTotals.totalCents;

  const segments = [
    { key: "pago", label: "Pago", cents: monthTotals.paidCents, Icon: CircleCheckBig, stroke: "stroke-emerald-brand", text: "text-emerald-brand" },
    {
      key: "aberto",
      label: "A pagar em dia",
      cents: monthTotals.pendingCents - monthOverdue.totalCents,
      Icon: Clock,
      stroke: "stroke-slate-500",
      text: "text-slate-500",
    },
    { key: "atrasado", label: "Atrasado", cents: monthOverdue.totalCents, Icon: CircleAlert, stroke: "stroke-danger", text: "text-danger" },
  ].map((s) => ({ ...s, percent: total === 0 ? 0 : (s.cents / total) * 100 }));

  const visible = segments.filter((s) => s.cents > 0);
  let offset = 0;
  const arcs = visible.map((s) => {
    const gap = visible.length > 1 ? GAP : 0;
    const arc = { ...s, dash: Math.max(s.percent - gap, 0.5), offset };
    offset += s.percent;
    return arc;
  });
  const center = segments.find((s) => s.key === active);

  return (
    <DashboardCard title="Situação do mês" tone="emerald" subtitle={`Como estão os vencimentos de ${formatMonthName(month)}`}>
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Nenhum lançamento com vencimento neste mês.</p>
      ) : (
        // Lado a lado quando o cartão ocupa a largura toda (antes do xl); na coluna estreita, a legenda vai embaixo
        <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col">
          <div className="relative size-40 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="11" className="stroke-slate-100" />
              {arcs.map((a) => (
                <circle
                  key={a.key}
                  cx="50"
                  cy="50"
                  r={RADIUS}
                  fill="none"
                  strokeWidth="11"
                  pathLength={100}
                  strokeDasharray={`${a.dash} ${100 - a.dash}`}
                  strokeDashoffset={-a.offset}
                  onMouseEnter={() => setActive(a.key)}
                  onMouseLeave={() => setActive(null)}
                  className={`${a.stroke} cursor-default transition-opacity ${active && active !== a.key ? "opacity-30" : ""}`}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-slate-500">{center ? center.label : "Total"}</span>
              <span className="text-sm font-semibold text-navy">{formatBRL(center ? center.cents : total)}</span>
              {center && <span className="text-[11px] text-slate-500">{formatPercent(Math.round(center.percent * 10) / 10)}</span>}
            </div>
          </div>

          <ul className="w-full space-y-1 text-sm">
            {segments.map((s) => (
              <li
                key={s.key}
                tabIndex={0}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.key)}
                onBlur={() => setActive(null)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-navy"
              >
                <s.Icon className={`size-4 shrink-0 ${s.text}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-slate-700">{s.label}</span>
                <span className="font-medium text-slate-800 tabular-nums">{formatBRL(s.cents)}</span>
                <span className="w-12 text-right text-xs text-slate-500 tabular-nums">{formatPercent(Math.round(s.percent * 10) / 10)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
