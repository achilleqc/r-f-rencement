import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/ui/logo";
import { requireUser } from "@/lib/auth";
import { dueFollowUps } from "@/lib/prospects";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const due = await dueFollowUps(user.id);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container-page flex h-14 items-center gap-3">
          <div className="hidden sm:block">
            <Logo />
          </div>
          <div className="flex-1 sm:flex sm:justify-center">
            <AppNav dueCount={due} />
          </div>
          <form action={logout} className="flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-muted md:inline" title={user.email}>{user.name}</span>
            <button type="submit" className="btn btn-ghost btn-sm" title="Se déconnecter">
              <LogOut className="size-4" />
              <span className="sr-only">Se déconnecter</span>
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-surface py-4 text-xs text-muted">
        <div className="container-page flex flex-wrap items-center justify-between gap-2">
          <p>
            Données :{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">
              © contributeurs OpenStreetMap
            </a>
            {process.env.GOOGLE_PLACES_API_KEY ? " · Google Maps" : ""}
          </p>
          <Link href="/donnees" className="hover:underline">Données et confidentialité</Link>
        </div>
      </footer>
    </>
  );
}
