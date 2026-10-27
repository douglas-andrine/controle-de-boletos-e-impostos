import { Outlet } from "react-router";
import { BellRing, ChartPie, ShieldCheck } from "lucide-react";
import { Logo } from "../components/Logo";

const highlights = [
  { Icon: BellRing, text: "Alertas visuais de vencimentos e atrasos" },
  { Icon: ChartPie, text: "Visão clara de impostos vs. despesas operacionais" },
  { Icon: ShieldCheck, text: "Seus dados isolados e protegidos por sessão segura" },
];

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Logo />
        <div>
          <h2 className="max-w-md text-3xl leading-tight font-semibold">
            Nenhum boleto esquecido. <span className="text-gold">Nenhum imposto atrasado.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-slate-300">
                <span className="rounded-lg bg-navy-light p-2">
                  <Icon className="size-5 text-gold" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">Projeto de portfólio · dados de demonstração são fictícios</p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <Logo tone="dark" className="mb-8 lg:hidden" />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
