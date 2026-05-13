"use client";

import { useState } from "react";
import { Repeat, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

export function RecurrencePicker({ value, onChange, disabled }: RecurrencePickerProps) {
  const current = parseRecurrence(value);
  const [open, setOpen] = useState(false);

  const [draftKind, setDraftKind] = useState<RecurrenceRule["kind"]>(current?.kind ?? "weekly");
  const [draftEveryN, setDraftEveryN] = useState<number>(current?.everyN ?? 1);
  const [draftWeekdays, setDraftWeekdays] = useState<number[]>(
    current?.kind === "weekly" ? current.weekdays : [1],
  );
  const [draftDayOfMonth, setDraftDayOfMonth] = useState<number>(
    current?.kind === "monthly" ? (current.dayOfMonth ?? new Date().getDate()) : new Date().getDate(),
  );

  function buildRule(): RecurrenceRule {
    const everyN = Math.max(1, Math.floor(draftEveryN));
    if (draftKind === "weekly") return { kind: "weekly", everyN, weekdays: [...draftWeekdays].sort() };
    if (draftKind === "monthly") return { kind: "monthly", everyN, dayOfMonth: draftDayOfMonth };
    return { kind: "daily", everyN };
  }

  function openDialog() {
    if (current) {
      setDraftKind(current.kind);
      setDraftEveryN(current.everyN);
      if (current.kind === "weekly") setDraftWeekdays(current.weekdays);
      if (current.kind === "monthly" && current.dayOfMonth) setDraftDayOfMonth(current.dayOfMonth);
    }
    setOpen(true);
  }

  function commit() {
    onChange(stringifyRecurrence(buildRule()));
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setOpen(false);
  }

  const unitLabel = draftKind === "daily" ? "Tage" : draftKind === "weekly" ? "Wochen" : "Monate";

  return (
    <>
      {/* Trigger pill */}
      {!current ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openDialog}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Repeat className="h-3 w-3" />
          Wiederholen…
        </button>
      ) : (
        <div className="inline-flex items-center gap-1 rounded-full border border-info/40 bg-info/10 pl-2.5 pr-1 py-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={openDialog}
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
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Wiederholung
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rhythmus</Label>
                <Select value={draftKind} onValueChange={(v) => setDraftKind(v as RecurrenceRule["kind"])}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Täglich</SelectItem>
                    <SelectItem value="weekly">Wöchentlich</SelectItem>
                    <SelectItem value="monthly">Monatlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alle … {unitLabel}</Label>
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Wochentage</Label>
                <div className="flex gap-1.5">
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
                          "flex-1 h-9 rounded-lg text-xs font-semibold transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tag im Monat</Label>
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
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Beim Erledigen wird automatisch eine Folge-Instanz mit neuem Datum angelegt.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {current && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive mr-auto" onClick={clear}>
                Entfernen
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" size="sm" onClick={commit}>
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
