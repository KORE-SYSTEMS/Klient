"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Density = "comfortable" | "compact";
const STORAGE_KEY = "klient.density";

interface DensityContextValue {
  density: Density;
  setDensity: (d: Density) => void;
  toggle: () => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

/**
 * Density (UI dichte) toggle. Persists to localStorage and reflects on
 * `<html data-density="...">`. CSS rules in globals.css scale paddings,
 * row heights, and card spacing when compact is active.
 */
export function DensityProvider({ children }: { children: React.ReactNode }) {
  // SSR: start with "comfortable", hydrate from localStorage on mount.
  const [density, setDensityState] = useState<Density>("comfortable");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "compact" || saved === "comfortable") {
        setDensityState(saved);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try { window.localStorage.setItem(STORAGE_KEY, d); } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setDensity(density === "compact" ? "comfortable" : "compact");
  }, [density, setDensity]);

  return (
    <DensityContext.Provider value={{ density, setDensity, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error("useDensity must be used within DensityProvider");
  return ctx;
}
