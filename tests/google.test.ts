import { describe, expect, it, vi } from "vitest";
import { createGoogleProvider, normalizeGooglePlace, type GooglePlace } from "@/lib/places/google";
import { distanceMeters, offsetMeters } from "@/lib/places/geo";

const center = { lat: 48.8566, lng: 2.3522 };

function googlePlace(id: string, lat: number, lng: number, extra: Partial<GooglePlace> = {}): GooglePlace {
  return {
    id,
    displayName: { text: `Commerce ${id}` },
    location: { latitude: lat, longitude: lng },
    primaryType: "bakery",
    primaryTypeDisplayName: { text: "Boulangerie" },
    types: ["bakery", "store"],
    ...extra,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("normalizeGooglePlace", () => {
  it("convertit une fiche Google complète", () => {
    const place = normalizeGooglePlace(
      googlePlace("abc", 48.85, 2.35, {
        formattedAddress: "1 Rue de Rivoli, 75001 Paris",
        nationalPhoneNumber: "01 23 45 67 89",
        websiteUri: "https://www.facebook.com/boulangerie",
        rating: 4.2,
        userRatingCount: 8,
        photos: [{}, {}],
        regularOpeningHours: { openNow: true },
        businessStatus: "OPERATIONAL",
        googleMapsUri: "https://maps.google.com/?cid=1",
      }),
    )!;
    expect(place).toMatchObject({
      id: "google:abc",
      source: "google",
      category: "alimentation",
      typeLabel: "Boulangerie",
      reviewCount: 8,
      photoCount: 2,
      hasOpeningHours: true,
      status: "open",
      sourceUrl: "https://maps.google.com/?cid=1",
    });
  });

  it("considère l'absence d'avis et de photos comme 0", () => {
    const place = normalizeGooglePlace(googlePlace("x", 48.85, 2.35, { businessStatus: "CLOSED_PERMANENTLY" }))!;
    expect(place.reviewCount).toBe(0);
    expect(place.photoCount).toBe(0);
    expect(place.rating).toBeNull();
    expect(place.status).toBe("closed_permanently");
  });
});

describe("createGoogleProvider", () => {
  it("envoie la clé, le masque de champs et les types demandés", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ places: [googlePlace("a", 48.8567, 2.3523)] }));
    const provider = createGoogleProvider("CLE", fetchFn as unknown as typeof fetch, 5);
    const outcome = await provider.searchNearby({ center, radius: 500, category: "alimentation" });
    expect(outcome.places).toHaveLength(1);
    expect(outcome.apiCalls).toBe(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("CLE");
    expect(headers["X-Goog-FieldMask"]).toContain("places.websiteUri");
    const body = JSON.parse(String(init.body));
    expect(body.includedTypes).toContain("bakery");
    expect(body.maxResultCount).toBe(20);
    expect(body.locationRestriction.circle.radius).toBe(500);
  });

  it("découpe une zone saturée en sous-zones, sans dépasser le budget d'appels", async () => {
    let n = 0;
    // Chaque appel renvoie 20 commerces distincts proches du centre de la zone demandée : toujours « saturé ».
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      const { circle } = JSON.parse(String(init.body)).locationRestriction;
      const places = Array.from({ length: 20 }, (_, i) => {
        const p = offsetMeters({ lat: circle.center.latitude, lng: circle.center.longitude }, i * 5, 0);
        return googlePlace(`p${n}-${i}`, p.lat, p.lng);
      });
      n += 1;
      return jsonResponse({ places });
    });
    const provider = createGoogleProvider("CLE", fetchFn as unknown as typeof fetch, 5);
    const outcome = await provider.searchNearby({ center, radius: 2000, category: "tous" });
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(outcome.apiCalls).toBe(5);
    expect(outcome.truncated).toBe(true);
    expect(outcome.places.every((p) => distanceMeters(center, p) <= 2000)).toBe(true);
  });

  it("n'appelle qu'une fois quand la zone n'est pas saturée", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ places: [googlePlace("a", 48.857, 2.353)] }));
    const provider = createGoogleProvider("CLE", fetchFn as unknown as typeof fetch, 12);
    const outcome = await provider.searchNearby({ center, radius: 5000, category: "tous" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(outcome.truncated).toBe(false);
  });

  it("traduit une clé refusée en message compréhensible", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ error: { code: 403, message: "PERMISSION_DENIED" } }, 403));
    const provider = createGoogleProvider("CLE", fetchFn as unknown as typeof fetch, 5);
    await expect(provider.searchNearby({ center, radius: 500, category: "tous" })).rejects.toThrow(/Places API \(New\)/);
  });

  it("relit une fiche via Place Details", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(googlePlace("abc", 48.85, 2.35)));
    const provider = createGoogleProvider("CLE", fetchFn as unknown as typeof fetch, 5);
    const place = await provider.getPlace("google:abc");
    expect(place?.id).toBe("google:abc");
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places/abc?languageCode=fr");
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).not.toContain("places.");
  });
});
