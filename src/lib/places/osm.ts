import { siteConfig } from "@/config/site";
import { categoriesFor, categoryForOsmTags, osmRuleToOverpass, osmTypeLabel, type OsmRule } from "./categories";
import { distanceMeters, offsetMeters } from "./geo";
import { normalizeUrl, socialUrl } from "./website";
import {
  ProviderError,
  type FetchFn,
  type NearbyParams,
  type Place,
  type PlacesProvider,
  type SearchOutcome,
} from "./types";

/**
 * Source gratuite : OpenStreetMap via l'API Overpass.
 * Les données sont collaboratives : un commerce sans site dans OSM peut en avoir un en réalité
 * (d'où le lien « Vérifier sur Google » dans l'interface).
 */

export const OSM_MAX_RESULTS = 1500;
/** Serveurs Overpass publics, essayés dans l'ordre (le suivant prend le relais si l'un échoue). */
const DEFAULT_OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
/** Temps total accordé à une recherche, et à chaque serveur (la page a 60 s au maximum). */
const SEARCH_DEADLINE_MS = 50_000;
const ATTEMPT_TIMEOUT_MS = 25_000;

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export function overpassUrls() {
  const fromEnv = process.env.OVERPASS_URL?.split(",").map((u) => u.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_OVERPASS_URLS;
}

export function userAgent() {
  const contact = process.env.OSM_CONTACT_EMAIL;
  return contact ? `${siteConfig.userAgent} (${contact})` : siteConfig.userAgent;
}

/**
 * Regroupe les règles portant sur le même tag : « shop = boulangerie | boucherie » et
 * « shop = tout sauf alimentation » deviennent une seule instruction, bien plus rapide.
 */
export function mergeOsmRules(rules: readonly OsmRule[]): OsmRule[] {
  const byKey = new Map<string, OsmRule[]>();
  for (const rule of rules) byKey.set(rule.key, [...(byKey.get(rule.key) ?? []), rule]);

  return [...byKey.entries()].map(([key, group]) => {
    if (group.some((r) => !r.values && !r.exclude)) return { key };
    const included = new Set(group.flatMap((r) => r.values ?? []));
    const excludeLists = group.filter((r) => r.exclude).map((r) => r.exclude!);
    if (excludeLists.length === 0) return { key, values: [...included] };
    // Exclu seulement si toutes les règles « sauf » l'excluent et qu'aucune règle ne l'inclut.
    const excluded = excludeLists[0].filter((v) => excludeLists.every((list) => list.includes(v)) && !included.has(v));
    return excluded.length ? { key, exclude: excluded } : { key };
  });
}

/** Carré englobant le cercle de recherche (les commerces des coins sont retirés ensuite). */
export function boundingBox(center: NearbyParams["center"], radius: number) {
  const southWest = offsetMeters(center, -radius, -radius);
  const northEast = offsetMeters(center, radius, radius);
  return [southWest.lat, southWest.lng, northEast.lat, northEast.lng].map((v) => v.toFixed(6)).join(",");
}

/**
 * Requête Overpass : un cadre global ([bbox]) est bien plus rapide à évaluer qu'un filtre
 * « around » répété sur chaque instruction, surtout pour les grands rayons.
 */
export function buildOverpassQuery({ center, radius, category }: NearbyParams, limit = OSM_MAX_RESULTS) {
  const rules = mergeOsmRules(categoriesFor(category).flatMap((c) => c.osm));
  const statements = rules.map((rule) => `  nwr${osmRuleToOverpass(rule)}["name"];`);
  return `[out:json][timeout:25][bbox:${boundingBox(center, radius)}];\n(\n${statements.join("\n")}\n);\nout tags center ${limit};`;
}

function buildAddress(tags: Record<string, string>) {
  if (tags["addr:full"]) return tags["addr:full"];
  const street = [tags["addr:housenumber"], tags["addr:street"] ?? tags["addr:place"]].filter(Boolean).join(" ");
  const city = [tags["addr:postcode"], tags["addr:city"]].filter(Boolean).join(" ");
  const address = [street, city].filter(Boolean).join(", ");
  return address || null;
}

export function normalizeOsmElement(el: OverpassElement): Place | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || lat == null || lng == null) return null;

  const facebook = tags["contact:facebook"] ?? tags.facebook;
  const instagram = tags["contact:instagram"] ?? tags.instagram;
  const socials = [
    facebook ? socialUrl("facebook", facebook) : null,
    instagram ? socialUrl("instagram", instagram) : null,
  ].filter((v): v is string => Boolean(v));

  return {
    id: `osm:${el.type}/${el.id}`,
    source: "osm",
    name,
    category: categoryForOsmTags(tags),
    typeLabel: osmTypeLabel(tags),
    address: buildAddress(tags),
    lat,
    lng,
    phone: (tags.phone ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? tags.mobile)?.split(";")[0].trim() || null,
    email: (tags.email ?? tags["contact:email"])?.split(";")[0].trim() || null,
    website: normalizeUrl(tags.website ?? tags["contact:website"] ?? tags.url),
    socials,
    hasOpeningHours: Boolean(tags.opening_hours),
    rating: null,
    reviewCount: null,
    photoCount: null,
    isChain: Boolean(tags.brand || tags["brand:wikidata"]),
    status: "open",
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

type OverpassResponse = { elements?: OverpassElement[]; remark?: string };

const TOO_SLOW =
  "OpenStreetMap n'a pas répondu à temps : la zone contient beaucoup de commerces. Réduisez le rayon (1 ou 2 km) ou choisissez un type de commerce.";
const BUSY = "Les serveurs OpenStreetMap sont très sollicités en ce moment : réessayez dans une minute.";
const UNREACHABLE = "Impossible de joindre les serveurs OpenStreetMap. Réessayez dans un instant.";

/** Cause lisible d'une erreur réseau (ENOTFOUND, ECONNRESET…). */
function networkCause(error: unknown) {
  const cause = error instanceof Error ? (error.cause as { code?: string; message?: string } | undefined) : undefined;
  return cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : "erreur réseau");
}

