import { describe, expect, it } from "vitest";
import { enrichPlaces } from "@/lib/places/enrich";
import type { Place } from "@/lib/places/types";

const center = { lat: 45.5, lng: -73.57 };

function place(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    source: "osm",
    name: id,
    category: "alimentation",
    typeLabel: "Boulangerie",
    address: null,
    lat: 45.5,
    lng: -73.57,
    phone: "0102030405",
    email: null,
    website: null,
    socials: [],
    hasOpeningHours: true,
    rating: null,
    reviewCount: null,
    photoCount: null,
    isChain: false,
    status: "open",
    sourceUrl: "",
    ...overrides,
  };
}

describe("enrichPlaces", () => {
  it("trie du moins visible au plus visible, puis par distance", () => {
    const result = enrichPlaces(
      [
        place("avec-site", { website: "https://a.fr" }),
        place("sans-site-loin", { lat: 45.51 }),
        place("sans-site-proche", { lat: 45.5001 }),
      ],
      center,
    );
    expect(result.map((p) => p.id)).toEqual(["sans-site-proche", "sans-site-loin", "avec-site"]);
    expect(result[0].distance).toBeGreaterThan(0);
  });

  it("repère les chaînes qui partagent le même site", () => {
    const result = enrichPlaces(
      [
        place("franchise-1", { website: "https://www.franchise.com/magasin-1" }),
        place("franchise-2", { website: "https://franchise.com/magasin-2" }),
        place("independant", { website: "https://independant.fr" }),
      ],
      center,
    );
    const byId = Object.fromEntries(result.map((p) => [p.id, p]));
    expect(byId["franchise-1"].isChain).toBe(true);
    expect(byId["franchise-2"].isChain).toBe(true);
    expect(byId["independant"].isChain).toBe(false);
  });
});
