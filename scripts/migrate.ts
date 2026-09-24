/**
 * Applique les migrations SQL du dossier /drizzle (non interactif : utilisable en production,
 * notamment lors du déploiement sur Vercel).
 *
 *   npm run db:migrate
 */
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { databaseAuthToken, databaseUrl } from "../src/db";

async function main() {
  const url = databaseUrl();
  if (url.startsWith("file:")) mkdirSync(dirname(url.slice("file:".length)), { recursive: true });

  const client = createClient({ url, authToken: databaseAuthToken() });
  console.log(`\n→ Migrations sur ${url.replace(/\?.*$/, "")}`);
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("  ✓ base à jour\n");
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
