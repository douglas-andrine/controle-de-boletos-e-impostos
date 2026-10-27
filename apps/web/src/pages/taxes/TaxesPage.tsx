import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { CircleCheckBig, Landmark, Loader2, Pencil, Plus, Search, Trash2, Undo2, X } from "lucide-react";
import { EFFECTIVE_STATUSES, formatBRL, type EffectiveStatus, type TaxDTO } from "@tributoleao/shared";
import { ApiError } from "../../lib/api";
import { useDeleteTax, useSetTaxPayment, useTaxes } from "../../lib/taxes";
import { daysUntil, formatDate, formatDueDistance, formatMonthShort } from "../../lib/format";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { currentParams } from "../../lib/urlParams";
import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/ui/Pagination";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { StatusBadge } from "../../components/StatusBadge";
import { CopyButton } from "../../components/CopyButton";
import { PayDialog } from "../../components/PayDialog";
import { TaxFormDialog } from "./TaxFormDialog";

const STATUS_TABS: { value: EffectiveStatus | undefined; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "ATRASADO", label: "Atrasados" },
  { value: "PAGO", label: "Pagos" },
];

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : "Algo deu errado. Tente novamente.");

function DueCell({ tax }: { tax: TaxDTO }) {
  return (
    <div>
      <p className="text-slate-700 tabular-nums">{formatDate(tax.dueDate)}</p>
      {tax.status === "PAGO" ? (
        <p className="text-xs text-slate-500">pago em {formatDate(tax.paidAt!)}</p>
      ) : (
        <p className={`text-xs ${tax.status === "ATRASADO" ? "font-medium text-danger" : "text-slate-500"}`}>
          {formatDueDistance(daysUntil(tax.dueDate))}
        </p>
      )}
    </div>
  );
}

type RowActionsProps = {
  tax: TaxDTO;
  onPay: () => void;
  onUnpay: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function RowActions({ tax, onPay, onUnpay, onEdit, onDelete }: RowActionsProps) {
  const iconButton = "rounded-lg p-2 text-slate-500 hover:bg-slate-100";
  return (
    <div className="flex items-center justify-end gap-1">
      {tax.paymentCode && tax.status !== "PAGO" && <CopyButton value={tax.paymentCode} />}
      {tax.status === "PAGO" ? (
        <button type="button" onClick={onUnpay} className={`${iconButton} hover:text-navy`} aria-label={`Estornar pagamento de ${tax.name}`} title="Estornar pagamento">
          <Undo2 className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onPay}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-brand/90"
        >
          <CircleCheckBig className="size-4" aria-hidden />
          Dar baixa
        </button>
      )}
      <button type="button" onClick={onEdit} className={`${iconButton} hover:text-navy`} aria-label={`Editar ${tax.name}`} title="Editar">
        <Pencil className="size-4" />
      </button>
      <button type="button" onClick={onDelete} className={`${iconButton} hover:text-danger`} aria-label={`Excluir ${tax.name}`} title="Excluir">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function TaxesPage() {
  // Filtros na URL: ?status=ATRASADO&mes=2026-09&q=das&page=2
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const statusParam = searchParams.get("status");
  const status = EFFECTIVE_STATUSES.find((s) => s === statusParam);
  const referenceMonth = searchParams.get("mes") || undefined;
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim());

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxDTO | null>(null);
  const [paying, setPaying] = useState<TaxDTO | null>(null);
  const [deleting, setDeleting] = useState<TaxDTO | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useTaxes({ page, status, referenceMonth, search });
  const setPayment = useSetTaxPayment();
  const remove = useDeleteTax();
  const toast = useToast();


  /** Altera um filtro e volta para a página 1. */
  function setFilter(key: "status" | "mes" | "q", value: string | undefined) {
    setSearchParams(
      () => {
        const params = currentParams();
        if (value) params.set(key, value);
        else params.delete(key);
        params.delete("page");
        return params;
      },
      { replace: key === "q" },
    );
  }

  function goToPage(next: number) {
    setSearchParams(() => {
      const params = currentParams();
      if (next > 1) params.set("page", String(next));
      else params.delete("page");
      return params;
    });
  }

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

  const hasFilter = Boolean(status || referenceMonth || search);
  const rowActions = (tax: TaxDTO) => (
    <RowActions
      tax={tax}
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
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Impostos</h1>
          <p className="mt-1 text-sm text-slate-500">Guias e tributos a pagar: DARF, DAS, IPTU, ISS e outros.</p>
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus className="size-4" aria-hidden />
          Novo imposto
        </Button>
      </div>

      {/* Filtros: status, período de apuração e busca, em uma linha no desktop */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Filtrar por status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setFilter("status", tab.value)}
              aria-pressed={status === tab.value}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                status === tab.value ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="filter-month" className="text-sm whitespace-nowrap text-slate-500">
            Apuração
          </label>
          <div className="relative flex-1">
            <input
              id="filter-month"
              type="month"
              value={referenceMonth ?? ""}
              onChange={(e) => setFilter("mes", e.target.value || undefined)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-2 focus:outline-navy/30"
            />
          </div>
          {referenceMonth && (
            <button type="button" onClick={() => setFilter("mes", undefined)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Limpar período">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou código"
            aria-label="Buscar impostos"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-10 pl-9 text-sm placeholder:text-slate-400 focus:outline-2 focus:outline-navy/30"
          />
          {isFetching && !isPending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" aria-label="Carregando" />
          )}
        </div>
      </div>

      {isError && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">Não foi possível carregar os impostos.</p>
          <Button variant="navy" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" aria-hidden />
      ) : data.meta.total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <Landmark className="size-8 text-slate-300" aria-hidden />
          {hasFilter ? (
            <>
              <p className="text-sm text-slate-500">Nenhum imposto encontrado com esses filtros.</p>
              <Button variant="outline" onClick={() => { setSearchInput(""); setSearchParams({}); }}>
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
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Imposto</th>
                  <th className="px-4 py-3">Apuração</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((tax) => (
                  <tr key={tax.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{tax.name}</p>
                      {tax.revenueCode && <p className="text-xs text-slate-500">{tax.revenueCode}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{formatMonthShort(tax.referenceMonth)}</td>
                    <td className="px-4 py-3">
                      <DueCell tax={tax} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800 tabular-nums">{formatBRL(tax.amountCents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tax.status} />
                    </td>
                    <td className="px-4 py-3">{rowActions(tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {data.data.map((tax) => (
              <li key={tax.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{tax.name}</p>
                    <p className="text-xs text-slate-500">
                      Apuração {formatMonthShort(tax.referenceMonth)}
                      {tax.revenueCode && ` · ${tax.revenueCode}`}
                    </p>
                  </div>
                  <StatusBadge status={tax.status} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <DueCell tax={tax} />
                  <p className="text-lg font-semibold text-slate-800 tabular-nums">{formatBRL(tax.amountCents)}</p>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">{rowActions(tax)}</div>
              </li>
            ))}
          </ul>

          <Pagination meta={data.meta} onPageChange={goToPage} />
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
