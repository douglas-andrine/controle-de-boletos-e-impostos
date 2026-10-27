/**
 * Parâmetros da URL atual. O `searchParams` do React Router (inclusive o `prev`
 * do updater funcional) reflete o último render; se dois filtros mudam antes de
 * um novo render, o segundo sobrescreveria o primeiro. `window.location` já está
 * atualizado no momento da navegação.
 */
export function currentParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
