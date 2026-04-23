"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Settings, Check, Loader2, X, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  image?: string | null;
}

interface Props {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    color?: string | null;
    dueDate?: string | null;
  };
  canEdit: boolean;
  initialMembers?: Member[];
  /** Optional task progress — omit or pass {total:0} to hide the bar. */
  progress?: { done: number; total: number };
}

const PROJECT_STATUSES = [
  { value: "PLANNING", label: "Planung" },
  { value: "ACTIVE", label: "Aktiv" },
  { value: "ON_HOLD", label: "Pausiert" },
  { value: "COMPLETED", label: "Abgeschlossen" },
  { value: "CANCELLED", label: "Abgebrochen" },
];

export function ProjectHeader({ project, canEdit, initialMembers = [], progress }: Props) {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : null;
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [status, setStatus] = useState(project.status);
  const [dueDate, setDueDate] = useState(
    project.dueDate ? new Date(project.dueDate).toISOString().split("T")[0] : ""
  );

  // Members management
  const [currentMembers, setCurrentMembers] = useState<Member[]>(initialMembers);
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(initialMembers.map((m) => m.id))
  );

  // Fetch all users when dialog opens
  useEffect(() => {
    if (!dialogOpen) return;
    // Reset form to current project values
    setName(project.name);
    setDescription(project.description || "");
    setStatus(project.status);
    setDueDate(
      project.dueDate ? new Date(project.dueDate).toISOString().split("T")[0] : ""
    );

    // Fetch fresh project data including members
    fetch(`/api/projects/${project.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) {
          const members = data.members.map((m: any) => m.user);
          setCurrentMembers(members);
          setSelectedMemberIds(new Set(members.map((m: Member) => m.id)));
        }
      });

    // Fetch all available users (admins, members, clients)
    Promise.all([
      fetch("/api/clients").then((r) => r.ok ? r.json() : []),
      fetch("/api/users").then((r) => r.ok ? r.json() : []),
    ]).then(([clients, users]) => {
      // Combine clients + any other users from the users endpoint
      const allUserMap = new Map<string, Member>();
      // Add clients
      if (Array.isArray(clients)) {
        clients.forEach((c: any) => {
          allUserMap.set(c.id, {
            id: c.id,
            name: c.name,
            email: c.email,
            role: "CLIENT",
            image: c.image,
          });
        });
      }
      // Add other users (admins, members)
      if (Array.isArray(users)) {
        users.forEach((u: any) => {
          if (!allUserMap.has(u.id)) {
            allUserMap.set(u.id, {
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              image: u.image,
            });
          }
        });
      }
      setAllUsers(Array.from(allUserMap.values()));
    });
  }, [dialogOpen, project]);

  async function handleStatusChange(newStatus: string) {
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  function toggleMember(userId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          status,
          dueDate: dueDate || null,
          memberIds: Array.from(selectedMemberIds),
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  // Users not yet in the project
  const availableUsers = allUsers.filter(
    (u) => !selectedMemberIds.has(u.id)
  );

  // Selected users (for display)
  const selectedUsers = allUsers.filter((u) => selectedMemberIds.has(u.id));

  function getRoleLabel(role: string) {
    if (role === "CLIENT") return "Kunde";
    if (role === "ADMIN") return "Admin";
    return "Mitarbeiter";
  }

  function getRoleColor(role: string) {
    if (role === "CLIENT") return "text-orange-500 border-orange-500/30 bg-orange-500/10";
    if (role === "ADMIN") return "text-blue-500 border-blue-500/30 bg-blue-500/10";
    return "text-green-500 border-green-500/30 bg-green-500/10";
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight truncate">
              {project.name}
            </h1>
            <StatusPill
              value={project.status}
              type="project"
              editable={canEdit}
              onChange={handleStatusChange}
            />
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground max-w-2xl">
              {project.description}
            </p>
          )}
          {pct !== null && progress && (
            <div className="flex items-center gap-3 max-w-md pt-1">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Fortschritt: ${pct} Prozent`}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct === 100
                      ? "bg-emerald-500"
                      : pct >= 66
                      ? "bg-primary"
                      : pct >= 33
                      ? "bg-amber-500"
                      : "bg-muted-foreground/40"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {progress.done}/{progress.total} · {pct}%
              </span>
            </div>
          )}
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => setDialogOpen(true)}
          >
            <Settings className="h-3.5 w-3.5" />
            Projekt bearbeiten
          </Button>
        )}
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Projekt bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="proj-name">Projektname</Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Projektname"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="proj-desc">Beschreibung</Label>
              <Textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Projektbeschreibung..."
                rows={2}
              />
            </div>

            {/* Status + Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-due">Fällig am</Label>
                <Input
                  id="proj-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Members / Clients */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mitglieder & Kunden
              </Label>

              {/* Current members */}
              {selectedUsers.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(user.name || user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {user.name || user.email}
                          </div>
                          {user.name && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {user.email.startsWith("placeholder-") ? "" : user.email}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", getRoleColor(user.role))}
                        >
                          {getRoleLabel(user.role)}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => toggleMember(user.id)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Keine Mitglieder zugewiesen</p>
              )}

              {/* Add member */}
              {availableUsers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hinzufügen</Label>
                  <div className="max-h-[180px] overflow-y-auto space-y-1 rounded-md border p-1.5">
                    {availableUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleMember(user.id)}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[9px]">
                            {getInitials(user.name || user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">
                            {user.name || user.email}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0 shrink-0", getRoleColor(user.role))}
                        >
                          {getRoleLabel(user.role)}
                        </Badge>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                )}
                Speichern
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
