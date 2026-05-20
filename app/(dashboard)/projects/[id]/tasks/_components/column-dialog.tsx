"use client";

import { ClipboardCheck } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "../_lib/types";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#6b7280",
];

interface ColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editColumn: TaskStatus | null;
  name: string;
  setName: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  isApproval: boolean;
  setIsApproval: (v: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

/**
 * Create/edit a Kanban column (TaskStatus). Lives in its own file to keep
 * the main tasks page focused on board + list rendering. Form state stays
 * controlled by the parent so the existing save/cancel flow there keeps
 * working unchanged.
 */
export function ColumnDialog({
  open,
  onOpenChange,
  editColumn,
  name,
  setName,
  color,
  setColor,
  isApproval,
  setIsApproval,
  onSubmit,
}: ColumnDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editColumn ? "Spalte bearbeiten" : "Neue Spalte"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="colName">Name</Label>
            <Input
              id="colName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="z.B. QA, Staging..."
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
          {/* Approval toggle */}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5 text-warning" />
                Abnahme-Spalte
              </Label>
              <p className="text-caption text-muted-foreground leading-snug">
                Tasks müssen vom Kunden genehmigt werden, bevor sie in diese Spalte verschoben werden können.
              </p>
            </div>
            <Switch checked={isApproval} onCheckedChange={setIsApproval} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim()}>
              {editColumn ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
