"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PriorityPill } from "@/components/task/priority-pill";
import { ApprovalBadge } from "@/components/task/approval-badge";
import { TimerButton, formatDurationShort } from "@/components/time-tracker";
import { InlineTitle } from "./inline-title";
import { getNextStatus } from "../_lib/dnd";
import type { Task, TaskStatus } from "../_lib/types";

interface TaskCardProps {
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
  onNextPhase?: (task: Task) => void;
  /** When true, card shows a selected ring + tinted background. */
  selected?: boolean;
  /** Cmd/Ctrl-click toggles selection; shift-click extends range. */
  onSelect?: (taskId: string, mode: "toggle" | "range") => void;
  /** Whether multi-select mode is active (changes plain-click behavior?). */
  selectionActive?: boolean;
}

/**
 * Sortable kanban card. The visible content while dragging is rendered by the
 * <DragOverlay> in the parent — this card swaps to a dashed placeholder so the
 * drop slot is obvious.
 */
export function TaskCard({
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
  onNextPhase,
  selected,
  onSelect,
  selectionActive,
}: TaskCardProps) {
  const isAssignedToClient = isClient && task.assigneeId === currentUserId;
  const isGreyedOut = isClient && !isAssignedToClient;
  const statusInfo = statuses.find((s) => s.id === task.status);
  const nextStatus = getNextStatus(task.status, statuses);
  const isDone = statusInfo?.category === "DONE";

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
  };

  const totalTime = task.totalTime || 0;

  if (isDragging && !task._isPreview) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 h-[88px]" />
      </div>
    );
  }

  // Preview card — shown to clients for tasks they can't see details of
  if (task._isPreview) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-3 opacity-40 select-none">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">{task.title}</span>
          </div>
        </div>
      </div>
    );
  }

  const checkTotal = task._count?.checklistItems ?? 0;
  const checkDone = task._count?.checklistDone ?? 0;
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isClient ? {} : { ...attributes, ...listeners })}
      className={cn(!isClient && "touch-none", "outline-none")}
    >
      <div
        className={cn(
          "group rounded-xl border bg-card",
          !isClient && "cursor-grab active:cursor-grabbing",
          isClient && "cursor-pointer",
          isTimerActive && "ring-2 ring-primary/30",
          selected && "ring-2 ring-primary border-primary bg-primary/5",
          isGreyedOut && "opacity-50",
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-click]")) return;
          // Modifier-click → multi-select instead of opening dialog
          if (!isClient && onSelect) {
            const meta = e.metaKey || e.ctrlKey;
            const shift = e.shiftKey;
            if (meta) { e.preventDefault(); onSelect(task.id, "toggle"); return; }
            if (shift) { e.preventDefault(); onSelect(task.id, "range"); return; }
            // While selection is active, plain click also toggles — opening
            // the dialog would lose the ongoing bulk operation.
            if (selectionActive) { e.preventDefault(); onSelect(task.id, "toggle"); return; }
          }
          onClick();
        }}
      >
        <div className="p-3.5 space-y-3">
          {/* Title */}
          <div
            className={cn(
              "task-title-text text-sm font-semibold leading-snug",
              isDone && "line-through text-muted-foreground",
            )}
            data-no-click=""
          >
            <InlineTitle
              value={task.title}
              onSave={(t) => onUpdateTitle?.(task.id, t)}
              disabled={isClient || !onUpdateTitle}
              inputClassName="text-sm font-semibold leading-snug"
            />
          </div>

          {/* Tags: epic · priority · approval · clientVisible */}
          <div className="flex flex-wrap gap-1.5">
            {task.epic && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-caption font-medium text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: task.epic.color }}
                />
                {task.epic.title}
              </span>
            )}
            <PriorityPill priority={task.priority} size="md" />
            {task.approvalStatus && <ApprovalBadge status={task.approvalStatus as string} />}
            {task.clientVisible && !isClient && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                <Eye className="h-3 w-3" />
              </span>
            )}
          </div>

          {/* Description (optional) */}
          {task.description && (
            <p className="text-caption leading-relaxed text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Checklist progress bar */}
          {checkTotal > 0 && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    checkPct === 100 ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${checkPct}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-meta tabular-nums",
                  checkPct === 100 ? "text-emerald-500" : "text-muted-foreground",
                )}
              >
                {checkDone}/{checkTotal}
              </span>
            </div>
          )}

          {/* Bottom row: avatar + date left | counts + timer right */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              {task.assignee ? (
                <Avatar className="h-6 w-6 shrink-0 border-2 border-background">
                  <AvatarFallback className="text-micro font-semibold">
                    {getInitials(task.assignee.name || task.assignee.email)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/20" />
              )}
              {task.dueDate && (() => {
                const overdue = new Date(task.dueDate) < new Date();
                return (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-caption truncate",
                      overdue ? "text-red-400 font-medium" : "text-muted-foreground",
                    )}
                  >
                    {overdue ? <AlertCircle className="h-3 w-3 shrink-0" /> : <Calendar className="h-3 w-3 shrink-0" />}
                    {formatDate(task.dueDate)}
                  </span>
                );
              })()}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
              {task._count?.subtasks ? (
                <span
                  className="flex items-center gap-0.5 text-caption tabular-nums"
                  title={`${task._count.subtasksDone ?? 0} von ${task._count.subtasks} Subtasks erledigt`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {task._count.subtasksDone ?? 0}/{task._count.subtasks}
                </span>
              ) : null}
              {task._count?.comments ? (
                <span className="flex items-center gap-0.5 text-caption">
                  <MessageSquare className="h-3 w-3" />
                  {task._count.comments}
                </span>
              ) : null}
              {task._count?.files ? (
                <span className="flex items-center gap-0.5 text-caption">
                  <Paperclip className="h-3 w-3" />
                  {task._count.files}
                </span>
              ) : null}
              {totalTime > 0 && (
                <span className="flex items-center gap-0.5 text-caption">
                  <Clock className="h-3 w-3" />
                  {formatDurationShort(totalTime)}
                </span>
              )}
              {!isClient && nextStatus && onNextPhase && (
                <button
                  data-no-click
                  onClick={(e) => {
                    e.stopPropagation();
                    onNextPhase(task);
                  }}
                  title={`→ ${nextStatus.name}`}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-primary"
                >
                  <ArrowRight className="h-3 w-3" />
                </button>
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
