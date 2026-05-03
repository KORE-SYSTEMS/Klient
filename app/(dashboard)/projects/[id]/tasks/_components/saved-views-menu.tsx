"use client";

import { useState } from "react";
import { Bookmark, BookmarkPlus, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavedView, ViewKind } from "../_lib/use-saved-views";
import type { TaskFilterState } from "./task-filters";

interface SavedViewsMenuProps {
  views: SavedView[];
  currentView: ViewKind;
  currentFilters: TaskFilterState;
  hasActiveFilters: boolean;
  onApply: (view: SavedView) => void;
  onSave: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Dropdown to load / save / rename / delete saved views.
 * Sits next to the View-Toggle in the toolbar.
 */
export function SavedViewsMenu({
  views,
  hasActiveFilters,
  onApply,
  onSave,
  onRename,
  onDelete,
}: SavedViewsMenuProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setSaveOpen(false);
  }

  function startRename(view: SavedView) {
    setRenameId(view.id);
    setRenameValue(view.name);
  }

  function commitRename() {
    if (!renameId) return;
    if (renameValue.trim()) onRename(renameId, renameValue);
    setRenameId(null);
    setRenameValue("");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
            <Bookmark className="h-3.5 w-3.5" />
            Views
            {views.length > 0 && (
              <span className="text-meta tabular-nums text-muted-foreground/60">
                {views.length}
              </span>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {views.length === 0 ? (
            <DropdownMenuLabel className="text-xs text-muted-foreground py-3 text-center font-normal">
              Noch keine gespeicherten Views
            </DropdownMenuLabel>
          ) : (
            <>
              <DropdownMenuLabel className="text-meta uppercase tracking-wider text-muted-foreground/70">
                Gespeichert
              </DropdownMenuLabel>
              {views.map((v) => (
                <div key={v.id} className="group flex items-center gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => onApply(v)}
                    className="flex-1 flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent"
                  >
                    <Bookmark className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{v.name}</span>
                    <span className="ml-auto text-meta text-muted-foreground/60">
                      {v.view === "kanban" ? "Board" : v.view === "list" ? "Liste" : "Kalender"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startRename(v)}
                    className="hover-action rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Umbenennen"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(v.id)}
                    className="hover-action rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Löschen"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={(e) => { e.preventDefault(); setSaveOpen(true); }}
            disabled={!hasActiveFilters}
            className="gap-2"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Aktuelle Ansicht speichern…
          </DropdownMenuItem>
          {!hasActiveFilters && (
            <p className="px-2 pb-1 pt-0 text-meta text-muted-foreground/70">
              Setze Filter, um eine Ansicht zu speichern.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ansicht speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <Label htmlFor="view-name">Name</Label>
            <Input
              id="view-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="z.B. Meine offenen Aufgaben"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameId !== null} onOpenChange={(o) => { if (!o) setRenameId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>View umbenennen</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <Label htmlFor="rename-view">Name</Label>
            <Input
              id="rename-view"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameId(null)}>Abbrechen</Button>
            <Button onClick={commitRename} disabled={!renameValue.trim()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
