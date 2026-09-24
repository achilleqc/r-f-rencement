import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { getCurrentUser, signupAllowed } from "@/lib/auth";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/recherche");
  if (!(await signupAllowed())) {
    return (
      <>
        <h1 className="text-xl font-bold">Inscriptions fermées</h1>
        <p className="mt-2 text-sm text-muted">
          Cet outil est privé. Demandez à son administrateur de vous créer un compte (commande
          <code className="mx-1 rounded bg-paper px-1">npm run user:create</code>) ou d&apos;activer
          <code className="mx-1 rounded bg-paper px-1">ALLOW_SIGNUP=true</code>.
        </p>
        <Link href="/connexion" className="btn btn-secondary mt-6 w-full">Retour à la connexion</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-xl font-bold">Créer un compte</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Vos prospects et vos notes restent privés.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted">
        Déjà un compte ? <Link href="/connexion" className="link">Se connecter</Link>
      </p>
    </>
  );
}
