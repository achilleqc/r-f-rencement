import type { CategoryId } from "./categories";

export type LatLng = { lat: number; lng: number };

export type PlaceSource = "osm" | "google";

export type BusinessStatus = "open" | "closed_temporarily" | "closed_permanently";

/** Commerce normalisé, quelle que soit la source des données. */
export type Place = {
  /** « osm:node/123 » ou « google:ChIJ… » */
  id: string;
  source: PlaceSource;
  name: string;
  category: CategoryId | null;
  /** Type lisible : « Boulangerie », « Coiffeur »… */
  typeLabel: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  /** Pages réseaux sociaux connues (OpenStreetMap). */
  socials: string[];
  hasOpeningHours: boolean;
  rating: number | null;
  /** null = inconnu (OpenStreetMap ne connaît pas les avis). */
  reviewCount: number | null;
  /** null = inconnu. */
  photoCount: number | null;
  /** Enseigne d'une chaîne ou d'une franchise (peu de chances d'être un client). */
  isChain: boolean;
  status: BusinessStatus;
  /** Lien vers la fiche d'origine (OpenStreetMap ou Google Maps). */
  sourceUrl: string;
};

export type SearchOutcome = {
  places: Place[];
  /** Nombre d'appels facturables / comptabilisés auprès de la source. */
  apiCalls: number;
  /** Vrai si la zone contient probablement plus de commerces que ceux renvoyés. */
  truncated: boolean;
};

export type NearbyParams = {
  center: LatLng;
  radius: number;
  category: CategoryId | "tous";
};

export interface PlacesProvider {
  id: PlaceSource;
  label: string;
  searchNearby(params: NearbyParams): Promise<SearchOutcome>;
  /** Données à jour d'un commerce (identifiant complet « osm:… » / « google:… »). */
  getPlace(placeId: string): Promise<Place | null>;
}

/** Erreur à afficher telle quelle à l'utilisateur. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Détail technique (serveurs essayés et réponses), affiché en petit pour le dépannage. */
    readonly details?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type FetchFn = typeof fetch;
