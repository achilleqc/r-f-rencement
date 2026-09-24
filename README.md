# Prospection locale

Trouvez les **commerces proches qui n'ont pas (ou peu) de présence en ligne** (pas de site, simple page Facebook, fiche Google incomplète, peu d'avis) et suivez-les comme prospects pour leur proposer un site ou du référencement local.

- **Recherche** autour d'une adresse ou de votre position, dans un rayon de 300 m à 10 km, par type de commerce.
- **Score de présence en ligne** de 0 à 100 pour chaque commerce, avec le détail des points perdus.
- **Carte + liste** triées des moins visibles aux plus visibles, filtres (« sans vrai site », score, type, chaînes…).
- **Analyse de site** en un clic (HTTPS, mobile, balises Google, rapidité, date de mise à jour) pour argumenter une refonte.
- **Mini-CRM** : statut (à contacter, contacté, intéressé, client, pas intéressé), notes, date de relance, alertes de relance.
- **Export CSV** (compatible Excel) des résultats et des prospects.
- Fonctionne **gratuitement avec OpenStreetMap**, ou avec **Google Places** si vous ajoutez une clé.

---

## 1. Lancer le projet en local

Prérequis : [Node.js](https://nodejs.org) 20.9 ou plus récent.

```bash
npm install
cp .env.example .env
npm run db:migrate          # crée la base SQLite dans data/app.db
npm run dev
```

Ouvrez http://localhost:3000 : vous arrivez sur la page de connexion. Cliquez sur **« Créer un compte »** : le **premier compte** peut toujours être créé, ensuite les inscriptions sont fermées (voir `ALLOW_SIGNUP`).

> `AUTH_SECRET` (clé des sessions) est facultatif en développement et sur Vercel avec Turso. Il est obligatoire pour `npm start` sans Turso. Le générer : `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

---

## 2. Sources de données

### OpenStreetMap (par défaut, gratuit)

Sans configuration, l'outil interroge [OpenStreetMap](https://www.openstreetmap.org) (API Overpass) pour les commerces et Nominatim pour les adresses.

- ✅ Gratuit, sans clé, sans limite de coût.
- ⚠️ Données collaboratives : beaucoup de commerces n'ont pas leur site renseigné dans OSM alors qu'ils en ont un. Le bouton **« Vérifier sur Google »** de chaque fiche permet de contrôler en 5 secondes avant d'appeler.
- ⚠️ Pas d'avis ni de photos : ces critères sont marqués « non disponibles » et ne comptent pas dans le score.
- Renseignez `OSM_CONTACT_EMAIL` (demandé par la politique d'utilisation d'OpenStreetMap).

### Google Places (optionnel, plus complet)

Avec une clé Google, les résultats incluent les **avis, la note, les photos, les horaires** et des sites web plus fiables.

**Obtenir une clé :**

1. Allez sur https://console.cloud.google.com et créez un projet.
2. Activez la **facturation** sur le projet (Google l'exige, même dans la limite de l'usage gratuit mensuel).
3. Menu **API et services → Bibliothèque** : cherchez et activez **« Places API (New) »**.
4. Menu **API et services → Identifiants → Créer des identifiants → Clé API**.
5. Cliquez sur la clé → **Restrictions d'API** → limitez-la à « Places API (New) ». Enregistrez.
6. Collez la clé dans `.env` : `GOOGLE_PLACES_API_KEY=...` et redémarrez.

**Coût :** Google facture chaque appel (voir la [grille tarifaire Google Maps Platform](https://mapsplatform.google.com/pricing/), avec un volume gratuit mensuel par type d'appel). Pour garder la facture sous contrôle :

- les recherches sont **mises en cache 7 jours** (relancer la même recherche ne coûte rien) ;
- une recherche consomme **au maximum `GOOGLE_MAX_CALLS_PER_SEARCH` appels** (12 par défaut). Google renvoie 20 commerces par appel : une zone dense est découpée en sous-zones jusqu'à ce plafond ;
- le nombre d'appels du mois est affiché sur la page de recherche ;
- définissez une **alerte de budget** dans la console Google Cloud (Facturation → Budgets et alertes).

**Conditions de Google :** les données Google ne peuvent pas être affichées sur une carte non-Google. En mode Google, la carte OpenStreetMap est donc remplacée par des liens « Google Maps » sur chaque commerce.

---

## 3. Le score de présence en ligne

Chaque commerce part de 100 points ; des points sont retirés pour chaque faiblesse (`src/lib/places/score.ts`).

| Critère | Points retirés |
|---|---|
| Aucun site web | −50 |
| Lien vers un site Google fermé (`business.site`, fermés en 2024) | −45 |
| Seulement une page réseau social (Facebook, Instagram, Linktree…) | −40 |
| Seulement une fiche plateforme (TripAdvisor, PagesJaunes, Doctolib, Uber Eats…) | −35 |
| Site sur un hébergement gratuit (Wix, Jimdo, Google Sites…) | −15 |
| Aucun avis Google / moins de 10 / moins de 30 | −15 / −10 / −5 |
| Note inférieure à 3,5/5 | −5 |
| Aucune photo | −8 |
| Pas de téléphone | −7 |
| Pas d'horaires | −6 |

| Score | Niveau | Couleur |
|---|---|---|
| 0 à 39 | Très faible : **meilleurs prospects** | rouge |
| 40 à 64 | Faible | orange |
| 65 à 89 | Moyenne | jaune |
| 90 à 100 | Bonne | vert |

Les **chaînes et franchises** (enseigne connue dans OSM, ou plusieurs commerces partageant le même site) sont masquées par défaut : elles ont rarement besoin d'un prestataire local.

---

## 4. Mettre en ligne sur Vercel (gratuit)

Aucune variable à saisir : la base de données Turso se branche en quelques clics et la clé des sessions en est dérivée automatiquement.

1. Sur https://vercel.com, connectez-vous **avec votre compte GitHub**.
2. **Add New… → Project** → à côté du dépôt `r-f-rencement`, cliquez **Import**, puis **Deploy**.
3. Ouvrez le site : il affiche « Dernière étape : connecter la base de données ». Dans le projet Vercel, onglet **Storage** → **Turso** → créez la base et connectez-la au projet.
4. Onglet **Deployments** → menu **⋯** du dernier déploiement → **Redeploy**. Les tables sont créées automatiquement.
5. Ouvrez le site et **créez tout de suite votre compte** : c'est le premier compte, les inscriptions se ferment ensuite.

Facultatif, dans **Settings → Environment Variables** : `OSM_CONTACT_EMAIL` (votre e-mail, demandé par OpenStreetMap), `GOOGLE_PLACES_API_KEY`, `AUTH_SECRET` (sinon dérivée de la base).

*Sans l'intégration Vercel :* créez une base sur https://turso.tech et ajoutez vous-même `DATABASE_URL` (`libsql://…`) et `DATABASE_AUTH_TOKEN`.

Pour donner accès à un collègue : mettez temporairement `ALLOW_SIGNUP=true`, ou créez son compte en ligne de commande (avec les variables de la base de production dans `.env`) :

```bash
npm run user:create -- collegue@exemple.fr "MotDePasse-Solide" "Prénom Nom"
```

---

## 5. Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm test` | Tests (Vitest, sans appel réseau) |
| `npm run lint` / `npm run typecheck` | Qualité du code |
| `npm run db:migrate` | Applique les migrations (`drizzle/`) |
| `npm run db:generate` | Génère une migration après modification de `src/db/schema.ts` |
| `npm run user:create -- email "mdp" "Nom"` | Crée un compte ou change son mot de passe |

---

## 6. Architecture

```
src/
  app/
    (auth)/connexion, inscription     connexion / premier compte
    (app)/recherche                   recherche, carte, liste, filtres
    (app)/prospects, prospects/[id]   mini-CRM, fiche prospect
    (app)/prospects/export            export CSV des prospects
    api/audit                         analyse d'un site web
    donnees                           données et confidentialité (RGPD)
    actions/                          server actions (auth, prospects)
  components/                         interface (recherche, carte Leaflet, fiches…)
  db/schema.ts                        tables Drizzle (SQLite / Turso)
  lib/
    places/osm.ts                     source OpenStreetMap (Overpass)
    places/google.ts                  source Google Places (New), découpage des zones
    places/geocode.ts                 adresses → coordonnées (Nominatim)
    places/categories.ts              types de commerces (tags OSM / types Google)
    places/website.ts                 site réel, réseau social, plateforme, site gratuit…
    places/score.ts                   score de présence en ligne
    search.ts                         cache des recherches, compteur d'appels
    site-audit.ts                     analyse de site (protégée contre les adresses internes)
tests/                                tests Vitest avec réponses d'API simulées
```

Les deux sources implémentent la même interface `PlacesProvider` (`src/lib/places/types.ts`) : ajouter une autre source revient à écrire un nouveau fichier dans `src/lib/places/`.

---

## 7. Données personnelles

L'outil ne manipule que des **données professionnelles publiques** (nom commercial, adresse, téléphone, site). Les prospects et vos notes sont privés, et supprimables à tout moment depuis leur fiche. Complétez la page `/donnees` (`src/app/donnees/page.tsx`) avec vos informations et respectez les règles de prospection de votre pays (RGPD et CNIL en France, Loi 25 et LCAP au Québec et au Canada).
