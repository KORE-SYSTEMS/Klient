"use client";

import { CheckCircle2, ChevronDown, Flag, Trash2, User as UserIcon, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/task-meta";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityPill } from "@/components/task/priority-pill";
import type { ProjectMember, TaskStatus } from "../_lib/types";

interface BulkToolbarProps {
  count: number;
  statuses: TaskStatus[];
  members: ProjectMember[];
  onSetStatus: (statusId: string) => void;
  onSetPriority: (priority: string) => void;
  onSetAssignee: (assigneeId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
}

/**
 * Floating bulk-action bar that slides in from the bottom when ≥1 tasks are
 * selected. Mirrors Linear/Asana — quick actions + Esc to clear.
 */
export function BulkToolbar({
  count,
  statuses,
  members,
  onSetStatus,
  onSetPriority,
  onSetAssignee,
  onDelete,
  onClear,
}: BulkToolbarProps) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-40",
        "flex items-center gap-2 rounded-xl border bg-popover px-3 py-2 shadow-lg",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-150",
      )}
      role="toolbar"
      aria-label="Bulk-Aktionen"
    >
      <span className="text-sm font-semibold tabular-nums px-1">
        {count} {count === 1 ? "Task" : "Tasks"}
      </span>

      <span className="h-6 w-px bg-border" aria-hidden />

      {/* Status */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Status
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          {statuses.map((s) => (
            <DropdownMenuItem key={s.id} className="gap-2" onClick={() => onSetStatus(s.id)}>
              <span
                className="h-2.5 w-2.5 rounded-[3px] shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Flag className="h-3.5 w-3.5" />
            Priorität
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-40">
          {PRIORITIES.map((p) => (
            <DropdownMenuItem key={p} onClick={() => onSetPriority(p)}>
              <PriorityPill priority={p} />
              <span className="ml-2 text-xs">{PRIORITY_LABELS[p]}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Assignee */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <UserIcon className="h-3.5 w-3.5" />
            Zuweisen
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56 max-h-[300px] overflow-y-auto">
          <DropdownMenuItem onClick={() => onSetAssignee(null)} className="gap-2">
            <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Niemand zuweisen</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {members.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => onSetAssignee(m.id)} className="gap-2">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-micro">
                  {getInitials(m.name || m.email)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{m.name || m.email}</span>
              {m.role === "CLIENT" && (
                <span className="ml-auto text-meta text-muted-foreground rounded-full border px-1.5 py-0.5">
                  Kunde
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="h-6 w-px bg-border" aria-hidden />

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Löschen
      </Button>

      <button
        type="button"
        onClick={onClear}
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Auswahl aufheben (Esc)"
        aria-label="Auswahl aufheben"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
