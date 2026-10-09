"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { TimerButton, formatDurationShort } from "@/components/time-tracker";
import { PRIORITY_LABELS, getPriorityHex } from "@/lib/task-meta";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { Task, TaskStatus } from "../_lib/types";

interface ListViewProps {
  /** Tasks grouped by status (already filtered). */
  statusGroups: { status: TaskStatus; tasks: Task[] }[];
  /** Total number of unfiltered tasks — only used for the empty state. */
  totalTaskCount: number;
  collapsedGroups: Set<string>;
  onToggleGroup: (statusId: string) => void;
  isClient: boolean;
  currentUserId: string;
  activeTimerTaskId: string | null;
  elapsed: number;
  selection: { isSelected: (id: string) => boolean; selectedCount: number };
  onSelect: (taskId: string, mode: "toggle" | "range") => void;
  onTaskClick: (task: Task) => void;
  onAddTask: (statusId?: string) => void;
  onTimerStart: (taskId: string) => void;
  onTimerStop: () => void;
}

/** Asana-style table grouped by status. */
export function ListView({
  statusGroups,
  totalTaskCount,
  collapsedGroups,
  onToggleGroup,
  isClient,
  currentUserId,
  activeTimerTaskId,
  elapsed,
  selection,
  onSelect,
  onTaskClick,
  onAddTask,
  onTimerStart,
  onTimerStop,
}: ListViewProps) {
  return (
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
              onClick={() => onToggleGroup(group.status.id)}
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
              const isTimerActive = activeTimerTaskId === task.id;
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
                    if (isClient) { onTaskClick(task); return; }
                    const meta = e.metaKey || e.ctrlKey;
                    const shift = e.shiftKey;
                    if (meta) { e.preventDefault(); onSelect(task.id, "toggle"); return; }
                    if (shift) { e.preventDefault(); onSelect(task.id, "range"); return; }
                    if (selectionActive) { e.preventDefault(); onSelect(task.id, "toggle"); return; }
                    onTaskClick(task);
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
                        onClick={(e) => { e.stopPropagation(); onSelect(task.id, "toggle"); }}
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
                      {task.epic && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none mb-0.5"
                          style={{ backgroundColor: task.epic.color + "18", color: task.epic.color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.epic.color }} />
                          {task.epic.title}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{task.title}</span>
                        {totalTime > 0 && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground shrink-0">
                            <Clock className="h-2.5 w-2.5" />{formatDurationShort(totalTime)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="w-[140px] shrink-0">
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-micro font-semibold">
                            {getInitials(task.assignee.name || task.assignee.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[11px] truncate">{task.assignee.name || task.assignee.email}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="w-[100px] shrink-0">
                    {task.dueDate ? (() => {
                      const overdue = group.status.category !== "DONE" && new Date(task.dueDate) < new Date();
                      return (
                        <span className={cn("text-[11px] flex items-center gap-1", overdue ? "text-destructive" : "text-muted-foreground")}>
                          {overdue && <AlertCircle className="h-2.5 w-2.5 shrink-0" />}
                          {formatDate(task.dueDate)}
                        </span>
                      );
                    })() : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Priority */}
                  <div className="w-[90px] shrink-0 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getPriorityHex(task.priority) }} />
                    <span className="text-sm">{PRIORITY_LABELS[task.priority] || task.priority}</span>
                  </div>

                  {/* Status */}
                  <div className="w-[110px] shrink-0">
                    <span
                      className="inline-flex items-center gap-1 rounded-full h-5 px-2 text-[10px] leading-none font-medium"
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
                        onStart={onTimerStart} onStop={onTimerStop} size="sm"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add task in group */}
            {!isCollapsed && !isClient && (
              <button
                onClick={() => onAddTask(group.status.id)}
                className="flex w-full items-center gap-2 border-b px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Task hinzufügen...
              </button>
            )}
          </div>
        );
      })}

      {totalTaskCount === 0 && (
        <EmptyState
          icon={CheckCircle2}
          title="Noch keine Tasks"
          description={!isClient ? "Erstelle den ersten Task um loszulegen." : "Noch keine Tasks sichtbar."}
          action={
            !isClient && (
              <button
                onClick={() => onAddTask()}
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
  );
}
