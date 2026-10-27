import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Building2, Loader2, Mail, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { formatDocument, type SupplierDTO } from "@tributoleao/shared";
import { useSuppliers } from "../../lib/suppliers";
import { maskPhone } from "../../lib/masks";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { currentParams } from "../../lib/urlParams";
import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/ui/Pagination";
import { SupplierFormDialog } from "./SupplierFormDialog";
import { DeleteSupplierDialog } from "./DeleteSupplierDialog";

function RowActions({ supplier, onEdit, onDelete }: { supplier: SupplierDTO; onEdit: () => void; onDelete: () => void }) {
  const iconButton = "rounded-lg p-2 text-slate-500 hover:bg-slate-100";
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onEdit} className={`${iconButton} hover:text-navy`} aria-label={`Editar ${supplier.legalName}`}>
        <Pencil className="size-4" />
      </button>
      <button type="button" onClick={onDelete} className={`${iconButton} hover:text-danger`} aria-label={`Excluir ${supplier.legalName}`}>
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function Contact({ supplier }: { supplier: SupplierDTO }) {
  if (!supplier.email && !supplier.phone) return <span className="text-slate-400">—</span>;
  return (
    <div className="space-y-0.5 text-xs text-slate-600">
      {supplier.email && (
        <p className="flex items-center gap-1.5 truncate">
          <Mail className="size-3.5 shrink-0 text-slate-400" aria-hidden />
          {supplier.email}
        </p>
      )}
      {supplier.phone && (
        <p className="flex items-center gap-1.5">
          <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden />
          {maskPhone(supplier.phone)}
        </p>
      )}
    </div>
  );
}

export function SuppliersPage() {
  // Busca e página ficam na URL: recarregar ou compartilhar o link mantém o estado
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const search = useDebouncedValue(searchInput.trim());

  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<SupplierDTO | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useSuppliers({ page, search });

  // Nova busca volta para a página 1
  useEffect(() => {
    if (search === (searchParams.get("q") ?? "")) return;
    setSearchParams(search ? { q: search } : {}, { replace: true });
  }, [search, searchParams, setSearchParams]);

  // Excluir o último item de uma página a deixa vazia: volta uma página
  useEffect(() => {
    if (data && data.data.length === 0 && page > 1) goToPage(data.meta.totalPages);
  });

  function goToPage(next: number) {
    setSearchParams(() => {
      const params = currentParams();
      if (next > 1) params.set("page", String(next));
      else params.delete("page");
      return params;
    });
  }

  const openForm = (supplier: SupplierDTO | null) => {
    setEditing(supplier);
    setFormOpen(true);
  };

  const hasFilter = search.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Fornecedores</h1>
          <p className="mt-1 text-sm text-slate-500">Empresas e pessoas de quem você recebe boletos.</p>
        </div>
        <Button onClick={() => openForm(null)}>
          <Plus className="size-4" aria-hidden />
          Novo fornecedor
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar por razão social, nome fantasia ou CPF/CNPJ"
          aria-label="Buscar fornecedores"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-10 pl-9 text-sm placeholder:text-slate-400 focus:outline-2 focus:outline-navy/30"
        />
        {isFetching && !isPending && (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" aria-label="Buscando" />
        )}
      </div>

      {isError && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-600">Não foi possível carregar os fornecedores.</p>
          <Button variant="navy" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" aria-hidden />
      ) : data.meta.total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <Building2 className="size-8 text-slate-300" aria-hidden />
          {hasFilter ? (
            <p className="text-sm text-slate-500">Nenhum fornecedor encontrado para “{search}”.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500">Você ainda não cadastrou fornecedores.</p>
              <Button variant="outline" onClick={() => openForm(null)}>
                <Plus className="size-4" aria-hidden />
                Cadastrar o primeiro
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Fornecedor</th>
                  <th className="px-4 py-3">CPF/CNPJ</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Contato</th>
                  <th className="px-4 py-3 text-right">Boletos</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="max-w-64 px-4 py-3">
                      <p className="truncate font-medium text-slate-800">{s.legalName}</p>
                      {s.tradeName && <p className="truncate text-xs text-slate-500">{s.tradeName}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">{formatDocument(s.document)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.category ?? <span className="text-slate-400">—</span>}</td>
                    <td className="max-w-56 px-4 py-3">
                      <Contact supplier={s} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">{s.boletoCount}</td>
                    <td className="px-4 py-3">
                      <RowActions supplier={s} onEdit={() => openForm(s)} onDelete={() => setDeleting(s)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cartões */}
          <ul className="space-y-3 md:hidden">
            {data.data.map((s) => (
              <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{s.legalName}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{formatDocument(s.document)}</p>
                  </div>
                  <RowActions supplier={s} onEdit={() => openForm(s)} onDelete={() => setDeleting(s)} />
                </div>
                <div className="mt-3 space-y-2">
                  {(s.email || s.phone) && <Contact supplier={s} />}
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {s.category && <span className="rounded-full bg-surface px-2 py-0.5">{s.category}</span>}
                    <span>{s.boletoCount} boleto(s)</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Pagination meta={data.meta} onPageChange={goToPage} />
        </div>
      )}

      <SupplierFormDialog open={formOpen} supplier={editing} onClose={() => setFormOpen(false)} />
      <DeleteSupplierDialog supplier={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
