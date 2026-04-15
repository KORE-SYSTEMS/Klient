"use client";

/**
 * useKeyboardShortcuts
 *
 * Registers a map of keyboard shortcuts. Each key is a shortcut descriptor:
 *   "c"          — single key
 *   "g+p"        — chord (press g, then p within 800 ms)
 *   "shift+c"    — modifier + key
 *   "meta+k"     — Cmd/Ctrl + k  (meta matches both metaKey and ctrlKey)
 *
 * Shortcuts are suppressed when any input/textarea/[contenteditable] is focused.
 * A chord resets if the second key doesn't arrive within 800 ms or if any key
 * outside the chord alphabet is pressed while waiting.
 */
import { useEffect, useRef } from "react";

type Handler = () => void;
type ShortcutMap = Record<string, Handler>;

function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function parseShortcut(descriptor: string) {
  const parts = descriptor.toLowerCase().split("+");
  return {
    chord: parts.length > 1 && !["shift", "meta", "ctrl", "alt"].includes(parts[0]),
    key: parts[parts.length - 1],
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("ctrl"),
    alt: parts.includes("alt"),
    // chord prefix key (e.g. "g" in "g+p")
    prefix: parts.length > 1 && !["shift", "meta", "ctrl", "alt"].includes(parts[0]) ? parts[0] : null,
  };
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    let chordPrefix: string | null = null;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    function resetChord() {
      chordPrefix = null;
      if (chordTimer) { clearTimeout(chordTimer); chordTimer = null; }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      const pressedKey = e.key.toLowerCase();
      const hasModifier = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

      // Try to match against all shortcuts
      for (const [descriptor, handler] of Object.entries(shortcutsRef.current)) {
        const parsed = parseShortcut(descriptor);

        // Chord (e.g. "g+p")
        if (parsed.chord && parsed.prefix) {
          // Waiting for second key in chord
          if (chordPrefix === parsed.prefix && pressedKey === parsed.key && !hasModifier) {
            e.preventDefault();
            resetChord();
            handler();
            return;
          }
          // First key of chord pressed
          if (!chordPrefix && pressedKey === parsed.prefix && !hasModifier) {
            chordPrefix = parsed.prefix;
            chordTimer = setTimeout(resetChord, 800);
            // Don't return — let other shortcuts still fire
          }
          continue;
        }

        // Modifier shortcut (e.g. "meta+k")
        if (parsed.meta && (e.metaKey || e.ctrlKey) && pressedKey === parsed.key) {
          e.preventDefault();
          resetChord();
          handler();
          return;
        }
        if (parsed.shift && e.shiftKey && pressedKey === parsed.key) {
          e.preventDefault();
          resetChord();
          handler();
          return;
        }

        // Plain single key — only fire when no chord is pending and no modifier held
        if (!parsed.chord && !parsed.meta && !parsed.shift && !parsed.alt && !hasModifier && pressedKey === parsed.key) {
          if (chordPrefix) continue; // waiting for chord completion — skip plain keys
          e.preventDefault();
          handler();
          return;
        }
      }

      // Any unrelated key while in chord — reset
      if (chordPrefix && !["g"].includes(pressedKey)) {
        resetChord();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      resetChord();
    };
  }, []); // stable — shortcutsRef always up-to-date
}
