import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  /** Texto fixo à esquerda do valor, ex.: "R$" */
  prefix?: string;
};

export function Field({ label, error, id, type = "text", prefix, className = "", ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500" aria-hidden>
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type={isPassword && showPassword ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 ${
            error ? "border-danger focus:outline-danger/40" : "border-slate-300 focus:outline-navy/30"
          } ${isPassword ? "pr-10" : ""} ${prefix ? "pl-10" : ""}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
