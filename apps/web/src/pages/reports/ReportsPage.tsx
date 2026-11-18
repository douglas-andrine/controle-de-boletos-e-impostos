import { Loader2, Printer } from "lucide-react";
import { APP_TIME_ZONE, EFFECTIVE_STATUSES, formatBRL, supplierName, todayISO, type BoletoDTO, type ReportTotalsDTO, type TaxDTO } from "@tributoleao/shared";
import { useCurrentUser } from "../../lib/auth";
import { formatDate, formatMonth, formatMonthShort } from "../../lib/format";
import { useListFilters } from "../../lib/useListFilters";
import { useReport, type ReportKind, type ReportPeriod } from "../../lib/reports";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/StatusBadge";
import { StatusTabs } from "../../components/payables";
import { Logo } from "../../components/Logo";

const KINDS: Array<{ value: ReportKind; label: string }> = [
  { value: "boletos", label: "Boletos" },
  { value: "taxes", label: "Impostos" },
];

const PERIODS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "day", label: "Diário" },
  { value: "month", label: "Mensal" },
];

const STATUS_LABELS = { PENDENTE: "pendentes", PAGO: "pagos", ATRASADO: "atrasados" } as const;

const filterInput =
  "w-full rounded-lg border border-slate-300 bg-card px-3 py-2 text-sm text-slate-700 focus:outline-2 focus:outline-heading/30";

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-card p-1" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
            value === option.value ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Na impressão a tabela fica mais compacta para caber mais linhas por folha
const th = "px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-heading uppercase print:py-1.5";
const thRight = `${th} text-right`;
const td = "px-3 py-2 align-top print:py-1";
const money = `${td} text-right whitespace-nowrap tabular-nums`;
const table = "w-full text-sm print:text-[11px]";
const thead = "bg-slate-100";
const row = "break-inside-avoid even:bg-slate-50";
const tfoot = "border-t-2 border-heading bg-slate-100 font-semibold text-heading";

