"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Project-status pill. Optional editable mode opens a popover for switching
 * between PLANNING / ACTIVE / REVIEW / COMPLETED / ON_HOLD.
 *
 * Task statuses are NOT handled here — those come from the per-project
 * `TaskStatus` table and are rendered via `<PriorityPill>` / inline color
 * pills in the kanban/list views.
 */
const PROJECT_STATUSES = [
  { value: "PLANNING",  label: "Planung",       color: "bg-info/10 text-info" },
  { value: "ACTIVE",    label: "Aktiv",         color: "bg-success/10 text-success" },
  { value: "REVIEW",    label: "Review",        color: "bg-warning/10 text-warning" },
  { value: "COMPLETED", label: "Abgeschlossen", color: "bg-success/10 text-success" },
  { value: "ON_HOLD",   label: "Pausiert",      color: "bg-muted/60 text-muted-foreground" },
] as const;

interface StatusPillProps {
  value: string;
  /** Kept for backwards-compat with existing callers. Only "project" is supported. */
  type?: "project" | "task";
  editable?: boolean;
  onChange?: (value: string) => void;
  size?: "sm" | "default";
  className?: string;
}

export function StatusPill({
  value,
  editable = false,
  onChange,
  size = "default",
  className,
}: StatusPillProps) {
  const [open, setOpen] = useState(false);
  const current = PROJECT_STATUSES.find((s) => s.value === value);
  const colorClass = current?.color || "bg-gray-500/15 text-gray-400 border-gray-500/30";
  const label = current?.label || value;

  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium text-[10px] leading-none h-5 px-2 transition-colors select-none",
        colorClass,
        editable && "cursor-pointer hover:brightness-125",
        className,
      )}
    >
      {label}
      {editable && <ChevronDown className="h-2.5 w-2.5 opacity-60" />}
    </span>
  );

  if (!editable || !onChange) return pill;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{pill}</PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {PROJECT_STATUSES.map((s) => (
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
