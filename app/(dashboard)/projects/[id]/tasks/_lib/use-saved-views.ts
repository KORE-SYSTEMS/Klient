"use client";

import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import type { TaskFilterState } from "../_components/task-filters";

export type ViewKind = "kanban" | "list" | "calendar";

export interface SavedView {
  id: string;
  name: string;
  view: ViewKind;
  filters: TaskFilterState;
  createdAt: string;
}

const STORAGE_PREFIX = "klient.savedViews.";

/**
 * LocalStorage-backed saved views, scoped per project. MVP — when teams
 * outgrow this we can add a `SavedView` Prisma model and sync via API.
 *
 * Each view captures the full filter state + which view-mode (kanban/list)
 * was active. Loading a view restores both.
 */
export function useSavedViews(projectId: string) {
  const key = STORAGE_PREFIX + projectId;
  const [views, setViews] = useState<SavedView[]>([]);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setViews(JSON.parse(raw) as SavedView[]);
    } catch { /* ignore */ }
  }, [key]);

  const persist = useCallback(
    (next: SavedView[]) => {
      setViews(next);
      try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    },
    [key],
  );

  const saveView = useCallback(
    (name: string, view: ViewKind, filters: TaskFilterState) => {
      const newView: SavedView = {
        id: nanoid(8),
        name: name.trim(),
        view,
        filters,
        createdAt: new Date().toISOString(),
      };
      persist([...views, newView]);
      return newView;
    },
    [views, persist],
  );

  const renameView = useCallback(
    (id: string, name: string) => {
      persist(views.map((v) => (v.id === id ? { ...v, name: name.trim() } : v)));
    },
    [views, persist],
  );

  const deleteView = useCallback(
    (id: string) => {
      persist(views.filter((v) => v.id !== id));
    },
    [views, persist],
  );

  return { views, saveView, renameView, deleteView };
}
