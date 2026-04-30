"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  CheckSquare,
  FileIcon,
  MessageSquare,
  Users,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { formatDate, getInitials } from "@/lib/utils";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image?: string | null;
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  dueDate: string | null;
  members: { user: Member }[];
  _count: {
    tasks: number;
    files: number;
    messages: number;
    updates: number;
  };
}

interface TaskStat {
  status: string;
  statusName?: string;
  statusColor?: string;
  _count: number;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [projRes, tasksRes, statusesRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/tasks?projectId=${projectId}`),
      fetch(`/api/projects/${projectId}/statuses`),
    ]);

    if (projRes.ok) {
      setProject(await projRes.json());
    }

    if (tasksRes.ok && statusesRes.ok) {
      const tasks = await tasksRes.json();
      const statuses = await statusesRes.json();

      // Build status counts
      const counts = new Map<string, number>();
      for (const task of tasks) {
        counts.set(task.status, (counts.get(task.status) || 0) + 1);
      }

      const stats: TaskStat[] = [];
      for (const s of statuses) {
        const count = counts.get(s.id) || 0;
        if (count > 0) {
          stats.push({
            status: s.id,
            statusName: s.name,
            statusColor: s.color,
            _count: count,
          });
        }
      }
      setTaskStats(stats);
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
    // Refetch on tab focus instead of polling. SSE in P5 replaces this.
    function handleVisibility() {
      if (document.visibilityState === "visible") fetchData();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", fetchData);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", fetchData);
    };
  }, [fetchData]);

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Lade Projektübersicht...
      </div>
    );
  }

  const totalTasks = taskStats.reduce((sum, s) => sum + s._count, 0);
  const doneTasks = taskStats.find((s) => s.status === "DONE")?._count || 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: CheckSquare,    label: "Tasks gesamt", value: totalTasks },
          { icon: FileIcon,       label: "Dateien",      value: project._count.files },
          { icon: MessageSquare,  label: "Nachrichten",  value: project._count.messages },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-caption uppercase tracking-wider font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-caption uppercase tracking-wider font-medium">Fortschritt</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{progress}%</div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Task breakdown + Members */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <CheckSquare className="h-3.5 w-3.5" />
            <span className="text-caption uppercase tracking-wider font-medium">
              Task-Verteilung
            </span>
          </div>
          <div className="space-y-2">
            {taskStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Tasks vorhanden
              </p>
            ) : (
              taskStats.map((stat) => (
                <div
                  key={stat.status}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-[3px]"
                      style={{ backgroundColor: stat.statusColor || "#6b7280" }}
                    />
                    <span className="text-sm">{stat.statusName || stat.status}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{stat._count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Users className="h-3.5 w-3.5" />
            <span className="text-caption uppercase tracking-wider font-medium">
              Mitglieder
            </span>
          </div>
          <div className="space-y-3">
            {project.members.map((m) => (
              <div key={m.user.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.user.image || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(m.user.name || m.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.user.name || m.user.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.user.role === "CLIENT" ? "Kunde" : m.user.role === "ADMIN" ? "Admin" : "Mitarbeiter"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    m.user.role === "CLIENT"
                      ? "text-meta text-orange-500 border-orange-500/30"
                      : m.user.role === "ADMIN"
                        ? "text-meta text-blue-500 border-blue-500/30"
                        : "text-meta text-green-500 border-green-500/30"
                  }
                >
                  {m.user.role === "CLIENT" ? "Kunde" : m.user.role === "ADMIN" ? "Admin" : "Mitarbeiter"}
                </Badge>
              </div>
            ))}
            {project.members.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Noch keine Mitglieder zugewiesen
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Meta info */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Erstellt: {formatDate(project.createdAt)}
          </span>
          {project.dueDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Fällig: {formatDate(project.dueDate)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {project.members.length} Mitglieder
          </span>
        </div>
      </div>
    </div>
  );
}
