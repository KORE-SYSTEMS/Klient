"use client";

import { useEffect } from "react";

/**
 * useRefetchOnFocus
 *
 * Calls `refetch` whenever the page becomes visible again (tab switch) or
 * the window regains focus. Used by data-driven pages that want a fresh
 * snapshot when the user returns from another tab/app.
 *
 * Why both events: `visibilitychange` fires on tab switches, `focus` fires
 * on alt-tabbing between windows. Some browsers don't fire both reliably,
 * so we listen for both — `refetch` itself should be cheap/idempotent
 * (typically a single in-flight-deduped GET via lib/api.ts).
 *
 * Pass a stable callback (e.g. `useCallback`) — the hook re-binds the
 * listener whenever `refetch` identity changes.
 */
export function useRefetchOnFocus(refetch: () => void) {
  useEffect(() => {
    function onVisible() {
      if (!document.hidden) refetch();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refetch);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refetch);
    };
  }, [refetch]);
}
