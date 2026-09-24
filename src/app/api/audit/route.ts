import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeUrl } from "@/lib/places/website";
import { rateLimit } from "@/lib/rate-limit";
import { AuditError, auditSite } from "@/lib/site-audit";

const bodySchema = z.object({
  url: z.string().max(500).optional(),
  prospectId: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Connectez-vous pour analyser un site." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });

  if (!rateLimit(`audit:${user.id}`, 20, 10 * 60_000).ok) {
    return Response.json({ error: "Trop d'analyses d'affilée : patientez quelques minutes." }, { status: 429 });
  }

  // Pour un prospect, on analyse toujours le site enregistré sur sa fiche.
  let prospectId: string | null = null;
  let url = normalizeUrl(parsed.data.url);
  if (parsed.data.prospectId) {
    const prospect = await db.query.prospects.findFirst({
      where: and(eq(prospects.id, parsed.data.prospectId), eq(prospects.userId, user.id)),
      columns: { id: true, website: true },
    });
    if (!prospect) return Response.json({ error: "Prospect introuvable." }, { status: 404 });
    prospectId = prospect.id;
    url = normalizeUrl(prospect.website);
  }
  if (!url) return Response.json({ error: "Aucun site à analyser." }, { status: 400 });

  try {
    const audit = await auditSite(url);
    if (prospectId) await db.update(prospects).set({ audit: JSON.stringify(audit) }).where(eq(prospects.id, prospectId));
    return Response.json({ audit });
  } catch (error) {
    const message = error instanceof AuditError ? error.message : "Analyse impossible pour le moment.";
    return Response.json({ error: message }, { status: 400 });
  }
}
