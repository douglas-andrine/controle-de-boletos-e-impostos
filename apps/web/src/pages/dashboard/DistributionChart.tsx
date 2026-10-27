import { useState } from "react";
import { formatBRL, type DashboardStatsDTO } from "@tributoleao/shared";
import { formatMonthName, formatPercent } from "../../lib/format";

// Parte-de-um-todo com 2 categorias: barra empilhada horizontal (não pizza de 2 fatias).
// Identidade nunca só pela cor: rótulos diretos + legenda em tabela com os valores.

type Segment = { key: string; label: string; cents: number; percent: number; colorClass: string };

const MIN_LABEL_PERCENT = 12; // abaixo disso o rótulo direto não cabe; a tabela abaixo cobre

export function DistributionChart({ stats }: { stats: DashboardStatsDTO }) {
  const { distribution, month } = stats;
  const [active, setActive] = useState<string | null>(null);
  const total = distribution.taxesCents + distribution.boletosCents;

  const segments: Segment[] = [
    { key: "tax", label: "Impostos", cents: distribution.taxesCents, percent: distribution.taxesPercent, colorClass: "bg-series-tax" },
    { key: "boleto", label: "Boletos", cents: distribution.boletosCents, percent: distribution.boletosPercent, colorClass: "bg-series-boleto" },
  ];
  const visible = segments.filter((s) => s.cents > 0);
  const activeSegment = segments.find((s) => s.key === active);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <header>
        <h2 className="font-semibold text-navy">Impostos vs. boletos</h2>
        <p className="text-xs text-slate-500">Distribuição dos vencimentos de {formatMonthName(month)}</p>
      </header>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Nenhum lançamento com vencimento neste mês.</p>
      ) : (
        <>
          {/* Rótulos diretos acima de cada segmento */}
          <div className="mt-6 flex gap-0.5 text-xs text-slate-600" aria-hidden>
            {visible.map((s) => (
              <span key={s.key} style={{ width: `${s.percent}%` }} className="truncate first:text-left last:text-right">
                {s.percent >= MIN_LABEL_PERCENT && (
                  <>
                    {s.label} <span className="font-semibold text-slate-800">{formatPercent(s.percent)}</span>
                  </>
                )}
              </span>
            ))}
          </div>

          <div className="relative mt-1.5">
            {/* gap-0.5 = 2px de respiro entre os segmentos; pontas externas arredondadas */}
            <div className="flex h-5 gap-0.5" role="img" aria-label={segments.map((s) => `${s.label} ${formatPercent(s.percent)}`).join(", ")}>
              {visible.map((s) => (
                <div
                  key={s.key}
                  tabIndex={0}
                  onMouseEnter={() => setActive(s.key)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(s.key)}
                  onBlur={() => setActive(null)}
                  style={{ width: `${s.percent}%` }}
                  className={`${s.colorClass} h-full cursor-default transition-opacity first:rounded-l last:rounded-r focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                    active && active !== s.key ? "opacity-40" : ""
                  }`}
                />
              ))}
            </div>

            {activeSegment && (
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-lg bg-navy px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
                style={{
                  left: `${activeSegment.key === "tax" ? activeSegment.percent / 2 : 100 - activeSegment.percent / 2}%`,
                }}
              >
                <p className="font-semibold">{activeSegment.label}</p>
                <p>
                  {formatBRL(activeSegment.cents)} · {formatPercent(activeSegment.percent)}
                </p>
              </div>
            )}
          </div>

          {/* Legenda + visão em tabela (também cobre segmentos pequenos demais para rótulo) */}
          <table className="mt-6 w-full text-sm">
            <caption className="sr-only">Valores por categoria em {formatMonthName(month)}</caption>
            <thead className="sr-only">
              <tr>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {segments.map((s) => (
                <tr key={s.key}>
                  <td className="py-2">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span className={`size-3 rounded-sm ${s.colorClass}`} aria-hidden />
                      {s.label}
                    </span>
                  </td>
                  <td className="py-2 text-right text-slate-800 tabular-nums">{formatBRL(s.cents)}</td>
                  <td className="w-16 py-2 text-right text-slate-500 tabular-nums">{formatPercent(s.percent)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-medium text-slate-700">Total</td>
                <td className="py-2 text-right font-semibold text-slate-800 tabular-nums">{formatBRL(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
