"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Switch } from "@/components/ui/switch";
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
  CalendarDays,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link2,
  ChevronDown,
  ChevronRight,
  Layers,
  X,
  Clock,
  MessageSquare,
  Paperclip,
  Upload,
  FileText,
  History,
  Send,
  Eye,
  Download,
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown,
  Lock,
} from "lucide-react";
import { cn, formatDate, getInitials, getPriorityColor } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  LINK_TYPES,
} from "@/lib/task-meta";
import { PriorityPill } from "@/components/task/priority-pill";
import { ApprovalBadge } from "@/components/task/approval-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  TimerButton,
  formatDurationShort,
} from "@/components/time-tracker";
import { useGlobalTimer } from "@/components/global-timer";
import { useOptimisticTasks } from "@/hooks/use-optimistic-tasks";
import { toast } from "@/hooks/use-toast";
import type {
  Task,
  TaskStatus,
  Epic,
  TaskLinkInfo,
} from "./_lib/types";
import { kanbanCollision, getNextStatus } from "./_lib/dnd";
import { TaskCard } from "./_components/task-card";
import { KanbanColumn } from "./_components/kanban-column";
import { TimeEntriesSection } from "./_components/time-entries-section";
import { ChecklistSection } from "./_components/checklist-section";
import { SubtasksSection } from "./_components/subtasks-section";
import { CommentsSection } from "./_components/comments-section";
import { FilesSection } from "./_components/files-section";
import { ActivityTimeline } from "./_components/activity-timeline";
import { TaskFilters } from "./_components/task-filters";
import { BulkToolbar } from "./_components/bulk-toolbar";
import { SavedViewsMenu } from "./_components/saved-views-menu";
import { TemplatesMenu } from "./_components/templates-menu";
import { ImportExportMenu } from "./_components/import-export-menu";
import { CalendarView } from "./_components/calendar-view";
import { RecurrencePicker } from "./_components/recurrence-picker";
import { useUrlFilters } from "./_lib/use-url-filters";
import { useSelection } from "./_lib/use-selection";
import { useSavedViews } from "./_lib/use-saved-views";
import { NEW_TASK_EVENT_NAME } from "@/components/keyboard-shortcut-overlay";
import { api } from "@/lib/api";
// --- Main Page ---

