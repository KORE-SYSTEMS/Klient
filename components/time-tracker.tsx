"use client";

import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Play, Square, Clock, Minimize2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

interface ActiveTimer {
  id: string;
  taskId: string;
  startedAt: string;
  task?: {
    id: string;
    title: string;
    status: string;
    projectId: string;
  };
}

// --- Formatters ---

export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatDurationShort(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

// --- Hook ---

export function useActiveTimer() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Callbacks to notify listeners (e.g. task page) when timer state changes
  const onChangeRef = useRef<(() => void) | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch("/api/time-entries/active");
      if (res.ok) {
        const data = await res.json();
        setActiveTimer(data);
        if (data?.startedAt) {
          const diff = Math.floor(
            (Date.now() - new Date(data.startedAt).getTime()) / 1000
          );
          setElapsed(diff);
        } else {
          setElapsed(0);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  useEffect(() => {
    if (activeTimer) {
      intervalRef.current = setInterval(() => {
        const diff = Math.floor(
          (Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000
        );
        setElapsed(diff);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer]);

  const startTimer = useCallback(
    async (taskId: string) => {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTimer(data);
        setElapsed(0);
        onChangeRef.current?.();
      }
      return res.ok;
    },
    []
  );

  const stopTimer = useCallback(
    async (comment?: string) => {
      if (!activeTimer) return false;
      const res = await fetch(`/api/time-entries/${activeTimer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stop: true,
          description: comment || null,
        }),
      });
      if (res.ok) {
        setActiveTimer(null);
        setElapsed(0);
        onChangeRef.current?.();
      }
      return res.ok;
    },
    [activeTimer]
  );

  const setOnChange = useCallback((fn: (() => void) | null) => {
    onChangeRef.current = fn;
  }, []);

  return {
    activeTimer,
    elapsed,
    startTimer,
    stopTimer,
    fetchActive,
    setOnChange,
  };
}

// --- Floating Timer Widget (with Stop-Dialog including comment) ---

export function FloatingTimer({
  activeTimer,
  elapsed,
  onStop,
  forceStopDialog,
  onStopDialogClose,
}: {
  activeTimer: ActiveTimer | null;
  elapsed: number;
  onStop: (comment?: string) => unknown;
  forceStopDialog?: boolean;
  onStopDialogClose?: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Open stop dialog when forceStopDialog becomes true
  useEffect(() => {
    if (forceStopDialog && activeTimer) {
      setComment("");
      setStopDialogOpen(true);
    }
  }, [forceStopDialog, activeTimer]);

  function openStopDialog() {
    setComment("");
    setStopDialogOpen(true);
  }

  async function handleConfirmStop() {
    setSubmitting(true);
    await onStop(comment.trim() || undefined);
    setSubmitting(false);
    setStopDialogOpen(false);
    setComment("");
    onStopDialogClose?.();
  }

  function handleDialogClose(open: boolean) {
    setStopDialogOpen(open);
    if (!open) onStopDialogClose?.();
  }

  if (!activeTimer) return null;

  // Minimized: compact pill
  if (minimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setMinimized(false)}
          className="group flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-primary-foreground shadow-lg transition-all hover:shadow-xl hover:scale-105"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground" />
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatDuration(elapsed)}
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <Card className="w-[320px] overflow-hidden border shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
              </span>
              <span className="text-xs font-medium text-primary-foreground/80">
                Timer läuft
              </span>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="rounded-sm p-1 text-primary-foreground/60 transition-colors hover:text-primary-foreground"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="mb-3 text-sm font-medium leading-tight text-foreground line-clamp-2">
              {activeTimer.task?.title || "Task"}
            </div>

            {/* Timer Display */}
            <div className="mb-4 flex items-center justify-center">
              <div className="font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground">
                {formatDuration(elapsed)}
              </div>
            </div>

            {/* Stop Button */}
            <Button
              onClick={openStopDialog}
              variant="destructive"
              className="w-full gap-2"
              size="lg"
            >
              <Square className="h-4 w-4 fill-current" />
              Timer stoppen
            </Button>
          </div>
        </Card>
      </div>

      {/* Stop Dialog with Comment */}
      <Dialog open={stopDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Timer stoppen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">Task</div>
              <div className="text-sm font-semibold mb-3">
                {activeTimer.task?.title || "Task"}
              </div>
              <div className="text-sm text-muted-foreground mb-1">
                Erfasste Zeit
              </div>
              <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                {formatDuration(elapsed)}
              </div>
            </div>

            {/* Comment field */}
            <div className="space-y-2">
              <Label
                htmlFor="stop-comment"
                className="flex items-center gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                Was wurde erledigt?
              </Label>
              <Textarea
                id="stop-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Beschreibe kurz, was du in dieser Zeit erledigt hast..."
                rows={3}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Wird als Kommentar beim Task und im Projekt-Chat gepostet.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setStopDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmStop}
              disabled={submitting}
              className="gap-2"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {submitting ? "Wird gestoppt..." : "Stoppen & speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Timer button for use in task cards / list rows ---

export function TimerButton({
  taskId,
  isActive,
  elapsed,
  totalTime,
  onStart,
  onStop,
  size = "default",
  showTotal = false,
}: {
  taskId: string;
  isActive: boolean;
  elapsed: number;
  totalTime: number;
  onStart: (taskId: string) => void;
  onStop: () => void;
  size?: "sm" | "default";
  showTotal?: boolean;
}) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const btnSize = size === "sm" ? "h-6 px-1.5" : "h-7 px-2";

  return (
    <div
      className="flex items-center gap-1.5"
      data-no-click
      onClick={(e) => e.stopPropagation()}
    >
      {showTotal && totalTime > 0 && !isActive && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {formatDurationShort(totalTime)}
        </span>
      )}
      {isActive ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStop();
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20",
            btnSize
          )}
        >
          <Square className={cn(iconSize, "fill-current")} />
          <span className="font-mono text-[11px] font-semibold tabular-nums">
            {formatDuration(elapsed)}
          </span>
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart(taskId);
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary",
            btnSize
          )}
          title="Timer starten"
        >
          <Play className={cn(iconSize, "fill-current")} />
        </button>
      )}
    </div>
  );
}
