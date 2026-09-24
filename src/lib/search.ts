import "server-only";
import { eq, like, lt, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { apiUsage, geocodeCache, searchCache } from "@/db/schema";
import { geocodeAddress, normalizeQuery, type GeocodeResult } from "@/lib/places/geocode";
import { getProvider, ProviderError, type LatLng, type Place, type PlaceSource } from "@/lib/places";
import type { CategoryFilter } from "@/lib/places/categories";
import { rateLimit } from "@/lib/rate-limit";

/** Durée de conservation des résultats (Google autorise 30 jours au maximum). */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SearchParams = { center: LatLng; radius: number; category: CategoryFilter };

export type SearchResult = {
  places: Place[];
  source: PlaceSource;
  sourceLabel: string;
  truncated: boolean;
  fromCache: boolean;
  cachedAt: Date;
};

type CachedPayload = { places: Place[]; truncated: boolean; sourceLabel: string };

/** Clé de cache : position arrondie à ~100 m, pour réutiliser les recherches voisines. */
export function cacheKey(source: string, { center, radius, category }: SearchParams) {
  return `${source}:${category}:${center.lat.toFixed(3)}:${center.lng.toFixed(3)}:${radius}`;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function recordApiUsage(provider: string, calls: number) {
  if (calls <= 0) return;
  await db
    .insert(apiUsage)
    .values({ day: today(), provider, calls })
    .onConflictDoUpdate({ target: [apiUsage.day, apiUsage.provider], set: { calls: sql`${apiUsage.calls} + ${calls}` } });
}

/** Appels du mois en cours, par fournisseur. */
export async function monthlyApiUsage() {
  const rows = await db
    .select({ provider: apiUsage.provider, calls: sum(apiUsage.calls) })
    .from(apiUsage)
    .where(like(apiUsage.day, `${today().slice(0, 7)}%`))
    .groupBy(apiUsage.provider);
  return Object.fromEntries(rows.map((r) => [r.provider, Number(r.calls ?? 0)])) as Record<string, number>;
}

export async function geocode(query: string, userId: string): Promise<GeocodeResult | null> {
  const key = normalizeQuery(query);
  const cached = await db.query.geocodeCache.findFirst({ where: eq(geocodeCache.query, key) });
  if (cached) return { lat: cached.lat, lng: cached.lng, label: cached.label };

  if (!rateLimit(`geocode:${userId}`, 30, 10 * 60_000).ok) {
    throw new ProviderError("Trop de recherches d'adresses d'affilée : patientez quelques minutes.");
  }
  const result = await geocodeAddress(query);
  await recordApiUsage("nominatim", 1);
  if (result) {
    await db.insert(geocodeCache).values({ query: key, ...result }).onConflictDoNothing();
  }
  return result;
}

export async function searchPlaces(params: SearchParams, userId: string): Promise<SearchResult> {
  const provider = getProvider();
  const key = cacheKey(provider.id, params);
  const now = new Date();

  const cached = await db.query.searchCache.findFirst({ where: eq(searchCache.key, key) });
  if (cached && cached.expiresAt > now) {
    const payload = JSON.parse(cached.payload) as CachedPayload;
    return { ...payload, source: provider.id, fromCache: true, cachedAt: cached.createdAt };
  }

  if (!rateLimit(`search:${userId}`, 30, 10 * 60_000).ok) {
    throw new ProviderError("Trop de recherches d'affilée : patientez quelques minutes (les recherches déjà faites restent disponibles).");
  }

  const outcome = await provider.searchNearby(params);
  await recordApiUsage(provider.id, outcome.apiCalls);

  const payload: CachedPayload = { places: outcome.places, truncated: outcome.truncated, sourceLabel: provider.label };
  await db.delete(searchCache).where(lt(searchCache.expiresAt, now));
  await db
    .insert(searchCache)
    .values({ key, provider: provider.id, payload: JSON.stringify(payload), createdAt: now, expiresAt: new Date(now.getTime() + CACHE_TTL_MS) })
    .onConflictDoUpdate({
      target: searchCache.key,
      set: { payload: JSON.stringify(payload), createdAt: now, expiresAt: new Date(now.getTime() + CACHE_TTL_MS) },
    });

  return { ...payload, source: provider.id, fromCache: false, cachedAt: now };
}

/** Supprime le cache d'une recherche (bouton « Actualiser »). */
export async function clearSearchCache(params: SearchParams) {
  const provider = getProvider();
  await db.delete(searchCache).where(eq(searchCache.key, cacheKey(provider.id, params)));
}
