import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, PackageX, Plus, Receipt, Search, X } from "lucide-react";
import { EFFECTIVE_STATUSES, formatBRL, supplierName, todayISO, type BoletoDTO } from "@tributoleao/shared";
import { ApiError } from "../../lib/api";
import { daysInMonth, useBoletos, useDeleteBoleto, useSetBoletoDelivery, useSetBoletoPayment } from "../../lib/boletos";
import { useSupplierOptions } from "../../lib/suppliers";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useListFilters } from "../../lib/useListFilters";
import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/ui/Pagination";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { StatusBadge } from "../../components/StatusBadge";
import { DueCell, PayableActions, StatusTabs } from "../../components/payables";
import { PayDialog } from "../../components/PayDialog";
import { DELIVERY_FILTERS, DeliveryCell, NotDeliveredButton, parseDeliveryFilter } from "../../components/delivery";
import { BoletoFormDialog } from "./BoletoFormDialog";

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : "Algo deu errado. Tente novamente.");

/** Como o boleto é chamado nas mensagens: pela nota; boletos antigos, pela descrição. */
const boletoLabel = (b: BoletoDTO) => (b.invoiceNumber ? `NF ${b.invoiceNumber}` : (b.description ?? "Boleto"));

/** Fornecedor em destaque e a nota abaixo (com a descrição, em boletos antigos). */
function SupplierInvoice({ boleto }: { boleto: BoletoDTO }) {
  const detail = [boleto.invoiceNumber && `NF ${boleto.invoiceNumber}`, boleto.description].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-slate-800">{supplierName(boleto.supplier)}</p>
      {detail && <p className="truncate text-xs text-slate-500 tabular-nums">{detail}</p>}
    </div>
  );
}

function AmountCell({ boleto }: { boleto: BoletoDTO }) {
  return (
    <div className="text-right">
      <p className="font-medium whitespace-nowrap text-slate-800 tabular-nums">{formatBRL(boleto.totalCents)}</p>
      {boleto.feesCents > 0 && <p className="text-xs whitespace-nowrap text-slate-500">inclui {formatBRL(boleto.feesCents)} de juros</p>}
    </div>
  );
}

const filterInput =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-2 focus:outline-navy/30";

