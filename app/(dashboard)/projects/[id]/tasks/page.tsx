"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Hourglass,
  Lock,
  Filter,
  Search,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import { cn, formatDate, getPriorityColor, getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  TimerButton,
  formatDurationShort,
  formatDuration,
} from "@/components/time-tracker";
import { useGlobalTimer } from "@/components/global-timer";
import { useOptimisticTasks } from "@/hooks/use-optimistic-tasks";
import { toast } from "@/hooks/use-toast";

// --- Types ---

interface TaskStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isApproval: boolean;
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

interface TimeEntryInfo {
  id: string;
  duration: number;
  startedAt: string;
  stoppedAt: string | null;
  userId: string;
}

interface TaskComment {
  id: string;
  content: string;
  authorId: string;
  author: { id: string; name: string; email: string; image?: string; role?: string };
  mentions: string;
  createdAt: string;
}

interface TaskActivity {
  id: string;
  type: string;
  userId: string;
  user: { id: string; name: string; email: string; image?: string };
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: string | null;
  createdAt: string;
}

interface TaskFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: { id: string; name: string; email: string };
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  clientVisible: boolean;
  dueDate?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  assigneeId?: string | null;
  epic?: { id: string; title: string; color: string } | null;
  epicId?: string | null;
  sourceLinks?: TaskLinkInfo[];
  targetLinks?: TaskLinkInfo[];
  timeEntries?: TimeEntryInfo[];
  totalTime?: number;
  activeEntry?: TimeEntryInfo | null;
  order?: number;
  // Approval workflow
  approvalStatus?: string | null;
  handoffComment?: string | null;
  approvalComment?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  _isPreview?: boolean;
  [key: string]: unknown;
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

const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "hat den Task erstellt",
  STATUS_CHANGE: "hat den Status geändert",
  PRIORITY_CHANGE: "hat die Priorität geändert",
  ASSIGNMENT: "hat die Zuweisung geändert",
  COMMENT: "hat kommentiert",
  FILE_UPLOAD: "hat eine Datei hochgeladen",
  TIME_ENTRY: "hat Zeit erfasst",
  APPROVAL_APPROVED: "hat den Task genehmigt",
  APPROVAL_REJECTED: "hat den Task abgelehnt",
};

// --- Priority colors for table pills ---
function getPriorityPillStyle(priority: string) {
  switch (priority) {
    case "URGENT": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "HIGH": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "LOW": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default: return "bg-muted text-muted-foreground";
  }
}

// --- Approval status badge ---
function ApprovalBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  if (status === "PENDING") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
      <Hourglass className="h-2.5 w-2.5" />Abnahme ausstehend
    </span>
  );
  if (status === "APPROVED") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
      <ThumbsUp className="h-2.5 w-2.5" />Abgenommen
    </span>
  );
  if (status === "REJECTED") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
      <ThumbsDown className="h-2.5 w-2.5" />Abgelehnt
    </span>
  );
  return null;
}

// --- Inline title editor (double-click to edit) ---

