"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TaskFilterState } from "../_components/task-filters";

/**
 * Two-way sync between TaskFilterState and the URL query string. View links
 * become shareable / bookmarkable, browser back/forward navigates filter
 * history, and a hard refresh keeps the user on the same view.
 *
 * URL format (all keys optional, values comma-separated for arrays):
 *   ?q=foo&assignee=user1,user2&priority=HIGH,URGENT&epic=epic1&due=overdue
 *
 * `q` is debounced 300ms to avoid burning history on every keystroke;
 * other keys update instantly via router.replace (no extra history entry).
 */

const EMPTY: TaskFilterState = {
  search: "",
  assignees: [],
  priorities: [],
  epicId: "",
  due: "",
};

type DueFilter = TaskFilterState["due"];

const VALID_DUE: ReadonlyArray<DueFilter> = ["", "overdue", "today", "week", "none"];

function parseFromParams(params: URLSearchParams): TaskFilterState {
  const due = (params.get("due") ?? "") as DueFilter;
  return {
    search:     params.get("q") ?? "",
    assignees:  params.get("assignee")?.split(",").filter(Boolean) ?? [],
    priorities: params.get("priority")?.split(",").filter(Boolean) ?? [],
    epicId:     params.get("epic") ?? "",
    due:        VALID_DUE.includes(due) ? due : "",
  };
}

function serializeToParams(f: TaskFilterState): string {
  const p = new URLSearchParams();
  if (f.search)              p.set("q", f.search);
  if (f.assignees.length)    p.set("assignee", f.assignees.join(","));
  if (f.priorities.length)   p.set("priority", f.priorities.join(","));
  if (f.epicId)              p.set("epic", f.epicId);
  if (f.due)                 p.set("due", f.due);
  return p.toString();
}

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Initialize from URL on first render (client-side only).
  const [filters, setFiltersState] = useState<TaskFilterState>(() =>
    typeof window === "undefined" ? EMPTY : parseFromParams(search),
  );

  // Re-sync if the URL changes externally (browser back/forward).
  // We compare serialized strings to avoid a feedback loop.
  const lastWrittenRef = useRef<string>("");
  useEffect(() => {
    const incoming = serializeToParams(parseFromParams(search));
    if (incoming !== lastWrittenRef.current) {
      setFiltersState(parseFromParams(search));
    }
  }, [search]);

  // Push filter changes back into the URL. `q` is debounced; everything else
  // is immediate so chip-toggles feel snappy.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeToUrl = useCallback(
    (next: TaskFilterState, debounce: boolean) => {
      const apply = () => {
        const qs = serializeToParams(next);
        lastWrittenRef.current = qs;
        const target = qs ? `${pathname}?${qs}` : pathname;
        router.replace(target, { scroll: false });
      };
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (debounce) {
        debounceTimer.current = setTimeout(apply, 300);
      } else {
        apply();
      }
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (next: Partial<TaskFilterState>) => {
      setFiltersState((prev) => {
        const merged = { ...prev, ...next };
        // Debounce only when the only change is to `search` (avoid spamming
        // history while typing).
        const onlySearch =
          Object.keys(next).length === 1 && Object.prototype.hasOwnProperty.call(next, "search");
        writeToUrl(merged, onlySearch);
        return merged;
      });
    },
    [writeToUrl],
  );

  const clearFilters = useCallback(() => {
    setFiltersState(EMPTY);
    writeToUrl(EMPTY, false);
  }, [writeToUrl]);

  return { filters, setFilters, clearFilters };
}
