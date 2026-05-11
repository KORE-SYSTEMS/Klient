import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, getPriorityPillStyle } from "@/lib/task-meta";

interface PriorityPillProps {
  priority: string;
  size?: "sm" | "md";
  className?: string;
}

/** Standardized colored pill for task priorities. Used across board, list, dialog. */
export function PriorityPill({ priority, className }: PriorityPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium text-[10px] leading-none h-5 px-2",
        getPriorityPillStyle(priority),
        className,
      )}
    >
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}
