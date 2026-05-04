/**
 * Recurrence-Rule Parsing + nächstes Datum berechnen.
 *
 * Recurrence-Rules werden als JSON-String in `Task.recurrenceRule` gespeichert.
 * Beim Erledigen einer wiederkehrenden Task ruft der Server `nextOccurrence`
 * mit dem alten `dueDate` (Fallback: heute) auf und legt eine Folge-Instanz an.
 *
 * Bewusst minimaler RFC-5545 — wir brauchen daily/weekly/monthly, nicht
 * jährliche Cron-Expressions oder Excludes. Wenn das später mal komplexer
 * wird, ist `rrule` die natürliche Library.
 */

export type RecurrenceRule =
  | { kind: "daily";   everyN: number }
  | { kind: "weekly";  everyN: number; weekdays: number[] /* 0=So..6=Sa */ }
  | { kind: "monthly"; everyN: number; dayOfMonth?: number };

export const RECURRENCE_KINDS: ReadonlyArray<RecurrenceRule["kind"]> = [
  "daily", "weekly", "monthly",
];

export const WEEKDAY_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;

/** Parse a stored JSON string. Returns null on bad input — never throws. */
export function parseRecurrence(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    if (!RECURRENCE_KINDS.includes(obj.kind)) return null;
    const everyN = Number(obj.everyN);
    if (!Number.isFinite(everyN) || everyN < 1) return null;
    if (obj.kind === "weekly") {
      const days = Array.isArray(obj.weekdays) ? obj.weekdays.filter((d: unknown) => typeof d === "number" && d >= 0 && d <= 6) : [];
      return { kind: "weekly", everyN, weekdays: days };
    }
    if (obj.kind === "monthly") {
      const dom = typeof obj.dayOfMonth === "number" && obj.dayOfMonth >= 1 && obj.dayOfMonth <= 31 ? obj.dayOfMonth : undefined;
      return { kind: "monthly", everyN, dayOfMonth: dom };
    }
    return { kind: "daily", everyN };
  } catch {
    return null;
  }
}

/** Serialize for storage. */
export function stringifyRecurrence(rule: RecurrenceRule): string {
  return JSON.stringify(rule);
}

/**
 * Berechnet das nächste dueDate basierend auf `from` und der Regel.
 * `from` wird zur lokalen Mittagszeit normalisiert, um DST-Drift zu vermeiden.
 */
export function nextOccurrence(rule: RecurrenceRule, from: Date): Date {
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  const everyN = Math.max(1, Math.floor(rule.everyN));

  switch (rule.kind) {
    case "daily": {
      const out = new Date(base);
      out.setDate(out.getDate() + everyN);
      return out;
    }
    case "weekly": {
      // Wenn weekdays gesetzt: finde nächsten gewählten Wochentag
      // mit Berücksichtigung von everyN Wochen-Lücken.
      if (rule.weekdays && rule.weekdays.length > 0) {
        const sorted = [...rule.weekdays].sort((a, b) => a - b);
        const baseDow = base.getDay();
        // Suche nach dem nächsten Wochentag in dieser Woche
        const nextThisWeek = sorted.find((d) => d > baseDow);
        if (nextThisWeek !== undefined && everyN === 1) {
          const out = new Date(base);
          out.setDate(out.getDate() + (nextThisWeek - baseDow));
          return out;
        }
        // Sonst: ersten gewählten Tag in der nächsten Iter-Woche
        const out = new Date(base);
        out.setDate(out.getDate() + (7 * everyN) - baseDow + sorted[0]);
        return out;
      }
      // Ohne weekdays: einfach +N Wochen
      const out = new Date(base);
      out.setDate(out.getDate() + 7 * everyN);
      return out;
    }
    case "monthly": {
      const out = new Date(base);
      out.setMonth(out.getMonth() + everyN);
      if (rule.dayOfMonth) {
        // Cap an den Monatsletzten (z.B. 31 → 30 im April)
        const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
        out.setDate(Math.min(rule.dayOfMonth, lastDay));
      }
      return out;
    }
  }
}

/** Menschenlesbare Kurzbeschreibung für UI-Badges. */
export function describeRecurrence(rule: RecurrenceRule): string {
  const n = rule.everyN;
  switch (rule.kind) {
    case "daily":
      return n === 1 ? "Täglich" : `Alle ${n} Tage`;
    case "weekly":
      if (rule.weekdays && rule.weekdays.length > 0) {
        const days = rule.weekdays
          .slice()
          .sort()
          .map((d) => WEEKDAY_SHORT_DE[d])
          .join(" ");
        return n === 1 ? `Wöchentl. (${days})` : `Alle ${n} Wo. (${days})`;
      }
      return n === 1 ? "Wöchentlich" : `Alle ${n} Wochen`;
    case "monthly":
      if (rule.dayOfMonth) {
        return n === 1
          ? `Monatlich am ${rule.dayOfMonth}.`
          : `Alle ${n} Mon. am ${rule.dayOfMonth}.`;
      }
      return n === 1 ? "Monatlich" : `Alle ${n} Monate`;
  }
}
