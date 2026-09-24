import { describe, expect, it } from "vitest";
import { analyzeHtml, assertPublicUrl, isPublicIp } from "@/lib/site-audit";

const now = new Date("2026-09-24T12:00:00Z");

describe("analyzeHtml", () => {
  it("valide une page bien construite", () => {
    const html = `<!doctype html><html><head>
      <title>Boulangerie Martin – Pain au levain à Montréal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="description" content="Boulangerie artisanale rue Saint-Denis : pains au levain, viennoiseries et gâteaux sur commande.">
      <script type="application/ld+json">{"@type":"Bakery"}</script>
    </head><body><h1>Boulangerie Martin</h1><footer>© 2026 Boulangerie Martin</footer></body></html>`;
    const checks = analyzeHtml(html, now);
    expect(checks.every((c) => c.ok === true)).toBe(true);
  });

  it("repère un vieux site non adapté au mobile", () => {
    const html = `<html><head><title>Accueil</title></head><body><p>Bienvenue</p><p>Copyright &copy; 2014-2017</p></body></html>`;
    const byId = Object.fromEntries(analyzeHtml(html, now).map((c) => [c.id, c]));
    expect(byId.mobile.ok).toBe(false);
    expect(byId.title.ok).toBe(false);
    expect(byId.description.ok).toBe(false);
    expect(byId.h1.ok).toBe(false);
    expect(byId.schema.ok).toBe(false);
    expect(byId.fresh.ok).toBe(false);
    expect(byId.fresh.detail).toContain("2017");
  });

  it("laisse « inconnu » quand aucune date n'est trouvée", () => {
    const byId = Object.fromEntries(analyzeHtml("<html></html>", now).map((c) => [c.id, c]));
    expect(byId.fresh.ok).toBeNull();
  });
});

describe("protection des adresses internes", () => {
  it.each([
    ["8.8.8.8", true],
    ["2606:4700:4700::1111", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.20.0.1", false],
    ["192.168.1.10", false],
    ["169.254.169.254", false],
    ["::1", false],
    ["fd00::1", false],
    ["::ffff:127.0.0.1", false],
    ["pas-une-ip", false],
  ])("%s → %s", (ip, expected) => {
    expect(isPublicIp(ip)).toBe(expected);
  });

  it("refuse les URL locales et les protocoles exotiques", async () => {
    await expect(assertPublicUrl(new URL("http://127.0.0.1/admin"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("http://[::1]/"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("ftp://exemple.fr/"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("http://exemple.fr:8080/"))).rejects.toThrow();
  });
});
