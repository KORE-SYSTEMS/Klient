"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  List,
  LayoutGrid,
  CalendarDays,
  GanttChart,
  Layers,
  MessageSquare,
  Paperclip,
  FileText,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalTimer } from "@/components/global-timer";
import { useOptimisticTasks } from "@/hooks/use-optimistic-tasks";
import { toast } from "@/hooks/use-toast";
import type {
  Task,
  TaskStatus,
  Epic,
} from "./_lib/types";
import { kanbanCollision, getNextStatus } from "./_lib/dnd";
import { TaskCard } from "./_components/task-card";
import { KanbanColumn } from "./_components/kanban-column";
import { TaskFilters } from "./_components/task-filters";
import { BulkToolbar } from "./_components/bulk-toolbar";
import { SavedViewsMenu } from "./_components/saved-views-menu";
import { TemplatesMenu } from "./_components/templates-menu";
import { ImportExportMenu } from "./_components/import-export-menu";
import { CalendarView } from "./_components/calendar-view";
import { TimelineView } from "./_components/timeline-view";
import { ColumnDialog } from "./_components/column-dialog";
import { HandoffDialog } from "./_components/handoff-dialog";
import { ListView } from "./_components/list-view";
import { TaskDialog } from "./_components/task-dialog";
import { EpicDialog } from "./_components/epic-dialog";
import { LinkDialog } from "./_components/link-dialog";
import { useUrlFilters } from "./_lib/use-url-filters";
import { useSelection } from "./_lib/use-selection";
import { useSavedViews } from "./_lib/use-saved-views";
import { NEW_TASK_EVENT_NAME } from "@/components/keyboard-shortcut-overlay";
import { api, run } from "@/lib/api";
import { confirmDialog } from "@/components/confirm-dialog";

// --- Main Page ---

