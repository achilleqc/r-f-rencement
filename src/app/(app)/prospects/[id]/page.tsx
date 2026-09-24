import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { deleteProspect } from "@/app/actions/prospects";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { AuditPanel } from "@/components/places/audit-panel";
import { PlaceContact, PlaceLinks, ScoreFactors } from "@/components/places/place-facts";
import { ProspectFollowUpForm, RefreshProspectForm } from "@/components/prospects/prospect-forms";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { LevelLabel, ScoreBadge } from "@/components/ui/score-badge";
import { requireUser } from "@/lib/auth";
import type { Place } from "@/lib/places";
import { computeVisibilityScore } from "@/lib/places/score";
import { hasOwnSite } from "@/lib/places/website";
import type { SiteAudit } from "@/lib/site-audit";
import { formatDate, toDateInput } from "@/lib/utils";

export const metadata: Metadata = { title: "Prospect" };

function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide text-muted uppercase">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default async function ProspectPage({ params }: PageProps<"/prospects/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/prospects/${id}`);
  const prospect = await db.query.prospects.findFirst({ where: and(eq(prospects.id, id), eq(prospects.userId, user.id)) });
  if (!prospect) notFound();

  const place = JSON.parse(prospect.snapshot) as Place;
  const visibility = computeVisibilityScore(place);
  const audit = prospect.audit ? (JSON.parse(prospect.audit) as SiteAudit) : null;

  return (
    <div className="container-page max-w-5xl space-y-4 py-6">
      <Link href="/prospects" className="text-sm font-semibold text-muted hover:text-ink">← Prospects</Link>

      <header className="flex items-start gap-4">
        <ScoreBadge score={visibility.score} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{prospect.name}</h1>
          <p className="text-sm text-muted">
            {prospect.typeLabel} · <LevelLabel score={visibility.score} /> · ajouté le {formatDate(prospect.createdAt)}
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Section title="Suivi">
            <ProspectFollowUpForm
              id={prospect.id}
              status={prospect.status}
              notes={prospect.notes}
              followUpAt={toDateInput(prospect.followUpAt)}
            />
          </Section>

          {hasOwnSite(visibility.website) && prospect.website && (
            <Section title="Qualité du site">
              <AuditPanel url={prospect.website} prospectId={prospect.id} initial={audit} />
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section title="Coordonnées">
            <div className="space-y-4">
              <PlaceContact place={place} />
              <PlaceLinks place={place} />
            </div>
          </Section>

          <Section title={`Présence en ligne : ${visibility.score}/100`}>
            <ScoreFactors factors={visibility.factors} />
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-xs text-muted">
                Informations relevées le {formatDate(prospect.snapshotAt)} ({place.source === "google" ? "Google" : "OpenStreetMap"}).
              </p>
              <RefreshProspectForm id={prospect.id} />
            </div>
          </Section>

          <Section title="Supprimer">
            <p className="mb-3 text-sm text-muted">
              Supprime définitivement ce prospect, vos notes et l&apos;analyse de son site (par exemple à la demande du commerçant).
            </p>
            <form action={deleteProspect}>
              <input type="hidden" name="id" value={prospect.id} />
              <ConfirmButton message={`Supprimer définitivement « ${prospect.name} » ?`}>
                <Trash2 className="size-4" /> Supprimer ce prospect
              </ConfirmButton>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
