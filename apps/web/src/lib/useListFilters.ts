import { useSearchParams } from "react-router";
import { currentParams } from "./urlParams";

/**
 * Filtros e página de uma listagem guardados na URL (?status=...&page=2).
 * Mudar um filtro volta para a página 1.
 */
export function useListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  function setFilter(key: string, value: string | undefined) {
    setSearchParams(
      () => {
        const params = currentParams();
        if (value) params.set(key, value);
        else params.delete(key);
        params.delete("page");
        return params;
      },
      // Digitação na busca não deve encher o histórico do navegador
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

  const clearFilters = () => setSearchParams({});

  return { searchParams, page, setFilter, goToPage, clearFilters };
}
