import { api } from "@/lib/api";

export const projectsApi = {
  list: (opts: { archived?: boolean } = {}) =>
    api<unknown[]>(`/api/projects${opts.archived ? "?archived=true" : ""}`),

  get: (id: string) =>
    api<unknown>(`/api/projects/${id}`),

  update: (id: string, payload: Record<string, unknown>) =>
    api<unknown>(`/api/projects/${id}`, { method: "PATCH", body: payload }),

  remove: (id: string) =>
    api<void>(`/api/projects/${id}`, { method: "DELETE" }),

  statuses: (id: string) =>
    api<unknown[]>(`/api/projects/${id}/statuses`),

  reorderStatuses: (id: string, order: string[]) =>
    api<unknown>(`/api/projects/${id}/statuses/reorder`, {
      method: "POST",
      body: { order },
    }),

  epics: (id: string) =>
    api<unknown[]>(`/api/projects/${id}/epics`),
};
