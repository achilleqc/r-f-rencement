import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Données et confidentialité" };

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-2 text-lg font-bold">{children}</h2>;
}

export default function DataPage() {
  return (
    <main className="container-page max-w-3xl flex-1 py-8">
      <Logo />
      <h1 className="mt-8 text-3xl font-bold">Données et confidentialité</h1>
      <p className="mt-2 text-sm text-muted">
        Cette page est à compléter avec vos informations avant une utilisation commerciale (les passages
        entre crochets).
      </p>

      <div className="mt-6 space-y-3 text-[0.95rem] leading-relaxed text-ink-soft">
        <H2>Éditeur de l&apos;outil</H2>
        <p>
          [Nom ou raison sociale], [adresse], [numéro SIREN / NEQ], contact : [adresse e-mail].
          Hébergement : [Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis] et
          [Turso / ChiselStrike] pour la base de données.
        </p>

        <H2>D&apos;où viennent les données sur les commerces ?</H2>
        <p>
          Uniquement de sources publiques : la base collaborative{" "}
          <a href="https://www.openstreetmap.org/copyright" className="link" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{" "}
          (licence ODbL, © contributeurs OpenStreetMap) et, si elle est activée, l&apos;API Google Places. Seules des
          informations professionnelles publiées par les établissements eux-mêmes sont utilisées : nom commercial,
          adresse, téléphone, site web, horaires, note et nombre d&apos;avis.
        </p>

        <H2>Ce que l&apos;outil enregistre</H2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Votre compte : nom, e-mail et mot de passe (chiffré, jamais stocké en clair).</li>
          <li>
            Les commerces que vous ajoutez à vos prospects, avec vos notes, leur statut et la date de relance. Ces données
            ne sont visibles que par vous.
          </li>
          <li>
            Un cache temporaire des recherches (7 jours) pour limiter les appels aux services externes, et le nombre
            d&apos;appels effectués chaque jour.
          </li>
        </ul>
        <p>Aucune donnée n&apos;est revendue ni transmise à des tiers. Aucun cookie publicitaire n&apos;est utilisé : un seul cookie sert à garder votre session ouverte.</p>

        <H2>Durée de conservation et suppression</H2>
        <p>
          Un prospect est conservé jusqu&apos;à ce que vous le supprimiez (bouton « Supprimer ce prospect » sur sa fiche).
          Supprimez-le sans attendre si le commerçant vous le demande. Les résultats de recherche sont effacés
          automatiquement après 7 jours.
        </p>

        <H2>Prospection : les règles à respecter</H2>
        <p>
          Contacter un commerçant pour lui proposer vos services est encadré. En France, la CNIL admet la prospection
          B2B par e-mail sans consentement préalable si le message concerne l&apos;activité professionnelle de la
          personne et permet de s&apos;opposer facilement aux envois. Au Québec et au Canada, la Loi 25 et la loi
          anti-pourriel (LCAP) s&apos;appliquent : vérifiez les exigences de consentement avant tout envoi
          d&apos;e-mail commercial. Dans tous les cas : identifiez-vous clairement, respectez un refus et supprimez les
          données de la personne qui le demande.
        </p>

        <H2>Vos droits</H2>
        <p>
          Toute personne peut demander l&apos;accès, la rectification ou la suppression des données la concernant en
          écrivant à [adresse e-mail]. En cas de difficulté, vous pouvez saisir la CNIL (France) ou la Commission
          d&apos;accès à l&apos;information (Québec).
        </p>
      </div>

      <p className="mt-10">
        <Link href="/recherche" className="link">← Retour à l&apos;outil</Link>
      </p>
    </main>
  );
}
