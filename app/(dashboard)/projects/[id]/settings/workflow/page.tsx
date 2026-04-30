"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Check,
  ClipboardCheck,
  Sparkles,
  AlertTriangle,
  Circle,
  CircleDot,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";

type Category = "TODO" | "IN_PROGRESS" | "DONE";

interface TaskStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isApproval: boolean;
  category: Category;
}

const CATEGORY_META: Record<Category, { label: string; icon: typeof Circle; className: string }> = {
  TODO:        { label: "Offen",      icon: Circle,        className: "text-muted-foreground" },
  IN_PROGRESS: { label: "In Arbeit",  icon: CircleDot,     className: "text-warning" },
  DONE:        { label: "Erledigt",   icon: CheckCircle2,  className: "text-success" },
};

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
];

export default function WorkflowSettingsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canEdit = role === "ADMIN" || role === "MEMBER";

  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<TaskStatus | null>(null);
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(COLORS[5]);
  const [formCategory, setFormCategory] = useState<Category>("IN_PROGRESS");
  const [formApproval, setFormApproval] = useState(false);

  // Template confirm
  const [templateConfirmId, setTemplateConfirmId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const fetchStatuses = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/statuses`);
    if (!res.ok) return;
    const data = (await res.json()) as TaskStatus[];
    setStatuses(data.sort((a, b) => a.order - b.order));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const openCreate = () => {
    setEditStatus(null);
    setFormName("");
    setFormColor(COLORS[5]);
    setFormCategory("IN_PROGRESS");
    setFormApproval(false);
    setDialogOpen(true);
  };

  const openEdit = (s: TaskStatus) => {
    setEditStatus(s);
    setFormName(s.name);
    setFormColor(s.color);
    setFormCategory(s.category);
    setFormApproval(s.isApproval);
    setDialogOpen(true);
  };

  const saveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editStatus) {
        const res = await fetch(`/api/projects/${projectId}/statuses/${editStatus.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            color: formColor,
            category: formCategory,
            isApproval: formApproval,
          }),
        });
        if (!res.ok) throw new Error("save failed");
      } else {
        const res = await fetch(`/api/projects/${projectId}/statuses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            color: formColor,
            category: formCategory,
            isApproval: formApproval,
          }),
        });
        if (!res.ok) throw new Error("save failed");
      }
      setDialogOpen(false);
      await fetchStatuses();
      toast({ title: editStatus ? "Phase aktualisiert" : "Phase erstellt" });
    } catch (err) {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteStatus = async (s: TaskStatus) => {
    if (!confirm(`Phase "${s.name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/projects/${projectId}/statuses/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({ title: "Löschen nicht möglich", description: data?.error || "Unbekannter Fehler", variant: "destructive" });
      return;
    }
    await fetchStatuses();
    toast({ title: "Phase gelöscht" });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = statuses.findIndex((s) => s.id === active.id);
    const newIndex = statuses.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(statuses, oldIndex, newIndex).map((s, idx) => ({ ...s, order: idx }));
    setStatuses(reordered);
    const res = await fetch(`/api/projects/${projectId}/statuses/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((s) => s.id) }),
    });
    if (!res.ok) {
      toast({ title: "Reihenfolge konnte nicht gespeichert werden", variant: "destructive" });
      await fetchStatuses();
    }
  };

  const applyTemplate = async (templateId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, strategy: "replace" }),
      });
      if (!res.ok) throw new Error("apply failed");
      setTemplateConfirmId(null);
      await fetchStatuses();
      toast({ title: "Workflow angewendet", description: "Tasks wurden anhand ihrer Kategorie neu zugeordnet." });
      router.refresh();
    } catch (err) {
      toast({ title: "Fehler", description: "Template konnte nicht angewendet werden", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const templateById = useMemo(() => Object.fromEntries(WORKFLOW_TEMPLATES.map((t) => [t.id, t])), []);
  const confirmTemplate = templateConfirmId ? templateById[templateConfirmId] : null;

  if (!canEdit) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Nur Team-Mitglieder können den Workflow bearbeiten.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Workflow</h2>
        <p className="text-sm text-muted-foreground">
          Definiere die Phasen, durch die Tasks in diesem Projekt laufen. Die Reihenfolge bestimmt, wohin &quot;Nächste Phase&quot; führt.
        </p>
      </div>

      {/* Templates */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Vorlagen</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {WORKFLOW_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setTemplateConfirmId(tpl.id)}
              className="rounded-lg border bg-background p-3 text-left"
            >
              <div className="flex items-center gap-1 mb-2">
                {tpl.statuses.map((s) => (
                  <span key={s.slug} className="h-1.5 flex-1 rounded" style={{ backgroundColor: s.color }} />
                ))}
              </div>
              <p className="text-sm font-medium">{tpl.name}</p>
              <p className="text-caption text-muted-foreground mt-0.5 leading-relaxed">{tpl.description}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Phases list */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Phasen ({statuses.length})</h3>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Neue Phase
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Noch keine Phasen vorhanden.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={statuses.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {statuses.map((s) => (
                  <SortableRow
                    key={s.id}
                    status={s}
                    onEdit={() => openEdit(s)}
                    onDelete={() => deleteStatus(s)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      {/* Status edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editStatus ? "Phase bearbeiten" : "Neue Phase"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveStatus} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z.B. QA, Staging, Freigabe..."
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={formCategory} onValueChange={(v) => setFormCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["TODO", "IN_PROGRESS", "DONE"] as Category[]).map((c) => {
                    const meta = CATEGORY_META[c];
                    const Icon = meta.icon;
                    return (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <Icon className={cn("h-3.5 w-3.5", meta.className)} />
                          {meta.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-caption text-muted-foreground leading-snug">
                Tasks in <strong>Erledigt</strong> zählen als abgeschlossen und werden im Board gedämpft dargestellt.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      formColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5 text-warning" />
                  Kunden-Abnahme
                </Label>
                <p className="text-caption text-muted-foreground leading-snug">
                  Tasks in dieser Phase werden dem Kunden zur Freigabe übergeben.
                </p>
              </div>
              <Switch checked={formApproval} onCheckedChange={setFormApproval} />
            </div>

            <DialogFooter className="gap-2">
              {editStatus && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDialogOpen(false);
                    deleteStatus(editStatus);
                  }}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
              <Button type="submit" disabled={saving || !formName.trim()}>
                {editStatus ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template confirmation */}
      <Dialog open={!!templateConfirmId} onOpenChange={(o) => !o && setTemplateConfirmId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vorlage &quot;{confirmTemplate?.name}&quot; anwenden?</DialogTitle>
            <DialogDescription>
              Bestehende Phasen werden ersetzt. Tasks werden anhand ihrer Kategorie (Offen / In Arbeit / Erledigt) in die neuen Phasen übernommen.
            </DialogDescription>
          </DialogHeader>
          {confirmTemplate && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Neue Phasen:</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {confirmTemplate.statuses.map((s, i) => (
                  <span key={s.slug} className="inline-flex items-center gap-1">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium"
                      style={{ backgroundColor: s.color + "22", color: s.color }}
                    >
                      {s.name}
                      {s.isApproval && <ClipboardCheck className="h-3 w-3" />}
                    </span>
                    {i < confirmTemplate.statuses.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-md bg-warning/10 p-2.5 text-caption text-warning-foreground/80">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <span>Diese Aktion kann nicht rückgängig gemacht werden.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateConfirmId(null)}>Abbrechen</Button>
            <Button onClick={() => confirmTemplate && applyTemplate(confirmTemplate.id)} disabled={saving}>
              Anwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableRow({
  status,
  onEdit,
  onDelete,
}: {
  status: TaskStatus;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const meta = CATEGORY_META[status.category];
  const CategoryIcon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card px-2.5 py-2",
        isDragging && "shadow-md"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Reihenfolge ändern"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: status.color }}
      />
      <button onClick={onEdit} className="flex-1 text-left">
        <p className="text-sm font-medium">{status.name}</p>
      </button>
      <span className={cn("inline-flex items-center gap-1 text-caption", meta.className)}>
        <CategoryIcon className="h-3 w-3" />
        {meta.label}
      </span>
      {status.isApproval && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-meta font-medium text-warning">
          <ClipboardCheck className="h-3 w-3" />Abnahme
        </span>
      )}
      <Button size="sm" variant="ghost" onClick={onEdit} className="h-8 px-2 text-xs">
        Bearbeiten
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover-action"
        aria-label="Löschen"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
