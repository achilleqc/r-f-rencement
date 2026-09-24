import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { CalendarClock, Download, Search } from "lucide-react";
import { db } from "@/db";
import { PROSPECT_STATUSES, prospects, type ProspectStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/ui/score-badge";
import { requireUser } from "@/lib/auth";
import { CLOSED_STATUSES, endOfToday, STATUS_LABELS } from "@/lib/prospects";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Prospects" };

const STATUS_TONES: Record<ProspectStatus, "neutral" | "accent" | "warning" | "success" | "danger"> = {
  a_contacter: "accent",
  contacte: "neutral",
  interesse: "warning",
  client: "success",
  pas_interesse: "danger",
};

export default async function ProspectsPage({ searchParams }: PageProps<"/prospects">) {
  const user = await requireUser("/prospects");
  const sp = await searchParams;
  const status = (PROSPECT_STATUSES as readonly string[]).includes(String(sp.statut)) ? (sp.statut as ProspectStatus) : null;

  const [rows, counts] = await Promise.all([
    db.query.prospects.findMany({
      where: status ? and(eq(prospects.userId, user.id), eq(prospects.status, status)) : eq(prospects.userId, user.id),
      // Relances d'abord (les plus anciennes en premier), puis les plus récents.
      orderBy: [sql`${prospects.followUpAt} is null`, asc(prospects.followUpAt), desc(prospects.updatedAt)],
      columns: { snapshot: false, audit: false },
    }),
    db.select({ status: prospects.status, n: count() }).from(prospects).where(eq(prospects.userId, user.id)).groupBy(prospects.status),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<ProspectStatus, number>>;
  const total = counts.reduce((sum, c) => sum + c.n, 0);
  const todayEnd = endOfToday();
  const isDue = (p: (typeof rows)[number]) => p.followUpAt != null && p.followUpAt <= todayEnd && !CLOSED_STATUSES.includes(p.status);
  const due = rows.filter(isDue).length;

  const tabs: [ProspectStatus | null, string, number][] = [
    [null, "Tous", total],
    ...PROSPECT_STATUSES.map((s) => [s, STATUS_LABELS[s], byStatus[s] ?? 0] as [ProspectStatus, string, number]),
  ];

  return (
    <div className="container-page space-y-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prospects</h1>
          <p className="text-sm text-muted">Les commerces que vous avez enregistrés depuis la recherche.</p>
        </div>
        {total > 0 && (
          <a href={`/prospects/export${status ? `?statut=${status}` : ""}`} className="btn btn-secondary btn-sm">
            <Download className="size-3.5" /> Export CSV
          </a>
        )}
      </div>

      {sp.supprime && <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">Prospect supprimé.</p>}

      {due > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          <CalendarClock className="size-4" /> {due} relance{due > 1 ? "s" : ""} à faire aujourd&apos;hui ou en retard.
        </p>
      )}

      <nav aria-label="Filtrer par statut" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tabs.map(([value, label, n]) => (
          <Link
            key={label}
            href={value ? `/prospects?statut=${value}` : "/prospects"}
            aria-current={status === value ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold",
              status === value ? "bg-ink text-white" : "bg-surface text-muted ring-1 ring-line hover:text-ink",
            )}
          >
            {label} <span className="opacity-70">{n}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">
            {total === 0 ? "Aucun prospect pour l'instant." : "Aucun prospect avec ce statut."}
          </p>
          {total === 0 && (
            <Link href="/recherche" className="btn btn-primary mt-4">
              <Search className="size-4" /> Lancer une recherche
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/prospects/${p.id}`} className="card flex h-full items-start gap-3 p-3 transition-shadow hover:shadow-soft">
                <ScoreBadge score={p.score} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {p.typeLabel}
                    {p.address ? ` · ${p.address}` : ""}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    <Badge tone={STATUS_TONES[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    {p.followUpAt && !CLOSED_STATUSES.includes(p.status) && (
                      <Badge tone={isDue(p) ? "danger" : "neutral"}>
                        <CalendarClock className="size-3" /> {formatDate(p.followUpAt)}
                      </Badge>
                    )}
                    {p.phone && <span className="text-xs text-muted">{p.phone}</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
