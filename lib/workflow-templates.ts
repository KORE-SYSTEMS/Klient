/**
 * Workflow templates — predefined status sets that can be applied to a project.
 *
 * The category field drives "done / in progress / open" semantics and is kept
 * separate from display name so that custom renaming never breaks progress logic.
 */

export type StatusCategory = "TODO" | "IN_PROGRESS" | "DONE";

export interface TemplateStatus {
  /** Short stable slug — joined with the project id to form the TaskStatus.id */
  slug: string;
  name: string;
  color: string;
  category: StatusCategory;
  isApproval?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  statuses: TemplateStatus[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "simple",
    name: "Einfach",
    description: "Drei Phasen für kleine Projekte und schnelle To-Dos.",
    statuses: [
      { slug: "TODO",        name: "To Do",     color: "#3b82f6", category: "TODO" },
      { slug: "IN_PROGRESS", name: "In Arbeit", color: "#f97316", category: "IN_PROGRESS" },
      { slug: "DONE",        name: "Erledigt",  color: "#10b981", category: "DONE" },
    ],
  },
  {
    id: "agile",
    name: "Agile",
    description: "Klassischer Scrum-Flow mit Backlog, Review und Done.",
    statuses: [
      { slug: "BACKLOG",     name: "Backlog",   color: "#6b7280", category: "TODO" },
      { slug: "TODO",        name: "To Do",     color: "#3b82f6", category: "TODO" },
      { slug: "IN_PROGRESS", name: "In Arbeit", color: "#f97316", category: "IN_PROGRESS" },
      { slug: "IN_REVIEW",   name: "In Review", color: "#eab308", category: "IN_PROGRESS" },
      { slug: "DONE",        name: "Erledigt",  color: "#10b981", category: "DONE" },
    ],
  },
  {
    id: "client-approval",
    name: "Mit Kunden-Abnahme",
    description: "Workflow mit dedizierter Abnahme-Phase für Kundenfreigabe.",
    statuses: [
      { slug: "TODO",        name: "To Do",     color: "#3b82f6", category: "TODO" },
      { slug: "IN_PROGRESS", name: "In Arbeit", color: "#f97316", category: "IN_PROGRESS" },
      { slug: "CLIENT_REVIEW", name: "Kunden-Abnahme", color: "#eab308", category: "IN_PROGRESS", isApproval: true },
      { slug: "DONE",        name: "Erledigt",  color: "#10b981", category: "DONE" },
    ],
  },
];

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}

/** Default template used when a project has no explicit workflow yet. */
export const DEFAULT_TEMPLATE_ID = "agile";
