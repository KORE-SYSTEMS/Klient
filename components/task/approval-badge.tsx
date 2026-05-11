import { Hourglass, ThumbsUp, ThumbsDown } from "lucide-react";

interface ApprovalBadgeProps {
  status: string | null | undefined;
}

const BASE_CLS =
  "inline-flex items-center gap-1 rounded-full font-medium text-[10px] leading-none h-5 px-2";

/**
 * Renders the client approval state on a task. Returns null for tasks without
 * an approval workflow (the common case) so callers can drop it in unchecked.
 */
export function ApprovalBadge({ status }: ApprovalBadgeProps) {
  if (!status) return null;

  if (status === "PENDING") {
    return (
      <span className={`${BASE_CLS} bg-warning/10 text-warning`}>
        <Hourglass className="h-2.5 w-2.5" />
        Abnahme ausstehend
      </span>
    );
  }

  if (status === "APPROVED") {
    return (
      <span className={`${BASE_CLS} bg-success/10 text-success`}>
        <ThumbsUp className="h-2.5 w-2.5" />
        Abgenommen
      </span>
    );
  }

  if (status === "REJECTED") {
    return (
      <span className={`${BASE_CLS} bg-destructive/10 text-destructive`}>
        <ThumbsDown className="h-2.5 w-2.5" />
        Abgelehnt
      </span>
    );
  }

  return null;
}
