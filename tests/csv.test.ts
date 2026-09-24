import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("CSV", () => {
  it("échappe les séparateurs et les guillemets", () => {
    expect(csvCell('Chez "Paulo"; bar')).toBe('"Chez ""Paulo""; bar"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("neutralise les formules mais garde les numéros de téléphone", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+33 1 23 45 67 89")).toBe("+33 1 23 45 67 89");
    expect(csvCell("-bonjour")).toBe("'-bonjour");
  });

  it("commence par un BOM UTF-8 et utilise ; comme séparateur", () => {
    const csv = toCsv(["Nom", "Ville"], [["Boulangerie", "Lyon"]]);
    expect(csv.startsWith("﻿Nom;Ville\r\n")).toBe(true);
    expect(csv).toContain("Boulangerie;Lyon");
  });
});
