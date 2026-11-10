import { Link } from "react-router";
import { formatBRL, type DashboardStatsDTO } from "@tributoleao/shared";
import { formatMonthName } from "../../lib/format";
import { DashboardCard } from "./DashboardCard";

// Uma só série (valor por fornecedor): uma cor só, barras horizontais ordenadas,
// rótulo de valor na ponta. A cor é a dos impostos+boletos juntos, então usa o navy.

export function SupplierBars({ stats }: { stats: DashboardStatsDTO }) {
  const { topSuppliers, month } = stats;
  const max = Math.max(...topSuppliers.map((s) => s.totalCents), 1);

  return (
    <DashboardCard title="Valor por fornecedor" subtitle={`Fornecedores com mais valor vencendo em ${formatMonthName(month)} (boletos e impostos)`}>
      {topSuppliers.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Nenhum fornecedor com vencimento neste mês.</p>
      ) : (
        <ul className="space-y-2.5">
          {topSuppliers.map((s) => (
            <li key={s.id}>
              <Link
                to={`/boletos?fornecedor=${s.id}&venc=${month}`}
                className="group grid grid-cols-[7rem_1fr] items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-heading sm:grid-cols-[9rem_1fr]"
                title={`${s.name}: ${formatBRL(s.totalCents)} em ${s.count} lançamento(s). Ver boletos`}
              >
                <span className="truncate text-right text-xs text-slate-600 group-hover:text-heading">{s.name}</span>
                <span className="flex items-center gap-3">
                  <span className="flex-1">
                    <span
                      className="block h-4 rounded-r bg-bar transition-opacity group-hover:opacity-80"
                      style={{ width: `${Math.max((s.totalCents / max) * 100, 2)}%` }}
                    />
                  </span>
                  <span className="w-24 text-right text-xs font-medium whitespace-nowrap text-slate-700 tabular-nums">{formatBRL(s.totalCents)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
