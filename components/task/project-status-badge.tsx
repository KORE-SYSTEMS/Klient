import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_LABELS,
  getProjectStatusPillStyle,
} from "@/lib/task-meta";

interface ProjectStatusBadgeProps {
  status: string;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium text-[10px] leading-none h-5 px-2",
        getProjectStatusPillStyle(status),
        className,
      )}
    >
      {PROJECT_STATUS_LABELS[status] || status}
    </span>
  );
}
