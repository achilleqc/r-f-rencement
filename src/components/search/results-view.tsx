"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Download, List, Map as MapIcon, RefreshCw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { refreshSearch } from "@/app/actions/prospects";
import { SubmitButton } from "@/components/ui/submit-button";
import { toCsv } from "@/lib/csv";
import { categoryLabel, type CategoryId } from "@/lib/places/categories";
import type { ScoredPlace } from "@/lib/places/enrich";
import { websiteSummary } from "@/lib/places/labels";
import { LEVELS } from "@/lib/places/score";
import type { LatLng, PlaceSource } from "@/lib/places/types";
import { cn, formatDistance } from "@/lib/utils";
import { PlaceItem } from "./place-item";

const ResultsMap = dynamic(() => import("./results-map"), {
  ssr: false,
  loading: () => <div className="grid size-full place-items-center bg-paper text-sm text-muted">Chargement de la carte…</div>,
});

const PAGE_SIZE = 50;

const SCORE_FILTERS = [
  { value: 100, label: "Tous les scores" },
  { value: LEVELS.good.min - 1, label: "Présence moyenne ou moins" },
  { value: LEVELS.medium.min - 1, label: "Présence faible ou moins" },
  { value: LEVELS.low.min - 1, label: "Présence très faible" },
];

type Props = {
  places: ScoredPlace[];
  center: LatLng;
  radius: number;
  locationLabel: string;
  source: PlaceSource;
  sourceLabel: string;
  truncated: boolean;
  fromCache: boolean;
  cachedAt: string;
  saved: Record<string, string>;
  query: string;
};

