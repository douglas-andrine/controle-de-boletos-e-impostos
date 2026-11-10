import { ChevronLeft, ChevronRight } from "lucide-react";
import { todayISO } from "@tributoleao/shared";
import { formatMonth, formatMonthAbbr, shiftMonth } from "../../lib/format";

/** Os 12 meses do ano em botões, com setas para trocar de ano. */
export function MonthStrip({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const current = todayISO().slice(0, 7);
  const year = month.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Mês de referência">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -12))}
        className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
        aria-label="Ano anterior"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span className="text-sm font-semibold tabular-nums">{year}</span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 12))}
        className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
        aria-label="Próximo ano"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>

      <div className="grid flex-1 grid-cols-6 gap-1 rounded-lg bg-white/10 p-1 sm:grid-cols-12">
        {months.map((m) => {
          const selected = m === month;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              aria-pressed={selected}
              aria-label={formatMonth(m)}
              className={`relative rounded-md px-1 py-1 text-xs font-medium transition-colors ${
                selected ? "bg-white text-navy shadow-sm" : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              {formatMonthAbbr(m)}
              {m === current && (
                <span
                  className={`absolute top-0.5 right-1 size-1.5 rounded-full ${selected ? "bg-emerald-brand" : "bg-gold"}`}
                  title="Mês atual"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
