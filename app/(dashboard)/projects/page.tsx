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
} from "lucide-react";
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

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } finally {
      setLoading(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Projekte
          </h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}
          </p>
        </div>
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
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              {(() => {
                const total = project._count.tasks;
                const done = project._count.doneTasks ?? 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const isOverdue =
                  project.dueDate &&
                  new Date(project.dueDate) < new Date() &&
                  project.status !== "DONE" &&
                  project.status !== "COMPLETED";
                return (
                  <Card className={cn(
                    "card-hover group cursor-pointer hover:border-primary/40",
                    isOverdue && "border-red-500/40"
                  )}>
                    <CardContent className="p-4 space-y-3">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: project.color || "#E8520A" }}
                          />
                          <h3 className="font-heading font-semibold truncate text-sm">
                            {project.name}
                          </h3>
                        </div>
                        <StatusPill value={project.status} type="project" size="sm" />
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
                );
              })()}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