export default function TasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const search = useSearchParams();
  // `?import=true` kommt vom Projekt-Erstellen-Flow → öffnet direkt den
  // File-Picker des Import/Export-Menüs.
  const autoOpenImport = search.get("import") === "true";
  // `?task=<id>` öffnet direkt den Task-Dialog (Link aus My Day, Inbox, etc.)
  const autoOpenTaskId = search.get("task");
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const currentUserId = session?.user?.id || "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list" | "calendar" | "timeline">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
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
  const [formStartDate, setFormStartDate] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAssigneeId, setFormAssigneeId] = useState("none");
  const [formClientVisible, setFormClientVisible] = useState(false);
  const [formEpicId, setFormEpicId] = useState("none");
  const [formRecurrence, setFormRecurrence] = useState<string | null>(null);
  const [formSubtaskTitles, setFormSubtaskTitles] = useState<string[]>([]);
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

  const fetchMembers = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) return;
    const data: { members?: { user: { id: string; name: string; email: string; role?: string } }[] } = await res.json();
    if (data.members) setMembers(data.members.map((m) => m.user));
  }, [projectId]);

  useEffect(() => {
    // All four bootstraps in parallel; loading flips once the slowest finishes.
    Promise.all([fetchTasks(), fetchStatuses(), fetchEpics(), fetchMembers()])
      .finally(() => setLoading(false));
  }, [fetchTasks, fetchStatuses, fetchEpics, fetchMembers]);

  useEffect(() => {
    // Pass fetchTasks itself, not a wrapper — the timer's onChangeRef calls
    // current() expecting it to trigger the refetch (previously `() => fetchTasks`
    // stored a getter that returned the function without invoking it).
    setOnChange(fetchTasks);
    return () => setOnChange(null);
  }, [setOnChange, fetchTasks]);

  // Auto-open Task-Dialog wenn ?task=<id> in der URL (Link aus My Day, Inbox)
  useEffect(() => {
    if (!autoOpenTaskId || loading || taskDialogOpen) return;
    const target = tasks.find((t) => t.id === autoOpenTaskId);
    if (target) {
      openTaskDialog(target);
      // One-shot: drop the param so later task-list changes don't reopen this task
      const url = new URL(window.location.href);
      url.searchParams.delete("task");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenTaskId, loading, tasks.length]);

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
    await optimisticUpdate(taskId, { title });
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
    setFormStartDate(task?.startDate ? task.startDate.split("T")[0] : "");
    setFormDueDate(task?.dueDate ? task.dueDate.split("T")[0] : "");
    setFormAssigneeId(task?.assigneeId || "none");
    setFormClientVisible(task?.clientVisible || false);
    setFormEpicId(task?.epicId || "none");
    setFormRecurrence(task?.recurrenceRule ?? null);
    setFormSubtaskTitles([]);
    setDetailTab(isClient && task ? "comments" : "details");
    setTaskDialogOpen(true);
  }

  async function saveTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormSubmitting(true);
    const patch: any = {
      title: formTitle, description: formDescription || "", priority: formPriority, status: formStatus,
      clientVisible: formClientVisible, startDate: formStartDate || null, dueDate: formDueDate || null,
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
        const created = await optimisticCreate({
          ...patch,
          projectId,
          ...(isAssigningToClient && {
            clientVisible: true,
            approvalStatus: "PENDING",
          }),
        });
        // Create subtasks if any were added during creation
        const subtitles = formSubtaskTitles.filter((t) => t.trim());
        if (created?.id && subtitles.length > 0) {
          await Promise.all(
            subtitles.map((st) =>
              run(
                api("/api/tasks", {
                  method: "POST",
                  body: {
                    title: st.trim(),
                    projectId,
                    status: formStatus,
                    priority: "MEDIUM",
                    parentId: created.id,
                  },
                }),
                { error: `Subtask „${st.trim()}“ konnte nicht erstellt werden` },
              ),
            ),
          );
          fetchTasks();
        }
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
    const colBody = { name: colName, color: colColor, isApproval: colIsApproval };
    const saved = await run(
      editColumn
        ? api(`/api/projects/${projectId}/statuses/${editColumn.id}`, { method: "PATCH", body: colBody })
        : api(`/api/projects/${projectId}/statuses`, { method: "POST", body: colBody }),
      { error: "Spalte konnte nicht gespeichert werden" },
    );
    if (saved === null) return;
    setColumnDialogOpen(false); setEditColumn(null); fetchStatuses();
  }

  async function deleteColumn(status: TaskStatus) {
    const tasksInColumn = tasks.filter((t) => t.status === status.id);
    if (tasksInColumn.length > 0) { toast({ title: "Spalte nicht leer", description: `„${status.name}“ hat noch ${tasksInColumn.length} Task(s). Verschiebe die Tasks zuerst.`, variant: "destructive" }); return; }
    const ok = await run(
      api(`/api/projects/${projectId}/statuses/${status.id}`, { method: "DELETE" }),
      { error: "Spalte konnte nicht gelöscht werden" },
    );
    if (ok === null) return;
    fetchStatuses();
  }

  // --- Epic CRUD ---
  function openEpicDialog(epic: Epic | null) {
    setEditEpic(epic); setEpicTitle(epic?.title || ""); setEpicDescription(epic?.description || ""); setEpicColor(epic?.color || "#6366f1"); setEpicDialogOpen(true);
  }

  async function saveEpic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const epicBody = { title: epicTitle, description: epicDescription, color: epicColor };
    const saved = await run(
      editEpic
        ? api(`/api/projects/${projectId}/epics/${editEpic.id}`, { method: "PATCH", body: epicBody })
        : api(`/api/projects/${projectId}/epics`, { method: "POST", body: epicBody }),
      { error: "Epic konnte nicht gespeichert werden" },
    );
    if (saved === null) return;
    setEpicDialogOpen(false); setEditEpic(null); fetchEpics(); fetchTasks();
  }

  async function deleteEpic(epic: Epic) {
    const ok = await run(
      api(`/api/projects/${projectId}/epics/${epic.id}`, { method: "DELETE" }),
      { error: "Epic konnte nicht gelöscht werden" },
    );
    if (ok === null) return;
    setEpicDialogOpen(false); setEditEpic(null); fetchEpics(); fetchTasks();
  }

  // --- Task Links ---
  function openLinkDialog(taskId: string) { setLinkSourceId(taskId); setLinkTargetId(""); setLinkType("RELATED"); setLinkDialogOpen(true); }

  async function saveLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const saved = await run(
      api("/api/task-links", { method: "POST", body: { sourceTaskId: linkSourceId, targetTaskId: linkTargetId, type: linkType } }),
      { error: "Verknüpfung konnte nicht erstellt werden" },
    );
    if (saved === null) return;
    setLinkDialogOpen(false); fetchTasks();
  }

  async function deleteLink(linkId: string) {
    const ok = await run(
      api(`/api/task-links/${linkId}`, { method: "DELETE" }),
      { error: "Verknüpfung konnte nicht gelöscht werden" },
    );
    if (ok === null) return;
    fetchTasks();
  }

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
    await optimisticUpdate(task.id, { status: next.id });
  }

  // --- Drag & Drop ---
  function handleDragStart(event: DragStartEvent) {
    if (isClient) return;
    setActiveId(event.active.id as string);
    const rect = event.active.rect.current.initial;
    setActiveWidth(rect ? rect.width : null);
    setActiveHeight(rect ? rect.height : null);
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
    setActiveId(null); setOverId(null); setActiveWidth(null); setActiveHeight(null);
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
        await optimisticUpdate(taskId, { status: targetColumn.id });
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
        await optimisticUpdate(taskId, { status: targetTask.status });
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
      const handedOff = await run(
        api(`/api/tasks/${pendingHandoffTaskId}`, {
          method: "PATCH",
          body: {
            status: pendingHandoffStatusId,
            handoffComment: handoffMsg.trim(),
            assigneeId: handoffClientId || null,
            approvalStatus: "PENDING",
            clientVisible: true,
          },
        }),
        { error: "Übergabe konnte nicht gesendet werden" },
      );
      if (handedOff !== null) {
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
      const updated = await run(
        api<Partial<Task>>(`/api/tasks/${editTask.id}/approve`, {
          method: "POST",
          body: { decision, comment: approvalComment.trim() || undefined },
        }),
        { error: "Entscheidung konnte nicht gespeichert werden" },
      );
      if (updated) {
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
  const doneStatusIds = useMemo(
    () => new Set(statuses.filter((s) => s.category === "DONE").map((s) => s.id)),
    [statuses],
  );
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
    if (!(await confirmDialog({ title: `${ids.length} ${ids.length === 1 ? "Task" : "Tasks"} löschen?` }))) return;
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
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                view === "timeline" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setView("timeline")}
            >
              <GanttChart className="h-4 w-4" />
              Timeline
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

      {/* Timeline / Gantt View */}
      {view === "timeline" ? (
        <TimelineView
          tasks={filteredTasks}
          epics={epics}
          isClient={isClient}
          onTaskClick={(t) => openTaskDialog(t)}
          onDateChange={async (taskId, startDate, dueDate) => {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      startDate: startDate ? new Date(startDate + "T12:00:00").toISOString() : null,
                      dueDate: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : null,
                    }
                  : t,
              ),
            );
            try {
              await api(`/api/tasks/${taskId}`, {
                method: "PATCH",
                body: {
                  startDate: startDate ? new Date(startDate + "T12:00:00").toISOString() : null,
                  dueDate: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : null,
                },
              });
            } catch {
              fetchTasks();
            }
          }}
        />
      ) : view === "calendar" ? (
        <CalendarView
          tasks={filteredTasks}
          isClient={isClient}
          doneStatusIds={doneStatusIds}
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
                  selectionActive={selection.selectedCount > 0}
                  dragHeight={activeHeight ?? undefined} />
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div style={{ width: activeWidth ?? undefined }}>
                <TaskCard
                  task={activeTask}
                  statuses={statuses}
                  isTimerActive={false}
                  timerElapsed={0}
                  onTimerStart={() => {}}
                  onTimerStop={() => {}}
                  isClient={isClient}
                  currentUserId={currentUserId}
                  isOverlay
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <ListView
          statusGroups={statusGroups}
          totalTaskCount={tasks.length}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroupCollapse}
          isClient={isClient}
          currentUserId={currentUserId}
          activeTimerTaskId={activeTimer?.taskId || null}
          elapsed={elapsed}
          selection={selection}
          onSelect={handleSelect}
          onTaskClick={(t) => openTaskDialog(t)}
          onAddTask={(statusId) => openTaskDialog(null, statusId)}
          onTimerStart={handleTimerStart}
          onTimerStop={handleTimerStop}
        />
      )}

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        editTask={editTask}
        isClient={isClient}
        isCreateMode={isCreateMode}
        isEditMode={isEditMode}
        isClientViewingTask={isClientViewingTask}
        canClientInteract={canClientInteract}
        currentUserId={currentUserId}
        projectId={projectId}
        statuses={statuses}
        epics={epics}
        members={members}
        tasks={tasks}
        setTasks={setTasks}
        fetchTasks={fetchTasks}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        dialogTabs={dialogTabs}
        saveTask={saveTask}
        deleteTask={deleteTask}
        handleNextPhase={handleNextPhase}
        openTaskDialog={openTaskDialog}
        getStatusInfo={getStatusInfo}
        formSubmitting={formSubmitting}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formDescription={formDescription}
        setFormDescription={setFormDescription}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        formPriority={formPriority}
        setFormPriority={setFormPriority}
        formStartDate={formStartDate}
        setFormStartDate={setFormStartDate}
        formDueDate={formDueDate}
        setFormDueDate={setFormDueDate}
        formAssigneeId={formAssigneeId}
        setFormAssigneeId={setFormAssigneeId}
        formClientVisible={formClientVisible}
        setFormClientVisible={setFormClientVisible}
        formEpicId={formEpicId}
        setFormEpicId={setFormEpicId}
        formRecurrence={formRecurrence}
        setFormRecurrence={setFormRecurrence}
        formSubtaskTitles={formSubtaskTitles}
        setFormSubtaskTitles={setFormSubtaskTitles}
        approvalComment={approvalComment}
        setApprovalComment={setApprovalComment}
        approvalSubmitting={approvalSubmitting}
        submitApproval={submitApproval}
        resubmitApproval={resubmitApproval}
        activeTimer={activeTimer}
        elapsed={elapsed}
        handleTimerStart={handleTimerStart}
        handleTimerStop={handleTimerStop}
      />

      {/* Column Dialog */}
      <ColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        editColumn={editColumn}
        name={colName}
        setName={setColName}
        color={colColor}
        setColor={setColColor}
        isApproval={colIsApproval}
        setIsApproval={setColIsApproval}
        onSubmit={saveColumn}
      />

      <HandoffDialog
        open={handoffDialogOpen}
        onOpenChange={setHandoffDialogOpen}
        members={members}
        message={handoffMsg}
        setMessage={setHandoffMsg}
        clientId={handoffClientId}
        setClientId={setHandoffClientId}
        clientLocked={handoffClientLocked}
        setClientLocked={setHandoffClientLocked}
        submitting={handoffSubmitting}
        onConfirm={confirmHandoff}
      />

      {/* Epic Dialog */}
      <EpicDialog
        open={epicDialogOpen}
        onOpenChange={setEpicDialogOpen}
        editEpic={editEpic}
        title={epicTitle}
        setTitle={setEpicTitle}
        description={epicDescription}
        setDescription={setEpicDescription}
        color={epicColor}
        setColor={setEpicColor}
        onSubmit={saveEpic}
        onDelete={deleteEpic}
      />

      {/* Link Dialog */}
      <LinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        sourceTaskId={linkSourceId}
        type={linkType}
        setType={setLinkType}
        targetId={linkTargetId}
        setTargetId={setLinkTargetId}
        tasks={tasks}
        onSubmit={saveLink}
      />

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
