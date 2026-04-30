"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Filter,
  Flag,
  Layers,
  Search,
  SlidersHorizontal,
  User as UserIcon,
  Users,
  UserX,
  X,
} from "lucide-react";
import { cn, getInitials, getPriorityColor } from "@/lib/utils";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/task-meta";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Epic, ProjectMember } from "../_lib/types";

type DueFilter = "" | "overdue" | "today" | "week" | "none";

export interface TaskFilterState {
  search: string;
  assignees: string[];
  priorities: string[];
  epicId: string;
  due: DueFilter;
}

interface TaskFiltersProps {
  filters: TaskFilterState;
  setFilters: (next: Partial<TaskFilterState>) => void;
  clear: () => void;
  members: ProjectMember[];
  epics: Epic[];
  isClient: boolean;
  currentUserId: string;
  /** Optional summary like "12 von 47 Tasks" shown when filters are active. */
  resultSummary?: string;
}

/**
 * Single filter surface that replaces the old "Quick-Chips + collapsible Bar"
 * pair. Layout (left → right):
 *   Search · preset chips · "Mehr Filter ▾" (advanced multi-selects in popover)
 *
 * Chips and advanced selects share the same state — toggling a chip mirrors
 * into the dropdowns and vice versa.
 */
export function TaskFilters({
  filters,
  setFilters,
  clear,
  members,
  epics,
  isClient,
  currentUserId,
  resultSummary,
}: TaskFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Preset states derived from current filters
  const myActive = filters.assignees.length === 1 && filters.assignees[0] === currentUserId;
  const unassignedActive = filters.assignees.length === 1 && filters.assignees[0] === "";
  const overdueActive = filters.due === "overdue";
  const highPrioActive =
    filters.priorities.length > 0 &&
    filters.priorities.every((p) => p === "HIGH" || p === "URGENT") &&
    (filters.priorities.includes("HIGH") || filters.priorities.includes("URGENT"));

  const advancedActive =
    filters.epicId !== "" ||
    (filters.due !== "" && filters.due !== "overdue") ||
    // any non-preset assignee selection
    (filters.assignees.length > 0 && !myActive && !unassignedActive) ||
    // any non-preset priority selection
    (filters.priorities.length > 0 && !highPrioActive);

  const activeCount =
    (filters.search ? 1 : 0) +
    filters.assignees.length +
    filters.priorities.length +
    (filters.epicId ? 1 : 0) +
    (filters.due ? 1 : 0);

  const chipCls = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
      active
        ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  function toggleAssignee(id: string) {
    setFilters({
      assignees: filters.assignees.includes(id)
        ? filters.assignees.filter((x) => x !== id)
        : [...filters.assignees, id],
    });
  }

  function togglePriority(p: string) {
    setFilters({
      priorities: filters.priorities.includes(p)
        ? filters.priorities.filter((x) => x !== p)
        : [...filters.priorities, p],
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Suchen..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="h-8 pl-8 w-44 text-xs"
          />
          {filters.search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setFilters({ search: "" })}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Preset chips */}
        <button
          type="button"
          className={chipCls(myActive)}
          onClick={() => setFilters({ assignees: myActive ? [] : [currentUserId] })}
        >
          <UserIcon className="h-3 w-3" />
          Mir zugewiesen
        </button>
        {!isClient && (
          <button
            type="button"
            className={chipCls(unassignedActive)}
            onClick={() => setFilters({ assignees: unassignedActive ? [] : [""] })}
          >
            <UserX className="h-3 w-3" />
            Ohne Assignee
          </button>
        )}
        <button
          type="button"
          className={chipCls(overdueActive)}
          onClick={() => setFilters({ due: overdueActive ? "" : "overdue" })}
        >
          <AlertCircle className="h-3 w-3" />
          Überfällig
        </button>
        <button
          type="button"
          className={chipCls(highPrioActive)}
          onClick={() => setFilters({ priorities: highPrioActive ? [] : ["HIGH", "URGENT"] })}
        >
          <Flag className="h-3 w-3" />
          Hoch-Prio
        </button>

        {/* Advanced dropdown */}
        <Button
          type="button"
          variant={advancedActive ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Mehr Filter
          {advancedActive && (
            <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-meta font-bold text-primary-foreground">
              !
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 transition-transform", advancedOpen && "rotate-180")} />
        </Button>

        {/* Clear all + result summary */}
        {activeCount > 0 && (
          <>
            <button
              type="button"
              onClick={clear}
              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Zurücksetzen
            </button>
            {resultSummary && (
              <span className="text-xs text-muted-foreground shrink-0">{resultSummary}</span>
            )}
          </>
        )}
      </div>

      {advancedOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {/* Assignee multi-select */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filters.assignees.length > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                {filters.assignees.length > 0
                  ? filters.assignees.length === 1
                    ? members.find((m) => m.id === filters.assignees[0])?.name || "1 Person"
                    : `${filters.assignees.length} Personen`
                  : "Zugewiesen"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {members.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  className="flex items-center gap-2"
                  onClick={() => toggleAssignee(m.id)}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      filters.assignees.includes(m.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {filters.assignees.includes(m.id) && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px]">{getInitials(m.name || m.email)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.name || m.email}</span>
                </DropdownMenuItem>
              ))}
              {filters.assignees.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilters({ assignees: [] })}>
                    <X className="mr-2 h-3.5 w-3.5" />
                    Zurücksetzen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority multi-select */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filters.priorities.length > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
              >
                <Filter className="h-3.5 w-3.5" />
                {filters.priorities.length > 0
                  ? filters.priorities.length === 1
                    ? PRIORITY_LABELS[filters.priorities[0]]
                    : `${filters.priorities.length} Prioritäten`
                  : "Priorität"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {PRIORITIES.map((p) => (
                <DropdownMenuItem
                  key={p}
                  className="flex items-center gap-2"
                  onClick={() => togglePriority(p)}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      filters.priorities.includes(p)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {filters.priorities.includes(p) && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <span className={cn("text-xs font-medium", getPriorityColor(p))}>
                    {PRIORITY_LABELS[p]}
                  </span>
                </DropdownMenuItem>
              ))}
              {filters.priorities.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilters({ priorities: [] })}>
                    <X className="mr-2 h-3.5 w-3.5" />
                    Zurücksetzen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Epic filter */}
          {epics.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={filters.epicId ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {filters.epicId
                    ? epics.find((e) => e.id === filters.epicId)?.title || "Epic"
                    : "Epic"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {epics.map((epic) => (
                  <DropdownMenuItem
                    key={epic.id}
                    className="flex items-center gap-2"
                    onClick={() =>
                      setFilters({ epicId: filters.epicId === epic.id ? "" : epic.id })
                    }
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: epic.color }}
                    />
                    <span className="truncate">{epic.title}</span>
                    {filters.epicId === epic.id && (
                      <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                {filters.epicId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilters({ epicId: "" })}>
                      <X className="mr-2 h-3.5 w-3.5" />
                      Zurücksetzen
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Due date pill toggle */}
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            {([
              { value: "", label: "Alle" },
              { value: "overdue", label: "Überfällig" },
              { value: "today", label: "Heute" },
              { value: "week", label: "Diese Woche" },
              { value: "none", label: "Kein Datum" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilters({ due: opt.value })}
                className={cn(
                  "rounded px-2 py-0.5 text-caption font-medium transition-colors",
                  filters.due === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