async function runOverpass(query: string, fetchFn: FetchFn): Promise<OverpassResponse> {
  const deadline = Date.now() + SEARCH_DEADLINE_MS;
  const attempts: string[] = [];
  // On garde l'erreur la plus parlante (un délai dépassé explique mieux l'échec qu'une coupure réseau).
  let best: { message: string; status?: number; rank: number } | null = null;
  const keep = (message: string, rank: number, status?: number) => {
    if (!best || rank > best.rank) best = { message, status, rank };
  };

  for (const url of overpassUrls()) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    const host = new URL(url).host;
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": userAgent(),
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
      });
    } catch (error) {
      const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      attempts.push(`${host} : ${timeout ? "délai dépassé" : networkCause(error)}`);
      if (timeout) keep(TOO_SLOW, 3);
      else keep(UNREACHABLE, 1);
      continue;
    }

    if (res.ok) {
      let data: OverpassResponse;
      try {
        data = (await res.json()) as OverpassResponse;
      } catch {
        attempts.push(`${host} : réponse illisible`);
        keep(UNREACHABLE, 1);
        continue;
      }
      if (!data.elements?.length && data.remark && /timed out|out of memory|error/i.test(data.remark)) {
        attempts.push(`${host} : ${data.remark.slice(0, 120)}`);
        keep(TOO_SLOW, 3);
        continue;
      }
      return data;
    }

    attempts.push(`${host} : erreur ${res.status}`);
    await res.body?.cancel().catch(() => undefined);
    if (res.status === 400) {
      // Requête invalide : inutile d'essayer un autre serveur.
      keep("OpenStreetMap a refusé la recherche (requête invalide).", 4, 400);
      break;
    }
    if (res.status === 429) keep(BUSY, 2, 429);
    else if (res.status === 504) keep(TOO_SLOW, 3, 504);
    else keep(`Erreur des serveurs OpenStreetMap (${res.status}).`, 1, res.status);
  }

  const failure = best as { message: string; status?: number } | null;
  const details = attempts.join(" · ");
  if (details) console.error(`[overpass] échec : ${details}`);
  throw new ProviderError(failure?.message ?? "Aucun serveur OpenStreetMap configuré.", failure?.status, details || undefined);
}

export function createOsmProvider(fetchFn: FetchFn = fetch): PlacesProvider {
  return {
    id: "osm",
    label: "OpenStreetMap",

    async searchNearby(params: NearbyParams): Promise<SearchOutcome> {
      const data = await runOverpass(buildOverpassQuery(params), fetchFn);
      const elements = data.elements ?? [];
      const seen = new Set<string>();
      const places: Place[] = [];
      for (const el of elements) {
        const place = normalizeOsmElement(el);
        // La requête couvre le carré englobant : on ne garde que le cercle demandé.
        if (!place || seen.has(place.id) || distanceMeters(params.center, place) > params.radius) continue;
        seen.add(place.id);
        places.push(place);
      }
      return { places, apiCalls: 1, truncated: elements.length >= OSM_MAX_RESULTS };
    },

    async getPlace(placeId: string) {
      const match = /^osm:(node|way|relation)\/(\d+)$/.exec(placeId);
      if (!match) return null;
      const [, type, id] = match;
      const data = await runOverpass(`[out:json][timeout:25];\n${type}(${id});\nout tags center;`, fetchFn);
      const el = data.elements?.[0];
      return el ? normalizeOsmElement(el) : null;
    },
  };
}
