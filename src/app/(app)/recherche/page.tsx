import type { Metadata } from "next";
import { Suspense } from "react";
import { Globe, MapPinned, TriangleAlert, UserPlus } from "lucide-react";
import { SearchForm } from "@/components/search/search-form";
import { ResultsView } from "@/components/search/results-view";
import { requireUser } from "@/lib/auth";
import { ProviderError, type LatLng } from "@/lib/places";
import { enrichPlaces } from "@/lib/places/enrich";
import { savedPlaceIds } from "@/lib/prospects";
import { geocode, monthlyApiUsage, searchPlaces } from "@/lib/search";
import { parseSearchParams, type ParsedSearch } from "@/lib/search-params";

export const metadata: Metadata = { title: "Recherche" };

type Search = NonNullable<ParsedSearch["search"]>;

async function loadResults(search: Search, userId: string) {
  try {
    let center: LatLng;
    let locationLabel: string;
    if (search.kind === "position") {
      center = { lat: search.lat, lng: search.lng };
      locationLabel = "votre position";
    } else {
      const found = await geocode(search.q, userId);
      if (!found) return { error: `Adresse introuvable : « ${search.q} ». Précisez la ville ou le code postal.` };
      center = { lat: found.lat, lng: found.lng };
      locationLabel = found.label;
    }
    const result = await searchPlaces({ center, radius: search.radius, category: search.category }, userId);
    const saved = await savedPlaceIds(userId);
    return { center, locationLabel, result, saved };
  } catch (error) {
    console.error("[recherche]", error);
    return {
      error: error instanceof ProviderError ? error.message : "La recherche a échoué. Réessayez dans un instant.",
    };
  }
}

async function Results({ search, query, userId }: { search: Search; query: string; userId: string }) {
  const data = await loadResults(search, userId);
  if ("error" in data) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {data.error}
      </p>
    );
  }
  const { center, locationLabel, result, saved } = data;
  return (
    <ResultsView
      places={enrichPlaces(result.places, center)}
      center={center}
      radius={search.radius}
      locationLabel={locationLabel}
      source={result.source}
      sourceLabel={result.sourceLabel}
      truncated={result.truncated}
      fromCache={result.fromCache}
      cachedAt={result.cachedAt.toISOString()}
      saved={saved}
      query={query}
    />
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-sm text-muted">Recherche des commerces… (jusqu&apos;à une vingtaine de secondes pour une grande zone)</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-line/60" />
          ))}
        </div>
        <div className="hidden h-[calc(100dvh-5.5rem)] animate-pulse rounded-2xl bg-line/60 lg:block" />
      </div>
    </div>
  );
}

const steps = [
  { icon: MapPinned, title: "1. Choisissez une zone", text: "Une adresse, une ville ou votre position, et un rayon de 300 m à 10 km." },
  { icon: Globe, title: "2. Repérez les points rouges", text: "Chaque commerce reçoit un score : rouge = pas de site, fiche incomplète, peu d'avis." },
  { icon: UserPlus, title: "3. Ajoutez vos prospects", text: "Enregistrez les commerces intéressants, prenez des notes et planifiez vos relances." },
];

async function Intro() {
  const usage = await monthlyApiUsage();
  const google = Boolean(process.env.GOOGLE_PLACES_API_KEY);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="card p-4">
            <s.icon className="mb-2 size-5 text-accent" />
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Source des données : {google ? "Google Places" : "OpenStreetMap (gratuit)"}.
        {google
          ? ` Appels Google ce mois-ci : ${usage.google ?? 0}.`
          : " Ajoutez une clé Google Places pour obtenir les avis, les photos et des fiches plus complètes."}
      </p>
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/recherche">) {
  const user = await requireUser("/recherche");
  const raw = await searchParams;
  const { form, search } = parseSearchParams(raw);
  const query = new URLSearchParams(
    Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  ).toString();

  return (
    <div className="container-page space-y-4 py-4">
      <SearchForm key={query} initial={form} />
      {search ? (
        <Suspense key={query} fallback={<ResultsSkeleton />}>
          <Results search={search} query={query} userId={user.id} />
        </Suspense>
      ) : (
        <Intro />
      )}
    </div>
  );
}