export default function TasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const search = useSearchParams();
  // `?import=true` kommt vom Projekt-Erstellen-Flow → öffnet direkt den
  // File-Picker des Import/Export-Menüs.
  const autoOpenImport = search.get("import") === "true";
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const currentUserId = session?.user?.id || "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list" | "calendar">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string; email: string; role?: string }[]>([]);

  const { activeTimer, elapsed, startTimer, requestStop, fetchActive, setOnChange } = useGlobalTimer();

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
  const [formRecurrence, setFormRecurrence] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [detailTab, setDetailTab] = useState<"details" | "comments" | "files" | "activity">("details");

  // Column dialog
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editColumn, setEditColumn] = useState<TaskStatus | null>(null);
  const [colName, setColName] = useState("");
  const [colColor, setColColor] = useState("#6b7280");
  const [colIsApproval, setColIsApproval] = useState(false);

  // Handoff dialog (when staff drags task to approval column)
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [pendingHandoffTaskId, setPendingHandoffTaskId] = useState<string | null>(null);
  const [pendingHandoffStatusId, setPendingHandoffStatusId] = useState<string | null>(null);
  const [handoffMsg, setHandoffMsg] = useState("");
  const [handoffClientId, setHandoffClientId] = useState("");
  const [handoffClientLocked, setHandoffClientLocked] = useState(false); // true when triggered from assignee selection
  const [handoffSubmitting, setHandoffSubmitting] = useState(false);

  // Approval submit (client view)
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");

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

  // List view: collapsed status groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // --- Filters (consolidated, two-way synced with URL search params) ---
  const { filters, setFilters, clearFilters } = useUrlFilters();

  // Saved views (localStorage-backed, scoped per project)
  const savedViews = useSavedViews(projectId);
  // Compatibility aliases — internal usages that read the old names still work.
  const filterSearch     = filters.search;
  const filterAssignees  = filters.assignees;
  const filterPriorities = filters.priorities;
  const filterEpicId     = filters.epicId;
  const filterDue        = filters.due;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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
    Promise.all([fetchTasks(), fetchStatuses(), fetchEpics()]).then(() => setLoading(false));
    fetch(`/api/projects/${projectId}`).then((r) => r.json()).then((data) => {
      if (data.members) setMembers(data.members.map((m: any) => m.user));
    });
  }, [fetchTasks, fetchStatuses, fetchEpics, projectId]);

  useEffect(() => {
    setOnChange(() => fetchTasks);
    return () => setOnChange(null);
  }, [setOnChange, fetchTasks]);

  // Global "c" shortcut → open the new-task dialog from anywhere on this page.
  useEffect(() => {
    if (isClient) return;
    function handler() {
      setEditTask(null);
      setFormTitle("");
      setFormDescription("");
      setFormStatus(statuses[0]?.id || "BACKLOG");
      setFormPriority("MEDIUM");
      setFormDueDate("");
      setFormAssigneeId("none");
      setFormClientVisible(false);
      setFormEpicId("none");
      setFormRecurrence(null);
      setTaskDialogOpen(true);
    }
    window.addEventListener(NEW_TASK_EVENT_NAME, handler);
    return () => window.removeEventListener(NEW_TASK_EVENT_NAME, handler);
  }, [isClient, statuses]);

  const { optimisticUpdate, optimisticDelete, optimisticCreate, optimisticReorder } =
    useOptimisticTasks({
      tasks,
      setTasks,
      onError: (msg) => toast({ title: "Fehler", description: msg, variant: "destructive" }),
    });

  // --- Inline title update ---
  async function handleUpdateTitle(taskId: string, title: string) {
    await optimisticUpdate(taskId, { title } as any);
  }

  // --- Timer ---
  async function handleTimerStart(taskId: string) { await startTimer(taskId); fetchTasks(); }
  function handleTimerStop() { requestStop(); }

  // --- Task CRUD ---
  function openTaskDialog(task: Task | null, defaultStatus?: string) {
    // Preview tasks cannot be opened by clients
    if (task?._isPreview) return;
    setEditTask(task);
    setFormTitle(task?.title || "");
    setFormDescription(task?.description || "");
    setFormStatus(task?.status || defaultStatus || statuses[0]?.id || "BACKLOG");
    setFormPriority(task?.priority || "MEDIUM");
    setFormDueDate(task?.dueDate ? task.dueDate.split("T")[0] : "");
    setFormAssigneeId(task?.assigneeId || "none");
    setFormClientVisible(task?.clientVisible || false);
    setFormEpicId(task?.epicId || "none");
    setFormRecurrence(task?.recurrenceRule ?? null);
    setDetailTab(isClient && task ? "comments" : "details");
    setTaskDialogOpen(true);
  }

  async function saveTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormSubmitting(true);
    const patch: any = {
      title: formTitle, description: formDescription || "", priority: formPriority, status: formStatus,
      clientVisible: formClientVisible, dueDate: formDueDate || null,
      assigneeId: formAssigneeId === "none" ? null : formAssigneeId,
      epicId: formEpicId === "none" ? null : formEpicId,
      recurrenceRule: formRecurrence,
    };
    const newAssigneeId = formAssigneeId === "none" ? null : formAssigneeId;
    const selectedAssignee = members.find((m) => m.id === newAssigneeId);
    const isAssigningToClient = selectedAssignee?.role === "CLIENT";

    try {
      if (editTask) {
        // Intercept 1: status changed to an approval column → handoff dialog
        const targetStatus = statuses.find((s) => s.id === formStatus);
        if (targetStatus?.isApproval && editTask.status !== formStatus && !editTask.approvalStatus) {
          setTaskDialogOpen(false);
          setEditTask(null);
          const clientMembers = members.filter((m) => m.role === "CLIENT");
          setPendingHandoffTaskId(editTask.id);
          setPendingHandoffStatusId(formStatus);
          setHandoffMsg("");
          setHandoffClientId(newAssigneeId && isAssigningToClient ? newAssigneeId : (clientMembers[0]?.id || ""));
          setHandoffClientLocked(false);
          setHandoffDialogOpen(true);
          return;
        }

        // Intercept 2: assignee changed to a client → approval flow
        const alreadyPendingForThisClient =
          editTask.approvalStatus === "PENDING" && editTask.assigneeId === newAssigneeId;
        if (isAssigningToClient && !alreadyPendingForThisClient) {
          setTaskDialogOpen(false);
          setEditTask(null);
          setPendingHandoffTaskId(editTask.id);
          setPendingHandoffStatusId(formStatus);
          setHandoffMsg("");
          setHandoffClientId(newAssigneeId || "");
          setHandoffClientLocked(true); // client already chosen — lock the selector
          setHandoffDialogOpen(true);
          return;
        }

        // Normal save
        setTaskDialogOpen(false);
        setEditTask(null);
        await optimisticUpdate(editTask.id, patch);
      } else {
        // Create — if client assigned, auto-set visibility + pending approval
        setTaskDialogOpen(false);
        setEditTask(null);
        await optimisticCreate({
          ...patch,
          projectId,
          ...(isAssigningToClient && {
            clientVisible: true,
            approvalStatus: "PENDING",
          }),
        });
      }
    } finally { setFormSubmitting(false); }
  }

  async function deleteTask(id: string) {
    setTaskDialogOpen(false);
    setEditTask(null);
    await optimisticDelete(id);
  }

  // --- Column CRUD ---
  function openColumnDialog(col: TaskStatus | null) {
    setEditColumn(col);
    setColName(col?.name || "");
    setColColor(col?.color || "#6b7280");
    setColIsApproval(col?.isApproval ?? false);
    setColumnDialogOpen(true);
  }

  async function saveColumn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editColumn) {
      await fetch(`/api/projects/${projectId}/statuses/${editColumn.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: colName, color: colColor, isApproval: colIsApproval }),
      });
    } else {
      await fetch(`/api/projects/${projectId}/statuses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: colName, color: colColor, isApproval: colIsApproval }),
      });
    }
    setColumnDialogOpen(false); setEditColumn(null); fetchStatuses();
  }

  async function deleteColumn(status: TaskStatus) {
    const tasksInColumn = tasks.filter((t) => t.status === status.id);
    if (tasksInColumn.length > 0) { alert(`Spalte "${status.name}" hat noch ${tasksInColumn.length} Task(s). Verschiebe die Tasks zuerst.`); return; }
    await fetch(`/api/projects/${projectId}/statuses/${status.id}`, { method: "DELETE" });
    fetchStatuses();
  }

  // --- Epic CRUD ---
  function openEpicDialog(epic: Epic | null) {
    setEditEpic(epic); setEpicTitle(epic?.title || ""); setEpicDescription(epic?.description || ""); setEpicColor(epic?.color || "#6366f1"); setEpicDialogOpen(true);
  }

  async function saveEpic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editEpic) {
      await fetch(`/api/projects/${projectId}/epics/${editEpic.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: epicTitle, description: epicDescription, color: epicColor }),
      });
    } else {
      await fetch(`/api/projects/${projectId}/epics`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: epicTitle, description: epicDescription, color: epicColor }),
      });
    }
    setEpicDialogOpen(false); setEditEpic(null); fetchEpics(); fetchTasks();
  }

  async function deleteEpic(epic: Epic) {
    await fetch(`/api/projects/${projectId}/epics/${epic.id}`, { method: "DELETE" });
    setEpicDialogOpen(false); setEditEpic(null); fetchEpics(); fetchTasks();
  }

  // --- Task Links ---
  function openLinkDialog(taskId: string) { setLinkSourceId(taskId); setLinkTargetId(""); setLinkType("RELATED"); setLinkDialogOpen(true); }

  async function saveLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await fetch("/api/task-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceTaskId: linkSourceId, targetTaskId: linkTargetId, type: linkType }) });
    setLinkDialogOpen(false); fetchTasks();
  }

  async function deleteLink(linkId: string) { await fetch(`/api/task-links/${linkId}`, { method: "DELETE" }); fetchTasks(); }

  // --- Next Phase ---
  // Moves a task to the next status in workflow order. If the next status is
  // an approval column, the handoff dialog is opened instead so staff can
  // attach a message for the client.
  async function handleNextPhase(task: Task) {
    if (isClient) return;
    const next = getNextStatus(task.status, statuses);
    if (!next) return;
    if (next.isApproval) {
      const clientMembers = members.filter((m) => m.role === "CLIENT");
      setPendingHandoffTaskId(task.id);
      setPendingHandoffStatusId(next.id);
      setHandoffMsg("");
      setHandoffClientId(clientMembers[0]?.id || "");
      setHandoffDialogOpen(true);
      return;
    }
    await optimisticUpdate(task.id, { status: next.id } as any);
  }

  // --- Drag & Drop ---
  function handleDragStart(event: DragStartEvent) {
    if (isClient) return;
    setActiveId(event.active.id as string);
    const rect = event.active.rect.current.initial;
    setActiveWidth(rect ? rect.width : null);
  }
  function handleDragOver(event: DragOverEvent) {
    if (isClient) return;
    if (!event.over) { setOverId(null); return; }
    const id = event.over.id as string;
    // If hovering over a task, resolve its column so the column highlights
    const overTask = tasks.find((t) => t.id === id);
    setOverId(overTask ? overTask.status : id);
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (isClient) return;
    setActiveId(null); setOverId(null); setActiveWidth(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const dragOverId = over.id as string;
    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Dropped onto a column header
    const targetColumn = statuses.find((s) => s.id === dragOverId);
    if (targetColumn && draggedTask.status !== targetColumn.id) {
      // Intercept: task dropped onto an approval column → show handoff dialog
      if (targetColumn.isApproval) {
        const clientMembers = members.filter((m) => m.role === "CLIENT");
        setPendingHandoffTaskId(taskId);
        setPendingHandoffStatusId(targetColumn.id);
        setHandoffMsg("");
        setHandoffClientId(clientMembers[0]?.id || "");
        setHandoffDialogOpen(true);
      } else {
        await optimisticUpdate(taskId, { status: targetColumn.id } as any);
      }
      return;
    }

    // Dropped onto another task (cross-column or same-column)
    const targetTask = tasks.find((t) => t.id === dragOverId);
    if (targetTask && draggedTask.status !== targetTask.status) {
      const destColumn = statuses.find((s) => s.id === targetTask.status);
      if (destColumn?.isApproval) {
        const clientMembers = members.filter((m) => m.role === "CLIENT");
        setPendingHandoffTaskId(taskId);
        setPendingHandoffStatusId(targetTask.status);
        setHandoffMsg("");
        setHandoffClientId(clientMembers[0]?.id || "");
        setHandoffDialogOpen(true);
      } else {
        await optimisticUpdate(taskId, { status: targetTask.status } as any);
      }
      return;
    }

    if (targetTask && draggedTask.status === targetTask.status) {
      const columnTasks = tasks.filter((t) => t.status === draggedTask.status);
      const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
      const newIndex = columnTasks.findIndex((t) => t.id === dragOverId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        await optimisticReorder(taskId, newIndex, reordered);
      }
    }
  }

  // --- Handoff confirmation (staff sends task to client for approval) ---
  async function confirmHandoff() {
    if (!pendingHandoffTaskId || !pendingHandoffStatusId || !handoffMsg.trim()) return;
    setHandoffSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${pendingHandoffTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: pendingHandoffStatusId,
          handoffComment: handoffMsg.trim(),
          assigneeId: handoffClientId || null,
          approvalStatus: "PENDING",
          clientVisible: true,
        }),
      });
      if (res.ok) {
        await fetchTasks();
        setHandoffDialogOpen(false);
        setPendingHandoffTaskId(null);
        setPendingHandoffStatusId(null);
        setHandoffMsg("");
        toast({ title: "Übergabe gesendet", description: "Der Kunde kann den Task jetzt einsehen und abnehmen.", variant: "success" });
      }
    } finally {
      setHandoffSubmitting(false);
    }
  }

  // --- Client approval submit ---
  async function submitApproval(decision: "APPROVED" | "REJECTED") {
    if (!editTask) return;
    setApprovalSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${editTask.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: approvalComment.trim() || undefined }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === editTask.id ? { ...t, ...updated } : t)));
        setEditTask((prev) => prev ? { ...prev, ...updated } : prev);
        setApprovalComment("");
        toast({
          title: decision === "APPROVED" ? "Task genehmigt ✓" : "Task abgelehnt",
          description: decision === "APPROVED"
            ? "Das Team wurde benachrichtigt."
            : "Das Team wurde über die Ablehnung informiert.",
          variant: decision === "APPROVED" ? "success" : "destructive",
        });
      }
    } finally {
      setApprovalSubmitting(false);
    }
  }

  // Team-side action: after a rejection, resubmit the task to the client for
  // another round of review. Clears the previous decision metadata and
  // notifies the client.
  async function resubmitApproval() {
    if (!editTask) return;
    setApprovalSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${editTask.id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: approvalComment.trim() || undefined }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === editTask.id ? { ...t, ...updated } : t)));
        setEditTask((prev) => prev ? { ...prev, ...updated } : prev);
        setApprovalComment("");
        toast({
          title: "Erneut zur Abnahme gesendet",
          description: "Der Kunde wurde benachrichtigt.",
          variant: "success",
        });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Konnte nicht erneut einreichen",
          description: err.error || "Bitte erneut versuchen.",
          variant: "destructive",
        });
      }
    } finally {
      setApprovalSubmitting(false);
    }
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  // --- Filter summary (badge + result count) ---
  const activeFilterCount =
    (filterSearch ? 1 : 0) +
    filterAssignees.length +
    filterPriorities.length +
    (filterEpicId ? 1 : 0) +
    (filterDue ? 1 : 0);

  // --- Filtered tasks (client-side) ---
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !(task.description || "").toLowerCase().includes(q)) return false;
      }
      if (filterAssignees.length > 0 && !filterAssignees.includes(task.assigneeId || "")) return false;
      if (filterPriorities.length > 0 && !filterPriorities.includes(task.priority)) return false;
      if (filterEpicId && task.epicId !== filterEpicId) return false;
      if (filterDue) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 86400000);
        const weekEnd = new Date(today.getTime() + 7 * 86400000);
        if (filterDue === "overdue") {
          if (!task.dueDate || new Date(task.dueDate) >= today) return false;
        } else if (filterDue === "today") {
          if (!task.dueDate) return false;
          const d = new Date(task.dueDate);
          if (d < today || d >= tomorrow) return false;
        } else if (filterDue === "week") {
          if (!task.dueDate) return false;
          const d = new Date(task.dueDate);
          if (d < today || d >= weekEnd) return false;
        } else if (filterDue === "none") {
          if (task.dueDate) return false;
        }
      }
      return true;
    });
  }, [tasks, filterSearch, filterAssignees, filterPriorities, filterEpicId, filterDue]);

  // --- Multi-select for bulk actions ---
  const selection = useSelection();
  const orderedTaskIds = useMemo(() => filteredTasks.map((t) => t.id), [filteredTasks]);
  const handleSelect = useCallback(
    (taskId: string, mode: "toggle" | "range") => {
      if (mode === "range") selection.toggleRange(taskId, orderedTaskIds);
      else selection.toggle(taskId);
    },
    [orderedTaskIds, selection],
  );

  // Esc clears selection (only when no input focused)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || selection.selectedCount === 0) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      selection.clear();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  // --- Bulk actions ---
  async function bulkPatch(patch: Record<string, unknown>) {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    // Optimistic: update each in local state immediately
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, ...patch } : t)));
    try {
      await Promise.all(
        ids.map((id) => api(`/api/tasks/${id}`, { method: "PATCH", body: patch })),
      );
      toast({
        title: `${ids.length} ${ids.length === 1 ? "Task" : "Tasks"} aktualisiert`,
        variant: "success",
      });
    } catch {
      toast({ title: "Bulk-Aktion fehlgeschlagen", variant: "destructive" });
      fetchTasks(); // re-sync truth
    }
  }

  async function bulkDelete() {
    const ids = selection.selectedIds;
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} ${ids.length === 1 ? "Task" : "Tasks"} wirklich löschen?`)) return;
    const idSet = new Set(ids);
    setTasks((prev) => prev.filter((t) => !idSet.has(t.id)));
    selection.clear();
    try {
      await Promise.all(ids.map((id) => api(`/api/tasks/${id}`, { method: "DELETE" })));
      toast({ title: `${ids.length} gelöscht`, variant: "success" });
    } catch {
      toast({ title: "Löschen fehlgeschlagen", variant: "destructive" });
      fetchTasks();
    }
  }

  // --- Grouped data for list view (by status like Asana) ---
  const statusGroups = useMemo(() => {
    return statuses.map((status) => ({
      status,
      tasks: filteredTasks.filter((t) => t.status === status.id),
    }));
  }, [filteredTasks, statuses]);

  function toggleGroupCollapse(statusId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(statusId)) next.delete(statusId); else next.add(statusId);
      return next;
    });
  }

  function getStatusInfo(statusId: string) { return statuses.find((s) => s.id === statusId); }
  function clientCanInteract(task: Task): boolean { return isClient && task.assigneeId === currentUserId; }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-sm" />
            <Skeleton className="h-8 w-24 rounded-sm" />
          </div>
          <Skeleton className="h-8 w-28 rounded-sm" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, col) => (
            <div key={col} className="flex-shrink-0 w-[272px] space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-6 rounded-full" />
                </div>
                <Skeleton className="h-6 w-6 rounded-sm" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: col === 0 ? 4 : col === 1 ? 3 : col === 2 ? 5 : 2 }).map((_, i) => (
                  <div key={i} className="rounded-sm border bg-card p-3 space-y-2.5">
                    <Skeleton className="h-4 w-full" />
                    {i % 3 === 0 && <Skeleton className="h-3 w-3/4" />}
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-12 rounded-full" />
                      {i % 2 === 0 && <Skeleton className="h-4 w-16 rounded-full" />}
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-3 w-6" />
                      </div>
                      <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280"];

  const isEditMode = !isClient && editTask !== null;
  const isCreateMode = !isClient && editTask === null;
  const isClientViewingTask = isClient && editTask !== null;
  const canClientInteract = editTask ? clientCanInteract(editTask) : false;

  const dialogTabs = editTask ? [
    { id: "details" as const, label: "Details", icon: FileText },
    { id: "comments" as const, label: "Kommentare", icon: MessageSquare },
    { id: "files" as const, label: "Dateien", icon: Paperclip },
    { id: "activity" as const, label: "Aktivität", icon: History },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Toolbar — Asana-style */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                view === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
              Board
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
              Liste
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                view === "calendar" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setView("calendar")}
            >
              <CalendarDays className="h-4 w-4" />
              Kalender
            </button>
          </div>

          {!isClient && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                  <Layers className="mr-1.5 h-4 w-4" />
                  Epics
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {epics.map((epic) => (
                  <DropdownMenuItem key={epic.id} onClick={() => openEpicDialog(epic)}>
                    <span className="mr-2 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: epic.color }} />
                    <span className="truncate">{epic.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{epic._count?.tasks || 0}</span>
                  </DropdownMenuItem>
                ))}
                {epics.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => openEpicDialog(null)}>
                  <Plus className="mr-2 h-3.5 w-3.5" />Neues Epic
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <SavedViewsMenu
            views={savedViews.views}
            currentView={view}
            currentFilters={filters}
            hasActiveFilters={activeFilterCount > 0}
            onApply={(v) => {
              setView(v.view);
              setFilters(v.filters);
            }}
            onSave={(name) => savedViews.saveView(name, view, filters)}
            onRename={savedViews.renameView}
            onDelete={savedViews.deleteView}
          />
        </div>

        <div className="flex items-center gap-2">
          {!isClient && (
            <>
              {view === "kanban" && (
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => openColumnDialog(null)}>
                  <Plus className="mr-1.5 h-4 w-4" />Spalte
                </Button>
              )}
              <ImportExportMenu
                projectId={projectId}
                onImported={fetchTasks}
                compact
                autoOpen={autoOpenImport}
              />
              <TemplatesMenu
                projectId={projectId}
                statuses={statuses}
                epics={epics}
                onApplied={fetchTasks}
                onCreateBlankTask={() => openTaskDialog(null)}
              />
            </>
          )}
        </div>
      </div>

      <TaskFilters
        filters={filters}
        setFilters={setFilters}
        clear={clearFilters}
        members={members}
        epics={epics}
        isClient={isClient}
        currentUserId={currentUserId}
        resultSummary={
          activeFilterCount > 0
            ? `${filteredTasks.length} von ${tasks.length} Tasks`
            : undefined
        }
      />

      {/* Calendar View — separater DnD-Context, eigene DueDate-Drag-Logik */}
      {view === "calendar" ? (
        <CalendarView
          tasks={filteredTasks}
          isClient={isClient}
          onTaskClick={(t) => openTaskDialog(t)}
          onDueDateChange={async (taskId, newDate) => {
            // Optimistic update — Server-PATCH kommt direkt hinterher
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? { ...t, dueDate: newDate ? new Date(newDate + "T12:00:00").toISOString() : null }
                  : t,
              ),
            );
            try {
              await api(`/api/tasks/${taskId}`, {
                method: "PATCH",
                body: { dueDate: newDate ? new Date(newDate + "T12:00:00").toISOString() : null },
              });
            } catch {
              fetchTasks();
            }
          }}
        />
      ) : view === "kanban" ? (
        <DndContext sensors={isClient ? [] : sensors} collisionDetection={kanbanCollision}
          onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}
          autoScroll={{ threshold: { x: 0.15, y: 0.2 }, acceleration: 14 }}>
          <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll">
            {statuses.map((status) => {
              const colTasks = filteredTasks.filter((t) => t.status === status.id);
              return (
                <KanbanColumn key={status.id} status={status} tasks={colTasks}
                  onTaskClick={(task) => openTaskDialog(task)} onAddTask={(statusId) => openTaskDialog(null, statusId)}
                  onEditColumn={openColumnDialog} onDeleteColumn={deleteColumn} isClient={isClient} statuses={statuses}
                  isOver={overId === status.id} activeTimerTaskId={activeTimer?.taskId || null} timerElapsed={elapsed}
                  onTimerStart={handleTimerStart} onTimerStop={handleTimerStop} currentUserId={currentUserId}
                  onUpdateTitle={isClient ? undefined : handleUpdateTitle}
                  onNextPhase={isClient ? undefined : handleNextPhase}
                  isSelected={selection.isSelected}
                  onSelect={isClient ? undefined : handleSelect}
                  selectionActive={selection.selectedCount > 0} />
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div
                className="rounded-xl border bg-card p-3.5 shadow-2xl cursor-grabbing"
                style={{ width: activeWidth ?? undefined }}
              >
                <div className="space-y-2.5">
                  <div className="text-sm font-semibold leading-snug">{activeTask.title}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTask.epic && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: activeTask.epic.color }} />
                        {activeTask.epic.title}
                      </span>
                    )}
                    <PriorityPill priority={activeTask.priority} size="md" />
                  </div>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* ===== LIST VIEW — Asana-style table grouped by status ===== */
        <div className="rounded-lg border">
          {/* Table header */}
          <div className="flex items-center border-b bg-muted/30 px-4 py-2 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="flex-1 min-w-0">Task</div>
            <div className="w-[140px] shrink-0 text-left">Zugewiesen</div>
            <div className="w-[100px] shrink-0 text-left">Fällig</div>
            <div className="w-[90px] shrink-0 text-left">Priorität</div>
            <div className="w-[110px] shrink-0 text-left">Status</div>
            {!isClient && <div className="w-[60px] shrink-0" />}
          </div>

          {/* Status groups */}
          {statusGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.status.id);
            return (
              <div key={group.status.id}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroupCollapse(group.status.id)}
                  className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: group.status.color }} />
                  <span className="text-sm font-semibold">{group.status.name}</span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
                </button>

                {/* Task rows */}
                {!isCollapsed && group.tasks.map((task) => {
                  const isTimerActive = activeTimer?.taskId === task.id;
                  const isGreyedOut = isClient && task.assigneeId !== currentUserId;
                  const totalTime = task.totalTime || 0;

                  const isRowSelected = selection.isSelected(task.id);
                  const selectionActive = selection.selectedCount > 0;
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center border-b px-4 py-2.5 transition-colors cursor-pointer group",
                        isTimerActive && "bg-primary/5",
                        isGreyedOut && "opacity-50",
                        isRowSelected
                          ? "bg-primary/10 ring-1 ring-primary/40 ring-inset"
                          : "hover:bg-accent/30",
                      )}
                      onClick={(e) => {
                        if (isClient) { openTaskDialog(task); return; }
                        const meta = e.metaKey || e.ctrlKey;
                        const shift = e.shiftKey;
                        if (meta) { e.preventDefault(); handleSelect(task.id, "toggle"); return; }
                        if (shift) { e.preventDefault(); handleSelect(task.id, "range"); return; }
                        if (selectionActive) { e.preventDefault(); handleSelect(task.id, "toggle"); return; }
                        openTaskDialog(task);
                      }}
                    >
                      {/* Selection checkbox / leading icon */}
                      <div className="flex-1 min-w-0 flex items-center gap-2.5">
                        {isClient ? (
                          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        ) : (
                          <button
                            type="button"
                            data-no-click
                            onClick={(e) => { e.stopPropagation(); handleSelect(task.id, "toggle"); }}
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-opacity",
                              selectionActive || isRowSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                              isRowSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40 hover:border-foreground",
                            )}
                            aria-label={isRowSelected ? "Abwählen" : "Auswählen"}
                          >
                            {isRowSelected && <CheckCircle2 className="h-3 w-3" />}
                          </button>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{task.title}</span>
                            {totalTime > 0 && (
                              <span className="flex items-center gap-0.5 text-caption text-muted-foreground shrink-0">
                                <Clock className="h-3 w-3" />{formatDurationShort(totalTime)}
                              </span>
                            )}
                          </div>
                          {task.epic && (
                            <span className="text-meta text-muted-foreground">{task.epic.title}</span>
                          )}
                        </div>
                      </div>

                      {/* Assignee */}
                      <div className="w-[140px] shrink-0">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-micro font-semibold">
                                {getInitials(task.assignee.name || task.assignee.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs truncate">{task.assignee.name || task.assignee.email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Due date */}
                      <div className="w-[100px] shrink-0">
                        {task.dueDate ? (() => {
                          const overdue = new Date(task.dueDate) < new Date();
                          return (
                            <span className={cn("text-xs flex items-center gap-1", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                              {overdue && <AlertCircle className="h-3 w-3 shrink-0" />}
                              {formatDate(task.dueDate)}
                            </span>
                          );
                        })() : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Priority */}
                      <div className="w-[90px] shrink-0">
                        <PriorityPill priority={task.priority} />
                      </div>

                      {/* Status */}
                      <div className="w-[110px] shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-meta font-semibold"
                          style={{
                            backgroundColor: group.status.color + "18",
                            color: group.status.color,
                          }}
                        >
                          {group.status.name}
                        </span>
                      </div>

                      {/* Timer */}
                      {!isClient && (
                        <div className="w-[60px] shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <TimerButton
                            taskId={task.id} isActive={isTimerActive}
                            elapsed={isTimerActive ? elapsed : 0} totalTime={totalTime}
                            onStart={handleTimerStart} onStop={handleTimerStop} size="sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add task in group */}
                {!isCollapsed && !isClient && (
                  <button
                    onClick={() => openTaskDialog(null, group.status.id)}
                    className="flex w-full items-center gap-2 border-b px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Task hinzufügen...
                  </button>
                )}
              </div>
            );
          })}

          {tasks.length === 0 && (
            <EmptyState
              icon={CheckCircle2}
              title="Noch keine Tasks"
              description={!isClient ? "Erstelle den ersten Task um loszulegen." : "Noch keine Tasks sichtbar."}
              action={
                !isClient && (
                  <button
                    onClick={() => openTaskDialog(null)}
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Plus className="h-4 w-4" />
                    Task erstellen
                  </button>
                )
              }
            />
          )}
        </div>
      )}

      {/* ===== Task Dialog ===== */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", editTask ? "max-w-2xl" : "max-w-lg")}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {isCreateMode && "Neuer Task"}
                {isEditMode && "Task bearbeiten"}
                {isClientViewingTask && (editTask?.title || "Task")}
              </DialogTitle>
              {editTask && !isClient && (
                <TimerButton taskId={editTask.id} isActive={activeTimer?.taskId === editTask.id}
                  elapsed={activeTimer?.taskId === editTask.id ? elapsed : 0} totalTime={editTask.totalTime || 0}
                  onStart={handleTimerStart} onStop={handleTimerStop} showTotal />
              )}
            </div>
          </DialogHeader>

          {/* Tabs */}
          {editTask && (
            <div className="flex items-center gap-1 border-b -mx-6 px-6 mb-2">
              {dialogTabs.map((tab) => (
                <button key={tab.id} onClick={() => setDetailTab(tab.id)}
                  className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                    detailTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}>
                  <tab.icon className="h-3.5 w-3.5" />{tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Workflow strip — current phase + quick "next phase" action */}
          {editTask && !isClient && detailTab === "details" && (() => {
            const current = statuses.find((s) => s.id === editTask.status);
            const next = getNextStatus(editTask.status, statuses);
            const isDone = current?.category === "DONE";
            return (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 mb-3">
                <span className="text-caption font-medium uppercase tracking-wider text-muted-foreground shrink-0">Phase</span>
                {current && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: current.color + "22", color: current.color }}
                  >
                    {current.name}
                    {current.isApproval && <ClipboardCheck className="h-3 w-3" />}
                  </span>
                )}
                <div className="flex-1" />
                {next ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => {
                      handleNextPhase(editTask);
                      setTaskDialogOpen(false);
                    }}
                  >
                    Nächste Phase
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className="font-medium" style={{ color: next.color }}>{next.name}</span>
                  </Button>
                ) : (
                  <span className={cn("inline-flex items-center gap-1 text-caption", isDone ? "text-success" : "text-muted-foreground")}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isDone ? "Abgeschlossen" : "Letzte Phase"}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Client read-only details */}
          {isClientViewingTask && detailTab === "details" && editTask && (
            <div className="space-y-4">
              <div className="space-y-3">
                {editTask.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{editTask.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      {(() => {
                        const si = getStatusInfo(editTask.status);
                        return si ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{ backgroundColor: si.color + "18", color: si.color }}>
                            {si.name}
                          </span>
                        ) : editTask.status;
                      })()}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Priorität</Label>
                    <div className="mt-1">
                      <PriorityPill priority={editTask.priority} size="md" />
                    </div>
                  </div>
                  {editTask.dueDate && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Fällig am</Label>
                      <p className="text-sm mt-1">{formatDate(editTask.dueDate)}</p>
                    </div>
                  )}
                  {editTask.assignee && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Zugewiesen an</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="h-5 w-5"><AvatarFallback className="text-micro">{getInitials(editTask.assignee.name || editTask.assignee.email)}</AvatarFallback></Avatar>
                        <span className="text-sm">{editTask.assignee.name || editTask.assignee.email}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3"><TimeEntriesSection taskId={editTask.id} onUpdate={fetchTasks} isClient={isClient} /></div>
              </div>

              {/* ── Handoff comment (shown to client when task is in approval) ── */}
              {editTask.handoffComment && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1.5">
                  <p className="text-caption font-semibold uppercase tracking-wider text-warning flex items-center gap-1.5">
                    <ClipboardCheck className="h-3 w-3" />Übergabe-Nachricht vom Team
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{editTask.handoffComment}</p>
                </div>
              )}

              {/* ── Approval action (only if PENDING and assigned to this client) ── */}
              {editTask.approvalStatus === "PENDING" && editTask.assigneeId === currentUserId && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Deine Abnahme
                  </p>
                  <Textarea
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Optionaler Kommentar zur Abnahme oder Ablehnung…"
                    rows={2}
                    className="resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
                      onClick={() => submitApproval("APPROVED")}
                      disabled={approvalSubmitting}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-2"
                      onClick={() => submitApproval("REJECTED")}
                      disabled={approvalSubmitting}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />Ablehnen
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Approved/Rejected result ── */}
              {(editTask.approvalStatus === "APPROVED" || editTask.approvalStatus === "REJECTED") && (
                <div className={cn(
                  "rounded-lg border p-3 space-y-1.5",
                  editTask.approvalStatus === "APPROVED"
                    ? "border-success/30 bg-success/5"
                    : "border-destructive/30 bg-destructive/5"
                )}>
                  <p className={cn(
                    "text-caption font-semibold uppercase tracking-wider flex items-center gap-1.5",
                    editTask.approvalStatus === "APPROVED" ? "text-success" : "text-destructive"
                  )}>
                    {editTask.approvalStatus === "APPROVED"
                      ? <><ThumbsUp className="h-3 w-3" />Abgenommen</>
                      : <><ThumbsDown className="h-3 w-3" />Abgelehnt</>
                    }
                  </p>
                  {editTask.approvalComment && (
                    <p className="text-sm whitespace-pre-wrap">{editTask.approvalComment}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Admin/Member edit form */}
          {(isCreateMode || isEditMode) && detailTab === "details" && (
            <form onSubmit={saveTask} className="space-y-4">
              <div className="space-y-2">
                <Label>Epic</Label>
                <Select value={formEpicId} onValueChange={setFormEpicId}>
                  <SelectTrigger><SelectValue placeholder="Kein Epic" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Epic</SelectItem>
                    {epics.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.color }} />{e.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input id="title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea id="description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} />
              </div>
              {editTask && (
                <ChecklistSection
                  taskId={editTask.id}
                  canEdit={!isClient}
                  canToggle={!isClient || canClientInteract}
                  onCountsChange={(total, done) => {
                    // Pure local state update — no PATCH needed, these counts
                    // are derived from checklist endpoints on next refetch anyway.
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === editTask.id
                          ? {
                              ...t,
                              _count: {
                                ...(t._count || {}),
                                checklistItems: total,
                                checklistDone: done,
                              },
                            }
                          : t
                      )
                    );
                  }}
                />
              )}
              {/* Subtasks — only for top-level tasks (subtasks can't have subtasks) */}
              {editTask && !editTask.parentId && !isClient && (
                <SubtasksSection
                  parentTask={editTask}
                  projectId={projectId}
                  statuses={statuses}
                  onOpenSubtask={(sub) => openTaskDialog(sub)}
                  onCountsChange={(total, done) => {
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === editTask.id
                          ? {
                              ...t,
                              _count: {
                                ...(t._count || {}),
                                subtasks: total,
                                subtasksDone: done,
                              },
                            }
                          : t,
                      ),
                    );
                  }}
                />
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
                          </div>
                        </SelectItem>
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
                        <SelectItem key={p} value={p}>
                          <PriorityPill priority={p} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fällig am</Label>
                  <DatePicker value={formDueDate} onChange={setFormDueDate} placeholder="Kein Datum" />
                  <div className="pt-1">
                    <RecurrencePicker value={formRecurrence} onChange={setFormRecurrence} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Zugewiesen an</Label>
                  <Select
                    value={formAssigneeId}
                    onValueChange={(v) => {
                      setFormAssigneeId(v);
                      const m = members.find((mem) => mem.id === v);
                      if (m?.role === "CLIENT") setFormClientVisible(true);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Niemand</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <span className="flex items-center gap-2">
                            {m.name || m.email}
                            {m.role === "CLIENT" && (
                              <span className="text-meta text-muted-foreground">(Kunde)</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Hint when a client is selected */}
                  {(() => {
                    const assignee = members.find((m) => m.id === formAssigneeId);
                    return assignee?.role === "CLIENT" ? (
                      <p className="flex items-center gap-1.5 text-xs text-warning">
                        <ClipboardCheck className="h-3 w-3 shrink-0" />
                        Speichern startet die Kunden-Abnahme
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="clientVisible" checked={formClientVisible}
                  onChange={(e) => setFormClientVisible(e.target.checked)} className="rounded-sm" />
                <Label htmlFor="clientVisible">Für Kunden sichtbar</Label>
              </div>
              {editTask && <div className="border-t pt-4"><TimeEntriesSection taskId={editTask.id} onUpdate={fetchTasks} isClient={isClient} /></div>}

              {/* Approval status panel visible to staff */}
              {editTask?.approvalStatus && (
                <div className={cn(
                  "rounded-lg border p-3 space-y-2",
                  editTask.approvalStatus === "PENDING" && "border-warning/30 bg-warning/5",
                  editTask.approvalStatus === "APPROVED" && "border-success/30 bg-success/5",
                  editTask.approvalStatus === "REJECTED" && "border-destructive/30 bg-destructive/5"
                )}>
                  <p className="text-caption font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                    <ClipboardCheck className="h-3 w-3" />Abnahme-Status
                  </p>
                  <ApprovalBadge status={editTask.approvalStatus as string} />
                  {editTask.handoffComment && (
                    <div>
                      <p className="text-meta text-muted-foreground mb-0.5">Übergabe-Nachricht</p>
                      <p className="text-xs whitespace-pre-wrap">{editTask.handoffComment}</p>
                    </div>
                  )}
                  {editTask.approvalComment && (
                    <div>
                      <p className="text-meta text-muted-foreground mb-0.5">Kunden-Kommentar</p>
                      <p className="text-xs whitespace-pre-wrap">{editTask.approvalComment}</p>
                    </div>
                  )}
                  {/* Team can resubmit after a rejection */}
                  {editTask.approvalStatus === "REJECTED" && (
                    <div className="space-y-2 pt-1">
                      <Textarea
                        placeholder="Kurze Notiz zu den Änderungen (optional)"
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        onClick={resubmitApproval}
                        disabled={approvalSubmitting}
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Erneut zur Abnahme einreichen
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Verknüpfungen sind vorübergehend ausgeblendet */}
              <DialogFooter>
                {editTask && <Button type="button" variant="destructive" onClick={() => deleteTask(editTask.id)}>Löschen</Button>}
                <Button type="submit" disabled={formSubmitting || !formTitle.trim()}>{editTask ? "Speichern" : "Erstellen"}</Button>
              </DialogFooter>
            </form>
          )}

          {editTask && detailTab === "comments" && (
            <CommentsSection taskId={editTask.id} members={members} currentUserId={currentUserId} />
          )}
          {editTask && detailTab === "files" && (
            <FilesSection taskId={editTask.id} isClient={isClient} canUpload={!isClient || canClientInteract} />
          )}
          {editTask && detailTab === "activity" && (
            <ActivityTimeline taskId={editTask.id} statuses={statuses} members={members} />
          )}
        </DialogContent>
      </Dialog>

      {/* Column Dialog */}
      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editColumn ? "Spalte bearbeiten" : "Neue Spalte"}</DialogTitle></DialogHeader>
          <form onSubmit={saveColumn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="colName">Name</Label>
              <Input id="colName" value={colName} onChange={(e) => setColName(e.target.value)} required placeholder="z.B. QA, Staging..." />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setColColor(c)}
                    className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      colColor === c ? "border-foreground scale-110" : "border-transparent"
                    )} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            {/* Approval toggle */}
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5 text-warning" />
                  Abnahme-Spalte
                </Label>
                <p className="text-caption text-muted-foreground leading-snug">
                  Tasks müssen vom Kunden genehmigt werden, bevor sie in diese Spalte verschoben werden können.
                </p>
              </div>
              <Switch checked={colIsApproval} onCheckedChange={setColIsApproval} />
            </div>
            <DialogFooter><Button type="submit" disabled={!colName.trim()}>{editColumn ? "Speichern" : "Erstellen"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Handoff Dialog — shown when staff moves task to approval column */}
      <Dialog open={handoffDialogOpen} onOpenChange={(o) => {
        if (!handoffSubmitting) {
          setHandoffDialogOpen(o);
          if (!o) setHandoffClientLocked(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-warning" />
              {handoffClientLocked ? "Zur Kunden-Abnahme übergeben" : "Übergabe an Kunden"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              {handoffClientLocked
                ? "Schreibe dem Kunden eine Nachricht dazu, was er prüfen oder abnehmen soll."
                : "Schreibe eine Nachricht an den Kunden und weise den Task zu. Der Kunde kann den Task dann genehmigen oder ablehnen."}
            </p>

            {/* Client: locked display (from assignee selection) OR dropdown (from column drag) */}
            {handoffClientLocked ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Zugewiesen an</Label>
                <div className="flex items-center gap-2 rounded-sm border bg-muted/30 px-3 py-2">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-micro">
                      {getInitials(members.find((m) => m.id === handoffClientId)?.name || members.find((m) => m.id === handoffClientId)?.email || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">
                    {members.find((m) => m.id === handoffClientId)?.name || members.find((m) => m.id === handoffClientId)?.email}
                  </span>
                  <span className="ml-auto text-meta text-muted-foreground rounded-full border px-1.5 py-0.5">Kunde</span>
                </div>
              </div>
            ) : (
              members.filter((m) => m.role === "CLIENT").length > 0 && (
                <div className="space-y-2">
                  <Label>Kunden auswählen</Label>
                  <select
                    className="w-full rounded-sm border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={handoffClientId}
                    onChange={(e) => setHandoffClientId(e.target.value)}
                  >
                    <option value="">— Kein Kunde zuweisen —</option>
                    {members.filter((m) => m.role === "CLIENT").map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.email}</option>
                    ))}
                  </select>
                </div>
              )
            )}

            {/* Handoff message */}
            <div className="space-y-2">
              <Label>
                Übergabe-Nachricht <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={handoffMsg}
                onChange={(e) => setHandoffMsg(e.target.value)}
                placeholder="Was wurde umgesetzt? Was soll der Kunde prüfen? Gibt es besondere Hinweise?"
                rows={4}
                className="resize-none"
                autoFocus
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setHandoffDialogOpen(false); setHandoffClientLocked(false); }} disabled={handoffSubmitting}>
                Abbrechen
              </Button>
              <Button
                onClick={confirmHandoff}
                disabled={handoffSubmitting || !handoffMsg.trim()}
                className="gap-2"
              >
                {handoffSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                <ClipboardCheck className="h-4 w-4" />
                Übergabe starten
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Epic Dialog */}
      <Dialog open={epicDialogOpen} onOpenChange={setEpicDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editEpic ? "Epic bearbeiten" : "Neues Epic"}</DialogTitle></DialogHeader>
          <form onSubmit={saveEpic} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="epicTitle">Titel</Label>
              <Input id="epicTitle" value={epicTitle} onChange={(e) => setEpicTitle(e.target.value)} required placeholder="z.B. User Authentication, Dashboard..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epicDesc">Beschreibung</Label>
              <Textarea id="epicDesc" value={epicDescription} onChange={(e) => setEpicDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Farbe</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setEpicColor(c)}
                    className={cn("h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      epicColor === c ? "border-foreground scale-110" : "border-transparent"
                    )} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <DialogFooter>
              {editEpic && <Button type="button" variant="destructive" onClick={() => deleteEpic(editEpic)}>Löschen</Button>}
              <Button type="submit" disabled={!epicTitle.trim()}>{editEpic ? "Speichern" : "Erstellen"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Task verknüpfen</DialogTitle></DialogHeader>
          <form onSubmit={saveLink} className="space-y-4">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LINK_TYPES.map((lt) => (<SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ziel-Task</Label>
              <Select value={linkTargetId} onValueChange={setLinkTargetId}>
                <SelectTrigger><SelectValue placeholder="Task auswählen..." /></SelectTrigger>
                <SelectContent>
                  {tasks.filter((t) => t.id !== linkSourceId).map((t) => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={!linkTargetId}>Verknüpfen</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Floating bulk-action toolbar — appears when tasks are selected */}
      {!isClient && (
        <BulkToolbar
          count={selection.selectedCount}
          statuses={statuses}
          members={members}
          onSetStatus={(s) => bulkPatch({ status: s })}
          onSetPriority={(p) => bulkPatch({ priority: p })}
          onSetAssignee={(a) => bulkPatch({ assigneeId: a })}
          onDelete={bulkDelete}
          onClear={selection.clear}
        />
      )}
    </div>
  );
}
