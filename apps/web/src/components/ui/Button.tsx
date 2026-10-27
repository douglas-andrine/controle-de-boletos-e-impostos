import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-emerald-brand text-white hover:bg-emerald-brand/90 focus-visible:outline-emerald-brand",
  navy: "bg-navy text-white hover:bg-navy-light focus-visible:outline-navy",
  outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-navy",
  gold: "border border-gold bg-gold/10 text-navy hover:bg-gold/20 focus-visible:outline-gold",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-navy",
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  loading?: boolean;
};

export function Button({ variant = "primary", loading, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
