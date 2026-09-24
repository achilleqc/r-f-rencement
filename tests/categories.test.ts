import { describe, expect, it } from "vitest";
import {
  CATEGORY_IDS,
  categoryForOsmTags,
  googleTypesFor,
  osmRuleMatches,
  osmRuleToOverpass,
  osmTypeLabel,
} from "@/lib/places/categories";

describe("catégories", () => {
  it("Google accepte au plus 50 types par requête, même pour « tous »", () => {
    const all = googleTypesFor("tous");
    expect(all.length).toBeLessThanOrEqual(50);
    expect(new Set(all).size).toBe(all.length);
  });

  it("chaque catégorie a des règles OSM et des types Google", () => {
    for (const id of CATEGORY_IDS) {
      expect(googleTypesFor(id).length).toBeGreaterThan(0);
    }
  });

  it("classe les tags OSM dans la bonne catégorie", () => {
    expect(categoryForOsmTags({ shop: "bakery" })).toBe("alimentation");
    expect(categoryForOsmTags({ shop: "hairdresser" })).toBe("beaute");
    expect(categoryForOsmTags({ shop: "optician" })).toBe("sante");
    expect(categoryForOsmTags({ amenity: "restaurant" })).toBe("restauration");
    expect(categoryForOsmTags({ craft: "plumber" })).toBe("artisans");
    expect(categoryForOsmTags({ shop: "florist" })).toBe("boutiques");
    expect(categoryForOsmTags({ shop: "vacant" })).toBeNull();
    expect(categoryForOsmTags({ amenity: "bench" })).toBeNull();
  });

  it("traduit les règles en filtres Overpass", () => {
    expect(osmRuleToOverpass({ key: "amenity", values: ["cafe", "bar"] })).toBe('["amenity"~"^(cafe|bar)$"]');
    expect(osmRuleToOverpass({ key: "shop", exclude: ["vacant"] })).toBe('["shop"]["shop"!~"^(vacant)$"]');
    expect(osmRuleToOverpass({ key: "craft" })).toBe('["craft"]');
    expect(osmRuleMatches({ key: "shop", exclude: ["vacant"] }, { shop: "vacant" })).toBe(false);
  });

  it("donne un libellé français aux types OSM", () => {
    expect(osmTypeLabel({ shop: "bakery" })).toBe("Boulangerie");
    expect(osmTypeLabel({ craft: "some_new_craft" })).toBe("Some new craft");
    expect(osmTypeLabel({})).toBe("Commerce");
  });
});
