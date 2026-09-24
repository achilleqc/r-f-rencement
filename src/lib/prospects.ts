import "server-only";
import { and, count, eq, lte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { CLOSED_STATUSES } from "@/lib/prospect-status";

export { CLOSED_STATUSES, STATUS_LABELS } from "@/lib/prospect-status";

export function endOfToday() {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Nombre de relances prévues aujourd'hui ou en retard. */
export async function dueFollowUps(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(prospects)
    .where(and(eq(prospects.userId, userId), lte(prospects.followUpAt, endOfToday()), notInArray(prospects.status, CLOSED_STATUSES)));
  return row.n;
}

export async function savedPlaceIds(userId: string) {
  const rows = await db.select({ placeId: prospects.placeId, id: prospects.id }).from(prospects).where(eq(prospects.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.placeId, r.id])) as Record<string, string>;
}
