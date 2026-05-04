"use client";

import { useState } from "react";
import { Repeat, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  describeRecurrence,
  parseRecurrence,
  stringifyRecurrence,
  WEEKDAY_SHORT_DE,
  type RecurrenceRule,
} from "@/lib/recurrence";

interface RecurrencePickerProps {
  /** Stored JSON string oder null */
  value: string | null | undefined;
  /** Callback liefert JSON-String zum Speichern oder null zum Entfernen */
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

/**
 * Inline-Editor für Recurrence-Rules. Zeigt eine "Wiederholen…"-Pille, die
 * beim Klick zu einem Mini-Editor expandiert. Beim Bestätigen wird onChange
 * mit dem JSON-Output gerufen; "Entfernen" setzt null.
 */
export function RecurrencePicker({ value, onChange, disabled }: RecurrencePickerProps) {
  const current = parseRecurrence(value);
  const [editing, setEditing] = useState(false);

  // Lokaler Draft im Edit-Mode
  const [draftKind, setDraftKind] = useState<RecurrenceRule["kind"]>(current?.kind ?? "weekly");
  const [draftEveryN, setDraftEveryN] = useState<number>(current?.everyN ?? 1);
  const [draftWeekdays, setDraftWeekdays] = useState<number[]>(
    current?.kind === "weekly" ? current.weekdays : [1] /* Mo */,
  );
  const [draftDayOfMonth, setDraftDayOfMonth] = useState<number>(
    current?.kind === "monthly" ? (current.dayOfMonth ?? new Date().getDate()) : new Date().getDate(),
  );

  function buildRule(): RecurrenceRule {
    const everyN = Math.max(1, Math.floor(draftEveryN));
    if (draftKind === "weekly") {
      return { kind: "weekly", everyN, weekdays: [...draftWeekdays].sort() };
    }
    if (draftKind === "monthly") {
      return { kind: "monthly", everyN, dayOfMonth: draftDayOfMonth };
    }
    return { kind: "daily", everyN };
  }

  function commit() {
    onChange(stringifyRecurrence(buildRule()));
    setEditing(false);
  }

  function clear() {
    onChange(null);
    setEditing(false);
  }

  function startEdit() {
    if (current) {
      setDraftKind(current.kind);
      setDraftEveryN(current.everyN);
      if (current.kind === "weekly") setDraftWeekdays(current.weekdays);
      if (current.kind === "monthly" && current.dayOfMonth) setDraftDayOfMonth(current.dayOfMonth);
    }
    setEditing(true);
  }

  // ── Anzeige (nicht editierend) ───────────────────────────────────────────
  if (!editing) {
    if (!current) {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={startEdit}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Repeat className="h-3 w-3" />
          Wiederholen…
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-info/40 bg-info/10 pl-2.5 pr-1 py-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={startEdit}
          className="flex items-center gap-1.5 text-xs font-medium text-info disabled:cursor-not-allowed"
        >
          <Repeat className="h-3 w-3" />
          {describeRecurrence(current)}
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={clear}
            className="rounded-full p-0.5 text-info/60 hover:bg-info/20 hover:text-info"
            aria-label="Wiederholung entfernen"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  // ── Edit-Mode ────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3 text-sm w-full max-w-md">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-meta uppercase tracking-wider text-muted-foreground">Rhythmus</Label>
          <Select value={draftKind} onValueChange={(v) => setDraftKind(v as RecurrenceRule["kind"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Täglich</SelectItem>
              <SelectItem value="weekly">Wöchentlich</SelectItem>
              <SelectItem value="monthly">Monatlich</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-meta uppercase tracking-wider text-muted-foreground">
            Alle … {draftKind === "daily" ? "Tage" : draftKind === "weekly" ? "Wochen" : "Monate"}
          </Label>
          <Input
            type="number"
            min={1}
            max={365}
            value={draftEveryN}
            onChange={(e) => setDraftEveryN(Number(e.target.value) || 1)}
            className="h-9"
          />
        </div>
      </div>

      {draftKind === "weekly" && (
        <div className="space-y-1.5">
          <Label className="text-meta uppercase tracking-wider text-muted-foreground">
            Wochentage
          </Label>
          <div className="flex flex-wrap gap-1">
            {/* Reihenfolge: Mo Di Mi Do Fr Sa So (deutsch) */}
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const active = draftWeekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setDraftWeekdays((prev) =>
                      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                    )
                  }
                  className={cn(
                    "h-8 w-9 rounded-md border text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {WEEKDAY_SHORT_DE[d]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {draftKind === "monthly" && (
        <div className="space-y-1">
          <Label className="text-meta uppercase tracking-wider text-muted-foreground">
            Tag im Monat
          </Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={draftDayOfMonth}
            onChange={(e) =>
              setDraftDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
            }
            className="h-9 w-24"
          />
          <p className="text-meta text-muted-foreground">
            Bei kürzeren Monaten wird der letzte gültige Tag verwendet.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Beim Erledigen wird automatisch eine Folge-Instanz mit neuem Datum angelegt.
      </p>

      <div className="flex justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setEditing(false)}>
          Abbrechen
        </Button>
        <div className="flex gap-2">
          {current && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={clear}>
              Entfernen
            </Button>
          )}
          <Button type="button" size="sm" className="h-8" onClick={commit}>
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
