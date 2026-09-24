import { createGoogleProvider } from "./google";
import { createOsmProvider } from "./osm";
import type { PlaceSource, PlacesProvider } from "./types";

/** Google Places si une clé est configurée, sinon OpenStreetMap (gratuit). */
export function getProvider(): PlacesProvider {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key ? createGoogleProvider(key) : createOsmProvider();
}

/** Fournisseur capable de relire un commerce enregistré (selon sa source d'origine). */
export function getProviderFor(source: PlaceSource): PlacesProvider | null {
  if (source === "osm") return createOsmProvider();
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key ? createGoogleProvider(key) : null;
}

export * from "./types";
