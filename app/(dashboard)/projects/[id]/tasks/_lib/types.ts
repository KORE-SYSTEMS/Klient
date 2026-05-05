/**
 * Domain types shared across all task-page sub-components. Kept colocated with
 * the route they belong to — these aren't app-wide types, they shape the
 * client-side Task representation used by this page.
 */

export interface TaskStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  isApproval: boolean;
  /** Semantic bucket for "done"/progress logic regardless of custom naming. */
  category?: "TODO" | "IN_PROGRESS" | "DONE";
}

export interface Epic {
  id: string;
  title: string;
  description?: string;
  color: string;
  order: number;
  _count?: { tasks: number };
}

export interface TaskLinkInfo {
  id: string;
  type: string;
  sourceTask?: { id: string; title: string; status: string };
  targetTask?: { id: string; title: string; status: string };
}

export interface TimeEntryInfo {
  id: string;
  duration: number;
  startedAt: string;
  stoppedAt: string | null;
  userId: string;
}

export interface TaskComment {
  id: string;
  content: string;
  authorId: string;
  author: { id: string; name: string; email: string; image?: string; role?: string };
  mentions: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  type: string;
  userId: string;
  user: { id: string; name: string; email: string; image?: string };
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface TaskFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: { id: string; name: string; email: string };
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  clientVisible: boolean;
  startDate?: string | null;
  dueDate?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  assigneeId?: string | null;
  epic?: { id: string; title: string; color: string } | null;
  epicId?: string | null;
  sourceLinks?: TaskLinkInfo[];
  targetLinks?: TaskLinkInfo[];
  timeEntries?: TimeEntryInfo[];
  totalTime?: number;
  activeEntry?: TimeEntryInfo | null;
  order?: number;
  approvalStatus?: string | null;
  handoffComment?: string | null;
  approvalComment?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  parentId?: string | null;
  /** JSON-String mit der Wiederholungsregel (siehe lib/recurrence.ts). */
  recurrenceRule?: string | null;
  _isPreview?: boolean;
  _count?: {
    comments?: number;
    files?: number;
    checklistItems?: number;
    checklistDone?: number;
    subtasks?: number;
    subtasksDone?: number;
  };
  [key: string]: unknown;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: string;
  statusId: string | null;
  epicId: string | null;
  /** JSON-encoded array of strings — parse before use. */
  subtaskTitles: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}
