import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageMeta } from "@tributoleao/shared";

export function Pagination({ meta, onPageChange }: { meta: PageMeta; onPageChange: (page: number) => void }) {
  const { page, pageSize, total, totalPages } = meta;
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const buttonClass =
    "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <nav className="flex items-center justify-between gap-4 text-sm text-slate-500" aria-label="Paginação">
      <p>
        <span className="font-medium text-slate-700">
          {from}–{to}
        </span>{" "}
        de {total}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <span className="hidden sm:inline">
          Página {page} de {totalPages}
        </span>
        <button type="button" className={buttonClass} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <span className="hidden sm:inline">Próxima</span>
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
