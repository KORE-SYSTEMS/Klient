import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, getPriorityPillStyle } from "@/lib/task-meta";

interface PriorityPillProps {
  priority: string;
  size?: "sm" | "md";
  className?: string;
}

/** Standardized colored pill for task priorities. Used across board, list, dialog. */
export function PriorityPill({ priority, size = "sm", className }: PriorityPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full font-semibold",
        size === "sm" ? "px-2 py-0.5 text-meta" : "px-2 py-0.5 text-caption",
        getPriorityPillStyle(priority),
        className,
      )}
    >
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}
