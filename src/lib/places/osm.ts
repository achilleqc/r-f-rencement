import { siteConfig } from "@/config/site";
import { categoriesFor, categoryForOsmTags, osmRuleToOverpass, osmTypeLabel } from "./categories";
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
const DEFAULT_OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

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

export function buildOverpassQuery({ center, radius, category }: NearbyParams, limit = OSM_MAX_RESULTS) {
  const around = `(around:${Math.round(radius)},${center.lat.toFixed(6)},${center.lng.toFixed(6)})`;
  const statements = categoriesFor(category).flatMap((c) =>
    c.osm.map((rule) => `  nwr${around}${osmRuleToOverpass(rule)}["name"];`),
  );
  return `[out:json][timeout:25];\n(\n${statements.join("\n")}\n);\nout tags center ${limit};`;
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

async function runOverpass(query: string, fetchFn: FetchFn): Promise<OverpassResponse> {
  let lastError: ProviderError | null = null;
  for (const url of overpassUrls()) {
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
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      lastError = new ProviderError("Impossible de joindre le serveur OpenStreetMap. Réessayez dans un instant.");
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as OverpassResponse;
      if (!data.elements?.length && data.remark && /timed out|out of memory|error/i.test(data.remark)) {
        lastError = new ProviderError("La zone est trop chargée pour OpenStreetMap : réduisez le rayon ou choisissez une catégorie.");
        continue;
      }
      return data;
    }
    lastError =
      res.status === 429
        ? new ProviderError("Le serveur OpenStreetMap est très sollicité : réessayez dans une minute.", 429)
        : res.status === 504
          ? new ProviderError("OpenStreetMap a mis trop de temps à répondre : réduisez le rayon ou choisissez une catégorie.", 504)
          : new ProviderError(`Erreur du serveur OpenStreetMap (${res.status}).`, res.status);
    // 400 = requête invalide : inutile d'essayer un autre serveur.
    if (res.status === 400) break;
  }
  throw lastError ?? new ProviderError("Aucun serveur OpenStreetMap configuré.");
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
        if (!place || seen.has(place.id)) continue;
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
