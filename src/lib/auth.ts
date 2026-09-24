import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { count, eq } from "drizzle-orm";
import { databaseAuthToken, db } from "@/db";
import { users, type User } from "@/db/schema";

export { hashPassword, verifyPassword } from "./auth-password";

export const SESSION_COOKIE = "pl_session";
const SESSION_DURATION_S = 60 * 60 * 24 * 30; // 30 jours

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32 && !secret.startsWith("change-me")) return new TextEncoder().encode(secret);
  // Sans AUTH_SECRET, la clé est dérivée du jeton de la base Turso : secrète et propre à
  // chaque installation, elle évite une variable de plus à saisir lors du déploiement.
  const dbToken = databaseAuthToken();
  if (dbToken) return new TextEncoder().encode(createHash("sha256").update(`prospection-locale:session:${dbToken}`).digest("base64url"));
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET doit contenir au moins 32 caractères en production.");
  }
  return new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret-change-me");
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_S}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_S,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function readSessionUserId() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Utilisateur connecté (ou null). Mis en cache pour la durée de la requête. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user ?? null;
});

/** Redirige vers la connexion si personne n'est connecté. */
export async function requireUser(next = "/recherche") {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  return user;
}

/**
 * L'inscription est ouverte pour créer le tout premier compte, puis seulement si
 * ALLOW_SIGNUP=true (pour éviter qu'un inconnu consomme vos quotas d'API).
 */
export async function signupAllowed() {
  if (process.env.ALLOW_SIGNUP === "true") return true;
  const [row] = await db.select({ n: count() }).from(users);
  return row.n === 0;
}
