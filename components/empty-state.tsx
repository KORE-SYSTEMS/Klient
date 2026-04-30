/**
 * EmptyState — consistent zero-data UI across the whole app.
 *
 * Three sizes: default (full-page hero), compact (inside cards/panels),
 * inline (single line for tiny spots, no icon-circle, no description).
 *
 * Three tones: default, info (primary-tinted), error (destructive-tinted).
 *
 *   <EmptyState icon={FolderKanban} title="Keine Projekte" action={<Button>Neu</Button>} />
 *   <EmptyState icon={MessageSquare} title="Keine Kommentare" compact />
 *   <EmptyState icon={History} title="Konnte nicht laden" tone="error" />
 */
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type Size = "default" | "compact" | "inline";
type Tone = "default" | "info" | "error";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Vertical density. `compact` for cards/panels, `inline` for one-liners. */
  size?: Size;
  /**
   * @deprecated use `size="compact"` instead — kept for backwards-compat.
   */
  compact?: boolean;
  /** Visual tone. `error` for failure states, `info` for first-run. */
  tone?: Tone;
}

const PADDING_BY_SIZE: Record<Size, string> = {
  default: "py-16 px-6",
  compact: "py-8 px-4",
  inline:  "py-3 px-2",
};

const ICON_BG_BY_TONE: Record<Tone, string> = {
  default: "bg-muted/50",
  info:    "bg-primary/10",
  error:   "bg-destructive/10",
};

const ICON_COLOR_BY_TONE: Record<Tone, string> = {
  default: "text-muted-foreground/60",
  info:    "text-primary/80",
  error:   "text-destructive/80",
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size,
  compact,
  tone = "default",
}: EmptyStateProps) {
  const resolvedSize: Size = size ?? (compact ? "compact" : "default");
  const isInline = resolvedSize === "inline";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        PADDING_BY_SIZE[resolvedSize],
        className,
      )}
    >
      {Icon && !isInline && (
        <div
          className={cn(
            "mb-4 flex items-center justify-center rounded-full",
            resolvedSize === "compact" ? "h-10 w-10" : "h-14 w-14",
            ICON_BG_BY_TONE[tone],
          )}
        >
          <Icon
            className={cn(
              resolvedSize === "compact" ? "h-5 w-5" : "h-7 w-7",
              ICON_COLOR_BY_TONE[tone],
            )}
            strokeWidth={1.5}
          />
        </div>
      )}
      {Icon && isInline && (
        <Icon className={cn("mb-1.5 h-4 w-4", ICON_COLOR_BY_TONE[tone])} strokeWidth={1.75} />
      )}
      <p
        className={cn(
          "font-medium",
          isInline ? "text-xs text-muted-foreground" : "text-sm text-foreground",
        )}
      >
        {title}
      </p>
      {description && !isInline && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && !isInline && <div className="mt-5">{action}</div>}
    </div>
  );
}
