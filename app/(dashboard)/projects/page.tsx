"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  Calendar,
  CheckSquare,
  Loader2,
  AlertCircle,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";

interface ProjectMember {
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    image: string | null;
  };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  dueDate: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  _count: {
    tasks: number;
    files: number;
    messages: number;
    doneTasks: number;
  };
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState("PLANNING");
  const [newColor, setNewColor] = useState("#E8520A");
  const [newDueDate, setNewDueDate] = useState("");

  const isAdmin = session?.user?.role === "ADMIN";
  const isMember = session?.user?.role === "MEMBER";
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchProjects();
    // fetchProjects reads showArchived from closure — intentional dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  async function fetchProjects() {
    setLoading(true);
    try {
      const url = showArchived ? "/api/projects?includeArchived=true" : "/api/projects";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleArchive(project: Project, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !project.archived }),
    });
    if (res.ok) fetchProjects();
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          status: newStatus,
          color: newColor,
          dueDate: newDueDate || undefined,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        setNewName("");
        setNewDescription("");
        setNewStatus("PLANNING");
        setNewColor("#E8520A");
        setNewDueDate("");
        fetchProjects();
      }
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-9 w-36 rounded-sm" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-sm" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-6 w-6 rounded-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Projekte
          </h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}
            {showArchived && " (inkl. archivierte)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isMember) && (
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? "Archiv ausblenden" : "Archiv anzeigen"}
            </Button>
          )}
        {(isAdmin || isMember) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Neues Projekt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">
                  Neues Projekt erstellen
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Projektname"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Beschreibung</Label>
                  <Textarea
                    id="desc"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Kurze Beschreibung..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLANNING">Planung</SelectItem>
                        <SelectItem value="ACTIVE">Aktiv</SelectItem>
                        <SelectItem value="REVIEW">Review</SelectItem>
                        <SelectItem value="ON_HOLD">Pausiert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Farbe</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="color"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="h-9 w-9 cursor-pointer rounded-sm border bg-transparent"
                      />
                      <Input
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due">Fälligkeitsdatum</Label>
                  <Input
                    id="due"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="w-full"
                >
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Projekt erstellen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FolderKanban}
              title="Noch keine Projekte"
              description={
                isAdmin || isMember
                  ? "Erstelle dein erstes Projekt um loszulegen."
                  : "Du wurdest noch keinem Projekt zugewiesen."
              }
              action={
                (isAdmin || isMember) && (
                  <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Neues Projekt
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const total     = project._count.tasks;
            const done      = project._count.doneTasks ?? 0;
            const pct       = total > 0 ? Math.round((done / total) * 100) : 0;
            const isOverdue =
              project.dueDate &&
              new Date(project.dueDate) < new Date() &&
              !project.archived &&
              project.status !== "DONE" &&
              project.status !== "COMPLETED";

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className={cn(
                  "card-hover group cursor-pointer hover:border-primary/40 relative",
                  isOverdue    && "border-red-500/40",
                  project.archived && "opacity-60"
                )}>
                  <CardContent className="p-4 space-y-3">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-heading font-semibold truncate text-sm">
                          {project.name}
                        </h3>
                        {project.archived && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                            <Archive className="h-2.5 w-2.5" />Archiv
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <StatusPill value={project.status} type="project" size="sm" />
                        {/* Archive action (staff only, shown on hover) */}
                        {(isAdmin || isMember) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-accent"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {project.archived ? (
                                <DropdownMenuItem onClick={(e) => toggleArchive(project, e)}>
                                  <ArchiveRestore className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                  Wiederherstellen
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={(e) => toggleArchive(project, e)}>
                                  <Archive className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                                  Archivieren
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    {/* Progress bar */}
                    {total > 0 && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: project.color || "#E8520A",
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{done}/{total} erledigt</span>
                          <span>{pct}%</span>
                        </div>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" />
                        {total} Tasks
                      </span>
                      {project.dueDate && (
                        <span className={cn(
                          "flex items-center gap-1",
                          isOverdue && "text-red-400 font-medium"
                        )}>
                          {isOverdue
                            ? <AlertCircle className="h-3 w-3" />
                            : <Calendar className="h-3 w-3" />
                          }
                          {isOverdue ? "Überfällig · " : ""}{formatDate(project.dueDate)}
                        </span>
                      )}
                    </div>

                    {/* Members */}
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 4).map((m) => (
                        <Avatar key={m.user.id} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={m.user.image || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(m.user.name || m.user.email)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {project.members.length > 4 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px]">
                          +{project.members.length - 4}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
