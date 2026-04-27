import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  CheckSquare,
  AlertCircle,
  Clock,
  ClipboardCheck,
  TrendingUp,
  CalendarDays,
  Circle,
  ArrowRight,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function getPriorityPillStyle(priority: string) {
  switch (priority) {
    case "URGENT": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "HIGH":   return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "LOW":    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:       return "bg-muted text-muted-foreground";
  }
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Niedrig", MEDIUM: "Mittel", HIGH: "Hoch", URGENT: "Dringend",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING:    "Planung",
  IN_PROGRESS: "In Arbeit",
  ON_HOLD:     "Pausiert",
  DONE:        "Abgeschlossen",
};

function ProjectStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PLANNING:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    IN_PROGRESS: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    ON_HOLD:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    DONE:        "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", styles[status] || "bg-muted text-muted-foreground")}>
      {PROJECT_STATUS_LABELS[status] || status}
    </span>
  );
}

function greet(name: string | null | undefined) {
  const h = new Date().getHours();
  const salut = h < 12 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
  return name ? `${salut}, ${name.split(" ")[0]}` : salut;
}

// ─── page ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId    = session.user.id;
  const isClient  = session.user.role === "CLIENT";
  const userName  = session.user.name;

  const now       = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // ── project access filter ──────────────────────────────────────────────────
  const projectWhere = isClient
    ? { members: { some: { userId } }, archived: false }
    : { archived: false };

  // Ignore archived — fall back gracefully if column doesn't exist yet
  const safeProjectWhere = isClient
    ? { members: { some: { userId } } }
    : {};

  // ── parallel queries ───────────────────────────────────────────────────────
  const [
    projects,
    myTasks,
    upcomingTasks,
    pendingApprovals,
    projectCount,
    overdueCount,
  ] = await Promise.all([
    // Recent projects
    prisma.project.findMany({
      where: safeProjectWhere,
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count:  { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),

    // Tasks assigned to me
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        project:    { ...(isClient ? { members: { some: { userId } } } : {}) },
        ...(isClient ? { clientVisible: true } : {}),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        epic:    { select: { id: true, title: true, color: true } },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),

    // Upcoming + overdue (has a due date, not null, and date <= 7 days from now)
    prisma.task.findMany({
      where: {
        project:  { ...(isClient ? { members: { some: { userId } } } : {}) },
        ...(isClient ? { clientVisible: true } : {}),
        dueDate:  { not: null, lte: weekLater },
      },
      include: {
        project:  { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),

    // Pending approvals for this user (client) or across all projects (staff)
    prisma.task.findMany({
      where: isClient
        ? { assigneeId: userId, approvalStatus: "PENDING" }
        : { approvalStatus: "PENDING" },
      include: {
        project:  { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),

    // Total project count
    prisma.project.count({ where: safeProjectWhere }),

    // Overdue task count
    prisma.task.count({
      where: {
        project:  { ...(isClient ? { members: { some: { userId } } } : {}) },
        ...(isClient ? { clientVisible: true } : {}),
        dueDate:  { not: null, lt: now },
      },
    }),
  ]);

  const myTaskCount = myTasks.length;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greet(userName)}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {isClient
            ? "Hier ist der aktuelle Stand Ihrer Projekte."
            : "Hier ist eine Übersicht über alle Aktivitäten."}
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CheckSquare}
          label="Meine Tasks"
          value={myTaskCount}
          iconClass="text-primary"
          href="/tasks"
          sublabel="zugewiesen"
        />
        <StatCard
          icon={AlertCircle}
          label="Überfällig"
          value={overdueCount}
          iconClass={overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}
          valueClass={overdueCount > 0 ? "text-destructive" : undefined}
          sublabel="Tasks mit Deadline überschritten"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Ausstehende Abnahmen"
          value={pendingApprovals.length}
          iconClass={pendingApprovals.length > 0 ? "text-warning" : "text-muted-foreground"}
          valueClass={pendingApprovals.length > 0 ? "text-warning" : undefined}
          sublabel="warten auf Bestätigung"
        />
        <StatCard
          icon={FolderKanban}
          label="Projekte"
          value={projectCount}
          iconClass="text-muted-foreground"
          href="/projects"
          sublabel="aktiv"
        />
      </div>

      {/* ── Main widgets row ───────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                Meine Tasks
              </CardTitle>
              <Link href="/tasks" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                Alle <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {myTasks.length === 0 ? (
              <EmptyHint icon={CheckSquare} text="Keine Tasks zugewiesen" />
            ) : (
              myTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${task.project.id}/tasks?task=${task.id}`}
                  className="group flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                >
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm group-hover:text-primary transition-colors">
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground truncate">{task.project.name}</span>
                      {task.epic && (
                        <span
                          className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium"
                          style={{ color: task.epic.color }}
                        >
                          {task.epic.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", getPriorityPillStyle(task.priority))}>
                      {PRIORITY_LABELS[task.priority] || task.priority}
                    </span>
                    {task.dueDate && (() => {
                      const overdue = new Date(task.dueDate) < now;
                      return (
                        <span className={cn("flex items-center gap-0.5 text-[10px]", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                          {overdue && <AlertCircle className="h-2.5 w-2.5" />}
                          {formatDate(task.dueDate)}
                        </span>
                      );
                    })()}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Bald fällig
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pt-0">
            {upcomingTasks.length === 0 ? (
              <EmptyHint icon={CalendarDays} text="Keine Deadlines in den nächsten 7 Tagen" />
            ) : (
              upcomingTasks.map((task) => {
                const dueDate = new Date(task.dueDate!);
                const overdue = dueDate < now;
                const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

                return (
                  <Link
                    key={task.id}
                    href={`/projects/${task.project.id}/tasks?task=${task.id}`}
                    className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    {/* Due indicator */}
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md text-center",
                      overdue ? "bg-destructive/10 text-destructive" : daysLeft <= 2 ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                    )}>
                      <span className="text-[11px] font-bold leading-none">{dueDate.toLocaleDateString("de-DE", { day: "2-digit" })}</span>
                      <span className="text-[9px] leading-none mt-0.5">{dueDate.toLocaleDateString("de-DE", { month: "short" })}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium group-hover:text-primary transition-colors">{task.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{task.project.name}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className={cn(
                        "text-[10px] font-medium",
                        overdue ? "text-destructive" : daysLeft <= 2 ? "text-warning" : "text-muted-foreground"
                      )}>
                        {overdue ? `${Math.abs(daysLeft)}T überfällig` : daysLeft === 0 ? "Heute" : `in ${daysLeft}T`}
                      </span>
                      {task.assignee && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{task.assignee.name || task.assignee.email}</div>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Approvals */}
        {(pendingApprovals.length > 0 || isClient) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-warning" />
                {isClient ? "Zur Abnahme" : "Ausstehende Abnahmen"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {pendingApprovals.length === 0 ? (
                <EmptyHint icon={ClipboardCheck} text="Keine ausstehenden Abnahmen" />
              ) : (
                pendingApprovals.map((task) => (
                  <Link
                    key={task.id}
                    href={`/projects/${task.project.id}/tasks?task=${task.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5 transition-colors hover:bg-warning/10"
                  >
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium group-hover:text-primary transition-colors">{task.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">{task.project.name}</span>
                      </div>
                    </div>
                    {task.assignee && !isClient && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {task.assignee.name || task.assignee.email}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Projects overview */}
        <Card className={cn(pendingApprovals.length === 0 && !isClient ? "lg:col-span-2" : "")}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                Projekte
              </CardTitle>
              <Link href="/projects" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                Alle <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {projects.length === 0 ? (
              <EmptyHint icon={FolderKanban} text="Keine Projekte vorhanden" />
            ) : (
              <div className={cn(
                "grid gap-2",
                pendingApprovals.length === 0 && !isClient ? "sm:grid-cols-2 lg:grid-cols-3" : ""
              )}>
                {projects.map((project) => {
                  const memberCount = project.members.length;
                  const taskCount = project._count.tasks;
                  const projectDue = project.dueDate ? new Date(project.dueDate) : null;
                  const projectOverdue = projectDue && projectDue < now;

                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
                          {project.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <ProjectStatusBadge status={project.status} />
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CheckSquare className="h-3 w-3" />{taskCount}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3" />{memberCount}
                          </span>
                          {projectDue && (
                            <span className={cn("flex items-center gap-1 text-[11px]", projectOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(project.dueDate!.toString())}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── small shared components ──────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  iconClass,
  valueClass,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sublabel?: string;
  iconClass?: string;
  valueClass?: string;
  href?: string;
}) {
  const inner = (
    <div className={cn("rounded-xl border bg-card p-4 transition-colors", href && "hover:bg-accent cursor-pointer")}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", valueClass)}>{value}</div>
      {sublabel && <p className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function EmptyHint({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
