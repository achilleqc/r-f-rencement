import { Database } from "lucide-react";

/** Affiché sur Vercel tant qu'aucune base de données en ligne n'est connectée au projet. */
export function SetupNotice() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="card w-full max-w-lg p-6 shadow-soft sm:p-8">
        <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
          <Database className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-bold">Dernière étape : connecter la base de données</h1>
        <p className="mt-2 text-sm text-muted">
          Le site est bien en ligne, mais il lui faut une base de données pour enregistrer vos comptes et vos prospects.
        </p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm">
          <li>
            Sur <strong>vercel.com</strong>, ouvrez ce projet puis l&apos;onglet <strong>Storage</strong>.
          </li>
          <li>
            Choisissez <strong>Turso</strong> (gratuit), créez la base et connectez-la à ce projet.
          </li>
          <li>
            Onglet <strong>Deployments</strong> : sur le dernier déploiement, menu <strong>⋯</strong> puis <strong>Redeploy</strong>.
          </li>
        </ol>
        <p className="mt-5 text-xs text-muted">
          Les tables sont créées automatiquement au redéploiement. Créez ensuite votre compte : le premier compte est le vôtre.
        </p>
      </div>
    </main>
  );
}
