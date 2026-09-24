import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdateFn(() => new Date());

/* ───────────────────────── Utilisateurs ───────────────────────── */

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

/* ───────────────────────── Prospects (mini-CRM) ───────────────────────── */

export const PROSPECT_STATUSES = ["a_contacter", "contacte", "interesse", "client", "pas_interesse"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const PLACE_SOURCES = ["osm", "google"] as const;

export const prospects = sqliteTable(
  "prospects",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Identifiant du commerce chez la source (« osm:node/123 », « google:ChIJ… »). */
    placeId: text("place_id").notNull(),
    source: text("source", { enum: PLACE_SOURCES }).notNull(),
    name: text("name").notNull(),
    typeLabel: text("type_label").notNull().default(""),
    address: text("address"),
    phone: text("phone"),
    website: text("website"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    /** Score de présence en ligne (0 = aucune, 100 = excellente) au moment de l'enregistrement. */
    score: integer("score").notNull(),
    /** Données complètes du commerce (JSON) et date de la copie. */
    snapshot: text("snapshot").notNull(),
    snapshotAt: integer("snapshot_at", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: PROSPECT_STATUSES }).notNull().default("a_contacter"),
    notes: text("notes").notNull().default(""),
    followUpAt: integer("follow_up_at", { mode: "timestamp" }),
    /** Dernière analyse du site web (JSON). */
    audit: text("audit"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("prospects_user_place_idx").on(t.userId, t.placeId), index("prospects_user_status_idx").on(t.userId, t.status)],
);

/* ───────────────────────── Caches ───────────────────────── */

/** Résultats de recherche mis en cache (limite le coût et la charge des API). */
export const searchCache = sqliteTable(
  "search_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").notNull(),
    payload: text("payload").notNull(),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("search_cache_expires_idx").on(t.expiresAt)],
);

/** Adresses déjà géocodées (demandé par la politique d'utilisation de Nominatim). */
export const geocodeCache = sqliteTable("geocode_cache", {
  query: text("query").primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  label: text("label").notNull(),
  createdAt: createdAt(),
});

/** Nombre d'appels aux API externes, par jour et par fournisseur. */
export const apiUsage = sqliteTable(
  "api_usage",
  {
    day: text("day").notNull(),
    provider: text("provider").notNull(),
    calls: integer("calls").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.provider] })],
);

export type User = typeof users.$inferSelect;
export type Prospect = typeof prospects.$inferSelect;
