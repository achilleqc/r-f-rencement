import { describe, expect, it } from "vitest";
import { circlesIntersect, distanceMeters, offsetMeters, splitCircle } from "@/lib/places/geo";

const paris = { lat: 48.8566, lng: 2.3522 };

describe("géométrie", () => {
  it("calcule une distance cohérente", () => {
    const lyon = { lat: 45.764, lng: 4.8357 };
    expect(distanceMeters(paris, lyon) / 1000).toBeCloseTo(392, -1);
  });

  it("décale un point du bon nombre de mètres", () => {
    const moved = offsetMeters(paris, 300, 400);
    expect(distanceMeters(paris, moved)).toBeCloseTo(500, -1);
  });

  it("les 4 sous-cercles couvrent tout le cercle d'origine", () => {
    const circle = { center: paris, radius: 2000 };
    const children = splitCircle(circle);
    expect(children).toHaveLength(4);
    // Échantillonne des points du disque d'origine : chacun doit être dans au moins un sous-cercle.
    for (let angle = 0; angle < 360; angle += 15) {
      for (const r of [0, 500, 1000, 1500, 1999]) {
        const point = offsetMeters(paris, r * Math.cos((angle * Math.PI) / 180), r * Math.sin((angle * Math.PI) / 180));
        expect(children.some((c) => distanceMeters(c.center, point) <= c.radius + 1)).toBe(true);
      }
    }
    expect(children.every((c) => circlesIntersect(c, circle))).toBe(true);
  });
});
