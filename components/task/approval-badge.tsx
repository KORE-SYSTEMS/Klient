import { Hourglass, ThumbsUp, ThumbsDown } from "lucide-react";

interface ApprovalBadgeProps {
  status: string | null | undefined;
}

/**
 * Renders the client approval state on a task. Returns null for tasks without
 * an approval workflow (the common case) so callers can drop it in unchecked.
 */
export function ApprovalBadge({ status }: ApprovalBadgeProps) {
  if (!status) return null;

  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
        <Hourglass className="h-2.5 w-2.5" />
        Abnahme ausstehend
      </span>
    );
  }

  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
        <ThumbsUp className="h-2.5 w-2.5" />
        Abgenommen
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <ThumbsDown className="h-2.5 w-2.5" />
        Abgelehnt
      </span>
    );
  }

  return null;
}
