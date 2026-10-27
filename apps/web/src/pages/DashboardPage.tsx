import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatBRL, todayISO } from "@tributoleao/shared";
import { DEMO_EMAIL, useCurrentUser } from "../lib/auth";
import { useDashboardStats } from "../lib/dashboard";
import { formatMonth, shiftMonth } from "../lib/format";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { KpiCards, KpiCardsSkeleton } from "./dashboard/KpiCards";
import { AgendaList } from "./dashboard/AgendaList";
import { DistributionChart } from "./dashboard/DistributionChart";

function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const current = todayISO().slice(0, 7);
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="inline-block min-w-36 text-center text-sm font-medium text-slate-700 first-letter:uppercase" aria-live="polite">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        aria-label="Próximo mês"
      >
        <ChevronRight className="size-4" />
      </button>
      {month !== current && (
        <button
          type="button"
          onClick={() => onChange(current)}
          className="rounded-md px-2 py-1 text-xs font-medium text-emerald-brand hover:bg-emerald-brand/10"
        >
          Hoje
        </button>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const { data: stats, isPending, isError, refetch, isFetching } = useDashboardStats(month);
  const firstName = user?.name.split(" ")[0];

  return (
    <div className="space-y-6">
      {user?.email === DEMO_EMAIL && (
        <Alert tone="info">Você está no modo demonstração. Todos os dados exibidos são fictícios.</Alert>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Olá, {firstName}!</h1>
          <p className="mt-1 text-sm text-slate-500">Resumo dos seus impostos e boletos.</p>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {isError && !stats ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">Não foi possível carregar o painel.</p>
          <Button variant="navy" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <KpiCardsSkeleton />
      ) : (
        <div className={`space-y-6 transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          {stats.overdue.count > 0 && (
            <Alert>
              <strong>{stats.overdue.count} pagamento(s) em atraso</strong> somando {formatBRL(stats.overdue.totalCents)}. Regularize para
              evitar juros e multa.
            </Alert>
          )}

          <KpiCards stats={stats} />

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <AgendaList items={stats.agenda} />
            </div>
            <DistributionChart stats={stats} />
          </div>
        </div>
      )}
    </div>
  );
}
