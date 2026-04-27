"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Download,
  FolderKanban,
  Users,
  BarChart3,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

// ---- Types ----

interface User { id: string; name: string | null; email: string; image: string | null }
interface Project { id: string; name: string; color: string | null }
interface EntryRow {
  id: string;
  duration: number;
  startedAt: string;
  stoppedAt: string | null;
  description: string | null;
  user: User;
  task: { id: string; title: string; project: Project };
}
interface Summary { id: string; name: string; color?: string | null; email?: string; image?: string | null; seconds: number }
interface DaySummary { date: string; seconds: number }

interface ReportData {
  entries: EntryRow[];
  byProject: Summary[];
  byUser: (Summary & { email: string; image: string | null })[];
  byDay: DaySummary[];
  totalSeconds: number;
}

// ---- Helpers ----

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// Simple bar chart — no external dep
function BarChart({ data, maxSeconds }: { data: DaySummary[]; maxSeconds: number }) {
  if (data.length === 0) return null;
  const peak = Math.max(...data.map((d) => d.seconds), 1);
  return (
    <div className="flex items-end gap-1 h-24 mt-2">
      {data.map((d) => {
        const pct = (d.seconds / peak) * 100;
        const label = new Date(d.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${label}: ${fmtDuration(d.seconds)}`}>
            <div className="w-full rounded-t-sm bg-primary/80 transition-all" style={{ height: `${pct}%`, minHeight: pct > 0 ? 4 : 0 }} />
            {data.length <= 14 && (
              <span className="text-[9px] text-muted-foreground rotate-0 leading-none">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- CSV export ----
function exportCsv(entries: EntryRow[]) {
  const header = ["Datum", "Start", "Ende", "Dauer (min)", "User", "Projekt", "Task", "Beschreibung"];
  const rows = entries.map((e) => [
    fmtDate(e.startedAt),
    fmtTime(e.startedAt),
    e.stoppedAt ? fmtTime(e.stoppedAt) : "",
    Math.round(e.duration / 60).toString(),
    e.user.name || e.user.email,
    e.task.project.name,
    e.task.title,
    e.description || "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zeiterfassung_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Main page ----

export default function ReportsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [projectId, setProjectId] = useState("all");
  const [userId, setUserId] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Projects + users for filter dropdowns
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (session?.user?.role === "CLIENT") { router.push("/dashboard"); return; }
    // Load filter options
    fetch("/api/projects").then((r) => r.ok ? r.json() : []).then((ps: any[]) =>
      setProjects(ps.map((p: any) => ({ id: p.id, name: p.name, color: p.color })))
    );
    if (session?.user?.role === "ADMIN") {
      fetch("/api/users").then((r) => r.ok ? r.json() : []).then(setUsers);
    }
  }, [session, router]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectId !== "all") params.set("projectId", projectId);
    if (userId !== "all") params.set("userId", userId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const res = await fetch(`/api/reports/time-entries?${params}`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, [projectId, userId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Zeit-Report</h1>
          <p className="text-sm text-muted-foreground">Erfasste Zeiten nach Projekt, Mitarbeiter und Tag</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => data && exportCsv(data.entries)}
          disabled={!data || data.entries.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          CSV exportieren
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Von</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Bis</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1.5 min-w-[160px]">
              <label className="text-xs text-muted-foreground font-medium">Projekt</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alle Projekte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Projekte</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-sm inline-block" style={{ backgroundColor: p.color || "#6366f1" }} />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-1.5 min-w-[160px]">
                <label className="text-xs text-muted-foreground font-medium">Mitarbeiter</label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Quick range buttons */}
            <div className="flex gap-1 ml-auto flex-wrap">
              {[
                { label: "Diese Woche", fn: () => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(new Date().toISOString().slice(0, 10)); } },
                { label: "Dieser Monat", fn: () => { const d = new Date(); d.setDate(1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(new Date().toISOString().slice(0, 10)); } },
                { label: "Letzter Monat", fn: () => { const d = new Date(); d.setDate(1); const end = new Date(d); end.setDate(0); d.setMonth(d.getMonth() - 1); setDateFrom(d.toISOString().slice(0, 10)); setDateTo(end.toISOString().slice(0, 10)); } },
              ].map((q) => (
                <Button key={q.label} variant="outline" size="sm" className="h-9 text-xs" onClick={q.fn}>
                  {q.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <ReportSkeleton />
      ) : !data || data.entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Keine Zeiteinträge gefunden"
          description="Für den gewählten Zeitraum und Filter wurden keine erfassten Zeiten gefunden."
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Clock}
              label="Gesamt"
              value={fmtDuration(data.totalSeconds)}
              sub={`${data.entries.length} Einträge`}
            />
            <StatCard
              icon={FolderKanban}
              label="Projekte"
              value={data.byProject.length.toString()}
              sub={data.byProject[0]?.name || "—"}
            />
            <StatCard
              icon={Users}
              label="Mitarbeiter"
              value={data.byUser.length.toString()}
              sub={data.byUser[0] ? (data.byUser[0].name || data.byUser[0].email || "") : "—"}
            />
            <StatCard
              icon={TrendingUp}
              label="Ø pro Tag"
              value={data.byDay.length > 0 ? fmtDuration(Math.round(data.totalSeconds / data.byDay.length)) : "—"}
              sub={`${data.byDay.length} aktive Tage`}
            />
          </div>

          {/* Chart + breakdowns */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Daily chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Zeitverlauf
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart data={data.byDay} maxSeconds={data.totalSeconds} />
              </CardContent>
            </Card>

            {/* By project */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  Nach Projekt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.byProject.map((p) => {
                  const pct = Math.round((p.seconds / data.totalSeconds) * 100);
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-medium truncate">
                          <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color || "#6366f1" }} />
                          {p.name}
                        </span>
                        <span className="text-muted-foreground ml-2 flex-shrink-0">{fmtDuration(p.seconds)}</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: p.color || "#6366f1" }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* By user (admin only) */}
          {isAdmin && data.byUser.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Nach Mitarbeiter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.byUser.map((u) => {
                    const pct = Math.round((u.seconds / data.totalSeconds) * 100);
                    return (
                      <div key={u.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {u.image && <img src={u.image} alt="" className="h-8 w-8 rounded-full object-cover" />}
                          <AvatarFallback className="text-xs">{getInitials(u.name || u.email || "")}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium truncate">{u.name || u.email}</span>
                            <span className="text-muted-foreground ml-1 flex-shrink-0">{fmtDuration(u.seconds)}</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entry table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Alle Einträge
                <Badge variant="secondary" className="ml-1">{data.entries.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-medium">Datum</th>
                      <th className="px-4 py-2.5 text-left font-medium">Dauer</th>
                      <th className="px-4 py-2.5 text-left font-medium">Mitarbeiter</th>
                      <th className="px-4 py-2.5 text-left font-medium">Projekt</th>
                      <th className="px-4 py-2.5 text-left font-medium">Task</th>
                      <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">Zeit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((entry, i) => (
                      <tr key={entry.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", i % 2 === 0 ? "" : "")}>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(entry.startedAt)}</td>
                        <td className="px-4 py-2.5 font-medium tabular-nums whitespace-nowrap">{fmtDuration(entry.duration)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 flex-shrink-0">
                              {entry.user.image && <img src={entry.user.image} alt="" className="h-5 w-5 rounded-full object-cover" />}
                              <AvatarFallback className="text-[9px]">{getInitials(entry.user.name || entry.user.email)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[120px]">{entry.user.name || entry.user.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm flex-shrink-0" style={{ backgroundColor: entry.task.project.color || "#6366f1" }} />
                            <span className="truncate max-w-[140px]">{entry.task.project.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <span className="truncate block text-muted-foreground">{entry.task.title}</span>
                          {entry.description && (
                            <span className="truncate block text-[10px] text-muted-foreground/70">{entry.description}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap hidden lg:table-cell">
                          {fmtTime(entry.startedAt)}
                          {entry.stoppedAt && ` → ${fmtTime(entry.stoppedAt)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sub}</p>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24 mt-1" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><Skeleton className="h-4 w-28" /></CardHeader>
          <CardContent><Skeleton className="h-24 w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    </div>
  );
}
