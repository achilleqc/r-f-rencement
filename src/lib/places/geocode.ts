import { userAgent } from "./osm";
import { ProviderError, type FetchFn, type LatLng } from "./types";

/**
 * Géocodage d'adresse avec Nominatim (OpenStreetMap), gratuit et sans clé.
 * Politique d'utilisation : 1 requête par seconde au maximum, User-Agent identifiable,
 * résultats mis en cache (voir lib/search.ts).
 */

export type GeocodeResult = LatLng & { label: string };

const MIN_INTERVAL_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** Exécute les appels à Nominatim les uns après les autres, espacés d'au moins une seconde. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

export function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function geocodeAddress(query: string, fetchFn: FetchFn = fetch): Promise<GeocodeResult | null> {
  const base = (process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", "accept-language": "fr" });
  if (process.env.OSM_CONTACT_EMAIL) params.set("email", process.env.OSM_CONTACT_EMAIL);

  const res = await throttled(async () => {
    try {
      return await fetchFn(`${base}/search?${params}`, {
        headers: { "User-Agent": userAgent(), Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ProviderError("Impossible de joindre le service de géolocalisation d'adresses. Réessayez dans un instant.");
    }
  });
  if (!res.ok) throw new ProviderError(`Le service de géolocalisation d'adresses a répondu ${res.status}. Réessayez dans un instant.`, res.status);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const first = data[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon), label: first.display_name };
}
