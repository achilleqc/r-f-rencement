import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser, signupAllowed } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  if (await getCurrentUser()) redirect("/recherche");
  const { next } = await searchParams;
  const canSignup = await signupAllowed();
  return (
    <>
      <h1 className="text-xl font-bold">Connexion</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Retrouvez vos recherches et vos prospects.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      {canSignup && (
        <p className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ? <Link href="/inscription" className="link">Créer un compte</Link>
        </p>
      )}
    </>
  );
}
