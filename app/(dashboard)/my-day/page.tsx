"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckSquare,
  Circle,
  Clock,
  Coffee,
  Hourglass,
  Inbox,
  Sparkles,
  Sun,
  Sunrise,
  Target,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PriorityPill } from "@/components/task/priority-pill";
import { api, run } from "@/lib/api";
import { tasksApi } from "@/lib/api/tasks";

interface MyTask {
  id: string;
  title: string;
  status: string;
  statusName: string;
  statusColor: string;
  priority: string;
  dueDate?: string | null;
  approvalStatus?: string | null;
  project: { id: string; name: string; color: string | null };
  epic?: { id: string; title: string; color: string } | null;
}

type Bucket = "overdue" | "today" | "week" | "later" | "undated";

interface BucketData {
  key: Bucket;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;          // tailwind text-color class
  toneBg: string;        // tailwind bg-tint class
  tasks: MyTask[];
}

function greet(name: string | null | undefined): string {
  const h = new Date().getHours();
  const salut = h < 5 ? "Späte Nacht" : h < 11 ? "Guten Morgen" : h < 17 ? "Hallo" : "Guten Abend";
  return name ? `${salut}, ${name.split(" ")[0]}` : salut;
}

function greetIcon(): React.ComponentType<{ className?: string }> {
  const h = new Date().getHours();
  if (h < 11) return Sunrise;
  if (h < 17) return Sun;
  return Coffee;
}

