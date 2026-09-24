"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bouton de soumission avec confirmation (suppression…). */
export function ConfirmButton({ message, children, className }: { message: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={cn("btn btn-danger btn-sm", className)}
    >
      {children}
    </button>
  );
}
