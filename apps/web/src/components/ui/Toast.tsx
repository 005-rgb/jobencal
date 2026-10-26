import type { ComponentChildren } from "preact";

interface ToastProps {
  children: ComponentChildren;
  tone?: "status" | "alert";
}

export function Toast({ children, tone = "status" }: ToastProps) {
  return (
    <div
      class={`rounded-lg border px-4 py-3 ${tone === "alert" ? "border-red-300 bg-red-50 text-red-950" : "border-cyan-200 bg-cyan-50 text-cyan-950"}`}
      role={tone === "alert" ? "alert" : "status"}
      aria-live={tone === "alert" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
