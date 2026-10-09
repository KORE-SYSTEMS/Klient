"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  History,
  Move,
  ArrowUpToLine,
} from "lucide-react";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { FileItem } from "../_lib/types";
import { getFileIcon, isImage, currentVersion } from "../_lib/helpers";
import { InlineRename } from "./inline-rename";

// ─── FileCard (grid) ──────────────────────────────────────────────────────────

export interface FileCardProps {
  file: FileItem;
  isClient: boolean;
  isRenaming: boolean;
  onStartRename: () => void;
  onConfirmRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onVersionHistory: () => void;
  onMove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function FileCard({
  file,
  isClient,
  isRenaming,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
  onToggleVisibility,
  onVersionHistory,
  onMove,
  onDragStart,
  onDragEnd,
}: FileCardProps) {
  const Icon = getFileIcon(file.mimeType);
  const ver = currentVersion(file);

  return (
    <div
      className="group relative rounded-xl border bg-card overflow-hidden cursor-grab active:cursor-grabbing"
      draggable={!isClient}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Thumbnail or icon */}
      <div className="h-24 bg-muted/40 flex items-center justify-center overflow-hidden">
        {isImage(file.mimeType) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/files/${file.id}`}
            alt={file.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Icon className="h-10 w-10 text-muted-foreground/50" />
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-1">
          {isRenaming ? (
            <InlineRename value={file.name} onConfirm={onConfirmRename} onCancel={onCancelRename} />
          ) : (
            <p
              className="text-sm font-medium truncate flex-1 leading-snug"
              onDoubleClick={onStartRename}
              title={file.name}
            >
              {file.name}
            </p>
          )}
          {!isRenaming && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 hover-action -mr-1"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <FileActionsMenu
                file={file}
                isClient={isClient}
                onStartRename={onStartRename}
                onDelete={onDelete}
                onToggleVisibility={onToggleVisibility}
                onVersionHistory={onVersionHistory}
                onMove={onMove}
              />
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
          <Badge variant="secondary" className="font-mono text-meta px-1 h-4">v{ver}</Badge>
          {file.clientVisible && !isClient && (
            <Eye className="h-3 w-3 text-primary flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FileRow (list) ───────────────────────────────────────────────────────────

export interface FileRowProps extends FileCardProps {
  isLast: boolean;
}

export function FileRow({
  file,
  isClient,
  isRenaming,
  isLast,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
  onToggleVisibility,
  onVersionHistory,
  onMove,
  onDragStart,
  onDragEnd,
}: FileRowProps) {
  const Icon = getFileIcon(file.mimeType);
  const ver = currentVersion(file);
  const uploader = file.uploadedBy.name || file.uploadedBy.email;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 hover:bg-accent/40 transition-colors",
        !isLast && "border-b",
        !isClient && "cursor-grab active:cursor-grabbing"
      )}
      draggable={!isClient}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <Icon className="h-[18px] w-[18px] text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <InlineRename value={file.name} onConfirm={onConfirmRename} onCancel={onCancelRename} />
        ) : (
          <span
            className="text-sm font-medium truncate block"
            onDoubleClick={onStartRename}
          >
            {file.name}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap w-16 text-right">
        {formatFileSize(file.size)}
      </span>
      <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap w-24 text-right">
        {formatDate(file.createdAt)}
      </span>
      <span className="text-xs text-muted-foreground hidden lg:block whitespace-nowrap w-28 truncate">
        {uploader}
      </span>
      <Badge variant="secondary" className="font-mono text-meta px-1.5 h-5 flex-shrink-0">
        v{ver}
      </Badge>
      {!isClient && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          title={file.clientVisible ? "Für Kunden verstecken" : "Für Kunden sichtbar machen"}
          onClick={onToggleVisibility}
        >
          {file.clientVisible
            ? <Eye className="h-3.5 w-3.5 text-primary" />
            : <EyeOff className="h-3.5 w-3.5 text-muted-foreground hover-action" />
          }
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 hover-action"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <FileActionsMenu
          file={file}
          isClient={isClient}
          onStartRename={onStartRename}
          onDelete={onDelete}
          onToggleVisibility={onToggleVisibility}
          onVersionHistory={onVersionHistory}
          onMove={onMove}
        />
      </DropdownMenu>
    </div>
  );
}

// ─── Shared file actions menu ─────────────────────────────────────────────────

export interface FileActionsMenuProps {
  file: FileItem;
  isClient: boolean;
  onStartRename: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onVersionHistory: () => void;
  onMove: () => void;
}

export function FileActionsMenu({
  file,
  isClient,
  onStartRename,
  onDelete,
  onToggleVisibility,
  onVersionHistory,
  onMove,
}: FileActionsMenuProps) {
  return (
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuItem asChild>
        <a href={`/api/files/${file.id}`} download className="flex items-center">
          <Download className="mr-2 h-3.5 w-3.5" />
          Herunterladen
        </a>
      </DropdownMenuItem>
      {!isClient && (
        <>
          <DropdownMenuItem onClick={onVersionHistory}>
            <ArrowUpToLine className="mr-2 h-3.5 w-3.5" />
            Neue Version hochladen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onVersionHistory}>
            <History className="mr-2 h-3.5 w-3.5" />
            Versionen anzeigen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStartRename}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMove}>
            <Move className="mr-2 h-3.5 w-3.5" />
            Verschieben
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggleVisibility}>
            {file.clientVisible ? (
              <>
                <EyeOff className="mr-2 h-3.5 w-3.5" />
                Für Kunden verstecken
              </>
            ) : (
              <>
                <Eye className="mr-2 h-3.5 w-3.5" />
                Für Kunden sichtbar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Löschen
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );
}
