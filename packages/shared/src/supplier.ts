/** Nome de exibição do fornecedor: nome fantasia; registros antigos sem ele mostram a razão social. */
export function supplierName(s: { tradeName: string | null; legalName: string | null }): string {
  return s.tradeName ?? s.legalName ?? "";
}
