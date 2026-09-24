import type { WebsiteInfo } from "./website";
import type { Place } from "./types";

export type Tone = "danger" | "warning" | "success" | "neutral";

/** Résumé court de la situation web d'un commerce, pour les listes. */
export function websiteSummary(info: WebsiteInfo): { text: string; tone: Tone } {
  switch (info.kind) {
    case "none":
      return { text: "Pas de site", tone: "danger" };
    case "social":
      return { text: `${info.service} seulement`, tone: "danger" };
    case "platform":
      return { text: `Fiche ${info.service} seulement`, tone: "danger" };
    case "defunct":
      return { text: "Site Google fermé", tone: "danger" };
    case "free":
      return { text: "Site gratuit", tone: "warning" };
    case "site":
      return { text: info.host ?? "Site web", tone: "success" };
  }
}

/** Recherche Google pour vérifier qu'un commerce n'a vraiment pas de site. */
export function googleSearchUrl(place: Pick<Place, "name" | "address">) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${place.name} ${place.address ?? ""}`.trim())}`;
}

export function googleMapsUrl(place: Pick<Place, "name" | "address" | "lat" | "lng" | "source" | "sourceUrl">) {
  if (place.source === "google") return place.sourceUrl;
  const query = place.address ? `${place.name} ${place.address}` : `${place.name} ${place.lat},${place.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
