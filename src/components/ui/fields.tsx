import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  name,
  error,
  hint,
  className,
  ...props
}: { label: string; name: string; error?: string; hint?: ReactNode } & ComponentProps<"input">) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}</label>
      <input
        id={name}
        name={name}
        className={cn("field", error && "border-danger")}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={`${name}-error`} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function FormMessage({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn("rounded-xl px-4 py-3 text-sm font-medium", ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}
    >
      {message}
    </p>
  );
}
