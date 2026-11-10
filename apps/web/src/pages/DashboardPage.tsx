import { useState } from "react";
import { Link } from "react-router";
import { DELIVERY_DEADLINE_DAYS, formatBRL, todayISO } from "@tributoleao/shared";
import { DEMO_EMAIL, useCurrentUser } from "../lib/auth";
import { useDashboardStats } from "../lib/dashboard";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { KpiCards, KpiCardsSkeleton } from "./dashboard/KpiCards";
import { DistributionChart } from "./dashboard/DistributionChart";
import { MonthStrip } from "./dashboard/MonthStrip";
import { MonthlyChart } from "./dashboard/MonthlyChart";
import { PaidGauge } from "./dashboard/PaidGauge";
import { StatusDonut } from "./dashboard/StatusDonut";
import { SupplierBars } from "./dashboard/SupplierBars";

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

      {/* Faixa do topo: saudação, meses e os números do mês */}
      <section className="space-y-5 rounded-2xl bg-navy p-4 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Olá, {firstName}!</h1>
            <p className="mt-1 text-sm text-white/70">Resumo dos seus impostos e boletos.</p>
          </div>
          <div className="xl:w-[34rem]">
            <MonthStrip month={month} onChange={setMonth} />
          </div>
        </div>

        {isError && !stats ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card p-8 text-center">
            <p className="text-sm text-slate-600">Não foi possível carregar o painel.</p>
            <Button variant="navy" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : isPending ? (
          <KpiCardsSkeleton />
        ) : (
          // minmax(0, 1fr): a coluna dos números encolhe em vez de empurrar o medidor para fora da faixa
          <div className={`grid gap-3 transition-opacity lg:grid-cols-[minmax(0,1fr)_16rem] ${isFetching ? "opacity-70" : ""}`}>
            <KpiCards stats={stats} />
            <PaidGauge stats={stats} />
          </div>
        )}
      </section>

      {stats && (
        <div className={`space-y-6 transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          {stats.overdue.count > 0 && (
            <Alert>
              <strong>{stats.overdue.count} pagamento(s) em atraso</strong> somando {formatBRL(stats.overdue.totalCents)}. Regularize para
              evitar juros e multa.
            </Alert>
          )}

          {stats.lateDeliveries.count > 0 && (
            <Alert>
              <strong>{stats.lateDeliveries.count} mercadoria(s) com entrega atrasada</strong>: impostos pagos há mais de{" "}
              {DELIVERY_DEADLINE_DAYS} dias sem a entrega registrada.{" "}
              <Link to="/impostos?entrega=atrasada" className="font-medium underline">
                Ver impostos
              </Link>
            </Alert>
          )}

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <MonthlyChart points={stats.yearByMonth} selected={month} onSelect={setMonth} />
            </div>
            <StatusDonut stats={stats} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SupplierBars stats={stats} />
            <DistributionChart stats={stats} />
          </div>
        </div>
      )}
    </div>
  );
}
