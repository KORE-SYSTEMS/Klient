"use client";

/**
 * useOptimisticTasks
 *
 * Wraps a tasks array with optimistic mutation helpers.
 * Each mutator:
 *   1. Captures a snapshot of current state
 *   2. Applies the change immediately (no waiting for server)
 *   3. Fires the async operation in the background
 *   4. On error: reverts to snapshot + calls onError(message)
 *
 * The caller provides onError to handle toasts / rollback UI.
 */
import { useCallback, useRef } from "react";

export interface OptimisticTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null | undefined;
  assigneeId?: string | null | undefined;
  epicId?: string | null | undefined;
  clientVisible?: boolean;
  description?: string | null | undefined;
  order?: number;
  // allow any extra fields Task has
  [key: string]: unknown;
}

interface UseOptimisticTasksOptions<T extends OptimisticTask> {
  tasks: T[];
  setTasks: React.Dispatch<React.SetStateAction<T[]>>;
  onError: (msg: string) => void;
}

export function useOptimisticTasks<T extends OptimisticTask>({
  tasks,
  setTasks,
  onError,
}: UseOptimisticTasksOptions<T>) {
  // Use a ref for the latest tasks so closures always see current state
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  /** Patch one task field(s) optimistically, PATCH the server, revert on error */
  const optimisticUpdate = useCallback(
    async (taskId: string, patch: Partial<T>) => {
      const snapshot = tasksRef.current;
      // Apply immediately
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e: any) {
        setTasks(snapshot);
        onError(`Änderung konnte nicht gespeichert werden: ${e?.message ?? "Unbekannter Fehler"}`);
      }
    },
    [setTasks, onError]
  );

  /** Remove a task optimistically, DELETE on server, restore on error */
  const optimisticDelete = useCallback(
    async (taskId: string) => {
      const snapshot = tasksRef.current;
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      try {
        const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e: any) {
        setTasks(snapshot);
        onError(`Task konnte nicht gelöscht werden: ${e?.message ?? "Unbekannter Fehler"}`);
      }
    },
    [setTasks, onError]
  );

  /**
   * Add a task optimistically with a temp id, POST to server, swap temp→real on success.
   * Returns the real task or null on error.
   */
  const optimisticCreate = useCallback(
    async (body: Omit<T, "id"> & { projectId: string }): Promise<T | null> => {
      const tempId = `__temp_${Date.now()}`;
      const tempTask = { ...body, id: tempId } as unknown as T;
      setTasks((prev) => [tempTask, ...prev]);
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created: T = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === tempId ? created : t)));
        return created;
      } catch (e: any) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        onError(`Task konnte nicht erstellt werden: ${e?.message ?? "Unbekannter Fehler"}`);
        return null;
      }
    },
    [setTasks, onError]
  );

  /**
   * Reorder tasks within a column optimistically; PATCH order on server.
   * `reordered` is the full updated list for the column.
   */
  const optimisticReorder = useCallback(
    async (taskId: string, newOrder: number, reorderedColumn: T[]) => {
      const snapshot = tasksRef.current;
      const statusId = reorderedColumn[0]?.status;
      setTasks((prev) => {
        const other = prev.filter((t) => t.status !== statusId);
        return [...other, ...reorderedColumn];
      });
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: newOrder }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e: any) {
        setTasks(snapshot);
        onError(`Reihenfolge konnte nicht gespeichert werden: ${e?.message ?? ""}`);
      }
    },
    [setTasks, onError]
  );

  return { optimisticUpdate, optimisticDelete, optimisticCreate, optimisticReorder };
}