export function BoletosPage() {
  // Filtros na URL: ?status=PENDENTE&fornecedor=<id>&venc=2026-10&dia=5&entrega=nao&q=energia&page=2
  const { searchParams, page, setFilter, setFilters, goToPage, clearFilters } = useListFilters();
  const statusParam = searchParams.get("status");
  const status = EFFECTIVE_STATUSES.find((s) => s === statusParam);
  const supplierId = searchParams.get("fornecedor") || undefined;
  const dueMonth = searchParams.get("venc") || undefined;
  // O dia só vale dentro de um mês; sem mês escolhido, os dias listados são os do mês atual
  const dayMonth = dueMonth ?? todayISO().slice(0, 7);
  const monthDays = daysInMonth(dayMonth);
  const dayParam = Number(searchParams.get("dia"));
  const dueDay = dueMonth && Number.isInteger(dayParam) && dayParam >= 1 && dayParam <= monthDays ? dayParam : undefined;
  const { delivery, goodsDelivered, deliveryLate } = parseDeliveryFilter(searchParams.get("entrega"));
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BoletoDTO | null>(null);
  const [paying, setPaying] = useState<BoletoDTO | null>(null);
  const [deleting, setDeleting] = useState<BoletoDTO | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useBoletos({ page, status, supplierId, dueMonth, dueDay, goodsDelivered, deliveryLate, search });
  const suppliers = useSupplierOptions();
  const setPayment = useSetBoletoPayment();
  const setDelivery = useSetBoletoDelivery();
  const remove = useDeleteBoleto();
  const toast = useToast();

  useEffect(() => {
    if (search !== (searchParams.get("q") ?? "")) setFilter("q", search || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Dar baixa pode tirar o último item da página filtrada: volta uma página
  useEffect(() => {
    if (data && data.data.length === 0 && page > 1) goToPage(data.meta.totalPages);
  });

  // Trocar de mês mantém o dia se ele existir no novo mês (dia 31 não existe em fevereiro)
  const changeMonth = (month: string | undefined) =>
    setFilters({ venc: month, dia: month && dueDay && dueDay <= daysInMonth(month) ? String(dueDay) : undefined });

  const changeDay = (day: number | undefined) => setFilters({ venc: dayMonth, dia: day ? String(day) : undefined });

  const openForm = (boleto: BoletoDTO | null) => {
    setEditing(boleto);
    setFormOpen(true);
  };

  const confirmPay = (paidAt: string) => {
    if (!paying) return;
    const boleto = paying;
    setPayment.mutate(
      { id: boleto.id, paidAt },
      {
        onSuccess: () => {
          setPaying(null);
          toast({ message: `${boletoLabel(boleto)} marcado como pago.` });
        },
      },
    );
  };

  const unpay = (boleto: BoletoDTO) => {
    setPayment.mutate(
      { id: boleto.id, paidAt: null },
      {
        onSuccess: () =>
          toast({
            message: `Pagamento de ${boletoLabel(boleto)} estornado.`,
            action: { label: "Desfazer", onClick: () => setPayment.mutate({ id: boleto.id, paidAt: boleto.paidAt }) },
          }),
        onError: (err) => toast({ message: errorMessage(err), tone: "error" }),
      },
    );
  };

  const markDelivery = (boleto: BoletoDTO, delivered: boolean) => {
    setDelivery.mutate(
      { id: boleto.id, delivered },
      {
        onSuccess: () =>
          toast({
            message: delivered ? `Entrega de ${boletoLabel(boleto)} registrada.` : `Entrega de ${boletoLabel(boleto)} desmarcada.`,
            action: { label: "Desfazer", onClick: () => setDelivery.mutate({ id: boleto.id, delivered: !delivered }) },
          }),
        onError: (err) => toast({ message: errorMessage(err), tone: "error" }),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const boleto = deleting;
    remove.mutate(boleto.id, {
      onSuccess: () => {
        setDeleting(null);
        toast({ message: `${boletoLabel(boleto)} excluído.` });
      },
    });
  };

  const hasFilter = Boolean(status || supplierId || dueMonth || delivery || search);
  const rowActions = (boleto: BoletoDTO) => (
    <PayableActions
      label={boletoLabel(boleto)}
      status={boleto.status}
      paymentCode={boleto.barcode}
      onPay={() => {
        setPayment.reset();
        setPaying(boleto);
      }}
      onUnpay={() => unpay(boleto)}
      onEdit={() => openForm(boleto)}
      onDelete={() => {
        remove.reset();
        setDeleting(boleto);
      }}
      paidAction={boleto.goodsDelivered === false && <NotDeliveredButton label={boletoLabel(boleto)} onClick={() => markDelivery(boleto, true)} />}
      menuItems={boleto.goodsDelivered ? [{ label: "Desmarcar entrega", Icon: PackageX, onSelect: () => markDelivery(boleto, false) }] : []}
    />
  );

  const rowAccent = (boleto: BoletoDTO) => (boleto.deliveryStatus === "ATRASADA" ? "shadow-[inset_3px_0_0_var(--color-danger)]" : "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Boletos</h1>
          <p className="mt-1 text-sm text-slate-500">Contas a pagar operacionais: aluguel, energia, serviços e fornecedores.</p>
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus className="size-4" aria-hidden />
          Novo boleto
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <StatusTabs value={status} onChange={(value) => setFilter("status", value)} />
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nota ou fornecedor"
              aria-label="Buscar boletos"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-10 pl-9 text-sm placeholder:text-slate-400 focus:outline-2 focus:outline-navy/30"
            />
            {isFetching && !isPending && (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" aria-label="Carregando" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={supplierId ?? ""}
            onChange={(e) => setFilter("fornecedor", e.target.value || undefined)}
            aria-label="Filtrar por fornecedor"
            className={`${filterInput} sm:max-w-xs`}
          >
            <option value="">Todos os fornecedores</option>
            {suppliers.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {supplierName(s)}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-due-month" className="text-sm whitespace-nowrap text-slate-500">
              Vencimento em
            </label>
            <input
              id="filter-due-month"
              type="month"
              value={dueMonth ?? ""}
              onChange={(e) => changeMonth(e.target.value || undefined)}
              className={filterInput}
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dueDay && changeDay(dueDay - 1)}
              disabled={!dueDay || dueDay <= 1}
              aria-label="Dia anterior"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <select
              value={dueDay ?? ""}
              onChange={(e) => changeDay(Number(e.target.value) || undefined)}
              aria-label="Filtrar por dia do vencimento"
              className={`${filterInput} sm:w-36`}
            >
              <option value="">Todos os dias</option>
              {Array.from({ length: monthDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Dia {d}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => dueDay && changeDay(dueDay + 1)}
              disabled={!dueDay || dueDay >= monthDays}
              aria-label="Próximo dia"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <select
            value={delivery?.value ?? ""}
            onChange={(e) => setFilter("entrega", e.target.value || undefined)}
            aria-label="Filtrar por entrega da mercadoria"
            className={`${filterInput} sm:max-w-56`}
          >
            <option value="">Toda entrega</option>
            {DELIVERY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                clearFilters();
              }}
              className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-slate-100 sm:self-auto"
            >
              <X className="size-4" aria-hidden />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {isError && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">Não foi possível carregar os boletos.</p>
          <Button variant="navy" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" aria-hidden />
      ) : data.meta.total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <Receipt className="size-8 text-slate-300" aria-hidden />
          <p className="text-sm text-slate-500">{hasFilter ? "Nenhum boleto encontrado com esses filtros." : "Nenhum boleto cadastrado ainda."}</p>
          {!hasFilter && (
            <Button variant="outline" onClick={() => openForm(null)}>
              <Plus className="size-4" aria-hidden />
              Cadastrar o primeiro
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Fornecedor / Nota</th>
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
                {data.data.map((b) => (
                  <tr key={b.id} className={`hover:bg-slate-50/60 ${rowAccent(b)}`}>
                    <td className="max-w-64 px-4 py-3">
                      <SupplierInvoice boleto={b} />
                    </td>
                    <td className="px-4 py-3">
                      <DueCell dueDate={b.dueDate} status={b.status} paidAt={b.paidAt} />
                    </td>
                    <td className="px-4 py-3">
                      <AmountCell boleto={b} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryCell item={b} />
                    </td>
                    <td className="px-4 py-3">{rowActions(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {data.data.map((b) => (
              <li key={b.id} className={`rounded-lg border border-slate-200 bg-white p-4 ${rowAccent(b)}`}>
                <div className="flex items-start justify-between gap-3">
                  <SupplierInvoice boleto={b} />
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={b.status} />
                    {b.deliveryStatus && <DeliveryCell item={b} />}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <DueCell dueDate={b.dueDate} status={b.status} paidAt={b.paidAt} />
                  <AmountCell boleto={b} />
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">{rowActions(b)}</div>
              </li>
            ))}
          </ul>

          <Pagination meta={data.meta} onPageChange={goToPage} />
        </div>
      )}

      <BoletoFormDialog open={formOpen} boleto={editing} defaultSupplierId={supplierId} onClose={() => setFormOpen(false)} />

      <PayDialog
        item={paying && { title: `${boletoLabel(paying)} · ${supplierName(paying.supplier)}`, amountCents: paying.totalCents }}
        onConfirm={confirmPay}
        onClose={() => setPaying(null)}
        loading={setPayment.isPending}
        error={setPayment.error ? errorMessage(setPayment.error) : null}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir boleto?"
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
      >
        {deleting && (
          <>
            <strong className="text-slate-800">{boletoLabel(deleting)}</strong> ({supplierName(deleting.supplier)}) de {formatBRL(deleting.totalCents)}{" "}
            será excluído permanentemente.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
