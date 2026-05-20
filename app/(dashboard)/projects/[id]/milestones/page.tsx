"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
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
  ChevronDown,
  ChevronRight,
  Circle,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { PriorityPill } from "@/components/task/priority-pill";

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

interface TaskInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  epicId?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
}

interface StatusInfo {
  id: string;
  name: string;
  color: string;
  category?: string;
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

  // Expanded epics (show tasks)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tasksByEpic, setTasksByEpic] = useState<Record<string, TaskInfo[]>>({});
  const [statusMap, setStatusMap] = useState<Record<string, StatusInfo>>({});
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());

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

  // Fetch statuses once
  useEffect(() => {
    fetch(`/api/projects/${projectId}/statuses`)
      .then((r) => r.ok ? r.json() : [])
      .then((statuses: StatusInfo[]) => {
        const map: Record<string, StatusInfo> = {};
        for (const s of statuses) map[s.id] = s;
        setStatusMap(map);
      });
  }, [projectId]);

  async function toggleExpand(epicId: string) {
    const next = new Set(expanded);
    if (next.has(epicId)) {
      next.delete(epicId);
      setExpanded(next);
      return;
    }
    next.add(epicId);
    setExpanded(next);

    if (!tasksByEpic[epicId]) {
      setLoadingTasks((prev) => new Set(prev).add(epicId));
      try {
        const res = await fetch(`/api/tasks?projectId=${projectId}`);
        if (res.ok) {
          const allTasks: TaskInfo[] = await res.json();
          const grouped: Record<string, TaskInfo[]> = {};
          for (const t of allTasks) {
            if (t.epicId) {
              if (!grouped[t.epicId]) grouped[t.epicId] = [];
              grouped[t.epicId].push(t);
            }
          }
          setTasksByEpic((prev) => ({ ...prev, ...grouped }));
        }
      } finally {
        setLoadingTasks((prev) => {
          const s = new Set(prev);
          s.delete(epicId);
          return s;
        });
      }
    }
  }

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
            const isOpen = expanded.has(epic.id);
            const epicTasks = tasksByEpic[epic.id] ?? [];
            const isLoadingTasks = loadingTasks.has(epic.id);

            return (
              <Card
                key={epic.id}
                className={cn(
                  "transition-colors",
                  isComplete && "opacity-70",
                )}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Chevron */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(epic.id)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={isOpen ? "Zuklappen" : "Aufklappen"}
                  >
                    {isOpen
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />
                    }
                  </button>

                  {/* Color dot — centered with title */}
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: epic.color }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{epic.title}</span>
                      {isOverdue && <Badge variant="destructive" className="text-micro px-1.5 py-0">Überfällig</Badge>}
                      {isComplete && <Badge className="text-micro px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">Abgeschlossen</Badge>}
                    </div>

                    {epic.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{epic.description}</p>
                    )}
                  </div>

                  {/* Progress + meta — right side */}
                  <div className="flex items-center gap-4 shrink-0">
                    {/* Progress bar */}
                    <div className="hidden sm:flex items-center gap-2.5">
                      <div className="w-24">
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
                      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {epic._tasksDone}/{epic._tasksTotal}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {pct}%
                      </span>
                    </div>

                    {/* Dates */}
                    {epic.dueDate && (
                      <span className={cn(
                        "hidden md:flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap",
                        isOverdue && "text-destructive",
                      )}>
                        <Calendar className="h-3 w-3 shrink-0" />
                        {formatDate(epic.dueDate)}
                      </span>
                    )}

                    {/* Actions — centered */}
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
                </div>

                {/* Expanded: task list */}
                {isOpen && (
                  <div className="border-t">
                    {isLoadingTasks ? (
                      <div className="px-4 py-3 space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : epicTasks.length === 0 ? (
                      <div className="px-4 py-4 text-xs text-muted-foreground text-center">
                        Keine Tasks in diesem Meilenstein
                      </div>
                    ) : (
                      <div className="divide-y">
                        {epicTasks.map((task) => {
                          const st = statusMap[task.status];
                          const isDone = st?.category === "DONE";
                          return (
                            <Link
                              key={task.id}
                              href={`/projects/${projectId}/tasks?task=${task.id}`}
                              className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors"
                            >
                              <Circle className={cn(
                                "h-3 w-3 shrink-0",
                                isDone ? "text-green-500 fill-green-500" : "text-muted-foreground/40",
                              )} />
                              <span className={cn(
                                "text-sm truncate flex-1",
                                isDone && "line-through text-muted-foreground",
                              )}>
                                {task.title}
                              </span>
                              <PriorityPill priority={task.priority} />
                              {task.dueDate && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDate(task.dueDate)}
                                </span>
                              )}
                              {st && (
                                <span
                                  className="inline-flex items-center rounded-full h-5 px-2 text-[10px] leading-none font-medium whitespace-nowrap"
                                  style={{ backgroundColor: (st.color || "#6b7280") + "20", color: st.color || "#6b7280" }}
                                >
                                  {st.name}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
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
