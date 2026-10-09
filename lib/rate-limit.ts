/**
 * Minimal in-memory failure limiter (per process). Good enough for a single
 * container; resets on restart/update, which is acceptable for brute-force
 * protection of the login form.
 */
interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

export function isLimited(key: string, max: number): boolean {
  const e = buckets.get(key);
  if (!e) return false;
  if (e.resetAt < Date.now()) {
    buckets.delete(key);
    return false;
  }
  return e.count >= max;
}

export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();
  const e = buckets.get(key);
  if (!e || e.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    e.count += 1;
  }
  // Opportunistic cleanup so the map cannot grow without bound
  if (buckets.size > 1000) {
    buckets.forEach((v, k) => {
      if (v.resetAt < now) buckets.delete(k);
    });
  }
}

export function clearFailures(key: string): void {
  buckets.delete(key);
}
