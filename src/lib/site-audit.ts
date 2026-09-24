import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { siteConfig } from "@/config/site";

/**
 * Analyse rapide d'un site web existant : de quoi argumenter une proposition de refonte
 * (HTTPS, mobile, balises SEO de base, rapidité, mises à jour).
 */

export type AuditCheck = {
  id: string;
  label: string;
  /** null = impossible à déterminer */
  ok: boolean | null;
  detail?: string;
};

export type SiteAudit = {
  url: string;
  finalUrl: string | null;
  status: number | null;
  responseMs: number | null;
  checks: AuditCheck[];
  passed: number;
  total: number;
  error?: string;
  auditedAt: string;
};

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;
const SLOW_MS = 3000;

/* ───────────── Sécurité : n'analyser que des adresses publiques ───────────── */

const privateRanges = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  privateRanges.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32], ["64:ff9b::", 96], ["100::", 64],
] as const) {
  privateRanges.addSubnet(net, prefix, "ipv6");
}

export function isPublicIp(ip: string) {
  const version = isIP(ip);
  if (version === 4) return !privateRanges.check(ip, "ipv4");
  if (version === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return isPublicIp(mapped[1]);
    return !privateRanges.check(ip, "ipv6");
  }
  return false;
}

export class AuditError extends Error {}

/** Refuse les adresses internes (localhost, réseau privé…) pour éviter tout usage détourné du serveur. */
export async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new AuditError("Seules les adresses http(s) peuvent être analysées.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new AuditError("Port non autorisé.");
  if (url.username || url.password) throw new AuditError("Adresse non autorisée.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new AuditError("Nom de domaine introuvable : le site n'existe peut-être plus.");
  if (!addresses.every(isPublicIp)) throw new AuditError("Adresse non autorisée.");
}

async function readLimited(res: Response) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

async function fetchPublic(start: URL) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": `${siteConfig.userAgent} (analyse de site)`, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      url = new URL(location, url);
      continue;
    }
    return { res, url };
  }
  throw new AuditError("Trop de redirections.");
}

/* ───────────── Analyse du HTML (fonction pure, testée) ───────────── */

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, name: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (new RegExp(`\\b(name|property)\\s*=\\s*["']?${name}["'\\s>]`, "i").test(tag)) {
      const content = /\bcontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
      return decodeEntities(content?.[2] ?? content?.[3] ?? "");
    }
  }
  return null;
}

export function analyzeHtml(html: string, now = new Date()): AuditCheck[] {
  const checks: AuditCheck[] = [];

  const hasViewport = metaContent(html, "viewport") !== null;
  checks.push({
    id: "mobile",
    label: "Adapté au mobile",
    ok: hasViewport,
    detail: hasViewport ? undefined : "Pas de balise « viewport » : le site s'affiche mal sur téléphone",
  });

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decodeEntities(titleMatch[1]) : "";
  checks.push({
    id: "title",
    label: "Titre de page pour Google",
    ok: title.length >= 10,
    detail: title ? `« ${title.slice(0, 90)} »${title.length < 10 ? " : trop court" : ""}` : "Aucun titre",
  });

  const description = metaContent(html, "description");
  checks.push({
    id: "description",
    label: "Description pour Google",
    ok: Boolean(description && description.length >= 50),
    detail: description ? (description.length < 50 ? "Trop courte" : undefined) : "Absente : Google choisit un extrait au hasard",
  });

  const hasH1 = /<h1[\s>]/i.test(html);
  checks.push({ id: "h1", label: "Titre principal (H1)", ok: hasH1, detail: hasH1 ? undefined : "Absent" });

  const structured = /application\/ld\+json/i.test(html) || /itemtype\s*=\s*["']https?:\/\/schema\.org/i.test(html);
  checks.push({
    id: "schema",
    label: "Données structurées (référencement local)",
    ok: structured,
    detail: structured ? undefined : "Aucune donnée schema.org (adresse, horaires…) pour Google",
  });

  const years = [...html.matchAll(/(?:©|&copy;|&#169;|copyright)\s*(?:(?:19|20)\d{2}\s*[-–]\s*)?((?:19|20)\d{2})/gi)]
    .map((m) => Number(m[1]))
    .filter((y) => y <= now.getFullYear());
  const lastYear = years.length ? Math.max(...years) : null;
  checks.push(
    lastYear == null
      ? { id: "fresh", label: "Mis à jour récemment", ok: null, detail: "Aucune date de copyright trouvée" }
      : {
          id: "fresh",
          label: "Mis à jour récemment",
          ok: lastYear >= now.getFullYear() - 1,
          detail: lastYear >= now.getFullYear() - 1 ? `© ${lastYear}` : `© ${lastYear} : le site ne semble plus entretenu`,
        },
  );

  return checks;
}

/* ───────────── Analyse complète ───────────── */

function summarize(url: string, partial: Omit<SiteAudit, "url" | "passed" | "total" | "auditedAt">): SiteAudit {
  const known = partial.checks.filter((c) => c.ok !== null);
  return {
    url,
    ...partial,
    passed: known.filter((c) => c.ok).length,
    total: known.length,
    auditedAt: new Date().toISOString(),
  };
}

export async function auditSite(rawUrl: string): Promise<SiteAudit> {
  let start: URL;
  try {
    start = new URL(rawUrl);
  } catch {
    throw new AuditError("Adresse invalide.");
  }

  const startedAt = Date.now();
  let fetched: Awaited<ReturnType<typeof fetchPublic>>;
  try {
    fetched = await fetchPublic(start);
  } catch (error) {
    if (error instanceof AuditError) throw error;
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return summarize(rawUrl, {
      finalUrl: null,
      status: null,
      responseMs: null,
      checks: [
        {
          id: "reachable",
          label: "Site accessible",
          ok: false,
          detail: timeout ? "Le site ne répond pas (plus de 10 s)" : "Le site est injoignable (domaine expiré ou serveur en panne ?)",
        },
      ],
      error: "Site injoignable",
    });
  }

  const { res, url } = fetched;
  const html = (res.headers.get("content-type") ?? "").includes("html") ? await readLimited(res) : "";
  if (!html) await res.body?.cancel().catch(() => undefined);
  const responseMs = Date.now() - startedAt;

  const checks: AuditCheck[] = [
    { id: "reachable", label: "Site accessible", ok: res.ok, detail: res.ok ? undefined : `Erreur ${res.status}` },
    {
      id: "https",
      label: "Connexion sécurisée (HTTPS)",
      ok: url.protocol === "https:",
      detail: url.protocol === "https:" ? undefined : "Le navigateur affiche « Non sécurisé »",
    },
    {
      id: "speed",
      label: "Rapidité",
      ok: responseMs < SLOW_MS,
      detail: `${(responseMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s pour charger la page`,
    },
  ];
  if (res.ok && html) checks.push(...analyzeHtml(html));

  return summarize(rawUrl, { finalUrl: url.toString(), status: res.status, responseMs, checks });
}
