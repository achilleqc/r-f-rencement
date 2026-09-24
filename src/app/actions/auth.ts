"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, hashPassword, signupAllowed, verifyPassword } from "@/lib/auth";
import { formValues, zodErrors, type FormState } from "@/lib/form";
import { clientIp, rateLimit } from "@/lib/rate-limit";

function safeNext(value: FormDataEntryValue | null, fallback = "/recherche") {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

const loginSchema = z.object({
  email: z.email("Adresse e-mail invalide."),
  password: z.string().min(1, "Indiquez votre mot de passe."),
});

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const email = parsed.data.email.toLowerCase().trim();
  if (!rateLimit(`login:${await clientIp()}`, 10, 10 * 60_000).ok) {
    return { message: "Trop de tentatives. Réessayez dans quelques minutes.", values };
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { message: "E-mail ou mot de passe incorrect.", values };
  }

  await createSession(user.id);
  redirect(safeNext(formData.get("next")));
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(100),
  email: z.email("Adresse e-mail invalide.").max(200),
  password: z.string().min(10, "10 caractères minimum.").max(200),
});

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["name", "email"]);
  if (!(await signupAllowed())) {
    return { message: "Les inscriptions sont fermées. Demandez un accès à l'administrateur.", values };
  }
  if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000).ok) {
    return { message: "Trop de créations de compte. Réessayez plus tard.", values };
  }
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { errors: { email: "Un compte existe déjà avec cette adresse." }, values };

  const [user] = await db
    .insert(users)
    .values({ name: parsed.data.name, email, passwordHash: await hashPassword(parsed.data.password) })
    .returning({ id: users.id });
  await createSession(user.id);
  redirect("/recherche");
}

export async function logout() {
  await destroySession();
  redirect("/connexion");
}
