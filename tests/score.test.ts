import { describe, expect, it } from "vitest";
import { computeVisibilityScore, PENALTIES, scoreLevel } from "@/lib/places/score";
import type { Place } from "@/lib/places/types";

const base: Pick<Place, "source" | "website" | "socials" | "phone" | "hasOpeningHours" | "rating" | "reviewCount" | "photoCount"> = {
  source: "google",
  website: "https://www.exemple.fr",
  socials: [],
  phone: "01 23 45 67 89",
  hasOpeningHours: true,
  rating: 4.6,
  reviewCount: 120,
  photoCount: 10,
};

describe("computeVisibilityScore", () => {
  it("donne 100 à une fiche complète avec un vrai site", () => {
    const result = computeVisibilityScore(base);
    expect(result.score).toBe(100);
    expect(result.level).toBe("good");
    expect(result.factors.every((f) => f.status === "good")).toBe(true);
  });

  it("pénalise fortement l'absence de site", () => {
    const result = computeVisibilityScore({ ...base, website: null });
    expect(result.score).toBe(100 - PENALTIES.noWebsite);
    expect(result.factors.find((f) => f.id === "website")?.status).toBe("bad");
  });

  it("repère une simple page Facebook donnée comme site", () => {
    const result = computeVisibilityScore({ ...base, website: "https://facebook.com/garage" });
    expect(result.score).toBe(100 - PENALTIES.socialOnly);
    expect(result.website.kind).toBe("social");
  });

  it("utilise les réseaux sociaux connus quand il n'y a pas de site (OpenStreetMap)", () => {
    const result = computeVisibilityScore({ ...base, website: null, socials: ["https://www.instagram.com/salon"] });
    expect(result.factors[0].detail).toContain("Instagram");
    expect(result.score).toBe(100 - PENALTIES.socialOnly);
  });

  it("additionne les pénalités d'une fiche Google pauvre", () => {
    const result = computeVisibilityScore({
      ...base,
      website: null,
      phone: null,
      hasOpeningHours: false,
      rating: null,
      reviewCount: 0,
      photoCount: 0,
    });
    const expected = 100 - PENALTIES.noWebsite - PENALTIES.noReviews - PENALTIES.noPhotos - PENALTIES.noPhone - PENALTIES.noHours;
    expect(result.score).toBe(expected);
    expect(result.level).toBe("critical");
  });

  it("classe en « très faible » un commerce OpenStreetMap sans site, sans téléphone ni horaires", () => {
    const result = computeVisibilityScore({ ...base, source: "osm", website: null, phone: null, hasOpeningHours: false, rating: null, reviewCount: null, photoCount: null });
    expect(result.level).toBe("critical");
  });

  it("ne pénalise pas les informations inconnues (OpenStreetMap)", () => {
    const result = computeVisibilityScore({ ...base, source: "osm", rating: null, reviewCount: null, photoCount: null });
    expect(result.score).toBe(100);
    expect(result.factors.filter((f) => f.status === "unknown").map((f) => f.id)).toEqual(["reviews", "photos"]);
  });

  it("signale peu d'avis et une note faible", () => {
    const result = computeVisibilityScore({ ...base, reviewCount: 4, rating: 3.1 });
    expect(result.score).toBe(100 - PENALTIES.fewReviews - PENALTIES.lowRating);
  });

  it("reste entre 0 et 100", () => {
    const result = computeVisibilityScore({
      ...base,
      website: "https://x.business.site",
      phone: null,
      hasOpeningHours: false,
      rating: 1,
      reviewCount: 0,
      photoCount: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("scoreLevel", () => {
  it("découpe les niveaux", () => {
    expect(scoreLevel(0)).toBe("critical");
    expect(scoreLevel(39)).toBe("critical");
    expect(scoreLevel(40)).toBe("low");
    expect(scoreLevel(65)).toBe("medium");
    expect(scoreLevel(89)).toBe("medium");
    expect(scoreLevel(90)).toBe("good");
  });
});
