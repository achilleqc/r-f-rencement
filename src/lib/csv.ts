/**
 * Génération de CSV lisible par Excel en français : séparateur « ; », encodage UTF-8 avec BOM.
 */

type Cell = string | number | null | undefined;

const PHONE_LIKE = /^\+?[\d\s().-]+$/;

export function csvCell(value: Cell) {
  if (value == null) return "";
  let text = String(value);
  // Protection contre l'injection de formules (=, +, -, @ en début de cellule).
  if (/^[=+\-@\t\r]/.test(text) && !PHONE_LIKE.test(text)) text = `'${text}`;
  if (/[;"\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(header: string[], rows: Cell[][]) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
