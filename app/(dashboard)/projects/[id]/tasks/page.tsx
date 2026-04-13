"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Calendar,
  List,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link2,
  ChevronDown,
  ChevronRight,
  Layers,
  X,
} from "lucide-react";
import { cn, formatDate, getPriorityColor, getInitials } from "@/lib/utils";

// --- Types ---

interface TaskStatus {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface Epic {
  id: string;
  title: string;
  description?: string;
  color: string;
  order: number;
  _count?: { tasks: number };
}

interface TaskLinkInfo {
  id: string;
  type: string;
  sourceTask?: { id: string; title: string; status: string };
  targetTask?: { id: string; title: string; status: string };
}

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
  epic?: { id: string; title: string; color: string } | null;
  epicId?: string | null;
  sourceLinks?: TaskLinkInfo[];
  targetLinks?: TaskLinkInfo[];
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend",
};
const LINK_TYPES = [
  { value: "RELATED", label: "Verwandt" },
  { value: "BLOCKS", label: "Blockiert" },
  { value: "BLOCKED_BY", label: "Blockiert von" },
  { value: "DEPENDS_ON", label: "Abhängig von" },
];

// --- Sortable Task Card ---

function TaskCard({
  task,
  onClick,
  statuses,
}: {
  task: Task;
  onClick: () => void;
  statuses: TaskStatus[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const linkCount =
    (task.sourceLinks?.length || 0) + (task.targetLinks?.length || 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <Card
        className="cursor-grab border bg-card p-3 transition-all hover:bg-accent hover:shadow-md active:cursor-grabbing"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("[data-no-click]")) {
            onClick();
          }
        }}
      >
        <div className="space-y-2">
          {task.epic && (
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: task.epic.color }}
              />
              <span className="text-[10px] font-medium text-muted-foreground truncate">
                {task.epic.title}
              </span>
            </div>
          )}
          <div className="text-sm font-medium leading-tight">{task.title}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                getPriorityColor(task.priority)
              )}
            >
              {PRIORITY_LABELS[task.priority] || task.priority}
            </Badge>
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                {formatDate(task.dueDate)}
              </span>
            )}
            {linkCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Link2 className="h-2.5 w-2.5" />
                {linkCount}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            {task.assignee ? (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px]">
                  {getInitials(task.assignee.name || task.assignee.email)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div />
            )}
            {task.clientVisible && (
              <span className="text-[10px] text-primary">Kundensichtbar</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- Droppable Column ---

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onAddTask,
  onEditColumn,
  onDeleteColumn,
  isClient,
  statuses,
  isOver,
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (statusId: string) => void;
  onEditColumn: (status: TaskStatus) => void;
  onDeleteColumn: (status: TaskStatus) => void;
  isClient: boolean;
  statuses: TaskStatus[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[280px] max-w-[320px] flex-col rounded-lg border bg-muted/30 transition-colors",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider">
            {status.name}
          </span>
          <Badge variant="secondary" className="text-[10px] ml-1">
            {tasks.length}
          </Badge>
        </div>
        {!isClient && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditColumn(status)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddTask(status.id)}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Task hinzufügen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteColumn(status)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Spalte löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <ScrollArea className="flex-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 p-2" style={{ minHeight: 80 }}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                statuses={statuses}
              />
            ))}
            {tasks.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Keine Tasks
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
      {!isClient && (
        <button
          onClick={() => onAddTask(status.id)}
          className="m-2 flex items-center justify-center gap-1 rounded-md border border-dashed p-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Task
        </button>
      )}
    </div>
  );
}

// --- Main Page ---

