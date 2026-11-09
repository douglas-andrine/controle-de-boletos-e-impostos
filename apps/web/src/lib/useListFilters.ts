import { useSearchParams } from "react-router";
import { currentParams } from "./urlParams";

/**
 * Filtros e página de uma listagem guardados na URL (?status=...&page=2).
 * Mudar um filtro volta para a página 1.
 */
export function useListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  /** Muda vários filtros de uma vez (um único passo no histórico). */
  function setFilters(updates: Record<string, string | undefined>) {
    setSearchParams(
      () => {
        const params = currentParams();
        for (const [key, value] of Object.entries(updates)) {
          if (value) params.set(key, value);
          else params.delete(key);
        }
        params.delete("page");
        return params;
      },
      // Digitação na busca não deve encher o histórico do navegador
      { replace: "q" in updates },
    );
  }

  const setFilter = (key: string, value: string | undefined) => setFilters({ [key]: value });

  function goToPage(next: number) {
    setSearchParams(() => {
      const params = currentParams();
      if (next > 1) params.set("page", String(next));
      else params.delete("page");
      return params;
    });
  }

  const clearFilters = () => setSearchParams({});

  return { searchParams, page, setFilter, setFilters, goToPage, clearFilters };
}
