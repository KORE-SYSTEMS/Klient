"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Epic } from "../_lib/types";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
];

interface EpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEpic: Epic | null;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onDelete: (epic: Epic) => void;
}

/**
 * Create/edit/delete an Epic. Controlled form state remains in the parent
 * so the existing fetchEpics/fetchTasks side-effects keep firing in the
 * same place as before — this is just a UI extraction.
 */
export function EpicDialog({
  open,
  onOpenChange,
  editEpic,
  title,
  setTitle,
  description,
  setDescription,
  color,
  setColor,
  onSubmit,
  onDelete,
}: EpicDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editEpic ? "Epic bearbeiten" : "Neues Epic"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="epicTitle">Titel</Label>
            <Input
              id="epicTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="z.B. User Authentication, Dashboard..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="epicDesc">Beschreibung</Label>
            <Textarea
              id="epicDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Farbe</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                    color === c ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            {editEpic && (
              <Button type="button" variant="destructive" onClick={() => onDelete(editEpic)}>
                Löschen
              </Button>
            )}
            <Button type="submit" disabled={!title.trim()}>
              {editEpic ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
