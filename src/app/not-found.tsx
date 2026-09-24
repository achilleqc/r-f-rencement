import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-16 text-center">
      <div>
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 text-2xl font-bold">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted">Ce prospect a peut-être été supprimé.</p>
        <Link href="/recherche" className="btn btn-primary mt-6">Retour à la recherche</Link>
      </div>
    </main>
  );
}
