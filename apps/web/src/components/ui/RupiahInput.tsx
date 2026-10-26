import { useState } from "preact/hooks";
import type { TargetedEvent } from "preact";
import { parseRupiahInput } from "@jobenapp/shared";
import { Field } from "./Field.js";

interface RupiahInputProps {
  id: string;
  label: string;
  value: string;
  hint?: string;
  onValueChange: (value: bigint | null) => void;
}

export function RupiahInput({
  id,
  label,
  value,
  hint,
  onValueChange,
}: RupiahInputProps) {
  const [error, setError] = useState<string | undefined>();

  function handleInput(event: TargetedEvent<HTMLInputElement, Event>): void {
    const input = event.currentTarget.value;
    try {
      onValueChange(parseRupiahInput(input));
      setError(undefined);
    } catch {
      onValueChange(null);
      setError("Masukkan angka Rupiah utuh, misalnya 1500000 atau 1.500.000.");
    }
  }

  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
          .filter(Boolean)
          .join(" ") || undefined}
        class="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
        onInput={handleInput}
      />
    </Field>
  );
}
