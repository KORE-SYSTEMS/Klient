"use client";

import {
  useActiveTimer,
  FloatingTimer,
} from "@/components/time-tracker";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface TimerContextValue {
  activeTimer: ReturnType<typeof useActiveTimer>["activeTimer"];
  elapsed: number;
  startTimer: (taskId: string) => Promise<boolean>;
  /** Opens the stop dialog (with comment field). Do NOT call stopTimer directly. */
  requestStop: () => void;
  /** Direct stop (used internally after comment is entered) */
  stopTimer: (comment?: string) => Promise<boolean>;
  fetchActive: () => Promise<void>;
  setOnChange: (fn: (() => void) | null) => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useGlobalTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error("useGlobalTimer must be used within GlobalTimerProvider");
  }
  return ctx;
}

export function GlobalTimerProvider({ children }: { children: ReactNode }) {
  const timer = useActiveTimer();
  const [stopRequested, setStopRequested] = useState(false);

  const requestStop = useCallback(() => {
    setStopRequested(true);
  }, []);

  const handleStop = useCallback(
    async (comment?: string) => {
      const ok = await timer.stopTimer(comment);
      setStopRequested(false);
      return ok;
    },
    [timer]
  );

  const value: TimerContextValue = {
    activeTimer: timer.activeTimer,
    elapsed: timer.elapsed,
    startTimer: timer.startTimer,
    requestStop,
    stopTimer: timer.stopTimer,
    fetchActive: timer.fetchActive,
    setOnChange: timer.setOnChange,
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
      <FloatingTimer
        activeTimer={timer.activeTimer}
        elapsed={timer.elapsed}
        onStop={handleStop}
        forceStopDialog={stopRequested}
        onStopDialogClose={() => setStopRequested(false)}
      />
    </TimerContext.Provider>
  );
}
