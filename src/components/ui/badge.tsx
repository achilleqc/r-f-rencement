import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-paper text-ink-soft ring-line",
  danger: "bg-danger/10 text-danger ring-danger/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  success: "bg-success/10 text-success ring-success/20",
  accent: "bg-accent-soft text-accent-deep ring-accent/20",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}
