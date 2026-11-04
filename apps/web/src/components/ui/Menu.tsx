import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export type MenuItem = {
  label: string;
  Icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  selected?: boolean;
};

type MenuProps = {
  /** Conteúdo do botão que abre o menu. */
  trigger: ReactNode;
  triggerLabel: string;
  triggerClassName: string;
  items: MenuItem[];
};

/**
 * Menu suspenso. Renderizado num portal com posição fixa para não ser cortado
 * pelo `overflow` das tabelas; fecha ao clicar fora, com Esc ou ao rolar.
 */
export function Menu({ trigger, triggerLabel, triggerClassName, items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    // Abre para cima quando não cabe abaixo do botão
    const below = rect.bottom + 4 + menuHeight <= window.innerHeight;
    setPosition({ top: below ? rect.bottom + 4 : rect.top - 4 - menuHeight, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    // preventScroll: rolar a página aqui dispararia o `close` do listener de scroll
    menuRef.current?.querySelector("button")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={triggerLabel}
        title={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={position ? { top: position.top, right: position.right } : { visibility: "hidden" }}
            className="fixed z-50 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            {items.map(({ label, Icon, onSelect, danger, selected }) => (
              <button
                key={label}
                type="button"
                role={selected === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={selected}
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap focus:outline-none ${
                  danger ? "text-danger hover:bg-danger/5 focus:bg-danger/5" : "text-slate-700 hover:bg-slate-100 focus:bg-slate-100"
                } ${selected ? "font-medium text-navy" : ""}`}
              >
                {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
