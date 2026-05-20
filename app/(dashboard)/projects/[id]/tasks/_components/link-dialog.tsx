"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LINK_TYPES } from "@/lib/task-meta";
import type { Task } from "../_lib/types";

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTaskId: string;
  type: string;
  setType: (v: string) => void;
  targetId: string;
  setTargetId: (v: string) => void;
  tasks: Task[];
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

/**
 * Link two tasks (related/blocks/duplicates/…). Source task is fixed by the
 * opener; the user picks the relationship type and the target task.
 */
export function LinkDialog({
  open,
  onOpenChange,
  sourceTaskId,
  type,
  setType,
  targetId,
  setTargetId,
  tasks,
  onSubmit,
}: LinkDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Task verknüpfen</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Typ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((lt) => (
                  <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ziel-Task</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Task auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {tasks.filter((t) => t.id !== sourceTaskId).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!targetId}>Verknüpfen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