function InlineTitle({
  value,
  onSave,
  disabled,
  className,
  inputClassName,
}: {
  value: string;
  onSave: (title: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleDoubleClick(e: React.MouseEvent) {
    if (disabled) return;
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        className={cn(
          "w-full rounded bg-accent/60 px-1 -mx-1 outline-none ring-1 ring-primary/40",
          inputClassName
        )}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={cn(disabled ? "" : "cursor-text select-text", className)}
      onDoubleClick={handleDoubleClick}
      title={disabled ? undefined : "Doppelklick zum Bearbeiten"}
    >
      {value}
    </span>
  );
}


// --- Kanban Task Card (Asana-style with color accent) ---

function TaskCard({
  task,
  onClick,
  statuses,
  isTimerActive,
  timerElapsed,
  onTimerStart,
  onTimerStop,
  isClient,
  currentUserId,
  onUpdateTitle,
}: {
  task: Task;
  onClick: () => void;
  statuses: TaskStatus[];
  isTimerActive: boolean;
  timerElapsed: number;
  onTimerStart: (taskId: string) => void;
  onTimerStop: () => void;
  isClient: boolean;
  currentUserId?: string;
  onUpdateTitle?: (id: string, title: string) => void;
}) {
  const isAssignedToClient = isClient && task.assigneeId === currentUserId;
  const isGreyedOut = isClient && !isAssignedToClient;
  const statusInfo = statuses.find((s) => s.id === task.status);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isClient });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const totalTime = task.totalTime || 0;

  // Preview card — shown to clients for tasks they can't see details of
  if (task._isPreview) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 opacity-40 select-none">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground truncate">{task.title}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isClient ? {} : { ...attributes, ...listeners })}
      className={cn(!isClient && "touch-none")}
    >
      <div
        className={cn(
          "card-hover group rounded-lg border bg-card shadow-sm",
          !isClient && "cursor-grab active:cursor-grabbing",
          isClient && "cursor-pointer",
          task.approvalStatus === "PENDING" && "border-warning/40",
          task.approvalStatus === "APPROVED" && "border-success/40",
          task.approvalStatus === "REJECTED" && "border-destructive/40",
          isTimerActive && "ring-2 ring-primary/30 border-primary/40",
          isGreyedOut && "opacity-50"
        )}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("[data-no-click]")) {
            onClick();
          }
        }}
      >
        {/* Color accent bar */}
        {task.epic && (
          <div
            className="h-1 rounded-t-lg"
            style={{ backgroundColor: task.epic.color }}
          />
        )}

        <div className="p-3 space-y-2.5">
          {/* Epic tag */}
          {task.epic && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {task.epic.title}
            </span>
          )}

          {/* Title — double-click to edit inline */}
          <div className="text-[13px] font-medium leading-snug" data-no-click="">
            <InlineTitle
              value={task.title}
              onSave={(t) => onUpdateTitle?.(task.id, t)}
              disabled={isClient || !onUpdateTitle}
              inputClassName="text-[13px] font-medium leading-snug"
            />
          </div>

          {/* Approval badge */}
          {task.approvalStatus && (
            <div><ApprovalBadge status={task.approvalStatus as string} /></div>
          )}

          {/* Description */}
          {task.description && (
            <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {task.dueDate && (() => {
              const overdue = new Date(task.dueDate) < new Date();
              return (
                <span className={cn(
                  "flex items-center gap-1 text-[11px]",
                  overdue ? "text-red-400 font-medium" : "text-muted-foreground"
                )}>
                  {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                  {formatDate(task.dueDate)}
                </span>
              );
            })()}
            {totalTime > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDurationShort(totalTime)}
              </span>
            )}
          </div>

          {/* Bottom row: avatar, priority, timer */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2">
              {task.assignee && (
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className="text-[9px] font-semibold">
                    {getInitials(task.assignee.name || task.assignee.email)}
                  </AvatarFallback>
                </Avatar>
              )}
              <span className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                getPriorityPillStyle(task.priority)
              )}>
                {PRIORITY_LABELS[task.priority] || task.priority}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {task.clientVisible && (
                <Eye className="h-3 w-3 text-muted-foreground" />
              )}
              {!isClient && (
                <span data-no-click>
                  <TimerButton
                    taskId={task.id}
                    isActive={isTimerActive}
                    elapsed={timerElapsed}
                    totalTime={totalTime}
                    onStart={onTimerStart}
                    onStop={onTimerStop}
                    size="sm"
                  />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Droppable Column (Asana-style) ---

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
  activeTimerTaskId,
  timerElapsed,
  onTimerStart,
  onTimerStop,
  currentUserId,
  onUpdateTitle,
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
  activeTimerTaskId: string | null;
  timerElapsed: number;
  onTimerStart: (taskId: string) => void;
  onTimerStop: () => void;
  currentUserId?: string;
  onUpdateTitle?: (id: string, title: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status.id });
  const columnTotalTime = tasks.reduce((sum, t) => sum + (t.totalTime || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[280px] max-w-[320px] flex-col rounded-lg transition-colors",
        isOver ? "bg-primary/5" : "bg-transparent"
      )}
    >
      {/* Column header with color bar */}
      <div className="mb-2">
        <div className="h-[3px] rounded-full" style={{ backgroundColor: status.color }} />
        <div className="flex items-center justify-between px-1 pt-2.5 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {status.name}
            </span>
            {status.isApproval && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold text-warning uppercase tracking-wide">
                <ClipboardCheck className="h-2.5 w-2.5" />Abnahme
              </span>
            )}
            <span className="text-xs text-muted-foreground font-medium">
              {tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {columnTotalTime > 0 && (
              <span className="mr-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDurationShort(columnTotalTime)}
              </span>
            )}
            {!isClient && (
              <>
                <button
                  onClick={() => onAddTask(status.id)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEditColumn(status)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Bearbeiten
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 px-0.5 pb-2" style={{ minHeight: 40 }}>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                statuses={statuses}
                isTimerActive={activeTimerTaskId === task.id}
                timerElapsed={activeTimerTaskId === task.id ? timerElapsed : 0}
                onTimerStart={onTimerStart}
                onTimerStop={onTimerStop}
                isClient={isClient}
                currentUserId={currentUserId}
                onUpdateTitle={onUpdateTitle}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>

      {/* Add task footer */}
      {!isClient && (
        <button
          onClick={() => onAddTask(status.id)}
          className="mx-0.5 mb-1 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>Task hinzufügen</span>
        </button>
      )}
    </div>
  );
}

// --- Time Entries Section ---

function TimeEntryRow({
  entry,
  isClient,
  onDelete,
  onSave,
}: {
  entry: any;
  isClient: boolean;
  onDelete: (id: string) => void;
  onSave: (id: string, data: { hours: number; minutes: number; date: string; description: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isRunning = !entry.stoppedAt;
  const startDate = new Date(entry.startedAt);

  const initHours = Math.floor(entry.duration / 3600);
  const initMinutes = Math.floor((entry.duration % 3600) / 60);
  const initDate = startDate.toISOString().slice(0, 10);

  const [editHours, setEditHours] = useState(initHours);
  const [editMinutes, setEditMinutes] = useState(initMinutes);
  const [editDate, setEditDate] = useState(initDate);
  const [editDesc, setEditDesc] = useState(entry.description ?? "");

  if (editing) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Datum</Label>
            <DatePicker value={editDate} onChange={setEditDate} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Dauer</Label>
            <div className="flex items-center gap-1">
              <Input type="number" min={0} max={99} value={editHours}
                onChange={(e) => setEditHours(Number(e.target.value))}
                className="h-9 w-14 text-center text-sm" />
              <span className="text-muted-foreground text-xs">h</span>
              <Input type="number" min={0} max={59} value={editMinutes}
                onChange={(e) => setEditMinutes(Number(e.target.value))}
                className="h-9 w-14 text-center text-sm" />
              <span className="text-muted-foreground text-xs">min</span>
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Beschreibung</Label>
          <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
            className="h-8 text-sm" placeholder="Optionale Notiz" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs px-3" onClick={() => {
            onSave(entry.id, { hours: editHours, minutes: editMinutes, date: editDate, description: editDesc });
            setEditing(false);
          }}>Speichern</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={() => setEditing(false)}>Abbrechen</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "group flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors",
      isRunning && "border-primary/30 bg-primary/5"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {isRunning && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
        <span className="text-muted-foreground shrink-0">
          {startDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
        </span>
        {entry.user && (
          <span className="text-muted-foreground truncate">– {entry.user.name || entry.user.email}</span>
        )}
        {entry.description && (
          <span className="text-muted-foreground/60 truncate italic">{entry.description}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono font-semibold tabular-nums">
          {isRunning ? "läuft…" : formatDuration(entry.duration)}
        </span>
        {!isRunning && !isClient && (
          <>
            <button type="button" onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => onDelete(entry.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TimeEntriesSection({
  taskId,
  onUpdate,
  isClient,
}: {
  taskId: string;
  onUpdate: () => void;
  isClient: boolean;
}) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [addDate, setAddDate] = useState(todayStr);
  const [addHours, setAddHours] = useState(0);
  const [addMinutes, setAddMinutes] = useState(30);
  const [addDesc, setAddDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`/api/time-entries?taskId=${taskId}`);
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }, [taskId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function deleteEntry(id: string) {
    await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    fetchEntries();
    onUpdate();
  }

  async function saveEdit(id: string, data: { hours: number; minutes: number; date: string; description: string }) {
    const durationSec = data.hours * 3600 + data.minutes * 60;
    const startedAt = new Date(data.date + "T12:00:00");
    const stoppedAt = new Date(startedAt.getTime() + durationSec * 1000);
    await fetch(`/api/time-entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: startedAt.toISOString(),
        stoppedAt: stoppedAt.toISOString(),
        duration: durationSec,
        description: data.description,
      }),
    });
    fetchEntries();
    onUpdate();
  }

  async function addManualEntry() {
    const durationSec = addHours * 3600 + addMinutes * 60;
    if (durationSec === 0) return;
    setSaving(true);
    await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        manual: true,
        startedAt: new Date(addDate + "T12:00:00").toISOString(),
        duration: durationSec,
        description: addDesc.trim() || null,
      }),
    });
    setSaving(false);
    setAdding(false);
    setAddDate(todayStr);
    setAddHours(0);
    setAddMinutes(30);
    setAddDesc("");
    fetchEntries();
    onUpdate();
  }

  const totalSeconds = entries.reduce((sum, e) => {
    if (e.stoppedAt) return sum + e.duration;
    return sum + Math.floor((Date.now() - new Date(e.startedAt).getTime()) / 1000);
  }, 0);

  if (loading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Zeiterfassung
        </Label>
        <div className="flex items-center gap-3">
          {totalSeconds > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {formatDuration(totalSeconds)} gesamt
            </span>
          )}
          {!isClient && (
            <button type="button" onClick={() => setAdding(!adding)}
              className="flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="h-3 w-3" />Zeit hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Manual add form */}
      {adding && !isClient && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Datum</Label>
              <DatePicker value={addDate} onChange={setAddDate} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Dauer</Label>
              <div className="flex items-center gap-1">
                <Input type="number" min={0} max={99} value={addHours}
                  onChange={(e) => setAddHours(Number(e.target.value))}
                  className="h-9 w-14 text-center text-sm" />
                <span className="text-muted-foreground text-xs">h</span>
                <Input type="number" min={0} max={59} value={addMinutes}
                  onChange={(e) => setAddMinutes(Number(e.target.value))}
                  className="h-9 w-14 text-center text-sm" />
                <span className="text-muted-foreground text-xs">min</span>
              </div>
            </div>
          </div>
          <Input value={addDesc} onChange={(e) => setAddDesc(e.target.value)}
            className="h-8 text-sm" placeholder="Beschreibung (optional)" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs px-3"
              disabled={saving || (addHours === 0 && addMinutes === 0)}
              onClick={addManualEntry}>
              {saving ? "…" : "Eintragen"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      {entries.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground py-1">Noch keine Zeit erfasst</p>
      ) : (
        <div className="max-h-[220px] space-y-1 overflow-y-auto">
          {entries.map((entry: any) => (
            <TimeEntryRow key={entry.id} entry={entry} isClient={isClient}
              onDelete={deleteEntry} onSave={saveEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Comments Section ---

function CommentsSection({
  taskId, members, currentUserId,
}: {
  taskId: string;
  members: { id: string; name: string; email: string }[];
  currentUserId: string;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/comments`);
    if (res.ok) setComments(await res.json());
    setLoading(false);
  }, [taskId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comments]);

  function handleCommentChange(value: string) {
    setNewComment(value);
    const lastAtPos = value.lastIndexOf("@");
    if (lastAtPos !== -1) {
      const afterAt = value.substring(lastAtPos + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
        return;
      }
    }
    setShowMentions(false);
  }

  function insertMention(member: { id: string; name: string; email: string }) {
    const lastAtPos = newComment.lastIndexOf("@");
    const before = newComment.substring(0, lastAtPos);
    const displayName = member.name || member.email;
    setNewComment(`${before}@${displayName} `);
    setShowMentions(false);
    textareaRef.current?.focus();
  }

  async function handleSubmit() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    const mentionedIds: string[] = [];
    for (const m of members) {
      const displayName = m.name || m.email;
      if (newComment.includes(`@${displayName}`)) mentionedIds.push(m.id);
    }
    try {
      await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim(), mentions: mentionedIds }),
      });
      setNewComment("");
      fetchComments();
    } finally { setSubmitting(false); }
  }

  const filteredMembers = members.filter((m) => {
    const name = (m.name || m.email).toLowerCase();
    return name.includes(mentionFilter);
  });

  function renderCommentContent(content: string) {
    const parts = content.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return <span key={i} className="rounded bg-primary/10 px-1 py-0.5 font-medium text-primary">{part}</span>;
      }
      return part;
    });
  }

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="max-h-[250px] space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-12 w-full rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Noch keine Kommentare" compact />
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="text-[9px]">{getInitials(comment.author.name || comment.author.email)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{comment.author.name || comment.author.email}</span>
                  {comment.author.role === "CLIENT" && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Kunde</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
                  {renderCommentContent(comment.content)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => handleCommentChange(e.target.value)}
              placeholder="Kommentar schreiben... (@Name zum Erwähnen)"
              rows={2}
              className="pr-10 resize-none text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            />
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border bg-popover p-1 shadow-md z-10">
                {filteredMembers.map((m) => (
                  <button key={m.id} type="button" onClick={() => insertMention(m)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                    <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{getInitials(m.name || m.email)}</AvatarFallback></Avatar>
                    <span>{m.name || m.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting || !newComment.trim()} className="self-end h-9 px-3">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Files Section ---

function FilesSection({ taskId, isClient, canUpload }: { taskId: string; isClient: boolean; canUpload: boolean }) {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/files`);
    if (res.ok) setFiles(await res.json());
    setLoading(false);
  }, [taskId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) formData.append("files", selectedFiles[i]);
    try {
      await fetch(`/api/tasks/${taskId}/files`, { method: "POST", body: formData });
      fetchFiles();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileId: string) {
    await fetch(`/api/tasks/${taskId}/files?fileId=${fileId}`, { method: "DELETE" });
    fetchFiles();
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-2">
      {canUpload && (
        <div>
          <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" id="task-file-upload" />
          <Button type="button" variant="outline" size="sm" className="h-8 w-full gap-2"
            onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Wird hochgeladen..." : "Datei hochladen"}
          </Button>
        </div>
      )}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <EmptyState icon={Paperclip} title="Noch keine Dateien" compact />
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.size)} - {file.uploadedBy.name || file.uploadedBy.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={`/api/files/${file.id}`} className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors" title="Herunterladen">
                  <Download className="h-3.5 w-3.5" />
                </a>
                {!isClient && (
                  <button type="button" onClick={() => handleDelete(file.id)} className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Activity Timeline ---

function ActivityTimeline({ taskId, statuses, members }: {
  taskId: string; statuses: TaskStatus[]; members: { id: string; name: string; email: string }[];
}) {
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}/activities`).then((r) => r.json())
      .then((data) => { setActivities(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [taskId]);

  function getStatusName(id: string) { return statuses.find((s) => s.id === id)?.name || id; }
  function getUserName(id: string) { const m = members.find((m) => m.id === id); return m?.name || m?.email || id; }

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-2">
          <div className="flex flex-col items-center">
            <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
          </div>
          <div className="flex-1 space-y-1.5 pb-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
  if (activities.length === 0) return <EmptyState icon={History} title="Keine Aktivitäten" compact />;

  return (
    <div className="max-h-[300px] overflow-y-auto space-y-0">
      {activities.map((activity, i) => (
        <div key={activity.id} className="flex gap-3 py-2.5">
          <div className="flex flex-col items-center">
            <div className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5",
              activity.type === "CREATED" ? "bg-green-500" :
              activity.type === "STATUS_CHANGE" ? "bg-blue-500" :
              activity.type === "COMMENT" ? "bg-yellow-500" :
              activity.type === "FILE_UPLOAD" ? "bg-purple-500" : "bg-muted-foreground/50"
            )} />
            {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xs font-semibold">{activity.user.name || activity.user.email}</span>
              <span className="text-xs text-muted-foreground">{ACTIVITY_LABELS[activity.type] || activity.type}</span>
            </div>
            {activity.type === "STATUS_CHANGE" && activity.oldValue && activity.newValue && (
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{getStatusName(activity.oldValue)}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{getStatusName(activity.newValue)}</Badge>
              </div>
            )}
            {activity.type === "PRIORITY_CHANGE" && activity.oldValue && activity.newValue && (
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                <span className={cn("font-medium", getPriorityColor(activity.oldValue))}>{PRIORITY_LABELS[activity.oldValue] || activity.oldValue}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className={cn("font-medium", getPriorityColor(activity.newValue))}>{PRIORITY_LABELS[activity.newValue] || activity.newValue}</span>
              </div>
            )}
            {activity.type === "ASSIGNMENT" && (
              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                <span className="text-muted-foreground">{activity.oldValue ? getUserName(activity.oldValue) : "Niemand"}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{activity.newValue ? getUserName(activity.newValue) : "Niemand"}</span>
              </div>
            )}
            {activity.type === "FILE_UPLOAD" && activity.newValue && (
              <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                <Paperclip className="h-3 w-3" />{activity.newValue}
              </div>
            )}
            {activity.type === "COMMENT" && activity.newValue && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">&ldquo;{activity.newValue}&rdquo;</p>
            )}
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {new Date(activity.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Page ---

export default function TasksPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const currentUserId = session?.user?.id || "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
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

  // --- Filter bar ---
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterEpicId, setFilterEpicId] = useState<string>("");
  const [filterDue, setFilterDue] = useState<"" | "overdue" | "today" | "week" | "none">("");

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
    Promise.all([fetchTasks(), fetchStatuses(), fetchEpics()]).then(() => setLoading(false));
    fetch(`/api/projects/${projectId}`).then((r) => r.json()).then((data) => {
      if (data.members) setMembers(data.members.map((m: any) => m.user));
    });
  }, [fetchTasks, fetchStatuses, fetchEpics, projectId]);

  useEffect(() => {
    setOnChange(() => fetchTasks);
    return () => setOnChange(null);
  }, [setOnChange, fetchTasks]);

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
    };
    try {
      if (editTask) {
        // Intercept: if status changed to an approval column, show handoff dialog
        const targetStatus = statuses.find((s) => s.id === formStatus);
        if (targetStatus?.isApproval && editTask.status !== formStatus && !editTask.approvalStatus) {
          setTaskDialogOpen(false);
          setEditTask(null);
          const clientMembers = members.filter((m) => m.role === "CLIENT");
          setPendingHandoffTaskId(editTask.id);
          setPendingHandoffStatusId(formStatus);
          setHandoffMsg("");
          setHandoffClientId(clientMembers[0]?.id || "");
          setHandoffDialogOpen(true);
          return;
        }
        // Close dialog immediately — optimistic update in background
        setTaskDialogOpen(false);
        setEditTask(null);
        await optimisticUpdate(editTask.id, patch);
      } else {
        // Create: close dialog, add optimistic placeholder
        setTaskDialogOpen(false);
        setEditTask(null);
        await optimisticCreate({ ...patch, projectId });
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

  // --- Drag & Drop ---
  function handleDragStart(event: DragStartEvent) { if (isClient) return; setActiveId(event.active.id as string); }
  function handleDragOver(event: DragOverEvent) { if (isClient) return; setOverId(event.over ? (event.over.id as string) : null); }

  async function handleDragEnd(event: DragEndEvent) {
    if (isClient) return;
    setActiveId(null); setOverId(null);
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

  // --- Filter helpers ---
  const activeFilterCount =
    (filterSearch ? 1 : 0) +
    filterAssignees.length +
    filterPriorities.length +
    (filterEpicId ? 1 : 0) +
    (filterDue ? 1 : 0);

  function clearFilters() {
    setFilterSearch("");
    setFilterAssignees([]);
    setFilterPriorities([]);
    setFilterEpicId("");
    setFilterDue("");
  }

  function toggleAssigneeFilter(id: string) {
    setFilterAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function togglePriorityFilter(p: string) {
    setFilterPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

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
        </div>

        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <Button
            variant={filterOpen || activeFilterCount > 0 ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground data-[active=true]:text-foreground"
            data-active={filterOpen || activeFilterCount > 0}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {!isClient && (
            <>
              {view === "kanban" && (
                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => openColumnDialog(null)}>
                  <Plus className="mr-1.5 h-4 w-4" />Spalte
                </Button>
              )}
              <Button size="sm" className="h-8 gap-1.5" onClick={() => openTaskDialog(null)}>
                <Plus className="h-4 w-4" />
                Task hinzufügen
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ===== Filter Bar ===== */}
      {filterOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Suchen..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="h-7 pl-8 w-44 text-xs"
            />
            {filterSearch && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setFilterSearch("")}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Assignee multi-select */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filterAssignees.length > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                {filterAssignees.length > 0
                  ? filterAssignees.length === 1
                    ? (members.find((m) => m.id === filterAssignees[0])?.name || "1 Person")
                    : `${filterAssignees.length} Personen`
                  : "Zugewiesen"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {members.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  className="flex items-center gap-2"
                  onClick={() => toggleAssigneeFilter(m.id)}
                >
                  <div className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    filterAssignees.includes(m.id) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                  )}>
                    {filterAssignees.includes(m.id) && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px]">{getInitials(m.name || m.email)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.name || m.email}</span>
                </DropdownMenuItem>
              ))}
              {filterAssignees.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterAssignees([])}>
                    <X className="mr-2 h-3.5 w-3.5" />Zurücksetzen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority multi-select */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={filterPriorities.length > 0 ? "secondary" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
              >
                <Filter className="h-3.5 w-3.5" />
                {filterPriorities.length > 0
                  ? filterPriorities.length === 1
                    ? PRIORITY_LABELS[filterPriorities[0]]
                    : `${filterPriorities.length} Prioritäten`
                  : "Priorität"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {PRIORITIES.map((p) => (
                <DropdownMenuItem
                  key={p}
                  className="flex items-center gap-2"
                  onClick={() => togglePriorityFilter(p)}
                >
                  <div className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    filterPriorities.includes(p) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                  )}>
                    {filterPriorities.includes(p) && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                  <span className={cn("text-xs font-medium", getPriorityColor(p))}>
                    {PRIORITY_LABELS[p]}
                  </span>
                </DropdownMenuItem>
              ))}
              {filterPriorities.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterPriorities([])}>
                    <X className="mr-2 h-3.5 w-3.5" />Zurücksetzen
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Epic filter */}
          {epics.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={filterEpicId ? "secondary" : "outline"}
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {filterEpicId
                    ? (epics.find((e) => e.id === filterEpicId)?.title || "Epic")
                    : "Epic"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {epics.map((epic) => (
                  <DropdownMenuItem
                    key={epic.id}
                    className="flex items-center gap-2"
                    onClick={() => setFilterEpicId(filterEpicId === epic.id ? "" : epic.id)}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: epic.color }}
                    />
                    <span className="truncate">{epic.title}</span>
                    {filterEpicId === epic.id && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
                {filterEpicId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFilterEpicId("")}>
                      <X className="mr-2 h-3.5 w-3.5" />Zurücksetzen
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Due date quick filters */}
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            {([
              { value: "", label: "Alle" },
              { value: "overdue", label: "Überfällig" },
              { value: "today", label: "Heute" },
              { value: "week", label: "Diese Woche" },
              { value: "none", label: "Kein Datum" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterDue(opt.value)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  filterDue === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Clear all — shown when any filter is active */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground ml-auto"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Alle zurücksetzen
            </Button>
          )}

          {/* Active count */}
          {activeFilterCount > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {filteredTasks.length} von {tasks.length} Tasks
            </span>
          )}
        </div>
      )}

      {/* Kanban View */}
      {view === "kanban" ? (
        <DndContext sensors={isClient ? [] : sensors} collisionDetection={closestCorners}
          onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {statuses.map((status) => {
              const colTasks = filteredTasks.filter((t) => t.status === status.id);
              return (
                <KanbanColumn key={status.id} status={status} tasks={colTasks}
                  onTaskClick={(task) => openTaskDialog(task)} onAddTask={(statusId) => openTaskDialog(null, statusId)}
                  onEditColumn={openColumnDialog} onDeleteColumn={deleteColumn} isClient={isClient} statuses={statuses}
                  isOver={overId === status.id} activeTimerTaskId={activeTimer?.taskId || null} timerElapsed={elapsed}
                  onTimerStart={handleTimerStart} onTimerStop={handleTimerStop} currentUserId={currentUserId}
                  onUpdateTitle={isClient ? undefined : handleUpdateTitle} />
              );
            })}
          </div>
          <DragOverlay>
            {activeTask && (
              <div className="w-[280px] rotate-2 rounded-lg border bg-card p-3 shadow-2xl">
                <div className="space-y-2">
                  {activeTask.epic && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{activeTask.epic.title}</span>
                  )}
                  <div className="text-sm font-medium">{activeTask.title}</div>
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", getPriorityPillStyle(activeTask.priority))}>
                    {PRIORITY_LABELS[activeTask.priority] || activeTask.priority}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* ===== LIST VIEW — Asana-style table grouped by status ===== */
        <div className="rounded-lg border">
          {/* Table header */}
          <div className="flex items-center border-b bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center border-b px-4 py-2.5 transition-colors hover:bg-accent/30 cursor-pointer group",
                        isTimerActive && "bg-primary/5",
                        isGreyedOut && "opacity-50"
                      )}
                      onClick={() => openTaskDialog(task)}
                    >
                      {/* Task name */}
                      <div className="flex-1 min-w-0 flex items-center gap-2.5">
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{task.title}</span>
                            {totalTime > 0 && (
                              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground shrink-0">
                                <Clock className="h-3 w-3" />{formatDurationShort(totalTime)}
                              </span>
                            )}
                          </div>
                          {task.epic && (
                            <span className="text-[10px] text-muted-foreground">{task.epic.title}</span>
                          )}
                        </div>
                      </div>

                      {/* Assignee */}
                      <div className="w-[140px] shrink-0">
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[9px] font-semibold">
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
                            <span className={cn("text-xs flex items-center gap-1", overdue ? "text-red-400 font-medium" : "text-muted-foreground")}>
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
                        <span className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          getPriorityPillStyle(task.priority)
                        )}>
                          {PRIORITY_LABELS[task.priority] || task.priority}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="w-[110px] shrink-0">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
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
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", getPriorityPillStyle(editTask.priority))}>
                        {PRIORITY_LABELS[editTask.priority] || editTask.priority}
                      </span>
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
                        <Avatar className="h-5 w-5"><AvatarFallback className="text-[9px]">{getInitials(editTask.assignee.name || editTask.assignee.email)}</AvatarFallback></Avatar>
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
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-warning flex items-center gap-1.5">
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
                    "text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5",
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
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", getPriorityPillStyle(p))}>
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
                  <Label>Fällig am</Label>
                  <DatePicker value={formDueDate} onChange={setFormDueDate} placeholder="Kein Datum" />
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
                  <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
                    <ClipboardCheck className="h-3 w-3" />Abnahme-Status
                  </p>
                  <ApprovalBadge status={editTask.approvalStatus as string} />
                  {editTask.handoffComment && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Übergabe-Nachricht</p>
                      <p className="text-xs whitespace-pre-wrap">{editTask.handoffComment}</p>
                    </div>
                  )}
                  {editTask.approvalComment && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Kunden-Kommentar</p>
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
                <p className="text-[11px] text-muted-foreground leading-snug">
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
      <Dialog open={handoffDialogOpen} onOpenChange={(o) => { if (!handoffSubmitting) setHandoffDialogOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-warning" />
              Übergabe an Kunden
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Schreibe eine Nachricht an den Kunden und weise den Task zu. Der Kunde erhält eine Benachrichtigung und kann den Task dann genehmigen oder ablehnen.
            </p>

            {/* Client selector */}
            {members.filter((m) => m.role === "CLIENT").length > 0 && (
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
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setHandoffDialogOpen(false)} disabled={handoffSubmitting}>
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
    </div>
  );
}
