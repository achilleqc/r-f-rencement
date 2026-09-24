import { categoryForGoogleTypes, googleTypesFor } from "./categories";
import { circlesIntersect, distanceMeters, splitCircle, type Circle } from "./geo";
import { normalizeUrl } from "./website";
import {
  ProviderError,
  type BusinessStatus,
  type FetchFn,
  type NearbyParams,
  type Place,
  type PlacesProvider,
  type SearchOutcome,
} from "./types";

/**
 * Source payante : Google Places API (New).
 * « Nearby Search » renvoie au plus 20 résultats par appel : quand une zone est saturée,
 * elle est découpée en 4 sous-zones (dans la limite d'un budget d'appels par recherche).
 */

const API_BASE = "https://places.googleapis.com/v1";
const MAX_RESULTS_PER_CALL = 20;
const MIN_CELL_RADIUS = 150;

/** Champs demandés : Google facture selon les champs, on ne prend que l'utile. */
export const GOOGLE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "photos",
  "regularOpeningHours",
  "businessStatus",
  "googleMapsUri",
];

export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: unknown[];
  regularOpeningHours?: unknown;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | string;
  googleMapsUri?: string;
};

function businessStatus(value: GooglePlace["businessStatus"]): BusinessStatus {
  if (value === "CLOSED_PERMANENTLY") return "closed_permanently";
  if (value === "CLOSED_TEMPORARILY") return "closed_temporarily";
  return "open";
}

export function normalizeGooglePlace(p: GooglePlace): Place | null {
  const name = p.displayName?.text?.trim();
  if (!name || !p.location) return null;
  const types = p.types ?? [];
  return {
    id: `google:${p.id}`,
    source: "google",
    name,
    category: categoryForGoogleTypes(p.primaryType ? [p.primaryType, ...types] : types),
    typeLabel: p.primaryTypeDisplayName?.text ?? "Commerce",
    address: p.formattedAddress ?? null,
    lat: p.location.latitude,
    lng: p.location.longitude,
    phone: p.nationalPhoneNumber ?? null,
    email: null,
    website: normalizeUrl(p.websiteUri),
    socials: [],
    hasOpeningHours: Boolean(p.regularOpeningHours),
    rating: p.rating ?? null,
    // Google omet ces champs quand la fiche n'a ni avis ni photo : l'absence vaut 0.
    reviewCount: p.userRatingCount ?? 0,
    photoCount: p.photos?.length ?? 0,
    isChain: false,
    status: businessStatus(p.businessStatus),
    sourceUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
  };
}

async function googleError(res: Response) {
  let message = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    message = body.error?.message ?? "";
  } catch {
    // réponse non JSON
  }
  if (res.status === 403 || res.status === 401) {
    return new ProviderError(
      "Clé Google refusée : vérifiez que « Places API (New) » est activée et que la facturation est configurée sur votre projet Google Cloud.",
      res.status,
    );
  }
  if (res.status === 429) return new ProviderError("Quota Google Places atteint : réessayez plus tard.", 429);
  return new ProviderError(`Erreur Google Places (${res.status})${message ? ` : ${message}` : ""}`, res.status);
}

export function maxCallsPerSearch() {
  const value = Number(process.env.GOOGLE_MAX_CALLS_PER_SEARCH);
  return Number.isFinite(value) && value >= 1 ? Math.min(Math.floor(value), 50) : 12;
}

export function createGoogleProvider(apiKey: string, fetchFn: FetchFn = fetch, maxCalls = maxCallsPerSearch()): PlacesProvider {
  async function nearby(cell: Circle, types: string[]): Promise<GooglePlace[]> {
    const res = await fetchFn(`${API_BASE}/places:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GOOGLE_FIELDS.map((f) => `places.${f}`).join(","),
      },
      body: JSON.stringify({
        includedTypes: types,
        maxResultCount: MAX_RESULTS_PER_CALL,
        rankPreference: "DISTANCE",
        languageCode: "fr",
        locationRestriction: {
          circle: {
            center: { latitude: cell.center.lat, longitude: cell.center.lng },
            radius: Math.min(50_000, Math.round(cell.radius)),
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw await googleError(res);
    const data = (await res.json()) as { places?: GooglePlace[] };
    return data.places ?? [];
  }

  return {
    id: "google",
    label: "Google Places",

    async searchNearby({ center, radius, category }: NearbyParams): Promise<SearchOutcome> {
      const types = googleTypesFor(category);
      const area: Circle = { center, radius };
      const found = new Map<string, Place>();
      const queue: Circle[] = [area];
      let calls = 0;
      let truncated = false;

      while (queue.length > 0) {
        if (calls >= maxCalls) {
          truncated = true;
          break;
        }
        const cell = queue.shift()!;
        const results = await nearby(cell, types);
        calls += 1;
        for (const raw of results) {
          const place = normalizeGooglePlace(raw);
          if (place && distanceMeters(center, place) <= radius) found.set(place.id, place);
        }
        if (results.length >= MAX_RESULTS_PER_CALL) {
          if (cell.radius / 2 >= MIN_CELL_RADIUS) queue.push(...splitCircle(cell).filter((c) => circlesIntersect(c, area)));
          else truncated = true;
        }
      }
      return { places: [...found.values()], apiCalls: calls, truncated };
    },

    async getPlace(placeId: string) {
      const id = placeId.replace(/^google:/, "");
      if (!/^[\w-]+$/.test(id)) return null;
      const res = await fetchFn(`${API_BASE}/places/${id}?languageCode=fr`, {
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": GOOGLE_FIELDS.join(",") },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw await googleError(res);
      return normalizeGooglePlace((await res.json()) as GooglePlace);
    },
  };
}
