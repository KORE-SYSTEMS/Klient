import { api } from "@/lib/api";

/**
 * Typed wrappers around `/api/tasks/*`. Pages should call these instead of
 * doing raw fetches — keeps URL paths and payload shapes in one place.
 */

export interface TaskCreatePayload {
  projectId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  epicId?: string | null;
  clientVisible?: boolean;
  parentId?: string | null;
  recurrenceRule?: string | null;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  epicId?: string | null;
  clientVisible?: boolean;
  order?: number;
  recurrenceRule?: string | null;
}

export const tasksApi = {
  list: (projectId: string) =>
    api<unknown[]>(`/api/tasks?projectId=${encodeURIComponent(projectId)}`),

  get: (id: string) =>
    api<unknown>(`/api/tasks/${id}`),

  create: (payload: TaskCreatePayload) =>
    api<unknown>("/api/tasks", { method: "POST", body: payload }),

  update: (id: string, payload: TaskUpdatePayload) =>
    api<unknown>(`/api/tasks/${id}`, { method: "PATCH", body: payload }),

  remove: (id: string) =>
    api<void>(`/api/tasks/${id}`, { method: "DELETE" }),

  approve: (id: string, decision: "APPROVED" | "REJECTED", comment?: string) =>
    api<unknown>(`/api/tasks/${id}/approve`, {
      method: "POST",
      body: { decision, comment },
    }),

  resubmit: (id: string, comment?: string) =>
    api<unknown>(`/api/tasks/${id}/resubmit`, {
      method: "POST",
      body: { comment },
    }),

  reorder: (id: string, order: number, status?: string) =>
    api<unknown>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: status !== undefined ? { order, status } : { order },
    }),
};
