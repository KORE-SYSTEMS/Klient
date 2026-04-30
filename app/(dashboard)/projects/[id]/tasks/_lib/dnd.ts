import {
  pointerWithin,
  rectIntersection,
  closestCenter,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { TaskStatus } from "./types";

/**
 * Returns the status that comes after `current` in the workflow, or null if
 * `current` is already the last phase. Approval columns aren't auto-skipped —
 * callers should branch on `targetStatus.isApproval` to decide whether to
 * trigger the handoff flow.
 */
export function getNextStatus(current: string, statuses: TaskStatus[]): TaskStatus | null {
  const sorted = [...statuses].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= sorted.length - 1) return null;
  return sorted[idx + 1];
}

/**
 * Prefer pointer-within (exact hit-test) so hovering over a column or card
 * registers immediately; fall back to closest-center when the pointer is
 * between droppables (e.g. gap between columns).
 */
export const kanbanCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) return rectHits;
  return closestCenter(args);
};
