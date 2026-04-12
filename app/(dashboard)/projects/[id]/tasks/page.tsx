"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  GripVertical,
  Calendar,
  List,
  LayoutGrid,
} from "lucide-react";
import { cn, formatDate, getPriorityColor, getInitials } from "@/lib/utils";

const COLUMNS = [
  { id: "BACKLOG", label: "Backlog" },
  { id: "TODO", label: "To Do" },
  { id: "IN_PROGRESS", label: "In Arbeit" },
  { id: "IN_REVIEW", label: "In Review" },
  { id: "DONE", label: "Erledigt" },
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  clientVisible: boolean;
  dueDate?: string;
  assignee?: { id: string; name: string; email: string } | null;
  assigneeId?: string | null;
}

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className="cursor-pointer border bg-card p-3 transition-colors hover:bg-accent"
        onClick={onClick}
      >
        <div className="flex items-start gap-2">
          <button {...listeners} className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-3 w-3" />
          </button>
          <div className="flex-1 space-y-2">
            <div className="text-sm font-medium leading-tight">{task.title}</div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0", getPriorityColor(task.priority))}
              >
                {task.priority}
              </Badge>
              {task.dueDate && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDate(task.dueDate)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              {task.assignee && (
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[8px]">
                    {getInitials(task.assignee.name || task.assignee.email)}
                  </AvatarFallback>
                </Avatar>
              )}
              {task.clientVisible && (
                <span className="text-[10px] text-primary">Kundenichtbar</span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function TasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[]>([]);

  // Form state for task dialog
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState("BACKLOG");
  const [formPriority, setFormPriority] = useState("MEDIUM");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAssigneeId, setFormAssigneeId] = useState("none");
  const [formClientVisible, setFormClientVisible] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?projectId=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) {
          setMembers(data.members.map((m: any) => m.user));
        }
      });
  }, [fetchTasks, projectId]);

  function openDialog(task: Task | null) {
    setEditTask(task);
    setFormTitle(task?.title || "");
    setFormDescription(task?.description || "");
    setFormStatus(task?.status || "BACKLOG");
    setFormPriority(task?.priority || "MEDIUM");
    setFormDueDate(task?.dueDate ? task.dueDate.split("T")[0] : "");
    setFormAssigneeId(task?.assigneeId || "none");
    setFormClientVisible(task?.clientVisible || false);
    setDialogOpen(true);
  }

  async function createOrUpdateTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormSubmitting(true);
    const body: any = {
      title: formTitle,
      description: formDescription || "",
      priority: formPriority,
      status: formStatus,
      clientVisible: formClientVisible,
      dueDate: formDueDate || null,
      assigneeId: formAssigneeId === "none" ? null : formAssigneeId,
    };

    try {
      if (editTask) {
        await fetch(`/api/tasks/${editTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        body.projectId = projectId;
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      setDialogOpen(false);
      setEditTask(null);
      fetchTasks();
    } finally {
      setFormSubmitting(false);
    }
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const targetColumn = COLUMNS.find((c) => c.id === overId);
    if (targetColumn) {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetColumn.id }),
      });
      fetchTasks();
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  if (loading) {
    return <div className="text-muted-foreground">Lade Tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="mr-1 h-4 w-4" />
            Kanban
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("list")}
          >
            <List className="mr-1 h-4 w-4" />
            Liste
          </Button>
        </div>
        {!isClient && (
          <Button size="sm" onClick={() => openDialog(null)}>
            <Plus className="mr-1 h-4 w-4" />
            Neuer Task
          </Button>
        )}
      </div>

      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <SortableContext
                  key={col.id}
                  id={col.id}
                  items={colTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex min-w-[260px] flex-col rounded-sm border bg-background">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {col.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {colTasks.length}
                      </Badge>
                    </div>
                    <ScrollArea className="flex-1 p-2">
                      <div className="space-y-2" style={{ minHeight: 100 }}>
                        {colTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => {
                              if (!isClient) {
                                openDialog(task);
                              }
                            }}
                          />
                        ))}
                        {colTasks.length === 0 && (
                          <div className="py-8 text-center text-xs text-muted-foreground">
                            Leer
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </SortableContext>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask && (
              <Card className="w-[250px] border bg-card p-3">
                <div className="text-sm font-medium">{activeTask.title}</div>
              </Card>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-2">
          {tasks.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">Keine Tasks vorhanden</p>
          )}
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between rounded-sm border p-3 transition-colors hover:bg-accent cursor-pointer"
              onClick={() => {
                if (!isClient) {
                  setEditTask(task);
                  setDialogOpen(true);
                }
              }}
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn("text-[10px]", getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
                <span className="text-sm font-medium">{task.title}</span>
              </div>
              <div className="flex items-center gap-3">
                {task.assignee && (
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[9px]">
                      {getInitials(task.assignee.name || task.assignee.email)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {task.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTask ? "Task bearbeiten" : "Neuer Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={createOrUpdateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorität</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Fällig am</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Zugewiesen an</Label>
                <Select value={formAssigneeId} onValueChange={setFormAssigneeId}>
                  <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Niemand</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name || m.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="clientVisible"
                checked={formClientVisible}
                onChange={(e) => setFormClientVisible(e.target.checked)}
                className="rounded-sm"
              />
              <Label htmlFor="clientVisible">Für Kunden sichtbar</Label>
            </div>
            <DialogFooter>
              {editTask && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => { deleteTask(editTask.id); setDialogOpen(false); }}
                >
                  Löschen
                </Button>
              )}
              <Button type="submit" disabled={formSubmitting || !formTitle.trim()}>
                {editTask ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
