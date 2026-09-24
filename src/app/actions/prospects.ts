"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { PROSPECT_STATUSES, prospects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formValues, zodErrors, type FormState } from "@/lib/form";
import { getProviderFor, ProviderError, type Place } from "@/lib/places";
import { CATEGORY_IDS } from "@/lib/places/categories";
import { computeVisibilityScore } from "@/lib/places/score";
import { clearSearchCache } from "@/lib/search";
import { parseSearchParams } from "@/lib/search-params";
import { errorMessage } from "@/lib/utils";

/* ───────────── Validation d'un commerce envoyé par le navigateur ───────────── */

const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => text(max).nullable();

const placeSchema = z.object({
  id: z.string().regex(/^(osm:(node|way|relation)\/\d+|google:[\w-]+)$/),
  source: z.enum(["osm", "google"]),
  name: text(200).min(1),
  category: z.enum(CATEGORY_IDS as [string, ...string[]]).nullable(),
  typeLabel: text(100),
  address: nullableText(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  phone: nullableText(60),
  email: nullableText(200),
  website: nullableText(500),
  socials: z.array(text(500)).max(5),
  hasOpeningHours: z.boolean(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).nullable(),
  photoCount: z.number().int().min(0).nullable(),
  isChain: z.boolean(),
  status: z.enum(["open", "closed_temporarily", "closed_permanently"]),
  sourceUrl: text(500),
});

function prospectFields(place: Place) {
  return {
    name: place.name,
    typeLabel: place.typeLabel,
    address: place.address,
    phone: place.phone,
    website: place.website,
    lat: place.lat,
    lng: place.lng,
    score: computeVisibilityScore(place).score,
    snapshot: JSON.stringify(place),
    snapshotAt: new Date(),
  };
}

export type AddProspectResult = { ok: true; id: string } | { ok: false; message: string };

export async function addProspect(input: unknown): Promise<AddProspectResult> {
  const user = await requireUser();
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Données du commerce invalides." };
  const place = parsed.data as Place;

  const existing = await db.query.prospects.findFirst({
    where: and(eq(prospects.userId, user.id), eq(prospects.placeId, place.id)),
    columns: { id: true },
  });
  if (existing) return { ok: true, id: existing.id };

  const [row] = await db
    .insert(prospects)
    .values({ userId: user.id, placeId: place.id, source: place.source, ...prospectFields(place) })
    .returning({ id: prospects.id });
  revalidatePath("/prospects");
  return { ok: true, id: row.id };
}

/* ───────────── Suivi d'un prospect ───────────── */

const updateSchema = z.object({
  status: z.enum(PROSPECT_STATUSES),
  notes: z.string().max(10_000, "Notes trop longues."),
  followUpAt: z.union([z.literal(""), z.iso.date("Date invalide.")]),
});

export async function updateProspect(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const values = formValues(formData, ["status", "notes", "followUpAt"]);
  const parsed = updateSchema.safeParse(values);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const followUpAt = parsed.data.followUpAt ? new Date(`${parsed.data.followUpAt}T00:00:00Z`) : null;
  const updated = await db
    .update(prospects)
    .set({ status: parsed.data.status, notes: parsed.data.notes, followUpAt })
    .where(and(eq(prospects.id, id), eq(prospects.userId, user.id)))
    .returning({ id: prospects.id });
  if (updated.length === 0) return { message: "Prospect introuvable.", values };

  revalidatePath("/prospects");
  revalidatePath(`/prospects/${id}`);
  return { ok: true, message: "Enregistré." };
}

export async function deleteProspect(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db.delete(prospects).where(and(eq(prospects.id, id), eq(prospects.userId, user.id)));
  revalidatePath("/prospects");
  redirect("/prospects?supprime=1");
}

/** Relit les informations du commerce à la source (adresse, téléphone, site, avis…). */
export async function refreshProspect(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const prospect = await db.query.prospects.findFirst({ where: and(eq(prospects.id, id), eq(prospects.userId, user.id)) });
  if (!prospect) return { message: "Prospect introuvable." };

  const provider = getProviderFor(prospect.source);
  if (!provider) return { message: "Ajoutez une clé Google Places pour actualiser ce commerce." };
  try {
    const place = await provider.getPlace(prospect.placeId);
    if (!place) return { message: "Ce commerce n'existe plus à la source (fermé ou supprimé ?)." };
    await db.update(prospects).set(prospectFields(place)).where(eq(prospects.id, prospect.id));
  } catch (error) {
    return { message: error instanceof ProviderError ? error.message : errorMessage(error) };
  }
  revalidatePath(`/prospects/${id}`);
  return { ok: true, message: "Informations actualisées." };
}

/* ───────────── Recherche ───────────── */

/** Ignore le cache et relance la recherche auprès de la source. */
export async function refreshSearch(formData: FormData) {
  await requireUser();
  const query = new URLSearchParams(String(formData.get("query") ?? ""));
  const { search } = parseSearchParams(Object.fromEntries(query));
  const center = search?.kind === "position" ? { lat: search.lat, lng: search.lng } : formData.get("lat") ? { lat: Number(formData.get("lat")), lng: Number(formData.get("lng")) } : null;
  if (search && center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
    await clearSearchCache({ center, radius: search.radius, category: search.category });
  }
  revalidatePath("/recherche");
}
