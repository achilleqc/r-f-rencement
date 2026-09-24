"use client";

import { useState } from "react";
import { Check, CircleHelp, Gauge, LoaderCircle, X } from "lucide-react";
import type { SiteAudit } from "@/lib/site-audit";
import { cn } from "@/lib/utils";

export function AuditResult({ audit }: { audit: SiteAudit }) {
  const date = new Date(audit.auditedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className={cn("font-bold", audit.passed === audit.total ? "text-success" : "text-ink")}>
          {audit.passed}/{audit.total} critères remplis
        </span>
        <span className="text-muted" suppressHydrationWarning> · analysé le {date}</span>
      </p>
      <ul className="space-y-1.5 text-sm">
        {audit.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            {c.ok === true && <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="OK" />}
            {c.ok === false && <X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="À améliorer" />}
            {c.ok === null && <CircleHelp className="mt-0.5 size-4 shrink-0 text-subtle" aria-label="Inconnu" />}
            <span>
              <span className="font-medium">{c.label}</span>
              {c.detail && <span className="text-muted"> : {c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bouton « Analyser le site » + résultat. Avec `prospectId`, l'analyse est enregistrée sur le prospect. */
export function AuditPanel({ url, prospectId, initial }: { url: string; prospectId?: string; initial?: SiteAudit | null }) {
  const [audit, setAudit] = useState<SiteAudit | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, prospectId }),
      });
      const data = (await res.json()) as { audit?: SiteAudit; error?: string };
      if (!res.ok || !data.audit) throw new Error(data.error ?? "Analyse impossible.");
      setAudit(data.audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {audit && <AuditResult audit={audit} />}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button type="button" onClick={run} disabled={loading} className="btn btn-secondary btn-sm">
        {loading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Gauge className="size-3.5" />}
        {loading ? "Analyse en cours…" : audit ? "Relancer l'analyse" : "Analyser le site"}
      </button>
    </div>
  );
}
