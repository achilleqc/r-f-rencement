import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/overpass.json";
import { buildOverpassQuery, createOsmProvider, normalizeOsmElement, type OverpassElement } from "@/lib/places/osm";

const montreal = { lat: 45.5017, lng: -73.5673 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildOverpassQuery", () => {
  it("cherche autour du point, uniquement les éléments nommés", () => {
    const query = buildOverpassQuery({ center: montreal, radius: 800, category: "alimentation" });
    expect(query).toContain("(around:800,45.501700,-73.567300)");
    expect(query).toContain('["shop"~"^(bakery|');
    expect(query).toContain('["name"]');
    expect(query).toMatch(/out tags center \d+;$/);
  });

  it("réunit toutes les catégories pour « tous »", () => {
    const query = buildOverpassQuery({ center: montreal, radius: 500, category: "tous" });
    expect(query).toContain('["amenity"~"^(restaurant|');
    expect(query).toContain('["craft"]');
    expect(query).toContain('["tourism"~"^(hotel|');
  });
});

describe("normalizeOsmElement", () => {
  const elements = fixture.elements as unknown as OverpassElement[];

  it("extrait adresse, téléphone et horaires", () => {
    const place = normalizeOsmElement(elements[0])!;
    expect(place).toMatchObject({
      id: "osm:node/101",
      name: "Boulangerie Martin",
      category: "alimentation",
      typeLabel: "Boulangerie",
      address: "12 Rue Saint-Denis, H2X 3K8 Montréal",
      phone: "+1 514 555 0101",
      website: null,
      hasOpeningHours: true,
      reviewCount: null,
      isChain: false,
      sourceUrl: "https://www.openstreetmap.org/node/101",
    });
  });

  it("utilise le centre des bâtiments et complète les pages Facebook", () => {
    const place = normalizeOsmElement(elements[1])!;
    expect(place.lat).toBe(45.5025);
    expect(place.socials).toEqual(["https://www.facebook.com/salonjulie"]);
  });

  it("normalise le site et repère les enseignes", () => {
    expect(normalizeOsmElement(elements[2])!.website).toBe("https://www.cafeolimpico.com/");
    expect(normalizeOsmElement(elements[3])!.isChain).toBe(true);
  });

  it("ignore les éléments sans nom", () => {
    expect(normalizeOsmElement(elements[4])).toBeNull();
  });
});

describe("createOsmProvider", () => {
  it("interroge Overpass et dédoublonne les résultats", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(fixture));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    const outcome = await provider.searchNearby({ center: montreal, radius: 1000, category: "tous" });
    expect(outcome.places.map((p) => p.name)).toEqual(["Boulangerie Martin", "Salon Julie", "Café Olimpico", "Tim Hortons"]);
    expect(outcome.apiCalls).toBe(1);
    expect(outcome.truncated).toBe(false);
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(String(init.body)).toMatch(/^data=/);
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("ProspectionLocale");
  });

  it("essaie le serveur suivant quand le premier est saturé", async () => {
    vi.stubEnv("OVERPASS_URL", "https://un.example/api,https://deux.example/api");
    const fetchFn = vi.fn(async (url: string) => (url.startsWith("https://un.") ? new Response("busy", { status: 429 }) : jsonResponse(fixture)));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    const outcome = await provider.searchNearby({ center: montreal, radius: 1000, category: "tous" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(outcome.places.length).toBe(4);
  });

  it("renvoie un message clair quand tous les serveurs échouent", async () => {
    vi.stubEnv("OVERPASS_URL", "https://un.example/api");
    const fetchFn = vi.fn(async () => new Response("timeout", { status: 504 }));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    await expect(provider.searchNearby({ center: montreal, radius: 1000, category: "tous" })).rejects.toThrow(/réduisez le rayon/);
  });

  it("relit un commerce par son identifiant", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ elements: [fixture.elements[0]] }));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    const place = await provider.getPlace("osm:node/101");
    expect(place?.name).toBe("Boulangerie Martin");
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(decodeURIComponent(String(init.body))).toContain("node(101)");
    expect(await provider.getPlace("osm:invalide")).toBeNull();
  });
});
