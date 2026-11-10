import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

/** Botão "Modo escuro"/"Modo claro". `className` define a aparência de cada lugar onde ele aparece. */
export function ThemeToggle({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Modo claro" : "Modo escuro";
  const Icon = dark ? Sun : Moon;

  return (
    <button type="button" onClick={toggleTheme} className={className} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}>
      <Icon className={iconOnly ? "size-5" : "size-4"} aria-hidden />
      {!iconOnly && label}
    </button>
  );
}