function BoletoTable({ items, totals }: { items: BoletoDTO[]; totals: ReportTotalsDTO }) {
  return (
    <table className={table}>
      <thead className={thead}>
        <tr>
          <th className={th}>Vencimento</th>
          <th className={th}>Fornecedor</th>
          <th className={th}>Nota fiscal</th>
          <th className={thRight}>Valor</th>
          <th className={thRight}>Juros/multa</th>
          <th className={thRight}>Total</th>
          <th className={th}>Situação</th>
          <th className={th}>Pago em</th>
        </tr>
      </thead>
      <tbody>
        {items.map((b) => (
          <tr key={b.id} className={row}>
            <td className={`${td} tabular-nums`}>{formatDate(b.dueDate)}</td>
            <td className={td}>{supplierName(b.supplier)}</td>
            <td className={`${td} tabular-nums`}>{b.invoiceNumber ?? "—"}</td>
            <td className={money}>{formatBRL(b.amountCents)}</td>
            <td className={money}>{b.feesCents > 0 ? formatBRL(b.feesCents) : "—"}</td>
            <td className={`${money} font-medium`}>{formatBRL(b.totalCents)}</td>
            <td className={td}>
              <StatusBadge status={b.status} />
            </td>
            <td className={`${td} tabular-nums`}>{b.paidAt ? formatDate(b.paidAt) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className={tfoot}>
        <tr>
          <td className={td} colSpan={5}>
            Total ({totals.count} {totals.count === 1 ? "boleto" : "boletos"})
          </td>
          <td className={money}>{formatBRL(totals.totalCents)}</td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}

function TaxTable({ items, totals }: { items: TaxDTO[]; totals: ReportTotalsDTO }) {
  return (
    <table className={table}>
      <thead className={thead}>
        <tr>
          <th className={th}>Vencimento</th>
          <th className={th}>Imposto</th>
          <th className={th}>Empresa</th>
          <th className={th}>Nota fiscal</th>
          <th className={th}>Competência</th>
          <th className={thRight}>Valor</th>
          <th className={th}>Situação</th>
          <th className={th}>Pago em</th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id} className={row}>
            <td className={`${td} tabular-nums`}>{formatDate(t.dueDate)}</td>
            <td className={td}>
              {t.name}
              {t.revenueCode && <span className="text-slate-500"> · {t.revenueCode}</span>}
            </td>
            <td className={td}>{t.supplier ? supplierName(t.supplier) : "—"}</td>
            <td className={`${td} tabular-nums`}>{t.invoiceNumber ?? "—"}</td>
            <td className={`${td} tabular-nums`}>{formatMonthShort(t.referenceMonth)}</td>
            <td className={`${money} font-medium`}>{formatBRL(t.amountCents)}</td>
            <td className={td}>
              <StatusBadge status={t.status} />
            </td>
            <td className={`${td} tabular-nums`}>{t.paidAt ? formatDate(t.paidAt) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className={tfoot}>
        <tr>
          <td className={td} colSpan={5}>
            Total ({totals.count} {totals.count === 1 ? "imposto" : "impostos"})
          </td>
          <td className={money}>{formatBRL(totals.totalCents)}</td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}

function Summary({ totals, itemLabel }: { totals: ReportTotalsDTO; itemLabel: string }) {
  const cells = [
    { label: "Total", value: totals.totalCents, accent: "border-l-heading", detail: `${totals.count} ${itemLabel}` },
    { label: "Pago", value: totals.paidCents, accent: "border-l-emerald-brand" },
    { label: "A pagar", value: totals.pendingCents, accent: "border-l-gold" },
    { label: "Atrasado", value: totals.overdueCents, accent: "border-l-danger" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className={`rounded-lg border border-l-4 border-slate-200 px-3 py-2 ${c.accent}`}>
          <dt className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{c.label}</dt>
          <dd className="text-lg font-semibold whitespace-nowrap text-heading tabular-nums">{formatBRL(c.value)}</dd>
          {c.detail && <dd className="text-xs text-slate-500">{c.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });

export function ReportsPage() {
  // Filtros na URL: ?tipo=impostos&periodo=mensal&data=2026-11&status=PAGO
  const { searchParams, setFilter, setFilters } = useListFilters();
  const kind: ReportKind = searchParams.get("tipo") === "impostos" ? "taxes" : "boletos";
  const period: ReportPeriod = searchParams.get("periodo") === "mensal" ? "month" : "day";
  const dateParam = searchParams.get("data") ?? "";
  const today = todayISO();
  // A data da URL só vale se tiver o formato do período; senão, hoje ou o mês atual
  const date = period === "day" ? (/^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today) : /^\d{4}-\d{2}$/.test(dateParam) ? dateParam : today.slice(0, 7);
  const statusParam = searchParams.get("status");
  const status = EFFECTIVE_STATUSES.find((s) => s === statusParam);

  const { data, isPending, isError, isFetching, refetch } = useReport({ kind, period, date, status });
  const { data: user } = useCurrentUser();

  // Trocar o período mantém a data: o dia vira o mês dele; o mês vira o dia 1 (ou hoje, se for o mês atual)
  const changePeriod = (next: ReportPeriod) => {
    if (next === period) return;
    const nextDate = next === "month" ? date.slice(0, 7) : date === today.slice(0, 7) ? today : `${date}-01`;
    setFilters({ periodo: next === "month" ? "mensal" : undefined, data: nextDate });
  };

  const kindLabel = kind === "boletos" ? "boletos" : "impostos";
  const title = `Relatório ${period === "day" ? "diário" : "mensal"} de ${kindLabel}`;
  const periodLabel = period === "day" ? formatDate(date) : formatMonth(date);
  const empty = data && data.items.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Relatórios</h1>
          <p className="mt-1 text-sm text-slate-500">Boletos e impostos que vencem no dia ou no mês, prontos para imprimir.</p>
        </div>
        <Button variant="navy" onClick={() => window.print()} disabled={!data || empty || isFetching}>
          <Printer className="size-4" aria-hidden />
          Imprimir
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center print:hidden">
        <Segmented label="Tipo de relatório" options={KINDS} value={kind} onChange={(v) => setFilter("tipo", v === "taxes" ? "impostos" : undefined)} />
        <Segmented label="Período do relatório" options={PERIODS} value={period} onChange={changePeriod} />
        <div className="flex items-center gap-2">
          <label htmlFor="report-date" className="text-sm whitespace-nowrap text-slate-500">
            {period === "day" ? "Vencimento em" : "Vencimentos de"}
          </label>
          <input
            id="report-date"
            type={period === "day" ? "date" : "month"}
            value={date}
            onChange={(e) => e.target.value && setFilter("data", e.target.value)}
            className={`${filterInput} sm:w-44`}
          />
        </div>
        <StatusTabs value={status} onChange={(value) => setFilter("status", value)} />
        {isFetching && !isPending && <Loader2 className="size-4 animate-spin text-slate-400" aria-label="Carregando" />}
      </div>

      {isError && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">Não foi possível gerar o relatório.</p>
          <Button variant="navy" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-64 animate-pulse rounded-xl bg-card shadow-sm" aria-hidden />
      ) : (
        // A folha impressa: o que está fora dela some na impressão (print:hidden)
        <section className={`print-sheet space-y-5 rounded-xl bg-card p-4 shadow-sm transition-opacity sm:p-6 ${isFetching ? "opacity-70" : ""}`} aria-label={title}>
          <header className="flex flex-col gap-3 border-b-2 border-heading pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Logo tone="dark" />
              <div>
                <h2 className="text-xl font-semibold text-heading">{title}</h2>
                <p className="text-sm text-slate-600">
                  Vencimento em {periodLabel}
                  {status && ` · somente ${STATUS_LABELS[status]}`}
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-500 sm:text-right">
              {user && <p className="font-medium text-slate-700">{user.name}</p>}
              <p>
                Emitido em {formatDate(today)} às {timeFormatter.format(new Date())}
              </p>
            </div>
          </header>

          {empty ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Nenhum {kind === "boletos" ? "boleto" : "imposto"}
              {status ? ` ${STATUS_LABELS[status].slice(0, -1)}` : ""} vence {period === "day" ? "neste dia" : "neste mês"}.
            </p>
          ) : (
            <>
              <Summary totals={data.totals} itemLabel={kind === "boletos" ? (data.totals.count === 1 ? "boleto" : "boletos") : data.totals.count === 1 ? "imposto" : "impostos"} />
              <div className="overflow-x-auto rounded-lg border border-slate-200 print:overflow-visible">
                {kind === "boletos" ? (
                  <BoletoTable items={data.items as BoletoDTO[]} totals={data.totals} />
                ) : (
                  <TaxTable items={data.items as TaxDTO[]} totals={data.totals} />
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
