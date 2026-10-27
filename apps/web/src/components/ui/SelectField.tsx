import { useId, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

type SelectFieldProps = ComponentProps<"select"> & { label: string; error?: string };

export function SelectField({ label, error, id, className = "", children, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`w-full appearance-none rounded-lg border bg-white py-2.5 pr-9 pl-3 text-sm text-slate-800 focus:outline-2 focus:outline-offset-0 ${
            error ? "border-danger focus:outline-danger/40" : "border-slate-300 focus:outline-navy/30"
          }`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
