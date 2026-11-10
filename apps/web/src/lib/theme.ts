// Tema claro/escuro: <html data-theme="light|dark">. O index.html aplica o tema antes
// da primeira pintura (sem piscar branco); aqui ficam a troca e a sincronização.
// O atributo no <html> é a fonte da verdade, compartilhada por todos os botões.
import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "tributoleao:theme";
// Cor da barra do navegador no celular, acompanhando o fundo de cada tema
const THEME_COLORS: Record<Theme, string> = { light: "#0B2545", dark: "#0A1120" };

const listeners = new Set<() => void>();
const media = window.matchMedia("(prefers-color-scheme: dark)");
const systemTheme = (): Theme => (media.matches ? "dark" : "light");

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null; // modo privado ou armazenamento bloqueado: segue o sistema
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  listeners.forEach((notify) => notify());
}

// Enquanto a pessoa não escolheu, o tema acompanha o do sistema
media.addEventListener("change", () => {
  if (!storedTheme()) applyTheme(systemTheme());
});

const getTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // sem armazenamento: a troca vale só até recarregar
    }
    applyTheme(next);
  };

  return { theme, toggleTheme };
}
