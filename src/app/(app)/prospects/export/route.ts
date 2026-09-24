import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { PROSPECT_STATUSES, prospects, type ProspectStatus } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { STATUS_LABELS } from "@/lib/prospects";

const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Connectez-vous pour exporter vos prospects.", { status: 401 });

  const statusParam = new URL(request.url).searchParams.get("statut") ?? "";
  const status = (PROSPECT_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as ProspectStatus) : null;
  const rows = await db.query.prospects.findMany({
    where: status ? and(eq(prospects.userId, user.id), eq(prospects.status, status)) : eq(prospects.userId, user.id),
    orderBy: [desc(prospects.updatedAt)],
    columns: { snapshot: false, audit: false },
  });

  const csv = toCsv(
    ["Nom", "Type", "Statut", "Score", "Téléphone", "Site web", "Adresse", "Relance", "Notes", "Ajouté le", "Latitude", "Longitude"],
    rows.map((p) => [
      p.name,
      p.typeLabel,
      STATUS_LABELS[p.status],
      p.score,
      p.phone,
      p.website,
      p.address,
      date(p.followUpAt),
      p.notes,
      date(p.createdAt),
      p.lat,
      p.lng,
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prospects-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