function exportCsv(places: ScoredPlace[]) {
  const csv = toCsv(
    ["Nom", "Type", "Score", "Niveau", "Site web", "Constat", "Téléphone", "E-mail", "Adresse", "Distance (m)", "Avis", "Note", "Source", "Lien"],
    places.map((p) => [
      p.name,
      p.typeLabel,
      p.visibility.score,
      LEVELS[p.visibility.level].short,
      p.website ?? p.socials[0] ?? "",
      websiteSummary(p.visibility.website).text,
      p.phone,
      p.email,
      p.address,
      Math.round(p.distance),
      p.reviewCount,
      p.rating,
      p.source === "google" ? "Google" : "OpenStreetMap",
      p.sourceUrl,
    ]),
  );
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `commerces-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ResultsView(props: Props) {
  const { places, center, radius, source } = props;
  const [saved, setSaved] = useState(props.saved);
  const [onlyNoSite, setOnlyNoSite] = useState(false);
  const [maxScore, setMaxScore] = useState(100);
  const [category, setCategory] = useState<CategoryId | "tous">("tous");
  const [hideChains, setHideChains] = useState(true);
  const [hideSaved, setHideSaved] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [sort, setSort] = useState<"score" | "distance">("score");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [showFilters, setShowFilters] = useState(false);

  const categories = useMemo(
    () => [...new Set(places.map((p) => p.category).filter((c): c is CategoryId => c !== null))],
    [places],
  );

  const filtered = useMemo(() => {
    const needle = nameFilter.trim().toLowerCase();
    const list = places.filter(
      (p) =>
        p.status !== "closed_permanently" &&
        p.visibility.score <= maxScore &&
        (!onlyNoSite || (p.visibility.website.kind !== "site" && p.visibility.website.kind !== "free")) &&
        (category === "tous" || p.category === category) &&
        (!hideChains || !p.isChain) &&
        (!hideSaved || !saved[p.id]) &&
        (!needle || p.name.toLowerCase().includes(needle)),
    );
    return sort === "distance" ? [...list].sort((a, b) => a.distance - b.distance) : list;
  }, [places, maxScore, onlyNoSite, category, hideChains, hideSaved, saved, nameFilter, sort]);

  const activeFilters = [onlyNoSite, !hideChains, hideSaved, maxScore < 100, category !== "tous", nameFilter.trim() !== "", sort !== "score"].filter(Boolean).length;

  const noSiteCount = useMemo(
    () => filtered.filter((p) => p.visibility.website.kind !== "site" && p.visibility.website.kind !== "free").length,
    [filtered],
  );

  function selectFromMap(id: string) {
    setSelectedId(id);
    setExpandedId(id);
    const index = filtered.findIndex((p) => p.id === id);
    if (index >= limit) setLimit(index + 1);
    setMobileView("list");
    requestAnimationFrame(() => document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function toggle(id: string) {
    setSelectedId(id);
    setExpandedId((current) => (current === id ? null : id));
  }

  const cachedAt = new Date(props.cachedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold">
            {filtered.length} commerce{filtered.length > 1 ? "s" : ""}
            <span className="font-normal text-muted"> dont {noSiteCount} sans vrai site</span>
          </h1>
          <p className="truncate text-xs text-muted" title={props.locationLabel}>
            {formatDistance(radius)} autour de {props.locationLabel} · {props.sourceLabel}
            {props.fromCache && <span suppressHydrationWarning> · résultats du {cachedAt}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={refreshSearch}>
            <input type="hidden" name="query" value={props.query} />
            <input type="hidden" name="lat" value={center.lat} />
            <input type="hidden" name="lng" value={center.lng} />
            <SubmitButton variant="secondary" className="btn-sm" pendingLabel="Actualisation…">
              <RefreshCw className="size-3.5" /> Actualiser
            </SubmitButton>
          </form>
          <button type="button" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0} className="btn btn-secondary btn-sm">
            <Download className="size-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {props.truncated && (
        <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          La zone contient probablement d&apos;autres commerces : réduisez le rayon ou choisissez un type de commerce.
        </p>
      )}

      {/* Onglets mobile */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-line/60 p-1 lg:hidden">
        {(
          [
            ["list", "Liste", List],
            ["map", "Carte", MapIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMobileView(value)}
            aria-pressed={mobileView === value}
            className={cn("btn btn-sm", mobileView === value ? "bg-surface shadow-soft" : "text-muted")}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={cn("btn btn-sm", showFilters ? "bg-surface shadow-soft" : "text-muted")}
        >
          <SlidersHorizontal className="size-4" /> Filtres{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </button>
      </div>

      {/* Filtres */}
      <div className={cn(showFilters ? "flex" : "hidden", "card flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm lg:flex")}>
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={onlyNoSite} onChange={(e) => setOnlyNoSite(e.target.checked)} className="size-4 accent-accent" />
          Sans vrai site web
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hideChains} onChange={(e) => setHideChains(e.target.checked)} className="size-4 accent-accent" />
          Masquer les chaînes
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hideSaved} onChange={(e) => setHideSaved(e.target.checked)} className="size-4 accent-accent" />
          Masquer mes prospects
        </label>
        <select value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} className="field w-auto py-1.5 text-sm" aria-label="Filtrer par score">
          {SCORE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        {categories.length > 1 && (
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId | "tous")} className="field w-auto py-1.5 text-sm" aria-label="Filtrer par type">
            <option value="tous">Tous les types</option>
            {categories.map((c) => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as "score" | "distance")} className="field w-auto py-1.5 text-sm" aria-label="Trier">
          <option value="score">Trier : moins visibles d&apos;abord</option>
          <option value="distance">Trier : plus proches d&apos;abord</option>
        </select>
        <input
          type="search"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Filtrer par nom…"
          className="field w-full py-1.5 text-sm sm:w-48"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Liste */}
        <div className={cn(mobileView === "list" ? "block" : "hidden", "lg:block")}>
          {filtered.length === 0 ? (
            <p className="card p-6 text-center text-sm text-muted">
              Aucun commerce ne correspond à ces filtres.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {filtered.slice(0, limit).map((place) => (
                  <PlaceItem
                    key={place.id}
                    place={place}
                    selected={selectedId === place.id}
                    expanded={expandedId === place.id}
                    prospectId={saved[place.id]}
                    onToggle={() => toggle(place.id)}
                    onSaved={(placeId, prospectId) => setSaved((s) => ({ ...s, [placeId]: prospectId }))}
                  />
                ))}
              </ul>
              {filtered.length > limit && (
                <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE)} className="btn btn-secondary mt-3 w-full">
                  Afficher plus ({filtered.length - limit} restants)
                </button>
              )}
            </>
          )}
        </div>

        {/* Carte */}
        <div className={cn(mobileView === "map" ? "block" : "hidden", "lg:block")}>
          <div className="card h-[70dvh] overflow-hidden lg:sticky lg:top-18 lg:h-[calc(100dvh-5.5rem)]">
            {source === "google" ? (
              <div className="grid size-full place-items-center p-6 text-center text-sm text-muted">
                <p className="max-w-sm">
                  Les conditions d&apos;utilisation de Google interdisent d&apos;afficher ses données sur une autre carte que
                  Google Maps. Utilisez le bouton « Google Maps » de chaque commerce.
                </p>
              </div>
            ) : (
              <ResultsMap
                center={center}
                radius={radius}
                places={filtered}
                selectedId={selectedId}
                onSelect={selectFromMap}
                visible={mobileView === "map"}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
