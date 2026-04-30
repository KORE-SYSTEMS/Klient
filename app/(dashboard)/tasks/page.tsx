"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CheckSquare,
  Circle,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  Filter,
  X,
  Clock,
  Hourglass,
} from "lucide-react";
import { cn, formatDate, getPriorityColor, getInitials } from "@/lib/utils";
import { PRIORITY_LABELS, getPriorityHex } from "@/lib/task-meta";
import { PriorityPill } from "@/components/task/priority-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  status: string;
  statusName: string;
  statusColor: string;
  priority: string;
  dueDate?: string | null;
  approvalStatus?: string | null;
  clientVisible?: boolean;
  project: { id: string; name: string; color: string | null };
  assignee?: { id: string; name: string | null; email: string } | null;
  epic?:    { id: string; title: string; color: string } | null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterDue, setFilterDue]               = useState<"" | "overdue" | "today" | "week" | "none">("");

  // Group collapse state (by project id)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Grouping mode
  const [groupBy, setGroupBy] = useState<"project" | "priority" | "due">("project");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDue) params.set("due", filterDue);
    const res = await fetch(`/api/my-tasks?${params.toString()}`);
    if (res.ok) setTasks(await res.json());
    setLoading(false);
  }, [filterDue]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const now = new Date();

  // Client-side priority filter (applied on top of server due filter)
  const filteredTasks = useMemo(() => {
    if (filterPriorities.length === 0) return tasks;
    return tasks.filter((t) => filterPriorities.includes(t.priority));
  }, [tasks, filterPriorities]);

  // ── Group by ──────────────────────────────────────────────────────────────

  const groups = useMemo(() => {
    if (groupBy === "project") {
      const map = new Map<string, { key: string; label: string; color: string; tasks: Task[] }>();
      for (const task of filteredTasks) {
        const key = task.project.id;
        if (!map.has(key)) {
          map.set(key, { key, label: task.project.name, color: task.project.color || "#6b7280", tasks: [] });
        }
        map.get(key)!.tasks.push(task);
      }
      return Array.from(map.values());
    }

    if (groupBy === "priority") {
      const order = ["URGENT", "HIGH", "MEDIUM", "LOW"];
      return order
        .map((p) => ({
          key:   p,
          label: PRIORITY_LABELS[p] || p,
          color: getPriorityHex(p),
          tasks: filteredTasks.filter((t) => t.priority === p),
        }))
        .filter((g) => g.tasks.length > 0);
    }

    if (groupBy === "due") {
      const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 86_400_000);
      const weekEnd  = new Date(today.getTime() + 7 * 86_400_000);

      const buckets: { key: string; label: string; color: string; filter: (t: Task) => boolean }[] = [
        { key: "overdue", label: "Überfällig",     color: "#ef4444", filter: (t) => !!t.dueDate && new Date(t.dueDate) < today },
        { key: "today",   label: "Heute fällig",   color: "#f97316", filter: (t) => !!t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) < tomorrow },
        { key: "week",    label: "Diese Woche",    color: "#eab308", filter: (t) => !!t.dueDate && new Date(t.dueDate) >= tomorrow && new Date(t.dueDate) < weekEnd },
        { key: "later",   label: "Später",         color: "#6b7280", filter: (t) => !!t.dueDate && new Date(t.dueDate) >= weekEnd },
        { key: "none",    label: "Kein Datum",     color: "#94a3b8", filter: (t) => !t.dueDate },
      ];

      return buckets
        .map((b) => ({ key: b.key, label: b.label, color: b.color, tasks: filteredTasks.filter(b.filter) }))
        .filter((g) => g.tasks.length > 0);
    }

    return [];
  }, [filteredTasks, groupBy, now]);

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function togglePriority(p: string) {
    setFilterPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  const activeFilters = filterPriorities.length + (filterDue ? 1 : 0);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="rounded-lg border space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Meine Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredTasks.length} {filteredTasks.length === 1 ? "Task" : "Tasks"} zugewiesen
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Group by */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" />
                Gruppierung: {groupBy === "project" ? "Projekt" : groupBy === "priority" ? "Priorität" : "Fälligkeit"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setGroupBy("project")}>
                Nach Projekt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("priority")}>
                Nach Priorität
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("due")}>
                Nach Fälligkeit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filterPriorities.length > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
              >
                <Filter className="h-3.5 w-3.5" />
                Priorität
                {filterPriorities.length > 0 && (
                  <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-meta font-bold text-primary-foreground">
                    {filterPriorities.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              {["URGENT", "HIGH", "MEDIUM", "LOW"].map((p) => (
                <DropdownMenuItem key={p} className="flex items-center gap-2" onClick={() => togglePriority(p)}>
                  <div className={cn(
                    "h-3.5 w-3.5 rounded-full shrink-0 border-2",
                    filterPriorities.includes(p) ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )} />
                  <span className={cn("text-xs font-medium", getPriorityColor(p))}>
                    {PRIORITY_LABELS[p]}
                  </span>
                </DropdownMenuItem>
              ))}
              {filterPriorities.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterPriorities([])}>
                    <X className="mr-2 h-3.5 w-3.5" />Zurücksetzen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Due date quick buttons */}
          <div className="flex items-center gap-0.5 rounded-md border bg-background p-0.5">
            {([
              { value: "",        label: "Alle"         },
              { value: "overdue", label: "Überfällig"   },
              { value: "today",   label: "Heute"        },
              { value: "week",    label: "Diese Woche"  },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterDue(opt.value)}
                className={cn(
                  "rounded px-2 py-0.5 text-caption font-medium transition-colors whitespace-nowrap",
                  filterDue === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Clear */}
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setFilterPriorities([]); setFilterDue(""); }}
            >
              <X className="mr-1 h-3 w-3" />Zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {/* ── Task list ── */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Keine Tasks gefunden"
          description={activeFilters > 0 ? "Keine Tasks entsprechen den gewählten Filtern." : "Dir sind aktuell keine Tasks zugewiesen."}
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* Table header */}
          <div className="flex items-center border-b bg-muted/30 px-4 py-2 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="flex-1 min-w-0">Task</div>
            {groupBy !== "project"  && <div className="w-[160px] shrink-0 hidden sm:block">Projekt</div>}
            {groupBy !== "priority" && <div className="w-[90px] shrink-0 hidden sm:block">Priorität</div>}
            {groupBy !== "due"      && <div className="w-[110px] shrink-0 hidden sm:block">Fällig</div>}
            <div className="w-[80px] shrink-0 hidden sm:block">Status</div>
          </div>

          {/* Groups */}
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.key)}
                  className="flex w-full items-center gap-2 border-b bg-muted/10 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronDown  className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <span className="text-sm font-semibold">{group.label}</span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </button>

                {/* Rows */}
                {!isCollapsed && group.tasks.map((task) => {
                  const overdue = task.dueDate && new Date(task.dueDate) < now;
                  const dueToday = task.dueDate && (() => {
                    const d = new Date(task.dueDate!);
                    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    return d >= t && d < new Date(t.getTime() + 86_400_000);
                  })();

                  return (
                    <Link
                      key={task.id}
                      href={`/projects/${task.project.id}/tasks?task=${task.id}`}
                      className="group flex items-center border-b px-4 py-2.5 transition-colors hover:bg-accent/30 last:border-b-0"
                    >
                      {/* Task name */}
                      <div className="flex-1 min-w-0 flex items-center gap-2.5">
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {task.title}
                            </span>
                            {task.approvalStatus === "PENDING" && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-meta font-semibold text-warning shrink-0">
                                <Hourglass className="h-2.5 w-2.5" />Abnahme
                              </span>
                            )}
                          </div>
                          {task.epic && (
                            <span
                              className="text-meta font-medium"
                              style={{ color: task.epic.color }}
                            >
                              {task.epic.title}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Project (when not grouping by project) */}
                      {groupBy !== "project" && (
                        <div className="w-[160px] shrink-0 hidden sm:flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground truncate">{task.project.name}</span>
                        </div>
                      )}

                      {/* Priority (when not grouping by priority) */}
                      {groupBy !== "priority" && (
                        <div className="w-[90px] shrink-0 hidden sm:block">
                          <PriorityPill priority={task.priority} />
                        </div>
                      )}

                      {/* Due date (when not grouping by due) */}
                      {groupBy !== "due" && (
                        <div className="w-[110px] shrink-0 hidden sm:block">
                          {task.dueDate ? (
                            <span className={cn(
                              "flex items-center gap-1 text-xs",
                              overdue  ? "text-destructive font-medium" :
                              dueToday ? "text-warning font-medium"     : "text-muted-foreground"
                            )}>
                              {overdue  && <AlertCircle className="h-3 w-3 shrink-0" />}
                              {dueToday && <Clock className="h-3 w-3 shrink-0" />}
                              {formatDate(task.dueDate)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      )}

                      {/* Status pill */}
                      <div className="w-[80px] shrink-0 hidden sm:block">
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-meta font-semibold truncate max-w-full"
                          style={{
                            backgroundColor: task.statusColor + "20",
                            color: task.statusColor,
                          }}
                        >
                          {task.statusName}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
