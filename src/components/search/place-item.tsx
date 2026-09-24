"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronDown, LoaderCircle, Plus, UserCheck } from "lucide-react";
import { addProspect } from "@/app/actions/prospects";
import { AuditPanel } from "@/components/places/audit-panel";
import { PlaceContact, PlaceLinks, ScoreFactors } from "@/components/places/place-facts";
import { Badge } from "@/components/ui/badge";
import { LevelLabel, ScoreBadge } from "@/components/ui/score-badge";
import type { ScoredPlace } from "@/lib/places/enrich";
import { websiteSummary } from "@/lib/places/labels";
import { hasOwnSite } from "@/lib/places/website";
import { cn, formatDistance } from "@/lib/utils";

type Props = {
  place: ScoredPlace;
  selected: boolean;
  expanded: boolean;
  prospectId: string | undefined;
  onToggle: () => void;
  onSaved: (placeId: string, prospectId: string) => void;
};

export function PlaceItem({ place, selected, expanded, prospectId, onToggle, onSaved }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const site = websiteSummary(place.visibility.website);

  function save() {
    setError(null);
    startTransition(async () => {
      // Le serveur ne garde que les champs du commerce et recalcule lui-même le score.
      const result = await addProspect(place);
      if (result.ok) onSaved(place.id, result.id);
      else setError(result.message);
    });
  }

  return (
    <li
      id={`place-${place.id}`}
      className={cn("scroll-mt-20 rounded-xl border bg-surface transition-shadow", selected ? "border-accent shadow-soft" : "border-line")}
    >
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-start gap-3 p-3 text-left">
        <ScoreBadge score={place.visibility.score} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-semibold">{place.name}</span>
            {prospectId && <UserCheck className="size-4 shrink-0 text-accent" aria-label="Déjà dans vos prospects" />}
          </span>
          <span className="block truncate text-xs text-muted">
            {place.typeLabel} · {formatDistance(place.distance)}
            {place.address ? ` · ${place.address}` : ""}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            <Badge tone={site.tone}>{site.text}</Badge>
            {place.reviewCount != null && (
              <Badge tone={place.reviewCount < 10 ? "warning" : "neutral"}>
                {place.reviewCount} avis{place.rating != null ? ` · ${place.rating.toLocaleString("fr-FR")}★` : ""}
              </Badge>
            )}
            {!place.phone && <Badge>Pas de téléphone</Badge>}
            {place.isChain && <Badge>Chaîne / réseau</Badge>}
            {place.status === "closed_temporarily" && <Badge tone="warning">Fermé temporairement</Badge>}
            {place.status === "closed_permanently" && <Badge tone="danger">Fermé définitivement</Badge>}
          </span>
        </span>
        <ChevronDown className={cn("mt-2 size-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-line p-3 sm:p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-muted uppercase">
                Score {place.visibility.score}/100 · <LevelLabel score={place.visibility.score} />
              </h3>
              <ScoreFactors factors={place.visibility.factors} />
            </section>
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Coordonnées</h3>
              <PlaceContact place={place} />
            </section>
          </div>

          {hasOwnSite(place.visibility.website) && place.website && (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Qualité du site</h3>
              <AuditPanel url={place.website} />
            </section>
          )}

          <PlaceLinks place={place} />

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            {prospectId ? (
              <Link href={`/prospects/${prospectId}`} className="btn btn-secondary btn-sm">
                <UserCheck className="size-3.5" /> Voir le prospect
              </Link>
            ) : (
              <button type="button" onClick={save} disabled={pending} className="btn btn-primary btn-sm">
                {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Ajouter aux prospects
              </button>
            )}
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          </div>
        </div>
      )}
    </li>
  );
}
