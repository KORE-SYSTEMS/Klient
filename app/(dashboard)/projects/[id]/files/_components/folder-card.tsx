"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Folder } from "../_lib/types";
import { InlineRename } from "./inline-rename";

// ─── FolderCard (grid) ────────────────────────────────────────────────────────

export interface FolderCardProps {
  folder: Folder;
  colorClass: string;
  isRenaming: boolean;
  isDragOver: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onConfirmRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

export function FolderCard({
  folder,
  colorClass,
  isRenaming,
  isDragOver,
  onOpen,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderCardProps) {
  const itemLabel = `${folder._count.files} ${folder._count.files === 1 ? "Datei" : "Dateien"} · ${folder._count.children} ${folder._count.children === 1 ? "Ordner" : "Ordner"}`;

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-4 cursor-pointer transition-all select-none",
        isDragOver
          ? "border-primary bg-primary/10 scale-[1.02]"
          : "hover:bg-accent/40"
      )}
      onClick={() => !isRenaming && onOpen()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <FolderOpen className={cn("h-8 w-8", colorClass)} />
          {!isRenaming && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover-action -mr-1 -mt-1"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStartRename(); }}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Umbenennen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {isRenaming ? (
          <InlineRename value={folder.name} onConfirm={onConfirmRename} onCancel={onCancelRename} />
        ) : (
          <div>
            <p className="text-sm font-medium truncate" onDoubleClick={(e) => { e.stopPropagation(); onStartRename(); }}>
              {folder.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{itemLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FolderRow (list) ─────────────────────────────────────────────────────────

export function FolderRow({
  folder,
  colorClass,
  isRenaming,
  isDragOver,
  onOpen,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderCardProps) {
  const itemLabel = `${folder._count.files} ${folder._count.files === 1 ? "Datei" : "Dateien"} · ${folder._count.children} ${folder._count.children === 1 ? "Ordner" : "Ordner"}`;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all select-none",
        isDragOver
          ? "border-primary bg-primary/10"
          : "hover:bg-accent/40"
      )}
      onClick={() => !isRenaming && onOpen()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <FolderOpen className={cn("h-5 w-5 flex-shrink-0", colorClass)} />
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <InlineRename value={folder.name} onConfirm={onConfirmRename} onCancel={onCancelRename} />
        ) : (
          <span
            className="text-sm font-medium truncate block"
            onDoubleClick={(e) => { e.stopPropagation(); onStartRename(); }}
          >
            {folder.name}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">{itemLabel}</span>
      <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">{formatDate(folder.createdAt)}</span>
      {!isRenaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover-action flex-shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStartRename(); }}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Umbenennen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
