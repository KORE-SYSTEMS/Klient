import { AlertCircle, Calendar, Clock } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface DueDateLabelProps {
  dueDate: string | Date | null | undefined;
  /**
   * Visual emphasis. `subtle` (default) is for inline use in cards/rows.
   * `strong` is for dedicated date columns where overdue should pop.
   */
  variant?: "subtle" | "strong";
  showIcon?: boolean;
  className?: string;
}

/**
 * Standardized due-date label. Decides icon + tone based on whether the date
 * is in the past (overdue), today, or upcoming. Renders nothing when there is
 * no date — callers can drop it in conditionally.
 */
export function DueDateLabel({
  dueDate,
  variant = "subtle",
  showIcon = true,
  className,
}: DueDateLabelProps) {
  if (!dueDate) return null;

  const d = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);

  const overdue = d < today;
  const isToday = d >= today && d < tomorrow;

  const Icon = overdue ? AlertCircle : isToday ? Clock : Calendar;
  const tone = overdue
    ? "text-destructive font-medium"
    : isToday
      ? "text-warning font-medium"
      : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 truncate",
        variant === "subtle" ? "text-caption" : "text-xs",
        tone,
        className,
      )}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {formatDate(d)}
    </span>
  );
}

/** Returns true when the date is strictly before today's start. */
export function isOverdue(dueDate: string | Date | null | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d < today;
}
