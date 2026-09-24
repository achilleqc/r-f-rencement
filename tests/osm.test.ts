import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/overpass.json";
import { buildOverpassQuery, createOsmProvider, mergeOsmRules, normalizeOsmElement, type OverpassElement } from "@/lib/places/osm";

const montreal = { lat: 45.5017, lng: -73.5673 };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildOverpassQuery", () => {
  it("cherche dans le carré englobant, uniquement les éléments nommés", () => {
    const query = buildOverpassQuery({ center: montreal, radius: 800, category: "alimentation" });
    const bbox = /\[bbox:([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\]/.exec(query)!;
    const [south, west, north, east] = bbox.slice(1).map(Number);
    expect(south).toBeLessThan(montreal.lat);
    expect(north).toBeGreaterThan(montreal.lat);
    expect(west).toBeLessThan(montreal.lng);
    expect(east).toBeGreaterThan(montreal.lng);
    expect((north - south) * 111_320).toBeCloseTo(1600, -1);
    expect(query).not.toContain("around");
    expect(query).toContain('["shop"~"^(bakery|');
    expect(query).toContain('["name"]');
    expect(query).toMatch(/out tags center \d+;$/);
  });

  it("regroupe les règles par tag pour « tous » (requête plus rapide)", () => {
    const query = buildOverpassQuery({ center: montreal, radius: 500, category: "tous" });
    expect(query).toContain('nwr["shop"]["shop"!~"^(vacant|no)$"]["name"];');
    expect(query).toContain('["craft"]');
    expect(query).toContain('["tourism"~"^(hotel|');
    expect(query.match(/nwr\["amenity"/g)).toHaveLength(1);
    expect(query.match(/nwr\["shop"/g)).toHaveLength(1);
  });
});

describe("mergeOsmRules", () => {
  it("réunit les valeurs d'un même tag", () => {
    expect(mergeOsmRules([{ key: "amenity", values: ["cafe"] }, { key: "amenity", values: ["bar", "cafe"] }])).toEqual([
      { key: "amenity", values: ["cafe", "bar"] },
    ]);
  });

  it("une règle « sauf » perd les exclusions reprises par une autre règle", () => {
    expect(
      mergeOsmRules([
        { key: "shop", exclude: ["bakery", "vacant"] },
        { key: "shop", values: ["bakery"] },
      ]),
    ).toEqual([{ key: "shop", exclude: ["vacant"] }]);
  });

  it("une règle sans condition l'emporte", () => {
    expect(mergeOsmRules([{ key: "craft" }, { key: "craft", values: ["plumber"] }])).toEqual([{ key: "craft" }]);
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

  it("ne garde que les commerces situés dans le rayon", async () => {
    const far = { type: "node", id: 999, lat: montreal.lat + 0.05, lon: montreal.lng, tags: { name: "Loin", shop: "bakery" } };
    const fetchFn = vi.fn(async () => jsonResponse({ elements: [...fixture.elements, far] }));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    const outcome = await provider.searchNearby({ center: montreal, radius: 1000, category: "tous" });
    expect(outcome.places.map((p) => p.name)).not.toContain("Loin");
  });

  it("essaie le serveur suivant quand le premier est saturé", async () => {
    vi.stubEnv("OVERPASS_URL", "https://un.example/api,https://deux.example/api");
    const fetchFn = vi.fn(async (url: string) => (url.startsWith("https://un.") ? new Response("busy", { status: 429 }) : jsonResponse(fixture)));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    const outcome = await provider.searchNearby({ center: montreal, radius: 1000, category: "tous" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(outcome.places.length).toBe(4);
  });

  it("passe au serveur suivant après un délai dépassé", async () => {
    vi.stubEnv("OVERPASS_URL", "https://un.example/api,https://deux.example/api");
    const fetchFn = vi.fn(async (url: string) => {
      if (url.startsWith("https://un.")) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return jsonResponse(fixture);
    });
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    const outcome = await provider.searchNearby({ center: montreal, radius: 1000, category: "tous" });
    expect(outcome.places.length).toBe(4);
  });

  it("explique l'échec le plus parlant et détaille chaque serveur", async () => {
    vi.stubEnv("OVERPASS_URL", "https://un.example/api,https://deux.example/api,https://trois.example/api");
    const fetchFn = vi.fn(async (url: string) => {
      if (url.startsWith("https://un.")) return new Response("busy", { status: 429 });
      if (url.startsWith("https://deux.")) throw new DOMException("timeout", "TimeoutError");
      throw new TypeError("fetch failed", { cause: { code: "ECONNRESET" } });
    });
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    const error = await provider.searchNearby({ center: montreal, radius: 5000, category: "tous" }).catch((e) => e);
    expect(error.message).toMatch(/Réduisez le rayon/);
    expect(error.details).toBe("un.example : erreur 429 · deux.example : délai dépassé · trois.example : ECONNRESET");
  });

  it("renvoie un message clair quand OpenStreetMap signale un dépassement de temps", async () => {
    vi.stubEnv("OVERPASS_URL", "https://un.example/api");
    const fetchFn = vi.fn(async () => jsonResponse({ elements: [], remark: 'runtime error: Query timed out in "query" at line 3 after 26 seconds.' }));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    await expect(provider.searchNearby({ center: montreal, radius: 5000, category: "tous" })).rejects.toThrow(/Réduisez le rayon/);
  });

  it("n'insiste pas quand la requête est refusée (400)", async () => {
    vi.stubEnv("OVERPASS_URL", "https://un.example/api,https://deux.example/api");
    const fetchFn = vi.fn(async () => new Response("bad", { status: 400 }));
    const provider = createOsmProvider(fetchFn as unknown as typeof fetch);
    await expect(provider.searchNearby({ center: montreal, radius: 1000, category: "tous" })).rejects.toThrow(/requête invalide/);
    expect(fetchFn).toHaveBeenCalledTimes(1);
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
