import type { Place } from "./types";
import { classifyWebsite, type WebsiteInfo } from "./website";

/**
 * Score de présence en ligne : 100 = excellente, 0 = inexistante.
 * Plus le score est bas, plus le commerce est un bon prospect.
 *
 * Les informations inconnues (ex. : nombre d'avis avec OpenStreetMap) ne font pas perdre
 * de points : elles sont signalées « à vérifier ».
 */

export type FactorStatus = "bad" | "good" | "unknown";

export type ScoreFactor = {
  id: string;
  label: string;
  /** Points retirés (0 si le critère est rempli ou inconnu). */
  penalty: number;
  status: FactorStatus;
  detail?: string;
};

export type ScoreLevel = "critical" | "low" | "medium" | "good";

export type VisibilityScore = {
  score: number;
  level: ScoreLevel;
  website: WebsiteInfo;
  factors: ScoreFactor[];
};

export const PENALTIES = {
  noWebsite: 50,
  defunctWebsite: 45,
  socialOnly: 40,
  platformOnly: 35,
  freeWebsite: 15,
  noReviews: 15,
  fewReviews: 10,
  someReviews: 5,
  lowRating: 5,
  noPhotos: 8,
  noPhone: 7,
  noHours: 6,
} as const;

export const LEVELS: Record<ScoreLevel, { label: string; short: string; color: string; min: number }> = {
  critical: { label: "Présence en ligne très faible", short: "Très faible", color: "#dc2626", min: 0 },
  low: { label: "Présence en ligne faible", short: "Faible", color: "#ea580c", min: 35 },
  medium: { label: "Présence en ligne moyenne", short: "Moyenne", color: "#ca8a04", min: 60 },
  good: { label: "Bonne présence en ligne", short: "Bonne", color: "#16a34a", min: 80 },
};

export function scoreLevel(score: number): ScoreLevel {
  if (score >= LEVELS.good.min) return "good";
  if (score >= LEVELS.medium.min) return "medium";
  if (score >= LEVELS.low.min) return "low";
  return "critical";
}

type ScoreInput = Pick<
  Place,
  "source" | "website" | "socials" | "phone" | "hasOpeningHours" | "rating" | "reviewCount" | "photoCount"
>;

function websiteFactor(place: ScoreInput, website: WebsiteInfo): ScoreFactor {
  const base = { id: "website", label: "Site web" };
  switch (website.kind) {
    case "site":
      return { ...base, penalty: 0, status: "good", detail: website.host ?? undefined };
    case "free":
      return { ...base, penalty: PENALTIES.freeWebsite, status: "bad", detail: `Site sur un hébergement gratuit : ${website.service}` };
    case "defunct":
      return { ...base, penalty: PENALTIES.defunctWebsite, status: "bad", detail: `Le lien mène à un ${website.service}` };
    case "social":
      return { ...base, penalty: PENALTIES.socialOnly, status: "bad", detail: `Seulement une page ${website.service}` };
    case "platform":
      return { ...base, penalty: PENALTIES.platformOnly, status: "bad", detail: `Seulement une fiche ${website.service}` };
    case "none": {
      const social = place.socials.length > 0 ? classifyWebsite(place.socials[0]) : null;
      if (social && social.kind === "social") {
        return { ...base, penalty: PENALTIES.socialOnly, status: "bad", detail: `Seulement une page ${social.service}` };
      }
      return {
        ...base,
        penalty: PENALTIES.noWebsite,
        status: "bad",
        detail: place.source === "osm" ? "Aucun site connu (à vérifier sur Google)" : "Aucun site web",
      };
    }
  }
}

export function computeVisibilityScore(place: ScoreInput): VisibilityScore {
  const website = classifyWebsite(place.website);
  const factors: ScoreFactor[] = [websiteFactor(place, website)];

  // Avis Google
  if (place.reviewCount == null) {
    factors.push({ id: "reviews", label: "Avis clients", penalty: 0, status: "unknown", detail: "Non disponible avec OpenStreetMap" });
  } else if (place.reviewCount === 0) {
    factors.push({ id: "reviews", label: "Avis clients", penalty: PENALTIES.noReviews, status: "bad", detail: "Aucun avis" });
  } else if (place.reviewCount < 10) {
    factors.push({ id: "reviews", label: "Avis clients", penalty: PENALTIES.fewReviews, status: "bad", detail: `Seulement ${place.reviewCount} avis` });
  } else if (place.reviewCount < 30) {
    factors.push({ id: "reviews", label: "Avis clients", penalty: PENALTIES.someReviews, status: "bad", detail: `${place.reviewCount} avis` });
  } else {
    factors.push({ id: "reviews", label: "Avis clients", penalty: 0, status: "good", detail: `${place.reviewCount} avis` });
  }

  // Note moyenne
  if (place.rating != null) {
    const rating = place.rating.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    factors.push(
      place.rating < 3.5
        ? { id: "rating", label: "Note moyenne", penalty: PENALTIES.lowRating, status: "bad", detail: `${rating}/5 : e-réputation à travailler` }
        : { id: "rating", label: "Note moyenne", penalty: 0, status: "good", detail: `${rating}/5` },
    );
  }

  // Photos
  if (place.photoCount == null) {
    factors.push({ id: "photos", label: "Photos", penalty: 0, status: "unknown", detail: "Non disponible avec OpenStreetMap" });
  } else if (place.photoCount === 0) {
    factors.push({ id: "photos", label: "Photos", penalty: PENALTIES.noPhotos, status: "bad", detail: "Aucune photo sur la fiche" });
  } else {
    factors.push({ id: "photos", label: "Photos", penalty: 0, status: "good", detail: `${place.photoCount}${place.photoCount >= 10 ? "+" : ""} photo(s)` });
  }

  factors.push(
    place.phone
      ? { id: "phone", label: "Téléphone", penalty: 0, status: "good", detail: place.phone }
      : { id: "phone", label: "Téléphone", penalty: PENALTIES.noPhone, status: "bad", detail: "Non renseigné" },
  );
  factors.push(
    place.hasOpeningHours
      ? { id: "hours", label: "Horaires d'ouverture", penalty: 0, status: "good" }
      : { id: "hours", label: "Horaires d'ouverture", penalty: PENALTIES.noHours, status: "bad", detail: "Non renseignés" },
  );

  const total = factors.reduce((sum, f) => sum + f.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - total));
  return { score, level: scoreLevel(score), website, factors };
}