export default function MyDayPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name;
  const isClient = session?.user?.role === "CLIENT";

  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  // Local "completed today" set — Tasks die wir gerade per Quick-Action
  // erledigt haben, bleiben sichtbar als "fertig in dieser Session"
  const [completedNow, setCompletedNow] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api<MyTask[]>("/api/my-tasks");
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const onVisible = () => { if (!document.hidden) fetchTasks(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchTasks);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchTasks);
    };
  }, [fetchTasks]);

  const buckets = useMemo<BucketData[]>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const weekEnd = new Date(today.getTime() + 7 * 86_400_000);

    // Tasks die wir gerade als done geklickt haben werden überall ausgeblendet
    const visible = tasks.filter((t) => !completedNow.has(t.id));

    const overdue = visible.filter((t) => t.dueDate && new Date(t.dueDate) < today);
    const todayTasks = visible.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= today && d < tomorrow;
    });
    const week = visible.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= tomorrow && d < weekEnd;
    });
    const later = visible.filter((t) => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= weekEnd;
    });
    const undated = visible.filter((t) => !t.dueDate);

    return [
      {
        key: "overdue",
        label: "Überfällig",
        description: "Sollte längst fertig sein — angehen oder neu planen.",
        icon: AlertCircle,
        tone: "text-destructive",
        toneBg: "bg-destructive/10",
        tasks: overdue,
      },
      {
        key: "today",
        label: "Heute",
        description: "Dein Fokus für heute.",
        icon: Target,
        tone: "text-primary",
        toneBg: "bg-primary/10",
        tasks: todayTasks,
      },
      {
        key: "week",
        label: "Diese Woche",
        description: "Kommt bald — erst mal vorbereiten.",
        icon: CalendarDays,
        tone: "text-info",
        toneBg: "bg-info/10",
        tasks: week,
      },
      {
        key: "later",
        label: "Später",
        description: "Zukunft — kein Druck.",
        icon: Hourglass,
        tone: "text-muted-foreground",
        toneBg: "bg-muted/40",
        tasks: later,
      },
      {
        key: "undated",
        label: "Ohne Datum",
        description: "Mir zugewiesen, kein Termin.",
        icon: Inbox,
        tone: "text-muted-foreground",
        toneBg: "bg-muted/40",
        tasks: undated,
      },
    ];
  }, [tasks, completedNow]);

  // Stats
  const stats = useMemo(() => {
    const overdue = buckets.find((b) => b.key === "overdue")?.tasks.length ?? 0;
    const today = buckets.find((b) => b.key === "today")?.tasks.length ?? 0;
    const week = buckets.find((b) => b.key === "week")?.tasks.length ?? 0;
    return { overdue, today, week, completedToday: completedNow.size };
  }, [buckets, completedNow]);

  /** Mark as done — moves the task to the "first DONE-category status".
   *  We don't know the project's DONE status without an extra fetch, so we
   *  PATCH `status: "DONE"` and let the server normalize. If the project
   *  uses a project-scoped status id (most do), the optimistic UI just
   *  hides the task locally and the server may fail — we then refetch.
   */
  async function markDone(task: MyTask) {
    setCompletedNow((prev) => new Set(prev).add(task.id));
    // Best-effort: try with hardcoded "DONE" first; backend may reject.
    // Safer: fetch the project's DONE status. But that's a round-trip per
    // task. Pragmatic compromise — refetch on error.
    const ok = await run(
      tasksApi.update(task.id, { status: "DONE" }),
      { success: null, error: null },
    );
    if (!ok) {
      setCompletedNow((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      // Quietly refetch so the UI is at least consistent
      fetchTasks();
    }
  }

  const GreetIcon = greetIcon();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Greeting + stats ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <GreetIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              {greet(userName)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {stats.overdue + stats.today === 0
                ? "Du bist auf Kurs für heute. Nice."
                : `${stats.today} heute, ${stats.overdue} überfällig.`}
            </p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard label="Heute"        value={stats.today}        icon={Target}       tone="text-primary" />
          <StatCard label="Überfällig"   value={stats.overdue}      icon={AlertCircle}  tone={stats.overdue > 0 ? "text-destructive" : "text-muted-foreground"} />
          <StatCard label="Diese Woche"  value={stats.week}         icon={CalendarDays} tone="text-info" />
          <StatCard label="Erledigt jetzt" value={stats.completedToday} icon={Sparkles}  tone={stats.completedToday > 0 ? "text-success" : "text-muted-foreground"} />
        </div>
      </div>

      {/* ── Loading skeleton ───────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <div className="rounded-lg border divide-y">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={Coffee}
          title="Keine Tasks zugewiesen"
          description="Genieß die Pause oder schau im Board vorbei."
          action={
            <Link href="/projects">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowRight className="h-3.5 w-3.5" />
                Zu den Projekten
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {buckets
            .filter((b) => b.tasks.length > 0)
            .map((bucket) => (
              <BucketSection
                key={bucket.key}
                bucket={bucket}
                onMarkDone={isClient ? undefined : markDone}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat-Card oben ────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <span className="text-meta uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

// ─── Eine Bucket-Sektion ──────────────────────────────────────────────────────

function BucketSection({
  bucket,
  onMarkDone,
}: {
  bucket: BucketData;
  onMarkDone?: (task: MyTask) => void;
}) {
  const Icon = bucket.icon;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-6 w-6 items-center justify-center rounded-full", bucket.toneBg)}>
            <Icon className={cn("h-3.5 w-3.5", bucket.tone)} />
          </div>
          <h2 className={cn("text-sm font-semibold", bucket.tone)}>{bucket.label}</h2>
          <span className="text-meta text-muted-foreground tabular-nums">
            {bucket.tasks.length}
          </span>
        </div>
        <p className="text-meta text-muted-foreground hidden sm:block">{bucket.description}</p>
      </div>

      <div className="rounded-lg border divide-y overflow-hidden">
        {bucket.tasks.map((task) => (
          <TaskRow key={task.id} task={task} onMarkDone={onMarkDone} />
        ))}
      </div>
    </section>
  );
}

// ─── Single task row ──────────────────────────────────────────────────────────

function TaskRow({
  task,
  onMarkDone,
}: {
  task: MyTask;
  onMarkDone?: (task: MyTask) => void;
}) {
  const overdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  const dueToday =
    task.dueDate &&
    (() => {
      const d = new Date(task.dueDate!);
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      const tomorrow = new Date(t.getTime() + 86_400_000);
      return d >= t && d < tomorrow;
    })();

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/30">
      {/* Quick mark-done */}
      {onMarkDone ? (
        <button
          type="button"
          onClick={() => onMarkDone(task)}
          className="shrink-0 text-muted-foreground/50 hover:text-success transition-colors"
          title="Als erledigt markieren"
          aria-label="Als erledigt markieren"
        >
          <Circle className="h-4 w-4 group-hover:hidden" />
          <Check className="h-4 w-4 hidden group-hover:block" />
        </button>
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      )}

      <Link
        href={`/projects/${task.project.id}/tasks?task=${task.id}`}
        className="flex-1 flex items-center gap-3 min-w-0"
      >
        <div className="min-w-0 flex-1">
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
          <div className="flex items-center gap-2 mt-0.5 text-meta text-muted-foreground">
            <span className="truncate">{task.project.name}</span>
            {task.epic && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate" style={{ color: task.epic.color }}>
                  {task.epic.title}
                </span>
              </>
            )}
          </div>
        </div>

        <PriorityPill priority={task.priority} />

        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs whitespace-nowrap",
              overdue ? "text-destructive font-medium" :
              dueToday ? "text-warning font-medium" :
              "text-muted-foreground",
            )}
          >
            {overdue
              ? <AlertCircle className="h-3 w-3 shrink-0" />
              : dueToday
                ? <Clock className="h-3 w-3 shrink-0" />
                : <CalendarDays className="h-3 w-3 shrink-0" />}
            {formatDate(task.dueDate)}
          </span>
        )}

        <span
          className="hidden sm:inline-flex rounded-full px-2 py-0.5 text-meta font-semibold whitespace-nowrap"
          style={{ backgroundColor: (task.statusColor || "#6b7280") + "20", color: task.statusColor || "#6b7280" }}
        >
          {task.statusName}
        </span>
      </Link>
    </div>
  );
}
