"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Circle, Plus, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriorityPill } from "@/components/task/priority-pill";
import { api, run } from "@/lib/api";
import { tasksApi } from "@/lib/api/tasks";
import type { Task, TaskStatus } from "../_lib/types";

interface SubtasksSectionProps {
  parentTask: Task;
  projectId: string;
  statuses: TaskStatus[];
  /** Open the full task dialog for a subtask (re-uses the parent dialog). */
  onOpenSubtask: (task: Task) => void;
  /** Lets the parent kanban-card update counters without a full refetch. */
  onCountsChange?: (total: number, done: number) => void;
}

/**
 * Real subtasks (Task.parentId), distinct from the lightweight Checklist.
 * Subtasks have their own status / assignee / etc. and can be opened in the
 * full dialog. Listed under the parent task's Details tab.
 */
export function SubtasksSection({
  parentTask,
  projectId,
  statuses,
  onOpenSubtask,
  onCountsChange,
}: SubtasksSectionProps) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const doneStatusIds = new Set(
    statuses.filter((s) => s.category === "DONE").map((s) => s.id),
  );

  const emitCounts = useCallback(
    (list: Task[]) => {
      const done = list.filter((t) => doneStatusIds.has(t.status)).length;
      onCountsChange?.(list.length, done);
    },
    [onCountsChange, doneStatusIds],
  );

  const fetchSubtasks = useCallback(async () => {
    try {
      const data = await api<Task[]>(
        `/api/tasks?projectId=${projectId}&parentId=${parentTask.id}`,
      );
      setSubtasks(data);
      emitCounts(data);
    } finally {
      setLoading(false);
    }
  }, [projectId, parentTask.id, emitCounts]);

  useEffect(() => { fetchSubtasks(); }, [fetchSubtasks]);

  async function addSubtask() {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const created = await run(
        tasksApi.create({ projectId, title, parentId: parentTask.id }),
        { error: "Subtask konnte nicht erstellt werden" },
      );
      if (created) {
        setNewTitle("");
        fetchSubtasks();
      }
    } finally {
      setAdding(false);
    }
  }

  // Toggle done — sets to first DONE status, or back to first non-DONE.
  async function toggleDone(sub: Task) {
    const isDone = doneStatusIds.has(sub.status);
    const targetStatus = isDone
      ? statuses.find((s) => s.category !== "DONE")?.id
      : statuses.find((s) => s.category === "DONE")?.id;
    if (!targetStatus) return;
    // Optimistic flip
    setSubtasks((prev) =>
      prev.map((t) => (t.id === sub.id ? { ...t, status: targetStatus } : t)),
    );
    const ok = await run(tasksApi.update(sub.id, { status: targetStatus }), {
      error: "Status konnte nicht geändert werden",
    });
    if (!ok) fetchSubtasks();
    else emitCounts(
      subtasks.map((t) => (t.id === sub.id ? { ...t, status: targetStatus } : t)),
    );
  }

  async function removeSubtask(sub: Task) {
    if (!confirm(`Subtask "${sub.title}" löschen?`)) return;
    setSubtasks((prev) => prev.filter((t) => t.id !== sub.id));
    const ok = await run(tasksApi.remove(sub.id), {
      error: "Subtask konnte nicht gelöscht werden",
    });
    if (!ok) fetchSubtasks();
  }

  const total = subtasks.length;
  const done = subtasks.filter((s) => doneStatusIds.has(s.status)).length;

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Subtasks</Label>
        <div className="h-8 rounded-md bg-muted/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Subtasks
        </Label>
        {total > 0 && (
          <span className="text-caption tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
        )}
      </div>

      <ul className="space-y-0.5">
        {subtasks.map((sub) => {
          const isDone = doneStatusIds.has(sub.status);
          const status = statuses.find((s) => s.id === sub.status);
          return (
            <li
              key={sub.id}
              className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40"
            >
              <button
                type="button"
                onClick={() => toggleDone(sub)}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                aria-label={isDone ? "Als offen markieren" : "Als erledigt markieren"}
              >
                {isDone
                  ? <CheckCircle2 className="h-4 w-4 text-success" />
                  : <Circle className="h-4 w-4" />
                }
              </button>
              <button
                type="button"
                onClick={() => onOpenSubtask(sub)}
                className={cn(
                  "flex-1 flex items-center gap-2 min-w-0 text-left",
                  isDone && "text-muted-foreground line-through",
                )}
              >
                <span className="text-sm truncate">{sub.title}</span>
                {status && !isDone && (
                  <span
                    className="ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-meta font-semibold shrink-0"
                    style={{ backgroundColor: status.color + "20", color: status.color }}
                  >
                    {status.name}
                  </span>
                )}
                <PriorityPill priority={sub.priority} />
                {sub.assignee && (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-micro">
                      {getInitials(sub.assignee.name || sub.assignee.email)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => removeSubtask(sub)}
                className="hover-action rounded p-0.5 text-muted-foreground hover:text-destructive"
                aria-label="Subtask löschen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 pt-1">
        <Input
          placeholder="Neuer Subtask…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addSubtask(); }
          }}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!newTitle.trim() || adding}
          onClick={addSubtask}
          className="h-8 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
