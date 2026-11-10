import { useState } from "react";
import { formatBRL, type MonthSeriesPointDTO } from "@tributoleao/shared";
import { formatCompactBRL, formatMonth, formatMonthAbbr } from "../../lib/format";
import { DashboardCard } from "./DashboardCard";

// Barras empilhadas por mês: impostos na base, boletos em cima, com 2px de respiro
// entre os segmentos. Um só eixo (valor); legenda + tabela para não depender da cor.

const PLOT_HEIGHT = 176; // px; o eixo x fica fora dessa altura
const TICKS = 4;

/** Topo "redondo" do eixo: 1, 2, 2,5 ou 5 × 10ⁿ acima do maior valor. */
function niceMax(value: number) {
  if (value <= 0) return 100_00;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

const SERIES = [
  { key: "taxesCents", label: "Impostos", colorClass: "bg-series-tax" },
  { key: "boletosCents", label: "Boletos", colorClass: "bg-series-boleto" },
] as const;

type MonthlyChartProps = { points: MonthSeriesPointDTO[]; selected: string; onSelect: (month: string) => void };

export function MonthlyChart({ points, selected, onSelect }: MonthlyChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const totals = points.map((p) => p.taxesCents + p.boletosCents);
  const max = niceMax(Math.max(...totals));
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (max / TICKS) * (TICKS - i));
  const year = selected.slice(0, 4);
  const yearTotal = totals.reduce((a, b) => a + b, 0);
  const active = points.find((p) => p.month === hovered);

  return (
    <DashboardCard title="Vencimentos por mês" subtitle={`Impostos e boletos que vencem em cada mês de ${year} · total ${formatBRL(yearTotal)}`}>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-sm ${s.colorClass}`} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        {/* Eixo y: valores compactos alinhados às linhas de grade */}
        <div className="relative w-16 shrink-0 text-right text-[11px] text-slate-500 tabular-nums" style={{ height: PLOT_HEIGHT }} aria-hidden>
          {ticks.map((t, i) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: (PLOT_HEIGHT / TICKS) * i }}>
              {formatCompactBRL(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((t, i) => (
              <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (PLOT_HEIGHT / TICKS) * i }} aria-hidden />
            ))}

            <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
              {points.map((p) => {
                const total = p.taxesCents + p.boletosCents;
                const isSelected = p.month === selected;
                return (
                  <button
                    key={p.month}
                    type="button"
                    onClick={() => onSelect(p.month)}
                    onMouseEnter={() => setHovered(p.month)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(p.month)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${formatMonth(p.month)}: ${formatBRL(total)}. Ver este mês`}
                    aria-pressed={isSelected}
                    className={`flex h-full flex-1 flex-col justify-end rounded-md px-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-navy sm:px-1.5 ${
                      isSelected ? "bg-navy/5" : "hover:bg-slate-50"
                    } ${hovered && hovered !== p.month ? "opacity-50" : ""}`}
                  >
                    {/* Boletos em cima, impostos na base; 2px entre eles; ponta superior arredondada */}
                    {p.boletosCents > 0 && (
                      <span
                        className={`block w-full bg-series-boleto ${p.taxesCents > 0 ? "mb-0.5" : ""} rounded-t`}
                        style={{ height: (p.boletosCents / max) * PLOT_HEIGHT }}
                      />
                    )}
                    {p.taxesCents > 0 && (
                      <span
                        className={`block w-full bg-series-tax ${p.boletosCents > 0 ? "" : "rounded-t"}`}
                        style={{ height: (p.taxesCents / max) * PLOT_HEIGHT }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {active && (
              <div
                role="tooltip"
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-navy px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
                style={{ left: `${Math.min(88, Math.max(12, ((points.indexOf(active) + 0.5) / points.length) * 100))}%` }}
              >
                <p className="font-semibold first-letter:uppercase">{formatMonth(active.month)}</p>
                {SERIES.map((s) => (
                  <p key={s.key} className="flex items-center gap-1.5 tabular-nums">
                    <span className={`size-2 rounded-sm ${s.colorClass}`} aria-hidden />
                    {s.label}: {formatBRL(active[s.key])}
                  </p>
                ))}
                <p className="mt-0.5 border-t border-white/20 pt-0.5 font-semibold tabular-nums">
                  Total: {formatBRL(active.taxesCents + active.boletosCents)}
                </p>
              </div>
            )}
          </div>

          {/* Eixo x: mês, com o selecionado em destaque */}
          <div className="mt-1.5 flex gap-1 sm:gap-2" aria-hidden>
            {points.map((p) => (
              <span
                key={p.month}
                className={`flex-1 text-center text-[11px] ${p.month === selected ? "font-semibold text-navy" : "text-slate-500"}`}
              >
                {formatMonthAbbr(p.month)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Vencimentos por mês em {year}</caption>
        <thead>
          <tr>
            <th>Mês</th>
            <th>Impostos</th>
            <th>Boletos</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.month}>
              <td>{formatMonth(p.month)}</td>
              <td>{formatBRL(p.taxesCents)}</td>
              <td>{formatBRL(p.boletosCents)}</td>
              <td>{formatBRL(totals[i]!)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardCard>
  );
}