export default function TasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [members, setMembers] = useState<
    { id: string; name: string; email: string }[]
  >([]);

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState("BACKLOG");
  const [formPriority, setFormPriority] = useState("MEDIUM");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAssigneeId, setFormAssigneeId] = useState("none");
  const [formClientVisible, setFormClientVisible] = useState(false);
  const [formEpicId, setFormEpicId] = useState("none");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Column dialog
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editColumn, setEditColumn] = useState<TaskStatus | null>(null);
  const [colName, setColName] = useState("");
  const [colColor, setColColor] = useState("#6b7280");

  // Epic dialog
  const [epicDialogOpen, setEpicDialogOpen] = useState(false);
  const [editEpic, setEditEpic] = useState<Epic | null>(null);
  const [epicTitle, setEpicTitle] = useState("");
  const [epicDescription, setEpicDescription] = useState("");
  const [epicColor, setEpicColor] = useState("#6366f1");

  // Link dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState("");
  const [linkTargetId, setLinkTargetId] = useState("");
  const [linkType, setLinkType] = useState("RELATED");

  // List view: collapsed epics
  const [collapsedEpics, setCollapsedEpics] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // --- Data fetching ---

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?projectId=${projectId}`);
    if (res.ok) setTasks(await res.json());
  }, [projectId]);

  const fetchStatuses = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/statuses`);
    if (res.ok) setStatuses(await res.json());
  }, [projectId]);

  const fetchEpics = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/epics`);
    if (res.ok) setEpics(await res.json());
  }, [projectId]);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchStatuses(), fetchEpics()]).then(() =>
      setLoading(false)
    );
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.members) setMembers(data.members.map((m: any) => m.user));
      });
  }, [fetchTasks, fetchStatuses, fetchEpics, projectId]);

  // --- Task CRUD ---

  function openTaskDialog(task: Task | null, defaultStatus?: string) {
    setEditTask(task);
    setFormTitle(task?.title || "");
    setFormDescription(task?.description || "");
    setFormStatus(task?.status || defaultStatus || statuses[0]?.id || "BACKLOG");
    setFormPriority(task?.priority || "MEDIUM");
    setFormDueDate(task?.dueDate ? task.dueDate.split("T")[0] : "");
    setFormAssigneeId(task?.assigneeId || "none");
    setFormClientVisible(task?.clientVisible || false);
    setFormEpicId(task?.epicId || "none");
    setTaskDialogOpen(true);
  }

  async function saveTask(e: React.FormEvent<HTMLFormElement>) {
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
      epicId: formEpicId === "none" ? null : formEpicId,
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
      setTaskDialogOpen(false);
      setEditTask(null);
      fetchTasks();
    } finally {
      setFormSubmitting(false);
    }
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTaskDialogOpen(false);
    fetchTasks();
  }

  // --- Column CRUD ---

  function openColumnDialog(col: TaskStatus | null) {
    setEditColumn(col);
    setColName(col?.name || "");
    setColColor(col?.color || "#6b7280");
    setColumnDialogOpen(true);
  }

  async function saveColumn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editColumn) {
      await fetch(
        `/api/projects/${projectId}/statuses/${editColumn.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: colName, color: colColor }),
        }
      );
    } else {
      await fetch(`/api/projects/${projectId}/statuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: colName, color: colColor }),
      });
    }
    setColumnDialogOpen(false);
    setEditColumn(null);
    fetchStatuses();
  }

  async function deleteColumn(status: TaskStatus) {
    const tasksInColumn = tasks.filter((t) => t.status === status.id);
    if (tasksInColumn.length > 0) {
      alert(
        `Spalte "${status.name}" hat noch ${tasksInColumn.length} Task(s). Verschiebe die Tasks zuerst.`
      );
      return;
    }
    await fetch(`/api/projects/${projectId}/statuses/${status.id}`, {
      method: "DELETE",
    });
    fetchStatuses();
  }

  // --- Epic CRUD ---

  function openEpicDialog(epic: Epic | null) {
    setEditEpic(epic);
    setEpicTitle(epic?.title || "");
    setEpicDescription(epic?.description || "");
    setEpicColor(epic?.color || "#6366f1");
    setEpicDialogOpen(true);
  }

  async function saveEpic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editEpic) {
      await fetch(`/api/projects/${projectId}/epics/${editEpic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: epicTitle,
          description: epicDescription,
          color: epicColor,
        }),
      });
    } else {
      await fetch(`/api/projects/${projectId}/epics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: epicTitle,
          description: epicDescription,
          color: epicColor,
        }),
      });
    }
    setEpicDialogOpen(false);
    setEditEpic(null);
    fetchEpics();
    fetchTasks();
  }

  async function deleteEpic(epic: Epic) {
    await fetch(`/api/projects/${projectId}/epics/${epic.id}`, {
      method: "DELETE",
    });
    setEpicDialogOpen(false);
    setEditEpic(null);
    fetchEpics();
    fetchTasks();
  }

  // --- Task Links ---

  function openLinkDialog(taskId: string) {
    setLinkSourceId(taskId);
    setLinkTargetId("");
    setLinkType("RELATED");
    setLinkDialogOpen(true);
  }

  async function saveLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await fetch("/api/task-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceTaskId: linkSourceId,
        targetTaskId: linkTargetId,
        type: linkType,
      }),
    });
    setLinkDialogOpen(false);
    fetchTasks();
  }

  async function deleteLink(linkId: string) {
    await fetch(`/api/task-links/${linkId}`, { method: "DELETE" });
    fetchTasks();
  }

  // --- Drag & Drop ---

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;
    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Check if dropped on a column (status)
    const targetColumn = statuses.find((s) => s.id === overId);
    if (targetColumn && draggedTask.status !== targetColumn.id) {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: targetColumn.id } : t
        )
      );
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetColumn.id }),
      });
      fetchTasks();
      return;
    }

    // Check if dropped on another task
    const targetTask = tasks.find((t) => t.id === overId);
    if (targetTask && draggedTask.status !== targetTask.status) {
      // Move to the target task's column
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: targetTask.status } : t
        )
      );
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetTask.status }),
      });
      fetchTasks();
      return;
    }

    // Same column reorder
    if (targetTask && draggedTask.status === targetTask.status) {
      const columnTasks = tasks
        .filter((t) => t.status === draggedTask.status)
        .sort((a, b) => (a.id === taskId ? -1 : b.id === taskId ? 1 : 0));
      const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
      const newIndex = columnTasks.findIndex((t) => t.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        // Update local state for immediate feedback
        setTasks((prev) => {
          const otherTasks = prev.filter(
            (t) => t.status !== draggedTask.status
          );
          return [...otherTasks, ...reordered];
        });
        // Update order on server
        for (let i = 0; i < reordered.length; i++) {
          if (reordered[i].id === taskId) {
            await fetch(`/api/tasks/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order: i }),
            });
          }
        }
      }
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  // --- Grouped data for list view ---

  const epicGroups = useMemo(() => {
    const groups: { epic: Epic | null; tasks: Task[] }[] = [];

    // Group tasks with epics
    const epicMap = new Map<string, Task[]>();
    const noEpicTasks: Task[] = [];

    for (const task of tasks) {
      if (task.epicId) {
        const existing = epicMap.get(task.epicId) || [];
        existing.push(task);
        epicMap.set(task.epicId, existing);
      } else {
        noEpicTasks.push(task);
      }
    }

    // Add epic groups in order
    for (const epic of epics) {
      const epicTasks = epicMap.get(epic.id) || [];
      if (epicTasks.length > 0) {
        groups.push({ epic, tasks: epicTasks });
      }
    }

    // Add tasks without epic
    if (noEpicTasks.length > 0) {
      groups.push({ epic: null, tasks: noEpicTasks });
    }

    return groups;
  }, [tasks, epics]);

  function toggleEpicCollapse(epicId: string) {
    setCollapsedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  }

  // --- Status color helper ---

  function getStatusInfo(statusId: string) {
    return statuses.find((s) => s.id === statusId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Lade Tasks...
      </div>
    );
  }

  const COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#10b981",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#6b7280",
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
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
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Layers className="mr-1 h-4 w-4" />
                  Epics
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {epics.map((epic) => (
                  <DropdownMenuItem
                    key={epic.id}
                    onClick={() => openEpicDialog(epic)}
                  >
                    <span
                      className="mr-2 h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: epic.color }}
                    />
                    <span className="truncate">{epic.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {epic._count?.tasks || 0}
                    </span>
                  </DropdownMenuItem>
                ))}
                {epics.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => openEpicDialog(null)}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Neues Epic
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {view === "kanban" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openColumnDialog(null)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Spalte
              </Button>
            )}
            <Button size="sm" onClick={() => openTaskDialog(null)}>
              <Plus className="mr-1 h-4 w-4" />
              Neuer Task
            </Button>
          </div>
        )}
      </div>

      {/* Kanban View */}
      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses.map((status) => {
              const colTasks = tasks.filter((t) => t.status === status.id);
              return (
                <KanbanColumn
                  key={status.id}
                  status={status}
                  tasks={colTasks}
                  onTaskClick={(task) => !isClient && openTaskDialog(task)}
                  onAddTask={(statusId) => openTaskDialog(null, statusId)}
                  onEditColumn={openColumnDialog}
                  onDeleteColumn={deleteColumn}
                  isClient={isClient}
                  statuses={statuses}
                  isOver={overId === status.id}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeTask && (
              <Card className="w-[280px] rotate-2 border bg-card p-3 shadow-xl">
                <div className="space-y-2">
                  {activeTask.epic && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: activeTask.epic.color }}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {activeTask.epic.title}
                      </span>
                    </div>
                  )}
                  <div className="text-sm font-medium">
                    {activeTask.title}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      getPriorityColor(activeTask.priority)
                    )}
                  >
                    {PRIORITY_LABELS[activeTask.priority] || activeTask.priority}
                  </Badge>
                </div>
              </Card>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* List View with Epic Grouping */
        <div className="space-y-4">
          {epicGroups.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Keine Tasks vorhanden
            </p>
          )}
          {epicGroups.map((group) => {
            const epicId = group.epic?.id || "__none__";
            const isCollapsed = collapsedEpics.has(epicId);
            return (
              <div key={epicId} className="space-y-1">
                {/* Epic Header */}
                <button
                  onClick={() => toggleEpicCollapse(epicId)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  {group.epic ? (
                    <>
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: group.epic.color }}
                      />
                      <span className="text-sm font-semibold">
                        {group.epic.title}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">
                      Ohne Epic
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {group.tasks.length}
                  </Badge>
                </button>

                {/* Task List */}
                {!isCollapsed && (
                  <div className="ml-6 space-y-1">
                    {group.tasks.map((task) => {
                      const statusInfo = getStatusInfo(task.status);
                      const linkCount =
                        (task.sourceLinks?.length || 0) +
                        (task.targetLinks?.length || 0);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2.5 transition-colors hover:bg-accent cursor-pointer"
                          onClick={() => !isClient && openTaskDialog(task)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] shrink-0",
                                getPriorityColor(task.priority)
                              )}
                            >
                              {PRIORITY_LABELS[task.priority] || task.priority}
                            </Badge>
                            <span className="text-sm font-medium truncate">
                              {task.title}
                            </span>
                            {linkCount > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                                <Link2 className="h-3 w-3" />
                                {linkCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                            {task.assignee && (
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[9px]">
                                  {getInitials(
                                    task.assignee.name || task.assignee.email
                                  )}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            {statusInfo && (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                                style={{
                                  borderColor: statusInfo.color + "40",
                                  color: statusInfo.color,
                                  backgroundColor: statusInfo.color + "15",
                                }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{
                                    backgroundColor: statusInfo.color,
                                  }}
                                />
                                {statusInfo.name}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTask ? "Task bearbeiten" : "Neuer Task"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTask} className="space-y-4">
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
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorität</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className={getPriorityColor(p)}>
                          {PRIORITY_LABELS[p] || p}
                        </span>
                      </SelectItem>
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
                <Select
                  value={formAssigneeId}
                  onValueChange={setFormAssigneeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Niemand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Niemand</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Epic</Label>
              <Select value={formEpicId} onValueChange={setFormEpicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kein Epic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Epic</SelectItem>
                  {epics.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: e.color }}
                        />
                        {e.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* Task Links Section (edit mode only) */}
            {editTask && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Verknüpfungen
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6"
                    onClick={() => openLinkDialog(editTask.id)}
                  >
                    <Link2 className="mr-1 h-3 w-3" />
                    Verknüpfen
                  </Button>
                </div>
                {[
                  ...(editTask.sourceLinks || []).map((l) => ({
                    ...l,
                    dir: "source" as const,
                    linkedTask: l.targetTask,
                  })),
                  ...(editTask.targetLinks || []).map((l) => ({
                    ...l,
                    dir: "target" as const,
                    linkedTask: l.sourceTask,
                  })),
                ].map((link) => {
                  const typeLabel =
                    LINK_TYPES.find((lt) => lt.value === link.type)?.label ||
                    link.type;
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {typeLabel}:
                        </span>
                        <span className="font-medium">
                          {link.linkedTask?.title}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => deleteLink(link.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
                {(editTask.sourceLinks?.length || 0) +
                  (editTask.targetLinks?.length || 0) ===
                  0 && (
                  <p className="text-xs text-muted-foreground">
                    Keine Verknüpfungen
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              {editTask && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteTask(editTask.id)}
                >
                  Löschen
                </Button>
              )}
              <Button
                type="submit"
                disabled={formSubmitting || !formTitle.trim()}
              >
                {editTask ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Column Dialog */}
      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editColumn ? "Spalte bearbeiten" : "Neue Spalte"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveColumn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="colName">Name</Label>
              <Input
                id="colName"
                value={colName}
                onChange={(e) => setColName(e.target.value)}
                required
                placeholder="z.B. QA, Staging..."
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      colColor === c
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!colName.trim()}>
                {editColumn ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Epic Dialog */}
      <Dialog open={epicDialogOpen} onOpenChange={setEpicDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editEpic ? "Epic bearbeiten" : "Neues Epic"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEpic} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="epicTitle">Titel</Label>
              <Input
                id="epicTitle"
                value={epicTitle}
                onChange={(e) => setEpicTitle(e.target.value)}
                required
                placeholder="z.B. User Authentication, Dashboard..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epicDesc">Beschreibung</Label>
              <Textarea
                id="epicDesc"
                value={epicDescription}
                onChange={(e) => setEpicDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEpicColor(c)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      epicColor === c
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              {editEpic && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => deleteEpic(editEpic)}
                >
                  Löschen
                </Button>
              )}
              <Button type="submit" disabled={!epicTitle.trim()}>
                {editEpic ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Task verknüpfen</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveLink} className="space-y-4">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map((lt) => (
                    <SelectItem key={lt.value} value={lt.value}>
                      {lt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ziel-Task</Label>
              <Select value={linkTargetId} onValueChange={setLinkTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Task auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks
                    .filter((t) => t.id !== linkSourceId)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!linkTargetId}>
                Verknüpfen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
