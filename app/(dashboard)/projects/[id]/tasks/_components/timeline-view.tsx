"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  addDays,
  addWeeks,
  differenceInDays,
  endOfWeek,
  format,
  isToday,
  isWeekend,
  startOfWeek,
  subWeeks,
  isSameMonth,
} from "date-fns";
import { de } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PriorityPill } from "@/components/task/priority-pill";
import type { Task, Epic } from "../_lib/types";

interface TimelineViewProps {
  tasks: Task[];
  epics: Epic[];
  isClient: boolean;
  onTaskClick: (task: Task) => void;
  onDateChange: (taskId: string, startDate: string | null, dueDate: string | null) => void;
}

type ZoomLevel = "day" | "week";

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; weeks: number }> = {
  day: { dayWidth: 40, weeks: 12 },
  week: { dayWidth: 20, weeks: 24 },
};

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 52;
const LABEL_WIDTH = 220;

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#3b82f6",
  LOW: "#22c55e",
};

function toDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseDate(s: string): Date {
  return new Date(s);
}

export function TimelineView({
  tasks,
  epics,
  isClient,
  onTaskClick,
  onDateChange,
}: TimelineViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("day");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [rangeStart, setRangeStart] = useState(() =>
    startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 }),
  );

  const config = ZOOM_CONFIG[zoom];

  const days = useMemo(() => {
    const out: Date[] = [];
    const end = addWeeks(rangeStart, config.weeks);
    let d = rangeStart;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [rangeStart, config.weeks]);

  const totalWidth = days.length * config.dayWidth;

  // Group tasks by epic (swimlanes)
  const { lanes, undated } = useMemo(() => {
    const topLevel = tasks.filter((t) => !t.parentId);
    const dated: Task[] = [];
    const noDates: Task[] = [];
    for (const t of topLevel) {
      if (t.startDate || t.dueDate) {
        dated.push(t);
      } else {
        noDates.push(t);
      }
    }

    const epicMap = new Map<string, { epic: Epic | null; tasks: Task[] }>();
    epicMap.set("__none__", { epic: null, tasks: [] });
    for (const ep of epics) {
      epicMap.set(ep.id, { epic: ep, tasks: [] });
    }
    for (const t of dated) {
      const key = t.epicId || "__none__";
      if (!epicMap.has(key)) epicMap.set(key, { epic: null, tasks: [] });
      epicMap.get(key)!.tasks.push(t);
    }

    const result: { epic: Epic | null; tasks: Task[] }[] = [];
    Array.from(epicMap.values()).forEach((lane) => {
      if (lane.tasks.length > 0) result.push(lane);
    });
    result.sort((a, b) => {
      if (!a.epic && b.epic) return 1;
      if (a.epic && !b.epic) return -1;
      return (a.epic?.order ?? 0) - (b.epic?.order ?? 0);
    });

    return { lanes: result, undated: noDates };
  }, [tasks, epics]);

  // Scroll to today on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayOffset = differenceInDays(new Date(), rangeStart);
    const scrollPos = todayOffset * config.dayWidth - scrollRef.current.clientWidth / 3;
    scrollRef.current.scrollLeft = Math.max(0, scrollPos);
  // Only on initial mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = useCallback(
    (dir: "back" | "forward" | "today") => {
      if (dir === "today") {
        setRangeStart(startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 }));
        requestAnimationFrame(() => {
          if (!scrollRef.current) return;
          const todayOffset = differenceInDays(
            new Date(),
            startOfWeek(subWeeks(new Date(), 2), { weekStartsOn: 1 }),
          );
          const scrollPos = todayOffset * config.dayWidth - scrollRef.current.clientWidth / 3;
          scrollRef.current.scrollLeft = Math.max(0, scrollPos);
        });
        return;
      }
      const shift = dir === "back" ? -4 : 4;
      setRangeStart((s) => addWeeks(s, shift));
    },
    [config.dayWidth],
  );

  // Drag state for moving bars
  const [dragging, setDragging] = useState<{
    taskId: string;
    mode: "move" | "resize-start" | "resize-end";
    originX: number;
    origStart: string | null;
    origEnd: string | null;
  } | null>(null);

  const [dragDelta, setDragDelta] = useState(0);

  const handlePointerDown = useCallback(
    (
      e: React.PointerEvent,
      task: Task,
      mode: "move" | "resize-start" | "resize-end",
    ) => {
      if (isClient) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging({
        taskId: task.id,
        mode,
        originX: e.clientX,
        origStart: task.startDate ?? null,
        origEnd: task.dueDate ?? null,
      });
      setDragDelta(0);
    },
    [isClient],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      setDragDelta(e.clientX - dragging.originX);
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    const daysDelta = Math.round(dragDelta / config.dayWidth);
    if (daysDelta !== 0) {
      let newStart = dragging.origStart;
      let newEnd = dragging.origEnd;

      if (dragging.mode === "move") {
        if (newStart) newStart = toDateKey(addDays(parseDate(newStart), daysDelta));
        if (newEnd) newEnd = toDateKey(addDays(parseDate(newEnd), daysDelta));
      } else if (dragging.mode === "resize-start" && newStart) {
        newStart = toDateKey(addDays(parseDate(newStart), daysDelta));
      } else if (dragging.mode === "resize-end" && newEnd) {
        newEnd = toDateKey(addDays(parseDate(newEnd), daysDelta));
      }

      onDateChange(dragging.taskId, newStart, newEnd);
    }
    setDragging(null);
    setDragDelta(0);
  }, [dragging, dragDelta, config.dayWidth, onDateChange]);

  // Calculate bar position for a task
  const getBarStyle = useCallback(
    (task: Task) => {
      const start = task.startDate ? parseDate(task.startDate) : null;
      const end = task.dueDate ? parseDate(task.dueDate) : null;

      let barStart: number;
      let barWidth: number;

      if (start && end) {
        barStart = differenceInDays(start, rangeStart) * config.dayWidth;
        barWidth = Math.max((differenceInDays(end, start) + 1) * config.dayWidth, config.dayWidth);
      } else if (start) {
        barStart = differenceInDays(start, rangeStart) * config.dayWidth;
        barWidth = config.dayWidth * 3;
      } else if (end) {
        barStart = (differenceInDays(end, rangeStart) - 2) * config.dayWidth;
        barWidth = config.dayWidth * 3;
      } else {
        return null;
      }

      // Apply drag delta
      if (dragging && dragging.taskId === task.id) {
        if (dragging.mode === "move") {
          barStart += dragDelta;
        } else if (dragging.mode === "resize-start") {
          barStart += dragDelta;
          barWidth -= dragDelta;
        } else if (dragging.mode === "resize-end") {
          barWidth += dragDelta;
        }
      }

      return { left: barStart, width: Math.max(barWidth, config.dayWidth / 2) };
    },
    [rangeStart, config.dayWidth, dragging, dragDelta],
  );

  // Month headers
  const monthHeaders = useMemo(() => {
    const headers: { label: string; left: number; width: number }[] = [];
    let currentMonth = "";
    let startIdx = 0;
    for (let i = 0; i < days.length; i++) {
      const m = format(days[i], "MMMM yyyy", { locale: de });
      if (m !== currentMonth) {
        if (currentMonth) {
          headers.push({
            label: currentMonth,
            left: startIdx * config.dayWidth,
            width: (i - startIdx) * config.dayWidth,
          });
        }
        currentMonth = m;
        startIdx = i;
      }
    }
    if (currentMonth) {
      headers.push({
        label: currentMonth,
        left: startIdx * config.dayWidth,
        width: (days.length - startIdx) * config.dayWidth,
      });
    }
    return headers;
  }, [days, config.dayWidth]);

  // Total rows for height calculation
  let totalRows = 0;
  for (const lane of lanes) {
    totalRows += 1 + lane.tasks.length; // header + tasks
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => navigate("back")}
            aria-label="Zurück"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="sm" className="h-8 px-2"
            onClick={() => navigate("today")}
          >
            Heute
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => navigate("forward")}
            aria-label="Vor"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={zoom === "day" ? "secondary" : "ghost"}
            size="sm" className="h-8 px-2 text-xs"
            onClick={() => setZoom("day")}
          >
            <ZoomIn className="mr-1 h-3.5 w-3.5" />
            Tage
          </Button>
          <Button
            variant={zoom === "week" ? "secondary" : "ghost"}
            size="sm" className="h-8 px-2 text-xs"
            onClick={() => setZoom("week")}
          >
            <ZoomOut className="mr-1 h-3.5 w-3.5" />
            Wochen
          </Button>
        </div>

        <span className="text-meta text-muted-foreground">
          {undated.length > 0 && `${undated.length} ohne Datum`}
        </span>
      </div>

      {/* Main timeline */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex">
          {/* Left labels column */}
          <div
            className="shrink-0 border-r bg-muted/20"
            style={{ width: LABEL_WIDTH }}
          >
            {/* Header spacer */}
            <div
              className="border-b bg-muted/30 px-3 flex items-end"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground pb-2">
                Tasks
              </span>
            </div>

            {/* Lane labels */}
            {lanes.map((lane) => (
              <div key={lane.epic?.id ?? "__none__"}>
                {/* Epic header */}
                <div
                  className="flex items-center gap-2 px-3 border-b bg-muted/10"
                  style={{ height: ROW_HEIGHT }}
                >
                  {lane.epic && (
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: lane.epic.color }}
                    />
                  )}
                  <span className="text-caption font-semibold truncate">
                    {lane.epic?.title ?? "Kein Epic"}
                  </span>
                  <span className="text-meta text-muted-foreground ml-auto tabular-nums">
                    {lane.tasks.length}
                  </span>
                </div>

                {/* Task labels */}
                {lane.tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="flex items-center gap-2 px-3 border-b w-full text-left hover:bg-accent/50 transition-colors"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => onTaskClick(task)}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? "#6b7280" }}
                    />
                    <span className="text-caption truncate flex-1">{task.title}</span>
                    {task.assignee && (
                      <Avatar className="h-4 w-4 shrink-0">
                        <AvatarFallback className="text-[7px] font-semibold">
                          {getInitials(task.assignee.name || task.assignee.email)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Scrollable timeline area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto overflow-y-hidden"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div style={{ width: totalWidth, position: "relative" }}>
              {/* Time axis header */}
              <div
                className="sticky top-0 z-10 bg-muted/30 border-b"
                style={{ height: HEADER_HEIGHT }}
              >
                {/* Month row */}
                <div className="flex border-b" style={{ height: HEADER_HEIGHT / 2 }}>
                  {monthHeaders.map((mh) => (
                    <div
                      key={mh.label}
                      className="border-r flex items-center justify-center text-caption font-semibold capitalize"
                      style={{ width: mh.width, position: "absolute", left: mh.left }}
                    >
                      {mh.label}
                    </div>
                  ))}
                </div>
                {/* Day row */}
                <div className="flex" style={{ height: HEADER_HEIGHT / 2 }}>
                  {days.map((day) => (
                    <div
                      key={toDateKey(day)}
                      className={cn(
                        "shrink-0 flex items-center justify-center text-meta tabular-nums border-r",
                        isToday(day) && "bg-primary/20 font-bold text-primary",
                        isWeekend(day) && !isToday(day) && "bg-muted/40 text-muted-foreground",
                      )}
                      style={{ width: config.dayWidth }}
                    >
                      {zoom === "day"
                        ? format(day, "d")
                        : format(day, "d") === "1" || days.indexOf(day) === 0
                          ? format(day, "d")
                          : days.indexOf(day) % 7 === 0
                            ? format(day, "d")
                            : ""}
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid lines + today marker */}
              <div
                className="relative"
                style={{
                  height: totalRows * ROW_HEIGHT,
                }}
              >
                {/* Day column lines */}
                {days.map((day) => (
                  <div
                    key={`col-${toDateKey(day)}`}
                    className={cn(
                      "absolute top-0 bottom-0 border-r",
                      isWeekend(day) && "bg-muted/20",
                    )}
                    style={{
                      left: differenceInDays(day, rangeStart) * config.dayWidth,
                      width: config.dayWidth,
                    }}
                  />
                ))}

                {/* Today marker */}
                {(() => {
                  const todayIdx = differenceInDays(new Date(), rangeStart);
                  if (todayIdx < 0 || todayIdx >= days.length) return null;
                  return (
                    <div
                      className="absolute top-0 bottom-0 z-20 pointer-events-none"
                      style={{
                        left: todayIdx * config.dayWidth + config.dayWidth / 2,
                        width: 2,
                        backgroundColor: "hsl(var(--primary))",
                        opacity: 0.7,
                      }}
                    />
                  );
                })()}

                {/* Task bars */}
                {(() => {
                  let rowIndex = 0;
                  return lanes.map((lane) => {
                    const laneHeaderRow = rowIndex;
                    rowIndex++;
                    return (
                      <div key={lane.epic?.id ?? "__none__"}>
                        {/* Epic header row bg */}
                        <div
                          className="absolute left-0 right-0 bg-muted/10 border-b"
                          style={{
                            top: laneHeaderRow * ROW_HEIGHT,
                            height: ROW_HEIGHT,
                          }}
                        />

                        {/* Task bars */}
                        {lane.tasks.map((task) => {
                          const currentRow = rowIndex;
                          rowIndex++;
                          const barStyle = getBarStyle(task);
                          if (!barStyle) return (
                            <div
                              key={task.id}
                              className="absolute border-b"
                              style={{
                                top: currentRow * ROW_HEIGHT,
                                height: ROW_HEIGHT,
                                left: 0,
                                right: 0,
                              }}
                            />
                          );

                          const color = PRIORITY_COLORS[task.priority] ?? "#6b7280";
                          const isDraggingThis = dragging?.taskId === task.id;
                          const hasRange = task.startDate && task.dueDate;

                          return (
                            <div
                              key={task.id}
                              className="absolute border-b"
                              style={{
                                top: currentRow * ROW_HEIGHT,
                                height: ROW_HEIGHT,
                                left: 0,
                                right: 0,
                              }}
                            >
                              {/* The bar */}
                              <div
                                className={cn(
                                  "absolute top-1 rounded-md transition-shadow cursor-pointer group",
                                  isDraggingThis && "shadow-lg ring-2 ring-primary/40 z-30",
                                  !isDraggingThis && "hover:shadow-md hover:brightness-110",
                                )}
                                style={{
                                  left: barStyle.left,
                                  width: barStyle.width,
                                  height: ROW_HEIGHT - 8,
                                  backgroundColor: color + "30",
                                  borderLeft: `3px solid ${color}`,
                                }}
                                onClick={() => onTaskClick(task)}
                              >
                                {/* Resize handle start */}
                                {hasRange && !isClient && (
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-white/20 rounded-l"
                                    onPointerDown={(e) => handlePointerDown(e, task, "resize-start")}
                                  />
                                )}

                                {/* Move handle (center) */}
                                <div
                                  className={cn(
                                    "absolute inset-0 flex items-center px-2 overflow-hidden",
                                    !isClient && "cursor-grab active:cursor-grabbing",
                                  )}
                                  onPointerDown={!isClient ? (e) => handlePointerDown(e, task, "move") : undefined}
                                >
                                  <span
                                    className="text-meta font-medium truncate"
                                    style={{ color }}
                                  >
                                    {task.title}
                                  </span>
                                </div>

                                {/* Resize handle end */}
                                {hasRange && !isClient && (
                                  <div
                                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-white/20 rounded-r"
                                    onPointerDown={(e) => handlePointerDown(e, task, "resize-end")}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Undated tasks */}
      {undated.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-caption font-semibold">Ohne Datum</span>
            <span className="text-meta text-muted-foreground tabular-nums">{undated.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 p-2">
            {undated.map((t) => (
              <button
                key={t.id}
                type="button"
                className="group rounded border bg-background hover:bg-accent transition-colors"
                onClick={() => onTaskClick(t)}
              >
                <div className="flex items-center gap-1.5 px-2 py-1 min-w-0">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: PRIORITY_COLORS[t.priority] ?? "#6b7280" }}
                  />
                  <span className="truncate text-meta font-medium max-w-[160px]">{t.title}</span>
                  {t.assignee && (
                    <Avatar className="h-3.5 w-3.5 shrink-0">
                      <AvatarFallback className="text-[8px] font-semibold">
                        {getInitials(t.assignee.name || t.assignee.email)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
