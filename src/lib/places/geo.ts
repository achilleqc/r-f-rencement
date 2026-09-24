import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distance à vol d'oiseau en mètres (formule de haversine). */
export function distanceMeters(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point décalé de `dx` mètres vers l'est et `dy` mètres vers le nord. */
export function offsetMeters(point: LatLng, dx: number, dy: number): LatLng {
  return {
    lat: point.lat + dy / METERS_PER_DEGREE_LAT,
    lng: point.lng + dx / (METERS_PER_DEGREE_LAT * Math.cos(toRad(point.lat))),
  };
}

export type Circle = { center: LatLng; radius: number };

/**
 * Découpe un cercle en 4 cercles plus petits qui couvrent entièrement son carré englobant
 * (utilisé quand une zone contient plus de résultats que l'API ne peut en renvoyer).
 */
export function splitCircle({ center, radius }: Circle): Circle[] {
  const half = radius / 2;
  const childRadius = radius * Math.SQRT1_2;
  return [
    [-half, half],
    [half, half],
    [-half, -half],
    [half, -half],
  ].map(([dx, dy]) => ({ center: offsetMeters(center, dx, dy), radius: childRadius }));
}

export function circlesIntersect(a: Circle, b: Circle) {
  return distanceMeters(a.center, b.center) <= a.radius + b.radius;
}

export function isValidLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
