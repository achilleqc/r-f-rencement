import { Check, CircleHelp, ExternalLink, Globe, Mail, MapPin, Phone, Search, X } from "lucide-react";
import { googleMapsUrl, googleSearchUrl } from "@/lib/places/labels";
import type { ScoreFactor } from "@/lib/places/score";
import type { Place } from "@/lib/places/types";
import { cn } from "@/lib/utils";

/** Liste des critères du score, avec les points perdus. */
export function ScoreFactors({ factors }: { factors: ScoreFactor[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {factors.map((f) => (
        <li key={f.id} className="flex items-start gap-2">
          {f.status === "good" && <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="OK" />}
          {f.status === "bad" && <X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="À améliorer" />}
          {f.status === "unknown" && <CircleHelp className="mt-0.5 size-4 shrink-0 text-subtle" aria-label="Inconnu" />}
          <span className="min-w-0 flex-1">
            <span className="font-medium">{f.label}</span>
            {f.detail && <span className={cn("text-muted", f.status === "bad" && "text-ink-soft")}> : {f.detail}</span>}
          </span>
          {f.penalty > 0 && <span className="shrink-0 text-xs font-semibold text-danger tabular-nums">−{f.penalty}</span>}
        </li>
      ))}
    </ul>
  );
}

function ContactLine({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/** Coordonnées connues du commerce. */
export function PlaceContact({ place }: { place: Place }) {
  return (
    <ul className="space-y-1.5 text-sm">
      <ContactLine icon={MapPin}>{place.address ?? <span className="text-muted">Adresse non renseignée</span>}</ContactLine>
      {place.phone && (
        <ContactLine icon={Phone}>
          <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className="link">{place.phone}</a>
        </ContactLine>
      )}
      {place.email && (
        <ContactLine icon={Mail}>
          <a href={`mailto:${place.email}`} className="link">{place.email}</a>
        </ContactLine>
      )}
      {place.website && (
        <ContactLine icon={Globe}>
          <a href={place.website} target="_blank" rel="noreferrer nofollow" className="link">{place.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>
        </ContactLine>
      )}
      {place.socials.map((url) => (
        <ContactLine key={url} icon={Globe}>
          <a href={url} target="_blank" rel="noreferrer nofollow" className="link">{url.replace(/^https?:\/\/(www\.)?/, "")}</a>
        </ContactLine>
      ))}
    </ul>
  );
}

/** Liens pour vérifier le commerce ailleurs (utile avec OpenStreetMap, parfois incomplet). */
export function PlaceLinks({ place }: { place: Place }) {
  const linkClass = "btn btn-secondary btn-sm";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={googleSearchUrl(place)} target="_blank" rel="noreferrer" className={linkClass}>
        <Search className="size-3.5" /> Vérifier sur Google
      </a>
      <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer" className={linkClass}>
        <MapPin className="size-3.5" /> Google Maps
      </a>
      {place.source === "osm" && (
        <a href={place.sourceUrl} target="_blank" rel="noreferrer" className={linkClass}>
          <ExternalLink className="size-3.5" /> OpenStreetMap
        </a>
      )}
    </div>
  );
}
