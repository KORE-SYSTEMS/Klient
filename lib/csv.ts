/**
 * Minimaler CSV-Encoder/Decoder für Task-Import/Export.
 *
 * Bewusst ohne npm-Dependency — wir brauchen nur RFC-4180-light:
 *   - Trennzeichen Komma
 *   - Werte mit Komma / Anführungszeichen / Newline werden in `"…"` gewrappt
 *   - `"` innen wird zu `""` escapt
 *   - Erste Zeile = Header
 *
 * Reicht für menschen-bearbeitete Spreadsheets (Excel / Numbers / Sheets).
 * Wer komplexere CSVs braucht, kann später `papaparse` einbauen.
 */

const NEEDS_QUOTING = /[",\r\n]/;

export function csvStringify(rows: string[][]): string {
  return rows.map((row) => row.map(quoteField).join(",")).join("\r\n");
}

function quoteField(value: string | undefined | null): string {
  const s = value == null ? "" : String(value);
  if (NEEDS_QUOTING.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Parse einen CSV-String. Werte sind immer Strings — Konvertierung passiert
 * im Aufrufer. Liefert `{ headers, rows }` oder wirft bei strukturellem
 * Bruch (z.B. nicht geschlossene Anführungszeichen).
 */
export function csvParse(input: string): { headers: string[]; rows: string[][] } {
  // Strip BOM if present (Excel adds it on UTF-8 export)
  let text = input.replace(/^﻿/, "");
  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    // Not in quotes
    if (ch === '"') {
      // Quote at start of field — go into quoted mode
      if (field.length === 0) { inQuotes = true; i++; continue; }
      // Mid-field quotes are tolerated as literal
      field += ch;
      i++;
      continue;
    }
    if (ch === ",") { current.push(field); field = ""; i++; continue; }
    if (ch === "\n") {
      current.push(field);
      field = "";
      // Skip fully empty rows (no fields, or single empty field)
      if (current.length > 1 || current[0] !== "") rows.push(current);
      current = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush trailing field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    if (current.length > 1 || current[0] !== "") rows.push(current);
  }

  if (inQuotes) throw new Error("Ungeschlossenes Anführungszeichen — CSV ist kaputt");

  if (rows.length === 0) return { headers: [], rows: [] };
  const [headers, ...body] = rows;
  return { headers: headers.map((h) => h.trim()), rows: body };
}

/**
 * Convenience: zip a parsed CSV into objects keyed by header.
 * Unbekannte Headers landen mit ihrem rohen String-Wert in `extra`.
 */
export function csvToObjects<T extends Record<string, string>>(
  parsed: { headers: string[]; rows: string[][] },
): T[] {
  return parsed.rows.map((row) => {
    const obj: Record<string, string> = {};
    parsed.headers.forEach((h, i) => {
      obj[h] = (row[i] ?? "").trim();
    });
    return obj as T;
  });
}
