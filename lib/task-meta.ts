/**
 * Single source of truth for task/project metadata: priority labels & styles,
 * project status labels, sort orders. Anything that was duplicated across
 * dashboard, /tasks, and /projects/[id]/tasks lives here now.
 *
 * UI components (badges, pills) live in `components/task/*` and consume these
 * values — keep this file purely data so it stays import-light.
 */

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Niedrig",
  MEDIUM: "Mittel",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

/** Sort order for priority lists — URGENT first. */
export const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/** Tailwind classes for priority pills. */
export function getPriorityPillStyle(priority: string): string {
  switch (priority) {
    case "URGENT": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "HIGH":   return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "LOW":    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:       return "bg-muted text-muted-foreground";
  }
}

/** Hex color for priority — used in chart legends, group headers, etc. */
export function getPriorityHex(priority: string): string {
  switch (priority) {
    case "URGENT": return "#ef4444";
    case "HIGH":   return "#f97316";
    case "MEDIUM": return "#eab308";
    case "LOW":    return "#22c55e";
    default:       return "#94a3b8";
  }
}

// --- Project status (free Project.status field, not the per-project workflow) ---

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING:    "Planung",
  IN_PROGRESS: "In Arbeit",
  ON_HOLD:     "Pausiert",
  DONE:        "Abgeschlossen",
};

export function getProjectStatusPillStyle(status: string): string {
  switch (status) {
    case "PLANNING":    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "IN_PROGRESS": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "ON_HOLD":     return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "DONE":        return "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400";
    default:            return "bg-muted text-muted-foreground";
  }
}

// --- Approval workflow ---

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  PENDING:  "Abnahme ausstehend",
  APPROVED: "Abgenommen",
  REJECTED: "Abgelehnt",
};

// --- Task activity log labels ---

export const ACTIVITY_LABELS: Record<string, string> = {
  CREATED:           "hat den Task erstellt",
  STATUS_CHANGE:     "hat den Status geändert",
  PRIORITY_CHANGE:   "hat die Priorität geändert",
  ASSIGNMENT:        "hat die Zuweisung geändert",
  COMMENT:           "hat kommentiert",
  FILE_UPLOAD:       "hat eine Datei hochgeladen",
  TIME_ENTRY:        "hat Zeit erfasst",
  APPROVAL_APPROVED: "hat den Task genehmigt",
  APPROVAL_REJECTED: "hat den Task abgelehnt",
};

// --- Task link types ---

export const LINK_TYPES = [
  { value: "RELATED",    label: "Verwandt" },
  { value: "BLOCKS",     label: "Blockiert" },
  { value: "BLOCKED_BY", label: "Blockiert von" },
  { value: "DEPENDS_ON", label: "Abhängig von" },
] as const;
