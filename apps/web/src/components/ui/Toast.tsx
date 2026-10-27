import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CircleCheck, CircleAlert, X } from "lucide-react";

type ToastOptions = {
  message: string;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
};
type Toast = ToastOptions & { id: number };

const ToastContext = createContext<(options: ToastOptions) => void>(() => {});

const DURATION_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { ...options, id }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => {
          const Icon = toast.tone === "error" ? CircleAlert : CircleCheck;
          return (
            <div
              key={toast.id}
              role="status"
              className="flex w-full max-w-md items-center gap-3 rounded-lg bg-navy px-4 py-3 text-sm text-white shadow-lg"
            >
              <Icon className={`size-5 shrink-0 ${toast.tone === "error" ? "text-danger" : "text-emerald-400"}`} aria-hidden />
              <span className="flex-1">{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onClick();
                    dismiss(toast.id);
                  }}
                  className="font-semibold text-gold hover:underline"
                >
                  {toast.action.label}
                </button>
              )}
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Fechar aviso" className="text-slate-400 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
