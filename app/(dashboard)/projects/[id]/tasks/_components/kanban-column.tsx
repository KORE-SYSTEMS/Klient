"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ClipboardCheck,
  Clock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDurationShort } from "@/components/time-tracker";
import { TaskCard } from "./task-card";
import type { Task, TaskStatus } from "../_lib/types";

interface KanbanColumnProps {
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
  onNextPhase?: (task: Task) => void;
}

/** Single droppable column on the kanban board. */
export function KanbanColumn({
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
  onNextPhase,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status.id });
  const columnTotalTime = tasks.reduce((sum, t) => sum + (t.totalTime || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[280px] max-w-[320px] flex-col rounded-lg transition-colors",
        isOver ? "bg-primary/5 ring-2 ring-primary/30 ring-inset" : "bg-transparent",
      )}
    >
      {/* Column header with color bar */}
      <div className="mb-2">
        <div className="h-[3px] rounded-full" style={{ backgroundColor: status.color }} />
        <div className="flex items-center justify-between px-1 pt-2.5 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{status.name}</span>
            {status.isApproval && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-micro font-semibold text-warning uppercase tracking-wide">
                <ClipboardCheck className="h-2.5 w-2.5" />
                Abnahme
              </span>
            )}
            <span className="text-xs text-muted-foreground font-medium">{tasks.length}</span>
          </div>
          <div className="flex items-center gap-0.5">
            {columnTotalTime > 0 && (
              <span className="mr-1 flex items-center gap-1 text-caption text-muted-foreground">
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
                    <DropdownMenuItem onClick={() => onDeleteColumn(status)} className="text-destructive">
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
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 px-0.5 pb-2" style={{ minHeight: 80 }}>
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
                onNextPhase={onNextPhase}
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
