import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_LABELS,
  getProjectStatusPillStyle,
} from "@/lib/task-meta";

interface ProjectStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Pill for the project's coarse status (PLANNING / IN_PROGRESS / ON_HOLD / DONE).
 * The detailed per-project workflow uses a separate `TaskStatus` table — this is
 * just the top-level project state.
 */
export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-meta font-semibold",
        getProjectStatusPillStyle(status),
        className,
      )}
    >
      {PROJECT_STATUS_LABELS[status] || status}
    </span>
  );
}
