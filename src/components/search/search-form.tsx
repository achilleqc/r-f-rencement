"use client";

import Form from "next/form";
import { useState } from "react";
import { LoaderCircle, LocateFixed, Search, X } from "lucide-react";
import { CATEGORIES } from "@/lib/places/categories";
import { RADII } from "@/lib/search-params";

export type SearchFormValues = {
  q: string;
  lat: number | null;
  lng: number | null;
  r: number;
  cat: string;
};

function radiusLabel(r: number) {
  return r < 1000 ? `${r} m` : `${r / 1000} km`;
}

export function SearchForm({ initial }: { initial: SearchFormValues }) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initial.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null,
  );
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoError("La géolocalisation n'est pas disponible sur cet appareil.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: Number(pos.coords.latitude.toFixed(5)), lng: Number(pos.coords.longitude.toFixed(5)) });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Autorisez la localisation dans votre navigateur, ou saisissez une adresse."
            : "Position introuvable pour le moment : saisissez une adresse.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return (
    <Form action="/recherche" className="card p-3 shadow-soft sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-end">
        <div>
          <label htmlFor="q" className="label">Adresse, ville ou quartier</label>
          {position ? (
            <div className="field flex items-center justify-between gap-2 bg-accent-soft/40">
              <span className="flex min-w-0 items-center gap-2 truncate text-sm font-medium">
                <LocateFixed className="size-4 shrink-0 text-accent" />
                Autour de ma position
              </span>
              <button type="button" onClick={() => setPosition(null)} className="rounded p-0.5 text-muted hover:text-ink" aria-label="Saisir une adresse à la place">
                <X className="size-4" />
              </button>
              <input type="hidden" name="lat" value={position.lat} />
              <input type="hidden" name="lng" value={position.lng} />
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                id="q"
                name="q"
                required
                maxLength={200}
                defaultValue={initial.q}
                placeholder="Ex. : 12 rue de la République, Lyon"
                autoComplete="street-address"
                className="field"
              />
              <button type="button" onClick={locate} disabled={locating} className="btn btn-secondary shrink-0 px-3" title="Utiliser ma position">
                {locating ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                <span className="sr-only sm:not-sr-only">Ma position</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:contents">
          <div>
            <label htmlFor="r" className="label">Rayon</label>
            <select id="r" name="r" defaultValue={initial.r} className="field lg:w-28">
              {RADII.map((r) => (
                <option key={r} value={r}>{radiusLabel(r)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cat" className="label">Type de commerce</label>
            <select id="cat" name="cat" defaultValue={initial.cat} className="field lg:w-64">
              <option value="tous">Tous les commerces</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-primary h-[2.9rem]">
          <Search className="size-4" />
          Rechercher
        </button>
      </div>
      {geoError && <p className="mt-2 text-sm text-danger" role="alert">{geoError}</p>}
    </Form>
  );
}
