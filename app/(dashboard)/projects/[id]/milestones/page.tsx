"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Milestone as MilestoneIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface Epic {
  id: string;
  title: string;
  description?: string | null;
  color: string;
  order: number;
  startDate?: string | null;
  dueDate?: string | null;
  _count?: { tasks: number };
  _tasksDone: number;
  _tasksTotal: number;
}

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
];

export default function MilestonesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEpic, setEditEpic] = useState<Epic | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEpics = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/epics`);
    if (res.ok) setEpics(await res.json());
  }, [projectId]);

  useEffect(() => {
    fetchEpics().finally(() => setLoading(false));
  }, [fetchEpics]);

  function openCreate() {
    setEditEpic(null);
    setTitle("");
    setDescription("");
    setColor("#6366f1");
    setStartDate("");
    setDueDate("");
    setDialogOpen(true);
  }

  function openEdit(epic: Epic) {
    setEditEpic(epic);
    setTitle(epic.title);
    setDescription(epic.description || "");
    setColor(epic.color);
    setStartDate(epic.startDate ? epic.startDate.slice(0, 10) : "");
    setDueDate(epic.dueDate ? epic.dueDate.slice(0, 10) : "");
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      color,
      startDate: startDate || null,
      dueDate: dueDate || null,
    };

    if (editEpic) {
      await fetch(`/api/projects/${projectId}/epics/${editEpic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/projects/${projectId}/epics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setDialogOpen(false);
    setSaving(false);
    fetchEpics();
  }

  async function handleDelete(epic: Epic) {
    await fetch(`/api/projects/${projectId}/epics/${epic.id}`, { method: "DELETE" });
    setDialogOpen(false);
    fetchEpics();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">Meilensteine</h2>
          <p className="text-xs text-muted-foreground">{epics.length} Meilenstein{epics.length !== 1 ? "e" : ""}</p>
        </div>
        {!isClient && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Meilenstein
          </Button>
        )}
      </div>

      {/* List */}
      {epics.length === 0 ? (
        <EmptyState
          icon={MilestoneIcon}
          title="Keine Meilensteine"
          description="Erstelle Meilensteine um den Projektfortschritt zu strukturieren und zu verfolgen."
          action={
            !isClient ? (
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Meilenstein erstellen
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {epics.map((epic) => {
            const pct = epic._tasksTotal > 0 ? Math.round((epic._tasksDone / epic._tasksTotal) * 100) : 0;
            const isComplete = epic._tasksTotal > 0 && epic._tasksDone === epic._tasksTotal;
            const isOverdue = epic.dueDate && new Date(epic.dueDate) < new Date() && !isComplete;

            return (
              <Card
                key={epic.id}
                className={cn(
                  "p-4 transition-colors hover:bg-muted/30 cursor-pointer",
                  isComplete && "opacity-70",
                )}
                onClick={() => !isClient && openEdit(epic)}
              >
                <div className="flex items-start gap-4">
                  {/* Color indicator */}
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
                    {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{epic.title}</span>
                      {isOverdue && <Badge variant="destructive" className="text-micro px-1.5 py-0">Überfällig</Badge>}
                      {isComplete && <Badge className="text-micro px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">Abgeschlossen</Badge>}
                    </div>

                    {epic.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{epic.description}</p>
                    )}

                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-xs">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: isComplete ? "#22c55e" : epic.color,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {epic._tasksDone}/{epic._tasksTotal} Tasks
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {pct}%
                      </span>
                    </div>

                    {/* Dates */}
                    {(epic.startDate || epic.dueDate) && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 shrink-0" />
                        {epic.startDate && <span>{formatDate(epic.startDate)}</span>}
                        {epic.startDate && epic.dueDate && <span>→</span>}
                        {epic.dueDate && (
                          <span className={cn(isOverdue && "text-destructive font-medium")}>
                            {formatDate(epic.dueDate)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isClient && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(epic); }}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(epic); }}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editEpic ? "Meilenstein bearbeiten" : "Neuer Meilenstein"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ms-title">Titel</Label>
              <Input
                id="ms-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="z.B. MVP Launch, Beta-Release..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ms-desc">Beschreibung</Label>
              <Textarea
                id="ms-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Was soll mit diesem Meilenstein erreicht werden?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Startdatum</Label>
                <DatePicker value={startDate} onChange={(v) => setStartDate(v ?? "")} />
              </div>
              <div className="space-y-2">
                <Label>Fällig am</Label>
                <DatePicker value={dueDate} onChange={(v) => setDueDate(v ?? "")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      color === c ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              {editEpic && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(editEpic)}
                >
                  Löschen
                </Button>
              )}
              <Button type="submit" disabled={!title.trim() || saving}>
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : editEpic ? (
                  "Speichern"
                ) : (
                  "Erstellen"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
