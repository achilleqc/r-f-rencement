import { describe, expect, it } from "vitest";
import { classifyWebsite, normalizeUrl, socialUrl } from "@/lib/places/website";

describe("normalizeUrl", () => {
  it("ajoute https:// quand le protocole manque", () => {
    expect(normalizeUrl("www.boulangerie-martin.fr")).toBe("https://www.boulangerie-martin.fr/");
  });
  it("garde le premier lien quand il y en a plusieurs", () => {
    expect(normalizeUrl("https://a.fr;https://b.fr")).toBe("https://a.fr/");
  });
  it("rejette les valeurs invalides", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl("pas un site")).toBeNull();
  });
});

describe("classifyWebsite", () => {
  it.each([
    [null, "none"],
    ["https://www.facebook.com/boulangerie.martin", "social"],
    ["https://m.facebook.com/boulangerie.martin", "social"],
    ["instagram.com/salon_julie", "social"],
    ["https://linktr.ee/garage", "social"],
    ["https://www.pagesjaunes.fr/pros/123", "platform"],
    ["https://www.tripadvisor.fr/Restaurant_Review-xyz", "platform"],
    ["https://www.doctolib.fr/dentiste/paris/dr-x", "platform"],
    ["https://boulangerie-martin.business.site/", "defunct"],
    ["https://salonjulie.wixsite.com/salon", "free"],
    ["https://sites.google.com/view/garage-dupont", "free"],
    ["https://www.boulangerie-martin.fr", "site"],
  ])("%s → %s", (url, kind) => {
    expect(classifyWebsite(url).kind).toBe(kind);
  });

  it("donne l'hôte sans www", () => {
    expect(classifyWebsite("https://www.exemple.fr/contact").host).toBe("exemple.fr");
  });
});

describe("socialUrl", () => {
  it("complète un identifiant Facebook ou Instagram", () => {
    expect(socialUrl("facebook", "boulangerie.martin")).toBe("https://www.facebook.com/boulangerie.martin");
    expect(socialUrl("instagram", "@salon_julie")).toBe("https://www.instagram.com/salon_julie");
  });
  it("garde une URL complète", () => {
    expect(socialUrl("facebook", "https://www.facebook.com/abc")).toBe("https://www.facebook.com/abc");
  });
});
