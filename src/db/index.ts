import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { databaseAuthToken, databaseUrl } from "./config";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: DB; __dbClient?: Client };

function createDb(): DB {
  const client = createClient({ url: databaseUrl(), authToken: databaseAuthToken() });
  globalForDb.__dbClient = client;
  return drizzle(client, { schema });
}

/** Instance unique de la base (réutilisée entre les rechargements en développement). */
export const db: DB = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;

export { databaseAuthToken, databaseUrl, schema };
