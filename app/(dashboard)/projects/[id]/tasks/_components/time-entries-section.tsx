"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDuration } from "@/components/time-tracker";

interface TimeEntry {
  id: string;
  duration: number;
  startedAt: string;
  stoppedAt: string | null;
  description?: string | null;
  user?: { id: string; name: string | null; email: string };
}

function TimeEntryRow({
  entry,
  isClient,
  onDelete,
  onSave,
}: {
  entry: TimeEntry;
  isClient: boolean;
  onDelete: (id: string) => void;
  onSave: (id: string, data: { hours: number; minutes: number; date: string; description: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isRunning = !entry.stoppedAt;
  const startDate = new Date(entry.startedAt);

  const initHours = Math.floor(entry.duration / 3600);
  const initMinutes = Math.floor((entry.duration % 3600) / 60);
  const initDate = startDate.toISOString().slice(0, 10);

  const [editHours, setEditHours] = useState(initHours);
  const [editMinutes, setEditMinutes] = useState(initMinutes);
  const [editDate, setEditDate] = useState(initDate);
  const [editDesc, setEditDesc] = useState(entry.description ?? "");

  if (editing) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-meta uppercase tracking-wider text-muted-foreground">Datum</Label>
            <DatePicker value={editDate} onChange={setEditDate} />
          </div>
          <div className="space-y-1">
            <Label className="text-meta uppercase tracking-wider text-muted-foreground">Dauer</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number" min={0} max={99} value={editHours}
                onChange={(e) => setEditHours(Number(e.target.value))}
                className="h-9 w-14 text-center text-sm"
              />
              <span className="text-muted-foreground text-xs">h</span>
              <Input
                type="number" min={0} max={59} value={editMinutes}
                onChange={(e) => setEditMinutes(Number(e.target.value))}
                className="h-9 w-14 text-center text-sm"
              />
              <span className="text-muted-foreground text-xs">min</span>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-meta uppercase tracking-wider text-muted-foreground">Beschreibung</Label>
          <Input
            value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
            className="h-8 text-sm" placeholder="Optionale Notiz"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" className="h-7 text-xs px-3"
            onClick={() => {
              onSave(entry.id, { hours: editHours, minutes: editMinutes, date: editDate, description: editDesc });
              setEditing(false);
            }}
          >
            Speichern
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={() => setEditing(false)}>
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors",
        isRunning && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isRunning && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
        <span className="text-muted-foreground shrink-0">
          {startDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
        </span>
        {entry.user && (
          <span className="text-muted-foreground truncate">– {entry.user.name || entry.user.email}</span>
        )}
        {entry.description && (
          <span className="text-muted-foreground/60 truncate italic">{entry.description}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono font-semibold tabular-nums">
          {isRunning ? "läuft…" : formatDuration(entry.duration)}
        </span>
        {!isRunning && !isClient && (
          <>
            <button
              type="button" onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button" onClick={() => onDelete(entry.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface TimeEntriesSectionProps {
  taskId: string;
  onUpdate: () => void;
  isClient: boolean;
}

/** Manual + tracked time entries, listed under Task-Dialog → Details. */
export function TimeEntriesSection({ taskId, onUpdate, isClient }: TimeEntriesSectionProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [addDate, setAddDate] = useState(todayStr);
  const [addHours, setAddHours] = useState(0);
  const [addMinutes, setAddMinutes] = useState(30);
  const [addDesc, setAddDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`/api/time-entries?taskId=${taskId}`);
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [taskId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function deleteEntry(id: string) {
    await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    fetchEntries();
    onUpdate();
  }

  async function saveEdit(
    id: string,
    data: { hours: number; minutes: number; date: string; description: string },
  ) {
    const durationSec = data.hours * 3600 + data.minutes * 60;
    const startedAt = new Date(data.date + "T12:00:00");
    const stoppedAt = new Date(startedAt.getTime() + durationSec * 1000);
    await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: startedAt.toISOString(),
        stoppedAt: stoppedAt.toISOString(),
        duration: durationSec,
        description: data.description,
      }),
    });
    fetchEntries();
    onUpdate();
  }

  async function addManualEntry() {
    const durationSec = addHours * 3600 + addMinutes * 60;
    if (durationSec === 0) return;
    setSaving(true);
    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        manual: true,
        startedAt: new Date(addDate + "T12:00:00").toISOString(),
        duration: durationSec,
        description: addDesc.trim() || null,
      }),
    });
    setSaving(false);
    setAdding(false);
    setAddDate(todayStr);
    setAddHours(0);
    setAddMinutes(30);
    setAddDesc("");
    fetchEntries();
    onUpdate();
  }

  const totalSeconds = entries.reduce((sum, e) => {
    if (e.stoppedAt) return sum + e.duration;
    return sum + Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 1000);
  }, 0);

  if (loading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Zeiterfassung
        </Label>
        <div className="flex items-center gap-3">
          {totalSeconds > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {formatDuration(totalSeconds)} gesamt
            </span>
          )}
          {!isClient && (
            <button
              type="button" onClick={() => setAdding(!adding)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Zeit hinzufügen
            </button>
          )}
        </div>
      </div>

      {adding && !isClient && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-meta uppercase tracking-wider text-muted-foreground">Datum</Label>
              <DatePicker value={addDate} onChange={setAddDate} />
            </div>
            <div className="space-y-1">
              <Label className="text-meta uppercase tracking-wider text-muted-foreground">Dauer</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number" min={0} max={99} value={addHours}
                  onChange={(e) => setAddHours(Number(e.target.value))}
                  className="h-9 w-14 text-center text-sm"
                />
                <span className="text-muted-foreground text-xs">h</span>
                <Input
                  type="number" min={0} max={59} value={addMinutes}
                  onChange={(e) => setAddMinutes(Number(e.target.value))}
                  className="h-9 w-14 text-center text-sm"
                />
                <span className="text-muted-foreground text-xs">min</span>
              </div>
            </div>
          </div>
          <Input
            value={addDesc} onChange={(e) => setAddDesc(e.target.value)}
            className="h-8 text-sm" placeholder="Beschreibung (optional)"
          />
          <div className="flex gap-2">
            <Button
              size="sm" className="h-7 text-xs px-3"
              disabled={saving || (addHours === 0 && addMinutes === 0)}
              onClick={addManualEntry}
            >
              {saving ? "…" : "Eintragen"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={() => setAdding(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground py-1">Noch keine Zeit erfasst</p>
      ) : (
        <div className="max-h-[220px] space-y-1 overflow-y-auto">
          {entries.map((entry) => (
            <TimeEntryRow
              key={entry.id} entry={entry} isClient={isClient}
              onDelete={deleteEntry} onSave={saveEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
