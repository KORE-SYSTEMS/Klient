"use client";

import { useEffect } from "react";

/**
 * Triggert window.print() einmal nach dem Mount.
 * Verzögerung damit Fonts + Layout fertig geladen sind.
 */
export function AutoPrint() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      window.print();
    }, 350);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
