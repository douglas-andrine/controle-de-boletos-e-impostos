import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Loader2,
  PackageX,
  Plus,
  Search,
  X,
} from "lucide-react";
import { EFFECTIVE_STATUSES, formatBRL, todayISO, type TaxDTO, type TaxListSummary } from "@tributoleao/shared";
import { ApiError } from "../../lib/api";
import { taxCompanyName, useDeleteTax, useSetTaxDelivery, useSetTaxPayment, useTaxes } from "../../lib/taxes";
import { formatDate, formatMonthShort, shiftMonth } from "../../lib/format";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useListFilters } from "../../lib/useListFilters";
import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/ui/Pagination";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Menu } from "../../components/ui/Menu";
import { useToast } from "../../components/ui/Toast";
import { StatusBadge } from "../../components/StatusBadge";
import { DueCell, PayableActions, StatusTabs } from "../../components/payables";
import { PayDialog } from "../../components/PayDialog";
import { DELIVERY_FILTERS, DeliveryCell, NotDeliveredButton, parseDeliveryFilter } from "../../components/delivery";
import { TaxFormDialog } from "./TaxFormDialog";

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : "Algo deu errado. Tente novamente.");

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Empresa em destaque e nota fiscal abaixo; "—" quando o imposto não tem nenhuma das duas. */
function CompanyCell({ tax }: { tax: TaxDTO }) {
  const company = taxCompanyName(tax);
  if (!company && !tax.invoiceNumber) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-0">
      {company && <p className="truncate font-medium text-slate-800">{company}</p>}
      {tax.invoiceNumber && <p className={`whitespace-nowrap tabular-nums ${company ? "text-xs text-slate-500" : "text-slate-700"}`}>NF {tax.invoiceNumber}</p>}
    </div>
  );
}

function TaxNameCell({ tax }: { tax: TaxDTO }) {
  return (
    <div>
      <p className="font-medium text-slate-800">{tax.name}</p>
      <p className="text-xs text-slate-500 tabular-nums">
        apuração {formatMonthShort(tax.referenceMonth)}
        {tax.revenueCode && ` · ${tax.revenueCode}`}
      </p>
    </div>
  );
}

