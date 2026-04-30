"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface InlineTitleProps {
  value: string;
  onSave: (title: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Double-click to edit, Enter to save, Esc to cancel. Used on the kanban card
 * so users can rename a task without opening the full dialog.
 */
export function InlineTitle({
  value,
  onSave,
  disabled,
  className,
  inputClassName,
}: InlineTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleDoubleClick(e: React.MouseEvent) {
    if (disabled) return;
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        className={cn(
          "w-full rounded bg-accent/60 px-1 -mx-1 outline-none ring-1 ring-primary/40",
          inputClassName,
        )}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.stopPropagation(); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={cn(disabled ? "" : "cursor-text select-text", className)}
      onDoubleClick={handleDoubleClick}
      title={disabled ? undefined : "Doppelklick zum Bearbeiten"}
    >
      {value}
    </span>
  );
}
