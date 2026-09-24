import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

/**
 * Cherche une variable d'environnement par son nom exact, ou par suffixe : l'intégration
 * Turso de Vercel peut ajouter un préfixe (ex. « PROSPECTION_TURSO_DATABASE_URL »).
 */
function findEnv(...suffixes: string[]) {
  for (const suffix of suffixes) {
    if (process.env[suffix]) return process.env[suffix];
  }
  for (const suffix of suffixes) {
    const key = Object.keys(process.env).find((k) => k.toUpperCase().endsWith(suffix) && process.env[k]);
    if (key) return process.env[key];
  }
  return undefined;
}

/** URL de la base : DATABASE_URL, ou les variables créées par l'intégration Turso de Vercel. */
export function databaseUrl() {
  return process.env.DATABASE_URL || findEnv("TURSO_DATABASE_URL", "TURSO_URL", "LIBSQL_URL") || "file:./data/app.db";
}

export function databaseAuthToken() {
  return process.env.DATABASE_AUTH_TOKEN || findEnv("TURSO_AUTH_TOKEN", "TURSO_TOKEN", "LIBSQL_AUTH_TOKEN") || undefined;
}

const globalForDb = globalThis as unknown as { __db?: DB; __dbClient?: Client };

function createDb(): DB {
  const client = createClient({ url: databaseUrl(), authToken: databaseAuthToken() });
  globalForDb.__dbClient = client;
  return drizzle(client, { schema });
}

/** Instance unique de la base (réutilisée entre les rechargements en développement). */
export const db: DB = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export { schema };
