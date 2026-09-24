"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ScoredPlace } from "@/lib/places/enrich";
import { LEVELS } from "@/lib/places/score";
import type { LatLng } from "@/lib/places/types";

type Props = {
  center: LatLng;
  radius: number;
  places: ScoredPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Vrai quand la carte est affichée (sur mobile, elle peut être masquée derrière l'onglet « Liste »). */
  visible: boolean;
};

const BASE_STYLE = { radius: 7, color: "#ffffff", weight: 1.5 };

/** Cadre la carte sur la zone ; une carte masquée (taille nulle) reçoit une vue provisoire. */
function frame(map: L.Map, bounds: L.LatLngBounds) {
  const size = map.getSize();
  if (size.x > 0 && size.y > 0) map.fitBounds(bounds, { padding: [12, 12] });
  else map.setView(bounds.getCenter(), 15);
}
const SELECTED_STYLE = { radius: 11, color: "#0f172a", weight: 3 };

export default function ResultsMap({ center, radius, places, selectedId, onSelect, visible }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.CircleMarker>());
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const select = useEffectEvent((id: string) => onSelect(id));

  // Création de la carte
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { preferCanvas: true, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Zone de recherche (le cadrage doit précéder l'ajout des calques : Leaflet attend une vue initiale)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    boundsRef.current = L.latLng(center.lat, center.lng).toBounds(radius * 2);
    frame(map, boundsRef.current);
    const circle = L.circle([center.lat, center.lng], {
      radius,
      color: "#2563eb",
      weight: 1.5,
      fillOpacity: 0.04,
      interactive: false,
    }).addTo(map);
    const dot = L.circleMarker([center.lat, center.lng], {
      radius: 5,
      color: "#ffffff",
      weight: 2,
      fillColor: "#0f172a",
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    return () => {
      circle.remove();
      dot.remove();
    };
  }, [center.lat, center.lng, radius]);

  // Marqueurs (couleur = niveau du score)
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current.clear();
    for (const place of places) {
      const marker = L.circleMarker([place.lat, place.lng], {
        ...BASE_STYLE,
        fillColor: LEVELS[place.visibility.level].color,
        fillOpacity: 0.95,
      });
      const label = document.createElement("span");
      label.textContent = `${place.name} · ${place.visibility.score}/100`;
      marker.bindTooltip(label, { direction: "top", offset: [0, -6] });
      marker.on("click", () => select(place.id));
      marker.addTo(layer);
      markersRef.current.set(place.id, marker);
    }
  }, [places]);

  // Commerce sélectionné
  useEffect(() => {
    const marker = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (!marker || !mapRef.current) return;
    marker.setStyle(SELECTED_STYLE);
    marker.bringToFront();
    mapRef.current.panTo(marker.getLatLng(), { animate: true });
    return () => {
      marker.setStyle(BASE_STYLE);
    };
  }, [selectedId, places]);

  // Une carte créée dans un conteneur masqué (onglet « Liste » sur mobile) a une taille nulle :
  // on la redimensionne et on la recadre quand elle s'affiche.
  const refit = useEffectEvent(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    if (boundsRef.current) frame(map, boundsRef.current);
    const marker = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (marker) map.panTo(marker.getLatLng());
  });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(refit, 50);
    return () => clearTimeout(timer);
  }, [visible]);

  return <div ref={containerRef} className="size-full" role="region" aria-label="Carte des commerces" />;
}
