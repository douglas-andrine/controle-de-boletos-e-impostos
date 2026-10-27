import { onlyDigits } from "@tributoleao/shared";
import { formatCentsPlain } from "../../lib/format";
import { Field } from "./Field";

const MAX_DIGITS = 11; // até R$ 999.999.999,99

type MoneyFieldProps = {
  label: string;
  value: number; // centavos
  onChange: (cents: number) => void;
  onBlur?: () => void;
  error?: string;
  name?: string;
};

/**
 * Valor em reais digitado como em app de banco: os dígitos entram pela direita
 * ("1" → 0,01; "1234" → 12,34). O formulário recebe sempre centavos inteiros.
 */
export function MoneyField({ label, value, onChange, onBlur, error, name }: MoneyFieldProps) {
  return (
    <Field
      label={label}
      name={name}
      prefix="R$"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0,00"
      value={value > 0 ? formatCentsPlain(value) : ""}
      onChange={(e) => onChange(Number(onlyDigits(e.target.value).slice(-MAX_DIGITS) || 0))}
      onBlur={onBlur}
      error={error}
      className="[&_input]:text-right [&_input]:tabular-nums"
    />
  );
}
