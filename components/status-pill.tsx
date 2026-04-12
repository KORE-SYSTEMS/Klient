"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PROJECT_STATUSES = [
  { value: "PLANNING", label: "Planung", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { value: "ACTIVE", label: "Aktiv", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  { value: "REVIEW", label: "Review", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { value: "COMPLETED", label: "Abgeschlossen", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { value: "ON_HOLD", label: "Pausiert", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
] as const;

const TASK_STATUSES = [
  { value: "BACKLOG", label: "Backlog", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  { value: "TODO", label: "To Do", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { value: "IN_PROGRESS", label: "In Arbeit", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  { value: "IN_REVIEW", label: "Review", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { value: "DONE", label: "Erledigt", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
] as const;

interface StatusPillProps {
  value: string;
  type?: "project" | "task";
  editable?: boolean;
  onChange?: (value: string) => void;
  size?: "sm" | "default";
  className?: string;
}

export function getStatusLabel(value: string, type: "project" | "task" = "project"): string {
  const list = type === "task" ? TASK_STATUSES : PROJECT_STATUSES;
  return list.find((s) => s.value === value)?.label || value;
}

export function getStatusPillColor(value: string): string {
  const all = [...PROJECT_STATUSES, ...TASK_STATUSES];
  return all.find((s) => s.value === value)?.color || "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

export function StatusPill({
  value,
  type = "project",
  editable = false,
  onChange,
  size = "default",
  className,
}: StatusPillProps) {
  const [open, setOpen] = useState(false);
  const statuses = type === "task" ? TASK_STATUSES : PROJECT_STATUSES;
  const current = statuses.find((s) => s.value === value);
  const colorClass = current?.color || "bg-gray-500/15 text-gray-400 border-gray-500/30";
  const label = current?.label || value;

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium transition-colors select-none",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        colorClass,
        editable && "cursor-pointer hover:brightness-125",
        className,
      )}
    >
      {label}
      {editable && <ChevronDown className={cn("opacity-60", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
    </span>
  );

  if (!editable || !onChange) return pill;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{pill}</PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              onChange(s.value);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors hover:bg-accent",
              s.value === value && "bg-accent",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", s.color.split(" ")[0].replace("/15", ""))} />
            <span className="flex-1 text-left">{s.label}</span>
            {s.value === value && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
