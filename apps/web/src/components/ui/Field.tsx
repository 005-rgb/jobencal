import type { ComponentChildren } from "preact";

interface FieldProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ComponentChildren;
}

export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div class="grid gap-1.5">
      <label class="font-medium text-slate-900" for={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p class="text-sm text-slate-600" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p class="text-sm text-red-800" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
