"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Eye,
  Lock,
  MessageSquare,
  Paperclip,
  Repeat,
  ClipboardCheck,
} from "lucide-react";
import { describeRecurrence, parseRecurrence } from "@/lib/recurrence";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskCardTimer } from "@/components/time-tracker";
import { getPriorityHex, getPriorityPillStyle, PRIORITY_LABELS } from "@/lib/task-meta";
import { InlineTitle } from "./inline-title";
import { getNextStatus } from "../_lib/dnd";
import type { Task, TaskStatus } from "../_lib/types";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  statuses: TaskStatus[];
  isTimerActive: boolean;
  timerElapsed: number;
  onTimerStart: (taskId: string) => void;
  onTimerStop: () => void;
  isClient: boolean;
  currentUserId?: string;
  onUpdateTitle?: (id: string, title: string) => void;
  onNextPhase?: (task: Task) => void;
  selected?: boolean;
  onSelect?: (taskId: string, mode: "toggle" | "range") => void;
  selectionActive?: boolean;
  isOverlay?: boolean;
  dragHeight?: number;
}

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
  isOverlay,
  dragHeight,
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
  } = useSortable({ id: task.id, disabled: isClient || isOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging && !task._isPreview && !isOverlay) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
        <div
          className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
          style={{ height: dragHeight ?? 88 }}
        />
      </div>
    );
  }

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
  const recurrence = task.recurrenceRule ? parseRecurrence(task.recurrenceRule) : null;
  const overdue = !isDone && task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      {...(isClient || isOverlay ? {} : { ...attributes, ...listeners })}
      className={cn(!isClient && !isOverlay && "touch-none", "outline-none")}
    >
      <div
        className={cn(
          "group rounded-xl border bg-card shadow-sm transition-colors hover:border-border/80",
          !isClient && !isOverlay && "cursor-grab active:cursor-grabbing",
          isClient && !isOverlay && "cursor-pointer",
          isOverlay && "shadow-2xl cursor-grabbing",
          isTimerActive && "border-primary/50",
          selected && "ring-2 ring-primary border-primary bg-primary/5",
          isGreyedOut && "opacity-50",
        )}
        onClick={(e) => {
          if (isOverlay) return;
          if ((e.target as HTMLElement).closest("[data-no-click]")) return;
          onClick?.();
        }}
      >
        <div className="p-3.5">
          <div className="space-y-2.5">
            {/* Epic pill + top-right icons row */}
            {(task.epic || (task.clientVisible && !isClient) || task.approvalStatus === "PENDING" || recurrence) && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  {task.epic && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
                      style={{
                        backgroundColor: task.epic.color + "18",
                        color: task.epic.color,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.epic.color }} />
                      {task.epic.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                  {task.approvalStatus === "PENDING" && (
                    <span className="flex h-5 w-5 items-center justify-center rounded text-warning" title="Wartet auf Abnahme">
                      <ClipboardCheck className="h-3 w-3" />
                    </span>
                  )}
                  {recurrence && (
                    <span className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50" title={describeRecurrence(recurrence)}>
                      <Repeat className="h-3 w-3" />
                    </span>
                  )}
                  {task.clientVisible && !isClient && (
                    <span className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50" title="Für Kunden sichtbar">
                      <Eye className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Title */}
            <div
              className={cn(
                "text-sm font-semibold leading-snug",
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

            {/* Description */}
            {task.description?.trim() && (
              <p className="text-caption leading-relaxed text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Checklist progress */}
            {checkTotal > 0 && (
              <div className="space-y-1">
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", checkPct === 100 ? "bg-success" : "bg-foreground/40")}
                    style={{ width: `${checkPct}%` }}
                  />
                </div>
                <span className="text-meta tabular-nums text-muted-foreground">
                  {checkDone}/{checkTotal} Checkliste
                </span>
              </div>
            )}

            {/* Pills row: Priority + Date */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Priority pill */}
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                getPriorityPillStyle(task.priority),
              )}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getPriorityHex(task.priority) }} />
                {PRIORITY_LABELS[task.priority]}
              </span>

              {/* Date pill */}
              {task.dueDate && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                  overdue
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-muted text-muted-foreground",
                )}>
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDate(task.dueDate)}
                </span>
              )}
            </div>

            {/* Bottom: Avatar | Counters + Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 min-w-0">
                {task.assignee ? (
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-micro font-semibold">
                      {getInitials(task.assignee.name || task.assignee.email)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/30" />
                )}
                {task.assignee && (
                  <span className="text-[10px] leading-none text-muted-foreground truncate">
                    {task.assignee.name || task.assignee.email}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0 text-[10px] leading-none text-muted-foreground/70">
                {task._count?.subtasks ? (
                  <span className="flex items-center gap-0.5 tabular-nums" title={`${task._count.subtasksDone ?? 0} von ${task._count.subtasks} Subtasks erledigt`}>
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {task._count.subtasksDone ?? 0}/{task._count.subtasks}
                  </span>
                ) : null}
                {task._count?.comments ? (
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {task._count.comments}
                  </span>
                ) : null}
                {task._count?.files ? (
                  <span className="flex items-center gap-0.5">
                    <Paperclip className="h-2.5 w-2.5" />
                    {task._count.files}
                  </span>
                ) : null}
                {!isClient && (
                  <span data-no-click>
                    <TaskCardTimer
                      taskId={task.id}
                      isActive={isTimerActive}
                      elapsed={timerElapsed}
                      onStart={onTimerStart}
                      onStop={onTimerStop}
                    />
                  </span>
                )}
                {!isClient && nextStatus && onNextPhase && (
                  <button
                    data-no-click
                    onClick={(e) => { e.stopPropagation(); onNextPhase(task); }}
                    title={`→ ${nextStatus.name}`}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 hover:bg-accent hover:text-foreground"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
