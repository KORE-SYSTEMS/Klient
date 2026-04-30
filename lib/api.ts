import { toast } from "@/hooks/use-toast";

/**
 * Thin fetch wrapper used everywhere instead of raw `fetch` + manual JSON
 * parsing. Centralizes error handling so every page reports failures the same
 * way and we can plug in retry / auth-refresh / SSE later in one place.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  /** Will be JSON.stringified and Content-Type set automatically. */
  body?: unknown;
  /** When true, returns the raw Response (e.g. for blobs/streams). */
  raw?: boolean;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, raw, headers, ...rest } = opts;

  const init: RequestInit = {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(path, init);
  if (raw) return res as unknown as T;

  if (!res.ok) {
    let errBody: unknown;
    try { errBody = await res.json(); } catch { /* ignore */ }
    const message =
      (errBody as { error?: string })?.error ||
      `Request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(res.status, message, errBody);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  // Tolerate empty body
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

interface RunOptions {
  /** Toast title shown on success. Pass null to silence. */
  success?: string | null;
  successDescription?: string;
  /** Toast title shown on failure. Pass null to silence. Default "Fehler". */
  error?: string | null;
  /** Override the description on error (otherwise uses the API error message). */
  errorDescription?: string;
}

/**
 * Wraps a promise with consistent toast feedback. Returns the result on
 * success, or `null` on failure (and shows the error toast). Intended for
 * fire-and-handle UI mutations:
 *
 *     const updated = await run(api("/api/tasks/" + id, { method: "PATCH", body: { ... } }), {
 *       success: "Gespeichert",
 *     });
 *     if (!updated) return;
 */
export async function run<T>(promise: Promise<T>, opts: RunOptions = {}): Promise<T | null> {
  try {
    const result = await promise;
    if (opts.success !== null && opts.success !== undefined) {
      toast({
        title: opts.success,
        description: opts.successDescription,
        variant: "success",
      });
    }
    return result;
  } catch (e) {
    if (opts.error !== null) {
      const message = e instanceof ApiError ? e.message : String(e);
      toast({
        title: opts.error || "Fehler",
        description: opts.errorDescription || message,
        variant: "destructive",
      });
    }
    return null;
  }
}
