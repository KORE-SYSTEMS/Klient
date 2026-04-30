"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit2, X, Plus, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  status: string;
}

interface ClientProject {
  project: Project;
}

interface ClientProps {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  active: boolean;
  projects?: ClientProject[];
}

export function EditClientDialog({ client }: { client: ClientProps }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Project assignment
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string>>(
    new Set((client.projects || []).map((p) => p.project.id))
  );

  useEffect(() => {
    if (!open) return;
    // Reset assigned projects to current state
    setAssignedProjectIds(
      new Set((client.projects || []).map((p) => p.project.id))
    );
    // Fetch all projects
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAllProjects(data.map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status,
          })));
        }
      });
  }, [open, client.projects]);

  function toggleProject(projectId: string) {
    setAssignedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        company: form.get("company"),
        projectIds: Array.from(assignedProjectIds),
      }),
    });

    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Kunde wirklich löschen?")) return;
    setLoading(true);
    await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  const defaultEmail = client.email.startsWith("placeholder-") ? "" : client.email;

  const assignedProjects = allProjects.filter((p) => assignedProjectIds.has(p.id));
  const availableProjects = allProjects.filter((p) => !assignedProjectIds.has(p.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Edit2 className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kunde bearbeiten</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" defaultValue={defaultEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={client.name || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Firma</Label>
            <Input id="company" name="company" defaultValue={client.company || ""} />
          </div>

          {/* Project assignment */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Zugewiesene Projekte
            </Label>

            {assignedProjects.length > 0 ? (
              <div className="space-y-1.5">
                {assignedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{project.name}</span>
                      <Badge variant="outline" className="text-meta px-1.5 py-0 shrink-0">
                        {project.status}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Keine Projekte zugewiesen</p>
            )}

            {availableProjects.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Projekt hinzufügen</Label>
                <div className="max-h-[150px] overflow-y-auto space-y-1 rounded-md border p-1.5">
                  {availableProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
                    >
                      <span className="truncate">{project.name}</span>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:justify-between items-center w-full gap-2 mt-4">
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
              Löschen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
