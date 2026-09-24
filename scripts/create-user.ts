/**
 * Crée (ou réinitialise) un compte en ligne de commande :
 *
 *   npm run user:create -- vous@exemple.fr "MotDePasse-Solide" "Votre nom"
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { databaseAuthToken, databaseUrl } from "../src/db/config";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/lib/auth-password";

async function main() {
  const [email, password, name = "Utilisateur"] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage : npm run user:create -- email "mot de passe" "Nom"');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Le mot de passe doit contenir au moins 10 caractères.");
    process.exit(1);
  }
  const client = createClient({ url: databaseUrl(), authToken: databaseAuthToken() });
  const db = drizzle(client, { schema });
  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, normalized) });
  if (existing) {
    await db.update(schema.users).set({ passwordHash, name }).where(eq(schema.users.id, existing.id));
    console.log(`✓ Mot de passe mis à jour pour ${normalized}`);
  } else {
    await db.insert(schema.users).values({ email: normalized, name, passwordHash });
    console.log(`✓ Compte créé : ${normalized}`);
  }
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
