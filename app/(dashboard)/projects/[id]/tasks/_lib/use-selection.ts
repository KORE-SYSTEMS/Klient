"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Multi-select state for a list of items. Supports:
 *
 *   - `toggle(id)`            → flip a single id
 *   - `toggleRange(id, ids)`  → shift+click range select between last anchor and id
 *   - `selectAll(ids)` / `clear()`
 *   - `isSelected(id)` cheap lookup
 *   - `selectedIds` array for iteration (stable order = insertion order)
 *
 * The "anchor" for shift-range is whichever id was last toggled individually.
 */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchorId(id);
  }, []);

  const toggleRange = useCallback(
    (id: string, orderedIds: string[]) => {
      if (!anchorId || anchorId === id) {
        // No anchor yet — fall back to single toggle
        toggle(id);
        return;
      }
      const fromIdx = orderedIds.indexOf(anchorId);
      const toIdx = orderedIds.indexOf(id);
      if (fromIdx === -1 || toIdx === -1) {
        toggle(id);
        return;
      }
      const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      const range = orderedIds.slice(start, end + 1);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of range) next.add(r);
        return next;
      });
      // Don't move the anchor — typical shift-range behavior
    },
    [anchorId, toggle],
  );

  const selectAll = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
    setAnchorId(ids[ids.length - 1] ?? null);
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
    setAnchorId(null);
  }, []);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return {
    selectedIds,
    selectedCount: selected.size,
    isSelected,
    toggle,
    toggleRange,
    selectAll,
    clear,
  };
}
