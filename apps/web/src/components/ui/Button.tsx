import type { ButtonHTMLAttributes } from "preact";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  type = "button",
  variant = "primary",
  class: className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      class={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variant === "primary" ? "bg-cyan-800 text-white hover:bg-cyan-900" : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"} ${className}`}
    />
  );
}
