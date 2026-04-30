"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  order: number;
}

interface ChecklistSectionProps {
  taskId: string;
  canEdit: boolean;
  canToggle: boolean;
  /** Lets the parent update kanban-card counters without a full refetch. */
  onCountsChange?: (total: number, done: number) => void;
}

/**
 * Lightweight inline sub-tasks ("Checklist") attached to a Task.
 *
 * - Admin/member can add/rename/toggle/delete items.
 * - Clients (if they can see the task) can only toggle `done`.
 */
export function ChecklistSection({
  taskId,
  canEdit,
  canToggle,
  onCountsChange,
}: ChecklistSectionProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const emitCounts = useCallback(
    (list: ChecklistItem[]) => {
      onCountsChange?.(list.length, list.filter((i) => i.done).length);
    },
    [onCountsChange],
  );

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/checklist`);
    if (res.ok) {
      const data: ChecklistItem[] = await res.json();
      setItems(data);
      emitCounts(data);
    }
    setLoading(false);
  }, [taskId, emitCounts]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function addItem() {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const created: ChecklistItem = await res.json();
        setItems((prev) => {
          const next = [...prev, created];
          emitCounts(next);
          return next;
        });
        setNewTitle("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(item: ChecklistItem) {
    // Optimistic flip — roll back on error.
    const next = items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i));
    setItems(next);
    emitCounts(next);
    const res = await fetch(`/api/tasks/${taskId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    if (!res.ok) {
      setItems(items);
      emitCounts(items);
    }
  }

  async function saveTitle(item: ChecklistItem) {
    const title = editingTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    if (title === item.title) {
      setEditingId(null);
      return;
    }
    const next = items.map((i) => (i.id === item.id ? { ...i, title } : i));
    setItems(next);
    setEditingId(null);
    const res = await fetch(`/api/tasks/${taskId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) setItems(items);
  }

  async function removeItem(item: ChecklistItem) {
    const next = items.filter((i) => i.id !== item.id);
    setItems(next);
    emitCounts(next);
    const res = await fetch(`/api/tasks/${taskId}/checklist/${item.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setItems(items);
      emitCounts(items);
    }
  }

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Checkliste</Label>
        <div className="h-8 rounded-md bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (!canEdit && !canToggle && items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Checkliste
        </Label>
        {total > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {done}/{total} · {pct}%
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full transition-all",
              pct === 100 ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <ul className="space-y-0.5">
        {items.map((item) => {
          const isEditing = editingId === item.id;
          return (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={item.done}
                disabled={!canToggle && !canEdit}
                onChange={() => toggleDone(item)}
                className="h-3.5 w-3.5 shrink-0 rounded accent-primary"
              />
              {isEditing ? (
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => saveTitle(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveTitle(item); }
                    else if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className="h-7 text-sm"
                />
              ) : (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    if (!canEdit) return;
                    setEditingId(item.id);
                    setEditingTitle(item.title);
                  }}
                  className={cn(
                    "flex-1 cursor-text truncate text-left text-sm",
                    item.done && "text-muted-foreground line-through",
                    !canEdit && "cursor-default",
                  )}
                >
                  {item.title}
                </button>
              )}
              {canEdit && !isEditing && (
                <button
                  type="button"
                  onClick={() => removeItem(item)}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  aria-label="Element löschen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {canEdit && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            placeholder="Neuer Checklist-Punkt..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addItem(); }
            }}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!newTitle.trim() || adding}
            onClick={addItem}
            className="h-8 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
