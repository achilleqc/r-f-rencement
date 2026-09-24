"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid flex-1 place-items-center px-4 py-16 text-center">
      <div>
        <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted">Réessayez dans un instant. Si le problème persiste, vérifiez la configuration (base de données, variables d&apos;environnement).</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-6">Réessayer</button>
      </div>
    </main>
  );
}
