import { useEffect, useState } from "react";
import { Loader2, Plus, Receipt, Search, X } from "lucide-react";
import { EFFECTIVE_STATUSES, formatBRL, type BoletoDTO } from "@tributoleao/shared";
import { ApiError } from "../../lib/api";
import { useBoletos, useDeleteBoleto, useSetBoletoPayment } from "../../lib/boletos";
import { useSupplierOptions } from "../../lib/suppliers";
import { formatDate } from "../../lib/format";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useListFilters } from "../../lib/useListFilters";
import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/ui/Pagination";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { StatusBadge } from "../../components/StatusBadge";
import { DueCell, PayableActions, StatusTabs } from "../../components/payables";
import { PayDialog } from "../../components/PayDialog";
import { BoletoFormDialog } from "./BoletoFormDialog";

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : "Algo deu errado. Tente novamente.");

const supplierName = (b: BoletoDTO) => b.supplier.tradeName ?? b.supplier.legalName;

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
  // Filtros na URL: ?status=PENDENTE&fornecedor=<id>&venc=2026-10&q=energia&page=2
  const { searchParams, page, setFilter, goToPage, clearFilters } = useListFilters();
  const statusParam = searchParams.get("status");
  const status = EFFECTIVE_STATUSES.find((s) => s === statusParam);
  const supplierId = searchParams.get("fornecedor") || undefined;
  const dueMonth = searchParams.get("venc") || undefined;
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BoletoDTO | null>(null);
  const [paying, setPaying] = useState<BoletoDTO | null>(null);
  const [deleting, setDeleting] = useState<BoletoDTO | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useBoletos({ page, status, supplierId, dueMonth, search });
  const suppliers = useSupplierOptions();
  const setPayment = useSetBoletoPayment();
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
          toast({ message: `“${boleto.description}” marcado como pago.` });
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
            message: `Pagamento de “${boleto.description}” estornado.`,
            action: { label: "Desfazer", onClick: () => setPayment.mutate({ id: boleto.id, paidAt: boleto.paidAt }) },
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
        toast({ message: `“${boleto.description}” excluído.` });
      },
    });
  };

  const hasFilter = Boolean(status || supplierId || dueMonth || search);
  const rowActions = (boleto: BoletoDTO) => (
    <PayableActions
      label={boleto.description}
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
    />
  );

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
              placeholder="Buscar por descrição ou fornecedor"
              aria-label="Buscar boletos"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-10 pl-9 text-sm placeholder:text-slate-400 focus:outline-2 focus:outline-navy/30"
            />
            {isFetching && !isPending && (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" aria-label="Carregando" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={supplierId ?? ""}
            onChange={(e) => setFilter("fornecedor", e.target.value || undefined)}
            aria-label="Filtrar por fornecedor"
            className={`${filterInput} sm:max-w-xs`}
          >
            <option value="">Todos os fornecedores</option>
            {suppliers.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.tradeName ?? s.legalName}
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
              onChange={(e) => setFilter("venc", e.target.value || undefined)}
              className={filterInput}
            />
          </div>

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
                  <th className="px-4 py-3">Boleto</th>
                  <th className="px-4 py-3">Emissão</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60">
                    <td className="max-w-64 px-4 py-3">
                      <p className="truncate font-medium text-slate-800">{b.description}</p>
                      <p className="truncate text-xs text-slate-500">{supplierName(b)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{formatDate(b.issueDate)}</td>
                    <td className="px-4 py-3">
                      <DueCell dueDate={b.dueDate} status={b.status} paidAt={b.paidAt} />
                    </td>
                    <td className="px-4 py-3">
                      <AmountCell boleto={b} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">{rowActions(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {data.data.map((b) => (
              <li key={b.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{b.description}</p>
                    <p className="truncate text-xs text-slate-500">{supplierName(b)}</p>
                  </div>
                  <StatusBadge status={b.status} />
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
        item={paying && { title: paying.description, amountCents: paying.totalCents }}
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
            <strong className="text-slate-800">{deleting.description}</strong> ({supplierName(deleting)}) de {formatBRL(deleting.totalCents)}{" "}
            será excluído permanentemente.
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
