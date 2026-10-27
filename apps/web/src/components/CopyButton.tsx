import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "./ui/Toast";

export function CopyButton({ value, label = "Copiar código" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast({ message: "Não foi possível copiar. Copie manualmente.", tone: "error" });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      aria-label={copied ? "Código copiado" : label}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      {copied ? <Check className="size-4 text-emerald-brand" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}
