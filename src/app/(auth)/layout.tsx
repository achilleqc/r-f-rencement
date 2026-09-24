import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/connexion" />
        </div>
        <div className="card p-6 shadow-soft sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/donnees" className="hover:underline">Données et confidentialité</Link>
        </p>
      </div>
    </main>
  );
}
