"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  FilePlus,
  ListPlus,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/task-meta";
import { run } from "@/lib/api";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi } from "@/lib/api/tasks";
import type { Epic, TaskStatus, TaskTemplate } from "../_lib/types";

interface TemplatesMenuProps {
  projectId: string;
  statuses: TaskStatus[];
  epics: Epic[];
  /** Called after a template is applied so the parent can refetch tasks. */
  onApplied: () => void;
  /** Allows the parent to honor the C-shortcut and "+ Task" button uniformly. */
  onCreateBlankTask: () => void;
}

interface DraftTemplate {
  id: string | null;
  name: string;
  title: string;
  description: string;
  priority: string;
  statusId: string;   // "" means default
  epicId: string;     // "" means none
  subtaskTitles: string[];
}

const EMPTY_DRAFT: DraftTemplate = {
  id: null, name: "", title: "", description: "",
  priority: "MEDIUM", statusId: "", epicId: "", subtaskTitles: [],
};

/**
 * Dropdown sitting next to the "Task hinzufügen" button. Lists project
 * task-templates for one-click creation, lets users save a new one, and
 * opens a manage-dialog for edit/delete.
 */
export function TemplatesMenu({
  projectId,
  statuses,
  epics,
  onApplied,
  onCreateBlankTask,
}: TemplatesMenuProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DraftTemplate>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const list = await projectsApi.taskTemplates(projectId) as TaskTemplate[];
      setTemplates(list);
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  function openEditor(template?: TaskTemplate) {
    if (template) {
      let parsedSubs: string[] = [];
      try { parsedSubs = JSON.parse(template.subtaskTitles); } catch { /* ignore */ }
      setDraft({
        id: template.id,
        name: template.name,
        title: template.title,
        description: template.description ?? "",
        priority: template.priority,
        statusId: template.statusId ?? "",
        epicId: template.epicId ?? "",
        subtaskTitles: Array.isArray(parsedSubs) ? parsedSubs : [],
      });
    } else {
      setDraft(EMPTY_DRAFT);
    }
    setEditorOpen(true);
  }

  async function saveDraft() {
    if (!draft.name.trim() || !draft.title.trim()) return;
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      statusId: draft.statusId || null,
      epicId: draft.epicId || null,
      subtaskTitles: draft.subtaskTitles
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const ok = draft.id
      ? await run(projectsApi.updateTaskTemplate(projectId, draft.id, payload), {
          success: "Vorlage gespeichert",
        })
      : await run(projectsApi.createTaskTemplate(projectId, payload), {
          success: "Vorlage erstellt",
        });
    setSaving(false);
    if (ok) {
      setEditorOpen(false);
      fetchTemplates();
    }
  }

  async function deleteTemplate(t: TaskTemplate) {
    if (!confirm(`Vorlage "${t.name}" löschen?`)) return;
    const ok = await run(projectsApi.removeTaskTemplate(projectId, t.id), {
      success: "Vorlage gelöscht",
    });
    if (ok) fetchTemplates();
  }

  /** Create a parent task + all subtasks from a template. */
  async function applyTemplate(t: TaskTemplate) {
    setApplying(t.id);
    try {
      const created = await run(
        tasksApi.create({
          projectId,
          title: t.title,
          description: t.description ?? undefined,
          priority: t.priority,
          status: t.statusId ?? undefined,
          epicId: t.epicId ?? undefined,
        }),
        { success: `Task "${t.name}" angelegt` },
      ) as { id: string } | null;

      if (!created) return;

      let subs: string[] = [];
      try { subs = JSON.parse(t.subtaskTitles); } catch { /* ignore */ }
      // Create subtasks sequentially to preserve order
      for (const subTitle of subs) {
        if (!subTitle.trim()) continue;
        await tasksApi.create({
          projectId,
          parentId: created.id,
          title: subTitle.trim(),
        }).catch(() => null);
      }
      onApplied();
    } finally {
      setApplying(null);
    }
  }

  function addSubtaskField() {
    setDraft((d) => ({ ...d, subtaskTitles: [...d.subtaskTitles, ""] }));
  }
  function updateSubtaskField(i: number, value: string) {
    setDraft((d) => {
      const next = [...d.subtaskTitles];
      next[i] = value;
      return { ...d, subtaskTitles: next };
    });
  }
  function removeSubtaskField(i: number) {
    setDraft((d) => ({ ...d, subtaskTitles: d.subtaskTitles.filter((_, j) => j !== i) }));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-8 gap-1.5">
            <Plus className="h-4 w-4" />
            Task hinzufügen
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={onCreateBlankTask} className="gap-2">
            <FilePlus className="h-3.5 w-3.5" />
            Leerer Task
            <span className="ml-auto text-meta text-muted-foreground/60 font-mono">C</span>
          </DropdownMenuItem>

          {templates.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-meta uppercase tracking-wider text-muted-foreground/70">
                Aus Vorlage
              </DropdownMenuLabel>
              {templates.map((t) => (
                <div key={t.id} className="group flex items-center gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => applyTemplate(t)}
                    disabled={applying !== null}
                    className={cn(
                      "flex-1 flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent disabled:opacity-50",
                    )}
                  >
                    <ListPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{t.name}</span>
                    {applying === t.id && (
                      <span className="ml-auto h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditor(t)}
                    className="hover-action rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Bearbeiten"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(t)}
                    className="hover-action rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Löschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openEditor()} className="gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            {templates.length === 0 ? "Erste Vorlage anlegen…" : "Neue Vorlage…"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Vorlage bearbeiten" : "Neue Vorlage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Vorlagen-Name</Label>
                <Input
                  id="tpl-name"
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="z.B. Bug-Report"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Priorität</Label>
                <Select
                  value={draft.priority}
                  onValueChange={(v) => setDraft({ ...draft, priority: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-title">Task-Titel beim Anlegen</Label>
              <Input
                id="tpl-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="z.B. Bug: …"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Beschreibung (Markdown später)</Label>
              <Textarea
                id="tpl-desc"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Optional — wird in jede aus dieser Vorlage erzeugte Task übernommen"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status (optional)</Label>
                <Select
                  value={draft.statusId || "__default__"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, statusId: v === "__default__" ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">— Erste Spalte —</SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Epic (optional)</Label>
                <Select
                  value={draft.epicId || "__none__"}
                  onValueChange={(v) =>
                    setDraft({ ...draft, epicId: v === "__none__" ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Keins —</SelectItem>
                    {epics.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />
                          {e.title}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Subtasks beim Anlegen</Label>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground"
                  onClick={addSubtaskField}
                >
                  <Plus className="h-3 w-3" />
                  Subtask
                </Button>
              </div>
              {draft.subtaskTitles.length === 0 ? (
                <p className="text-meta text-muted-foreground italic">
                  Optional — eine pro Zeile, werden automatisch unter dem Haupt-Task angelegt.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {draft.subtaskTitles.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        value={s}
                        onChange={(e) => updateSubtaskField(i, e.target.value)}
                        placeholder={`Subtask ${i + 1}`}
                        className="h-8 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSubtaskField(i)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            {draft.id && (
              <Button
                variant="destructive" type="button"
                onClick={() => {
                  const t = templates.find((x) => x.id === draft.id);
                  if (t) {
                    setEditorOpen(false);
                    deleteTemplate(t);
                  }
                }}
              >
                Löschen
              </Button>
            )}
            <Button variant="ghost" type="button" onClick={() => setEditorOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" onClick={saveDraft} disabled={saving || !draft.name.trim() || !draft.title.trim()}>
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
