import { DEMO_EMAIL, useCurrentUser } from "../lib/auth";
import { Alert } from "../components/ui/Alert";

// Provisório: os KPIs e gráficos entram na fase do dashboard.
export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const firstName = user?.name.split(" ")[0];

  return (
    <div className="space-y-6">
      {user?.email === DEMO_EMAIL && (
        <Alert tone="info">Você está no modo demonstração. Todos os dados exibidos são fictícios.</Alert>
      )}
      <div>
        <h1 className="text-2xl font-semibold text-navy">Olá, {firstName}!</h1>
        <p className="mt-1 text-sm text-slate-500">Aqui você verá o resumo dos seus vencimentos.</p>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
        KPIs, próximos vencimentos e gráficos chegam em breve.
      </div>
    </div>
  );
}
