import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export function formatDate(date: Date | null | undefined) {
  return date ? dateFormatter.format(date) : "—";
}

/** Distance lisible : « 350 m », « 1,2 km ». */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

/** Date au format AAAA-MM-JJ (champ <input type="date">). */
export function toDateInput(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function errorMessage(error: unknown, fallback = "Une erreur est survenue.") {
  return error instanceof Error && error.message ? error.message : fallback;
}