/** Período de apuração com setas, como o seletor de mês do dashboard; vazio = todos. */
function MonthFilter({ value, onChange }: { value?: string; onChange: (month?: string) => void }) {
  const base = value ?? todayISO().slice(0, 7);
  const arrow = "rounded-md p-1.5 text-slate-500 hover:bg-slate-100";
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-card p-1" role="group" aria-label="Período de apuração">
      <button type="button" onClick={() => onChange(shiftMonth(base, -1))} className={arrow} aria-label="Apuração anterior">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-32 text-center text-sm font-medium whitespace-nowrap text-slate-700 tabular-nums" aria-live="polite">
        {value ? `Apuração ${formatMonthShort(value)}` : "Toda apuração"}
      </span>
      <button type="button" onClick={() => onChange(shiftMonth(base, value ? 1 : 0))} className={arrow} aria-label="Próxima apuração">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function FilterChip({ label, onRemove, danger }: { label: string; onRemove: () => void; danger?: boolean }) {
  return (
    <span className={`${pill} py-1 pr-1 ${danger ? "bg-danger/10 text-danger" : "bg-navy/10 text-heading"}`}>
      {label}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-black/5" aria-label={`Remover filtro ${label}`}>
        <X className="size-3.5" />
      </button>
    </span>
  );
}

/** Totais de todo o filtro atual, não só da página. */
function SummaryStrip({ summary }: { summary: TaxListSummary }) {
  const card = "min-w-0 rounded-lg border border-slate-200 bg-card px-3 py-2.5 sm:px-4 sm:py-3";
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className={card}>
        <p className="truncate text-xs text-slate-500">A pagar</p>
        <p className="text-base font-semibold text-slate-800 tabular-nums sm:text-lg">{formatBRL(summary.pendingCents)}</p>
      </div>
      <div className={card}>
        <p className="truncate text-xs text-slate-500">Pago</p>
        <p className="text-base font-semibold text-slate-800 tabular-nums sm:text-lg">{formatBRL(summary.paidCents)}</p>
      </div>
      <div className={card}>
        <p className="truncate text-xs text-slate-500">Entregas pendentes</p>
        <p className="text-base font-semibold text-slate-800 tabular-nums sm:text-lg">
          {summary.deliveryPending}
          {summary.deliveryLate > 0 && (
            <span className="block text-xs font-medium text-danger sm:inline sm:text-sm"> · {plural(summary.deliveryLate, "atrasada", "atrasadas")}</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function TaxesPage() {
  // Filtros na URL: ?status=ATRASADO&mes=2026-09&entrega=atrasada&q=das&page=2
  const { searchParams, page, setFilter, goToPage, clearFilters } = useListFilters();
  const statusParam = searchParams.get("status");
  const status = EFFECTIVE_STATUSES.find((s) => s === statusParam);
  const referenceMonth = searchParams.get("mes") || undefined;
  const { delivery, goodsDelivered, deliveryLate } = parseDeliveryFilter(searchParams.get("entrega"));
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxDTO | null>(null);
  const [paying, setPaying] = useState<TaxDTO | null>(null);
  const [deleting, setDeleting] = useState<TaxDTO | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useTaxes({ page, status, referenceMonth, goodsDelivered, deliveryLate, search });
  const setPayment = useSetTaxPayment();
  const setDelivery = useSetTaxDelivery();
  const remove = useDeleteTax();
  const toast = useToast();

  useEffect(() => {
    if (search !== (searchParams.get("q") ?? "")) setFilter("q", search || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Dar baixa pode tirar o último item da página filtrada: volta uma página
  useEffect(() => {
    if (data && data.data.length === 0 && page > 1) goToPage(data.meta.totalPages);
  });

  const openForm = (tax: TaxDTO | null) => {
    setEditing(tax);
    setFormOpen(true);
  };

  const confirmPay = (paidAt: string) => {
    if (!paying) return;
    const tax = paying;
    setPayment.mutate(
      { id: tax.id, paidAt },
      {
        onSuccess: () => {
          setPaying(null);
          toast({ message: `${tax.name} marcado como pago.` });
        },
      },
    );
  };

  const unpay = (tax: TaxDTO) => {
    setPayment.mutate(
      { id: tax.id, paidAt: null },
      {
        onSuccess: () =>
          toast({
            message: `Pagamento de ${tax.name} estornado.`,
            action: { label: "Desfazer", onClick: () => setPayment.mutate({ id: tax.id, paidAt: tax.paidAt }) },
          }),
        onError: (err) => toast({ message: errorMessage(err), tone: "error" }),
      },
    );
  };

  const markDelivery = (tax: TaxDTO, delivered: boolean) => {
    setDelivery.mutate(
      { id: tax.id, delivered },
      {
        onSuccess: () =>
          toast({
            message: delivered ? `Entrega de ${tax.name} registrada.` : `Entrega de ${tax.name} desmarcada.`,
            action: { label: "Desfazer", onClick: () => setDelivery.mutate({ id: tax.id, delivered: !delivered }) },
          }),
        onError: (err) => toast({ message: errorMessage(err), tone: "error" }),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const tax = deleting;
    remove.mutate(tax.id, {
      onSuccess: () => {
        setDeleting(null);
        toast({ message: `${tax.name} excluído.` });
      },
    });
  };

  const hasFilter = Boolean(status || referenceMonth || delivery || search);
  const clearAll = () => {
    setSearchInput("");
    clearFilters();
  };

  const rowActions = (tax: TaxDTO) => (
    <PayableActions
      label={tax.name}
      status={tax.status}
      paymentCode={tax.paymentCode}
      onPay={() => {
        setPayment.reset();
        setPaying(tax);
      }}
      onUnpay={() => unpay(tax)}
      onEdit={() => openForm(tax)}
      onDelete={() => {
        remove.reset();
        setDeleting(tax);
      }}
      paidAction={
        tax.goodsDelivered === false && <NotDeliveredButton label={tax.name} onClick={() => markDelivery(tax, true)} />
      }
      menuItems={tax.goodsDelivered ? [{ label: "Desmarcar entrega", Icon: PackageX, onSelect: () => markDelivery(tax, false) }] : []}
    />
  );

  const rowAccent = (tax: TaxDTO) => (tax.deliveryStatus === "ATRASADA" ? "shadow-[inset_3px_0_0_var(--color-danger)]" : "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Impostos</h1>
          <p className="mt-1 text-sm text-slate-500">Guias e tributos a pagar: DARF, DAS, IPTU, ISS e outros.</p>
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus className="size-4" aria-hidden />
          Novo imposto
        </Button>
      </div>

      {data && <SummaryStrip summary={data.summary} />}

      {/* Filtros: status, apuração, entrega e busca; os ativos aparecem como chips abaixo */}
      <div className="space-y-2">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <StatusTabs value={status} onChange={(value) => setFilter("status", value)} />

          <div className="flex gap-3">
            <MonthFilter value={referenceMonth} onChange={(month) => setFilter("mes", month)} />
            <Menu
              trigger={
                <>
                  Entrega
                  <ChevronDown className="size-4 text-slate-400" aria-hidden />
                </>
              }
              triggerLabel="Filtrar por entrega da mercadoria"
              triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-card px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50"
              items={[
                { label: "Toda entrega", onSelect: () => setFilter("entrega", undefined), selected: !delivery },
                ...DELIVERY_FILTERS.map((f) => ({
                  label: f.label,
                  onSelect: () => setFilter("entrega", f.value),
                  selected: delivery?.value === f.value,
                })),
              ]}
            />
          </div>

          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar imposto, NF ou empresa"
              aria-label="Buscar impostos"
              className="w-full rounded-lg border border-slate-300 bg-card py-2 pr-10 pl-9 text-sm placeholder:text-slate-400 focus:outline-2 focus:outline-heading/30"
            />
            {isFetching && !isPending && (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" aria-label="Carregando" />
            )}
          </div>
        </div>

        {(referenceMonth || delivery) && (
          <div className="flex flex-wrap items-center gap-2">
            {referenceMonth && <FilterChip label={`Apuração ${formatMonthShort(referenceMonth)}`} onRemove={() => setFilter("mes", undefined)} />}
            {delivery && (
              <FilterChip
                label={`Entrega: ${delivery.chip}`}
                onRemove={() => setFilter("entrega", undefined)}
                danger={deliveryLate}
              />
            )}
            <button type="button" onClick={clearAll} className="text-xs font-medium text-slate-500 hover:text-heading">
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      {isError && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-card p-10 text-center">
          <p className="text-sm text-slate-600">Não foi possível carregar os impostos.</p>
          <Button variant="navy" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-card" aria-hidden />
      ) : data.meta.total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-card p-12 text-center">
          <Landmark className="size-8 text-slate-300" aria-hidden />
          {hasFilter ? (
            <>
              <p className="text-sm text-slate-500">Nenhum imposto encontrado com esses filtros.</p>
              <Button variant="outline" onClick={clearAll}>
                Limpar filtros
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">Nenhum imposto cadastrado ainda.</p>
              <Button variant="outline" onClick={() => openForm(null)}>
                <Plus className="size-4" aria-hidden />
                Cadastrar o primeiro
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-card xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Imposto</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((tax) => (
                  <tr key={tax.id} className={`hover:bg-slate-50/60 ${rowAccent(tax)}`}>
                    <td className="px-4 py-3">
                      <TaxNameCell tax={tax} />
                    </td>
                    <td className="max-w-48 px-4 py-3">
                      <CompanyCell tax={tax} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <DueCell dueDate={tax.dueDate} status={tax.status} paidAt={tax.paidAt} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800 tabular-nums">{formatBRL(tax.amountCents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tax.status} />
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryCell item={tax} />
                    </td>
                    <td className="px-4 py-3">{rowActions(tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
            {data.data.map((tax) => (
              <li key={tax.id} className={`rounded-lg border border-slate-200 bg-card p-4 ${rowAccent(tax)}`}>
                <div className="flex items-start justify-between gap-3">
                  <TaxNameCell tax={tax} />
                  <p className="text-lg font-semibold text-slate-800 tabular-nums">{formatBRL(tax.amountCents)}</p>
                </div>
                {(taxCompanyName(tax) || tax.invoiceNumber) && (
                  <div className="mt-2 text-sm">
                    <CompanyCell tax={tax} />
                  </div>
                )}
                <div className="mt-3 flex items-start justify-between gap-3">
                  <DueCell dueDate={tax.dueDate} status={tax.status} paidAt={tax.paidAt} />
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={tax.status} />
                    {tax.deliveryStatus && <DeliveryCell item={tax} />}
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">{rowActions(tax)}</div>
              </li>
            ))}
          </ul>

          <Pagination
            meta={data.meta}
            onPageChange={goToPage}
            label={
              <p>
                {plural(data.meta.total, "imposto", "impostos")} ·{" "}
                <span className="font-medium text-slate-700 tabular-nums">{formatBRL(data.summary.totalCents)}</span>
              </p>
            }
          />
        </div>
      )}

      <TaxFormDialog open={formOpen} tax={editing} onClose={() => setFormOpen(false)} />

      <PayDialog
        item={paying && { title: paying.name, amountCents: paying.amountCents }}
        onConfirm={confirmPay}
        onClose={() => setPaying(null)}
        loading={setPayment.isPending}
        error={setPayment.error ? errorMessage(setPayment.error) : null}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir imposto?"
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
      >
        {deleting && (
          <>
            <strong className="text-slate-800">{deleting.name}</strong> de {formatBRL(deleting.amountCents)} (vencimento{" "}
            {formatDate(deleting.dueDate)}) será excluído permanentemente.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
