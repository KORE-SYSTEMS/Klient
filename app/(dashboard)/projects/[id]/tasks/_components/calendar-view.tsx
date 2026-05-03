"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronLeft,
  ChevronRight,
  CalendarOff,
} from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PriorityPill } from "@/components/task/priority-pill";
import type { Task } from "../_lib/types";

interface CalendarViewProps {
  tasks: Task[];
  isClient: boolean;
  onTaskClick: (task: Task) => void;
  /** Persists a new dueDate (or null to remove). Optimistic update happens here. */
  onDueDateChange: (taskId: string, newDate: string | null) => void;
}

const WEEK_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/**
 * Monatsraster mit Tasks per dueDate. Drag-and-Drop ändert das Datum:
 * - Auf einen Tag droppen → setzt dueDate auf diesen Tag
 * - Auf "Ohne Datum"-Bereich droppen → entfernt dueDate
 *
 * Filter und Selection bleiben außen (kommen über `tasks`-Prop schon gefiltert).
 * Nur Top-Level-Tasks werden gerendert; Subtasks erscheinen über ihren Parent.
 */
export function CalendarView({
  tasks,
  isClient,
  onTaskClick,
  onDueDateChange,
}: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Build the 6×7 day matrix for the visible month.
  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = first;
    while (d <= last) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursor]);

  // Group tasks per ISO-Date string (YYYY-MM-DD).
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    const undated: Task[] = [];
    for (const t of tasks) {
      if (t.parentId) continue; // subtasks not on the calendar
      if (!t.dueDate) {
        undated.push(t);
        continue;
      }
      const key = format(new Date(t.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return { byDay: map, undated };
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart(e: DragStartEvent) {
    if (isClient) return;
    setDraggingId(e.active.id as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    if (isClient) return;
    if (!e.over) return;
    const taskId = e.active.id as string;
    const overId = e.over.id as string;
    if (overId === "undated-zone") {
      onDueDateChange(taskId, null);
      return;
    }
    if (overId.startsWith("day-")) {
      const dateKey = overId.slice(4); // "day-2026-05-15" → "2026-05-15"
      onDueDateChange(taskId, dateKey);
    }
  }

  const draggingTask = draggingId ? tasks.find((t) => t.id === draggingId) : null;

  return (
    <DndContext
      sensors={isClient ? [] : sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        {/* Header — month nav */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-8 px-2"
              onClick={() => setCursor(startOfMonth(new Date()))}
            >
              Heute
            </Button>
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Nächster Monat"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="font-heading text-lg font-bold tabular-nums">
            {format(cursor, "MMMM yyyy", { locale: de })}
          </h2>
          <span className="text-meta text-muted-foreground">
            {tasksByDay.undated.length} ohne Datum
          </span>
        </div>

        {/* Week-day header */}
        <div className="grid grid-cols-7 gap-px rounded-t-lg overflow-hidden border-x border-t bg-border">
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className="bg-muted/30 px-2 py-2 text-center text-meta font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 grid-rows-6 gap-px rounded-b-lg overflow-hidden border-x border-b bg-border -mt-3">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDay.byDay.get(key) ?? [];
            return (
              <CalendarDay
                key={key}
                day={day}
                cursor={cursor}
                tasks={dayTasks}
                isClient={isClient}
                draggingId={draggingId}
                onTaskClick={onTaskClick}
              />
            );
          })}
        </div>

        {/* Undated drop zone */}
        <UndatedZone
          tasks={tasksByDay.undated}
          isClient={isClient}
          draggingId={draggingId}
          onTaskClick={onTaskClick}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {draggingTask && (
          <div className="rounded-md border bg-card px-2 py-1 shadow-lg cursor-grabbing min-w-[160px] max-w-[260px]">
            <div className="flex items-center gap-1.5">
              <span className="text-caption font-medium truncate flex-1">{draggingTask.title}</span>
              <PriorityPill priority={draggingTask.priority} />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Single day cell ──────────────────────────────────────────────────────────

function CalendarDay({
  day,
  cursor,
  tasks,
  isClient,
  draggingId,
  onTaskClick,
}: {
  day: Date;
  cursor: Date;
  tasks: Task[];
  isClient: boolean;
  draggingId: string | null;
  onTaskClick: (task: Task) => void;
}) {
  const id = `day-${format(day, "yyyy-MM-dd")}`;
  const { setNodeRef, isOver } = useDroppable({ id, disabled: isClient });
  const isCurrentMonth = isSameMonth(day, cursor);
  const today = isToday(day);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[110px] flex flex-col gap-1 p-1.5 transition-colors",
        isCurrentMonth ? "bg-card" : "bg-muted/20",
        isOver && "bg-primary/10 ring-2 ring-primary/40 ring-inset",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-end px-1 pt-0.5 text-caption font-semibold tabular-nums",
          today && "text-primary",
          !isCurrentMonth && "text-muted-foreground/50",
        )}
      >
        {today ? (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-meta font-bold text-primary-foreground">
            {format(day, "d")}
          </span>
        ) : (
          format(day, "d")
        )}
      </div>
      <div className="flex flex-col gap-1 overflow-hidden">
        {tasks.slice(0, 4).map((t) => (
          <DraggableTaskChip
            key={t.id}
            task={t}
            isClient={isClient}
            hidden={draggingId === t.id}
            onClick={() => onTaskClick(t)}
          />
        ))}
        {tasks.length > 4 && (
          <button
            type="button"
            onClick={() => {
              // No dedicated overflow popover yet — open the first hidden one.
              // Simpler than building a sub-menu, and signals "more here".
              const next = tasks[4];
              if (next) onTaskClick(next);
            }}
            className="text-meta text-muted-foreground hover:text-foreground text-left px-1"
          >
            +{tasks.length - 4} weitere
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Single task chip on the calendar ─────────────────────────────────────────

function DraggableTaskChip({
  task,
  isClient,
  hidden,
  onClick,
}: {
  task: Task;
  isClient: boolean;
  hidden: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: task.id,
    disabled: isClient,
  });

  if (hidden) {
    return (
      <div className="rounded border-2 border-dashed border-primary/40 bg-primary/5 h-5" />
    );
  }

  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div
      ref={setNodeRef}
      {...(isClient ? {} : { ...attributes, ...listeners })}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "group rounded border bg-background hover:bg-accent transition-colors cursor-pointer touch-none",
        isOverdue && "border-destructive/40",
        !isClient && "active:cursor-grabbing",
      )}
      title={task.title}
    >
      <div className="flex items-center gap-1 px-1.5 py-0.5 min-w-0">
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{
            backgroundColor:
              task.priority === "URGENT" ? "#ef4444" :
              task.priority === "HIGH" ? "#f97316" :
              task.priority === "MEDIUM" ? "#eab308" :
              "#22c55e",
          }}
        />
        <span className="truncate text-meta font-medium flex-1">{task.title}</span>
        {task.assignee && (
          <Avatar className="h-3.5 w-3.5 shrink-0">
            <AvatarFallback className="text-[8px] font-semibold">
              {getInitials(task.assignee.name || task.assignee.email)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

// ─── Undated zone (drop here to remove dueDate) ───────────────────────────────

function UndatedZone({
  tasks,
  isClient,
  draggingId,
  onTaskClick,
}: {
  tasks: Task[];
  isClient: boolean;
  draggingId: string | null;
  onTaskClick: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "undated-zone", disabled: isClient });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-card transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/40 ring-inset",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-caption font-semibold">Ohne Datum</span>
        <span className="text-meta text-muted-foreground tabular-nums">{tasks.length}</span>
      </div>
      <ScrollArea className="max-h-[160px]">
        {tasks.length === 0 ? (
          <p className="px-3 py-3 text-meta text-muted-foreground italic">
            Hierher ziehen, um das Fälligkeitsdatum zu entfernen.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 p-2">
            {tasks.map((t) => (
              <div key={t.id} className="w-[180px]">
                <DraggableTaskChip
                  task={t}
                  isClient={isClient}
                  hidden={draggingId === t.id}
                  onClick={() => onTaskClick(t)}
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
