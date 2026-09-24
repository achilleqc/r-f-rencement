import { distanceMeters } from "./geo";
import { computeVisibilityScore, type VisibilityScore } from "./score";
import type { LatLng, Place } from "./types";

export type ScoredPlace = Place & {
  distance: number;
  visibility: VisibilityScore;
};

/**
 * Ajoute la distance et le score, et repère les réseaux : plusieurs commerces de la zone
 * qui partagent le même site web appartiennent probablement à une chaîne.
 */
export function enrichPlaces(places: Place[], center: LatLng): ScoredPlace[] {
  const scored = places.map((place) => ({
    ...place,
    distance: distanceMeters(center, place),
    visibility: computeVisibilityScore(place),
  }));

  const hostCount = new Map<string, number>();
  for (const p of scored) {
    if (p.visibility.website.kind === "site" && p.visibility.website.host) {
      hostCount.set(p.visibility.website.host, (hostCount.get(p.visibility.website.host) ?? 0) + 1);
    }
  }
  for (const p of scored) {
    const host = p.visibility.website.host;
    if (p.visibility.website.kind === "site" && host && (hostCount.get(host) ?? 0) >= 2) p.isChain = true;
  }

  return scored.sort((a, b) => a.visibility.score - b.visibility.score || a.distance - b.distance);
}
