/**
 * Classe le « site web » renseigné pour un commerce : vrai site, simple page réseau social,
 * fiche sur une plateforme, site gratuit… C'est le critère principal du score.
 */

export type WebsiteKind = "none" | "social" | "platform" | "defunct" | "free" | "site";

export type WebsiteInfo = {
  kind: WebsiteKind;
  url: string | null;
  host: string | null;
  /** Nom du service reconnu (« Facebook », « Wix »…). */
  service?: string;
};

const SOCIAL: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
  [/(^|\.)snapchat\.com$/, "Snapchat"],
  [/(^|\.)(linktr\.ee|linkin\.bio|beacons\.ai|lnk\.bio)$/, "Page de liens"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "WhatsApp"],
];

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)pagesjaunes\.(fr|ca)$/, "PagesJaunes"],
  [/(^|\.)(yellowpages\.[a-z.]+|pages-jaunes\.[a-z.]+)$/, "Pages jaunes"],
  [/(^|\.)tripadvisor\.[a-z.]+$/, "Tripadvisor"],
  [/(^|\.)yelp\.[a-z.]+$/, "Yelp"],
  [/(^|\.)(thefork\.[a-z.]+|lafourchette\.com)$/, "TheFork"],
  [/(^|\.)(ubereats\.com|deliveroo\.[a-z.]+|just-eat\.[a-z.]+|justeat\.[a-z.]+|doordash\.com|skipthedishes\.com)$/, "Livraison de repas"],
  [/(^|\.)doctolib\.[a-z.]+$/, "Doctolib"],
  [/(^|\.)(planity\.com|treatwell\.[a-z.]+|booksy\.com|fresha\.com)$/, "Réservation beauté"],
  [/(^|\.)(booking\.com|airbnb\.[a-z.]+|expedia\.[a-z.]+|hotels\.com)$/, "Réservation d'hébergement"],
  [/(^|\.)(leboncoin\.fr|etsy\.com|ebay\.[a-z.]+|amazon\.[a-z.]+)$/, "Place de marché"],
  [/(^|\.)(google\.[a-z.]+|goo\.gl|g\.page|maps\.app\.goo\.gl)$/, "Google"],
];

/** Sites Google (fiches d'établissement) fermés par Google en 2024 : le lien ne mène plus nulle part. */
const DEFUNCT: [RegExp, string][] = [[/(^|\.)business\.site$/, "Site Google (fermé en 2024)"]];

/** Sous-domaines de créateurs de sites gratuits : un site existe, mais peu professionnel. */
const FREE_HOSTS: [RegExp, string][] = [
  [/\.wixsite\.com$/, "Wix (gratuit)"],
  [/\.(weebly|weeblysite)\.com$/, "Weebly (gratuit)"],
  [/\.(jimdosite|jimdofree|jimdo)\.com$/, "Jimdo (gratuit)"],
  [/\.webnode\.[a-z.]+$/, "Webnode (gratuit)"],
  [/\.e-monsite\.com$/, "e-monsite (gratuit)"],
  [/\.wordpress\.com$/, "WordPress.com (gratuit)"],
  [/\.(blogspot\.[a-z.]+|over-blog\.com|canalblog\.com)$/, "Blog gratuit"],
  [/\.(godaddysites\.com|square\.site|mystrikingly\.com|strikingly\.com|site123\.me|carrd\.co|webflow\.io|framer\.website)$/, "Site gratuit"],
  [/^sites\.google\.com$/, "Google Sites"],
];

/** Complète « www.exemple.fr » en « https://www.exemple.fr ». Renvoie null si l'adresse est invalide. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[;\s]+/).find(Boolean);
  if (!first) return null;
  const withProtocol = /^https?:\/\//i.test(first) ? first : `https://${first.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function match(host: string, list: [RegExp, string][]) {
  return list.find(([re]) => re.test(host))?.[1];
}

export function classifyWebsite(raw: string | null | undefined): WebsiteInfo {
  const url = normalizeUrl(raw);
  if (!url) return { kind: "none", url: null, host: null };
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");

  const defunct = match(host, DEFUNCT);
  if (defunct) return { kind: "defunct", url, host, service: defunct };
  const free = match(host, FREE_HOSTS);
  if (free) return { kind: "free", url, host, service: free };
  const social = match(host, SOCIAL);
  if (social) return { kind: "social", url, host, service: social };
  const platform = match(host, PLATFORMS);
  if (platform) return { kind: "platform", url, host, service: platform };
  return { kind: "site", url, host };
}

/** Vrai quand le commerce a un site à lui (même gratuit) qu'on peut analyser. */
export function hasOwnSite(info: WebsiteInfo) {
  return info.kind === "site" || info.kind === "free";
}

/** Complète un identifiant de page (« boulangerie.martin ») en URL de réseau social. */
export function socialUrl(network: "facebook" | "instagram", raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return normalizeUrl(value);
  const handle = value.replace(/^@/, "").replace(/^(www\.)?(facebook|instagram)\.com\//i, "");
  return network === "facebook" ? `https://www.facebook.com/${handle}` : `https://www.instagram.com/${handle}`;
}
