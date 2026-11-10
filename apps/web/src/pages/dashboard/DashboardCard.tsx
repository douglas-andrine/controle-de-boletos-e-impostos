import type { ReactNode } from "react";

// Barra de título colorida no topo do cartão; os dois tons alternam pelo painel.
// emerald-800 em vez do emerald da marca: o branco do título precisa de contraste AA.
const TONES = { navy: "bg-navy", emerald: "bg-emerald-800" } as const;

type DashboardCardProps = {
  title: string;
  subtitle?: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
};

export function DashboardCard({ title, subtitle, tone = "navy", className = "", children }: DashboardCardProps) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <header className={`${TONES[tone]} px-5 py-2.5 text-white`}>
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      <div className="flex flex-1 flex-col p-5">
        {subtitle && <p className="mb-4 text-xs text-slate-500">{subtitle}</p>}
        {children}
      </div>
    </section>
  );
}
