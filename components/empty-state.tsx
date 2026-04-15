/**
 * EmptyState — consistent zero-data UI across the whole app.
 *
 * Usage:
 *   <EmptyState
 *     icon={FolderKanban}
 *     title="Noch keine Projekte"
 *     description="Erstelle dein erstes Projekt um loszulegen."
 *     action={<Button>Neues Projekt</Button>}
 *   />
 */
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** compact = less vertical padding, used inside cards/panels */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-16 px-6",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
          <Icon className="h-7 w-7 text-muted-foreground/60" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
