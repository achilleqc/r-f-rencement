import { z } from "zod";
import { CATEGORY_IDS, type CategoryFilter } from "@/lib/places/categories";
import { isValidLatLng } from "@/lib/places/geo";

export const RADII = [300, 500, 1000, 2000, 5000, 10000] as const;
export const DEFAULT_RADIUS = 1000;

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

const schema = z.object({
  q: z.string().trim().max(200).optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  r: z.coerce.number().optional(),
  cat: z.string().optional(),
});

export type ParsedSearch = {
  form: { q: string; lat: number | null; lng: number | null; r: number; cat: CategoryFilter };
  search:
    | { kind: "position"; lat: number; lng: number; radius: number; category: CategoryFilter }
    | { kind: "address"; q: string; radius: number; category: CategoryFilter }
    | null;
};

/** Lit les paramètres de l'URL /recherche (?q=…&r=…&cat=… ou ?lat=…&lng=…). */
export function parseSearchParams(raw: Record<string, string | string[] | undefined>): ParsedSearch {
  const parsed = schema.safeParse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v) || undefined])));
  const data = parsed.success ? parsed.data : {};
  const radius = (RADII as readonly number[]).includes(data.r ?? NaN) ? data.r! : DEFAULT_RADIUS;
  const category: CategoryFilter = data.cat && (CATEGORY_IDS as string[]).includes(data.cat) ? (data.cat as CategoryFilter) : "tous";
  const hasPosition = data.lat != null && data.lng != null && isValidLatLng(data.lat, data.lng);

  const form = {
    q: data.q ?? "",
    lat: hasPosition ? data.lat! : null,
    lng: hasPosition ? data.lng! : null,
    r: radius,
    cat: category,
  };
  if (hasPosition) return { form, search: { kind: "position", lat: data.lat!, lng: data.lng!, radius, category } };
  if (data.q && data.q.length >= 2) return { form, search: { kind: "address", q: data.q, radius, category } };
  return { form, search: null };
}
