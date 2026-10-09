"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Download,
  ChevronRight,
  Move,
  ArrowUpToLine,
  Layers,
  Grid2X2,
  List,
} from "lucide-react";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Folder, VersionEntry, FileItem, Breadcrumb } from "./_lib/types";
import { folderColor } from "./_lib/helpers";
import { FolderCard, FolderRow } from "./_components/folder-card";
import { FileCard, FileRow } from "./_components/file-card";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const { toast } = useToast();
  const isClient = session?.user?.role === "CLIENT";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionFileInputRef = useRef<HTMLInputElement>(null);

  // ── Core state ──
  const [folderId, setFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { id: null, name: "Dateien" },
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── View mode (persisted) ──
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("filesViewMode") as "grid" | "list") ?? "list";
    }
    return "list";
  });

  // ── Upload ──
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // ── Drag-to-folder ──
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);

  // ── Inline rename ──
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingType, setRenamingType] = useState<"folder" | "file">("folder");

  // ── New folder dialog ──
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // ── Version history dialog ──
  const [versionFile, setVersionFile] = useState<FileItem | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [versionNote, setVersionNote] = useState("");
  const [versionDragOver, setVersionDragOver] = useState(false);

  // ── Move file dialog ──
  const [moveFile, setMoveFile] = useState<FileItem | null>(null);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchContents = useCallback(async () => {
    setLoading(true);
    try {
      const folderParam = folderId ? `&parentId=${folderId}` : "";
      const fileParam = folderId ? folderId : "root";

      const [foldersRes, filesRes] = await Promise.all([
        isClient ? Promise.resolve(null) : fetch(`/api/folders?projectId=${projectId}${folderParam}`),
        fetch(`/api/files?projectId=${projectId}&folderId=${fileParam}`),
      ]);

      if (foldersRes?.ok) {
        const data = await foldersRes.json() as Folder[];
        setFolders(data);
      }
      if (filesRes?.ok) {
        const data = await filesRes.json() as FileItem[];
        setFiles(data);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, folderId, isClient]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  // ─── View mode persistence ────────────────────────────────────────────────

  function toggleViewMode(mode: "grid" | "list") {
    setViewMode(mode);
    localStorage.setItem("filesViewMode", mode);
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  function openFolder(folder: Folder) {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setFolderId(folder.id);
  }

  function navigateToBreadcrumb(index: number) {
    const crumb = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setFolderId(crumb.id);
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  async function uploadFiles(fileList: FileList | File[]) {
    setUploading(true);
    const formData = new FormData();
    formData.append("projectId", projectId);
    if (folderId) formData.append("folderId", folderId);
    Array.from(fileList).forEach((f) => formData.append("files", f));

    const res = await fetch("/api/files", { method: "POST", body: formData });
    setUploading(false);

    if (res.ok) {
      toast({ title: "Hochgeladen", description: "Dateien erfolgreich hochgeladen." });
      fetchContents();
    } else {
      toast({ title: "Fehler", description: "Upload fehlgeschlagen.", variant: "destructive" });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  // ─── New Folder ───────────────────────────────────────────────────────────

  async function createFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name: newFolderName.trim(), parentId: folderId }),
    });
    setCreatingFolder(false);
    if (res.ok) {
      setNewFolderOpen(false);
      setNewFolderName("");
      fetchContents();
    } else {
      toast({ title: "Fehler", description: "Ordner konnte nicht erstellt werden.", variant: "destructive" });
    }
  }

  // ─── Rename ───────────────────────────────────────────────────────────────

  async function renameFolder(id: string, name: string) {
    setRenamingId(null);
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      fetchContents();
    } else {
      toast({ title: "Fehler", description: "Umbenennen fehlgeschlagen.", variant: "destructive" });
    }
  }

  async function renameFile(id: string, name: string) {
    setRenamingId(null);
    const res = await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      fetchContents();
    } else {
      toast({ title: "Fehler", description: "Umbenennen fehlgeschlagen.", variant: "destructive" });
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function deleteFolder(id: string) {
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchContents();
      toast({ title: "Ordner gelöscht" });
    } else {
      toast({ title: "Fehler", description: "Ordner konnte nicht gelöscht werden.", variant: "destructive" });
    }
  }

  async function deleteFile(id: string) {
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchContents();
      toast({ title: "Datei gelöscht" });
    } else {
      toast({ title: "Fehler", description: "Datei konnte nicht gelöscht werden.", variant: "destructive" });
    }
  }

  // ─── Visibility toggle ────────────────────────────────────────────────────

  async function toggleVisibility(id: string, visible: boolean) {
    const res = await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientVisible: visible }),
    });
    if (res.ok) {
      fetchContents();
    } else {
      toast({ title: "Fehler", description: "Sichtbarkeit konnte nicht geändert werden.", variant: "destructive" });
    }
  }

  // ─── Drag file into folder ────────────────────────────────────────────────

  async function moveFileToFolder(fileId: string, targetFolderId: string | null) {
    const res = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: targetFolderId }),
    });
    if (res.ok) {
      fetchContents();
      toast({ title: "Datei verschoben" });
    } else {
      toast({ title: "Fehler", description: "Verschieben fehlgeschlagen.", variant: "destructive" });
    }
  }

  // ─── Move file dialog ─────────────────────────────────────────────────────

  async function openMoveDialog(file: FileItem) {
    setMoveFile(file);
    // Fetch all folders for this project (flat)
    const res = await fetch(`/api/folders?projectId=${projectId}`);
    if (res.ok) {
      const data = await res.json() as Folder[];
      setAllFolders(data);
    }
  }

  async function confirmMove(targetFolderId: string | null) {
    if (!moveFile) return;
    await moveFileToFolder(moveFile.id, targetFolderId);
    setMoveFile(null);
  }

  // ─── Version history ──────────────────────────────────────────────────────

  async function openVersionHistory(file: FileItem) {
    setVersionFile(file);
    setVersionsLoading(true);
    const res = await fetch(`/api/files/${file.id}/versions`);
    if (res.ok) {
      const data = await res.json() as VersionEntry[];
      setVersions(data);
    }
    setVersionsLoading(false);
  }

  async function uploadNewVersion(fileList: FileList | File[]) {
    if (!versionFile || fileList.length === 0) return;
    setUploadingVersion(true);
    const formData = new FormData();
    formData.append("file", fileList[0]);
    if (versionNote.trim()) formData.append("note", versionNote.trim());

    const res = await fetch(`/api/files/${versionFile.id}/versions`, {
      method: "POST",
      body: formData,
    });
    setUploadingVersion(false);

    if (res.ok) {
      const updatedFile = await res.json() as FileItem & { versions: VersionEntry[] };
      // Refresh version list
      setVersions(updatedFile.versions);
      setVersionNote("");
      // Update file in list
      setFiles((prev) =>
        prev.map((f) =>
          f.id === versionFile.id
            ? { ...f, name: updatedFile.name, size: updatedFile.size, versions: [{ version: updatedFile.versions[0]?.version ?? 1 }] }
            : f
        )
      );
      // Update versionFile reference
      setVersionFile((prev) =>
        prev
          ? { ...prev, name: updatedFile.name, size: updatedFile.size, versions: [{ version: updatedFile.versions[0]?.version ?? 1 }] }
          : null
      );
      toast({ title: "Neue Version hochgeladen" });
    } else {
      toast({ title: "Fehler", description: "Upload fehlgeschlagen.", variant: "destructive" });
    }
  }

  // ─── Skeleton loader ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-24 rounded" />
            <Skeleton className="h-8 w-24 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-sm border p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = folders.length === 0 && files.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm min-w-0 flex-1">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
              <button
                className={cn(
                  "truncate max-w-[160px] hover:text-foreground transition-colors",
                  i === breadcrumbs.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={() => navigateToBreadcrumb(i)}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* View toggle */}
          <div className="flex items-center rounded-md border overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-none border-r", viewMode === "grid" && "bg-accent")}
              onClick={() => toggleViewMode("grid")}
              title="Rasteransicht"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-none", viewMode === "list" && "bg-accent")}
              onClick={() => toggleViewMode("list")}
              title="Listenansicht"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {!isClient && (
            <>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setNewFolderOpen(true)}>
                <FolderPlus className="h-3.5 w-3.5" />
                Ordner
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => fileInputRef.current?.click()}>
                <ArrowUpToLine className="h-3.5 w-3.5" />
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Drop zone (full content area) ── */}
      <div
        className={cn(
          "relative min-h-[200px] rounded-xl transition-colors",
          dragOver && !isClient ? "bg-primary/5 ring-2 ring-primary ring-dashed" : ""
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isClient && e.dataTransfer.types.includes("Files")) setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDrop={(e) => {
          if (!isClient) handleDrop(e);
        }}
      >
        {dragOver && !isClient && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">Dateien hier ablegen</p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Upload className="h-4 w-4 animate-bounce" />
            Wird hochgeladen…
          </div>
        )}

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Dieser Ordner ist leer</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isClient
                  ? "Noch keine Dateien freigegeben."
                  : "Dateien hochladen oder neuen Ordner erstellen."}
              </p>
            </div>
            {!isClient && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
                  <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                  Ordner erstellen
                </Button>
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Dateien hochladen
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── Folders ── */}
            {folders.length > 0 && (
              viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {folders.map((folder, i) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      colorClass={folderColor(i)}
                      isRenaming={renamingId === folder.id}
                      isDragOver={dragOverFolder === folder.id}
                      onOpen={() => openFolder(folder)}
                      onStartRename={() => { setRenamingId(folder.id); setRenamingType("folder"); }}
                      onConfirmRename={(name) => renameFolder(folder.id, name)}
                      onCancelRename={() => setRenamingId(null)}
                      onDelete={() => deleteFolder(folder.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggingFileId) setDragOverFolder(folder.id);
                      }}
                      onDragLeave={() => setDragOverFolder(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverFolder(null);
                        if (draggingFileId) moveFileToFolder(draggingFileId, folder.id);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {folders.map((folder, i) => (
                    <FolderRow
                      key={folder.id}
                      folder={folder}
                      colorClass={folderColor(i)}
                      isRenaming={renamingId === folder.id}
                      isDragOver={dragOverFolder === folder.id}
                      onOpen={() => openFolder(folder)}
                      onStartRename={() => { setRenamingId(folder.id); setRenamingType("folder"); }}
                      onConfirmRename={(name) => renameFolder(folder.id, name)}
                      onCancelRename={() => setRenamingId(null)}
                      onDelete={() => deleteFolder(folder.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggingFileId) setDragOverFolder(folder.id);
                      }}
                      onDragLeave={() => setDragOverFolder(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverFolder(null);
                        if (draggingFileId) moveFileToFolder(draggingFileId, folder.id);
                      }}
                    />
                  ))}
                </div>
              )
            )}

            {/* ── Files ── */}
            {files.length > 0 && (
              viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      isClient={isClient}
                      isRenaming={renamingId === file.id}
                      onStartRename={() => { setRenamingId(file.id); setRenamingType("file"); }}
                      onConfirmRename={(name) => renameFile(file.id, name)}
                      onCancelRename={() => setRenamingId(null)}
                      onDelete={() => deleteFile(file.id)}
                      onToggleVisibility={() => toggleVisibility(file.id, !file.clientVisible)}
                      onVersionHistory={() => openVersionHistory(file)}
                      onMove={() => openMoveDialog(file)}
                      onDragStart={() => setDraggingFileId(file.id)}
                      onDragEnd={() => setDraggingFileId(null)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  {files.map((file, i) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      isClient={isClient}
                      isRenaming={renamingId === file.id}
                      isLast={i === files.length - 1}
                      onStartRename={() => { setRenamingId(file.id); setRenamingType("file"); }}
                      onConfirmRename={(name) => renameFile(file.id, name)}
                      onCancelRename={() => setRenamingId(null)}
                      onDelete={() => deleteFile(file.id)}
                      onToggleVisibility={() => toggleVisibility(file.id, !file.clientVisible)}
                      onVersionHistory={() => openVersionHistory(file)}
                      onMove={() => openMoveDialog(file)}
                      onDragStart={() => setDraggingFileId(file.id)}
                      onDragEnd={() => setDraggingFileId(null)}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── New Folder Dialog ── */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Neuer Ordner</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="z.B. Assets, Dokumente…"
              onKeyDown={(e) => {
                if (e.key === "Enter") createFolder();
                if (e.key === "Escape") setNewFolderOpen(false);
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={createFolder} disabled={!newFolderName.trim() || creatingFolder}>
              <FolderPlus className="mr-1.5 h-4 w-4" />
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Version History Dialog ── */}
      <Dialog open={!!versionFile} onOpenChange={(open) => { if (!open) { setVersionFile(null); setVersionNote(""); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Versionen: {versionFile?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {versionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Noch keine Versionen gespeichert.
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Version</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Datum</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hochgeladen von</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Größe</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Notiz</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v, i) => (
                      <tr key={v.id} className={cn("border-b last:border-0", i === 0 && "bg-primary/5")}>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="font-mono text-xs">v{v.version}</Badge>
                            {i === 0 && <span className="text-xs text-primary font-medium">aktuell</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{formatDate(v.createdAt)}</td>
                        <td className="px-3 py-2">{v.uploadedBy.name || v.uploadedBy.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{formatFileSize(v.size)}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{v.note || "—"}</td>
                        <td className="px-3 py-2">
                          <a href={`/api/files/${v.fileId}`} download>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* New version upload area */}
            {!isClient && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm font-medium">Neue Version hochladen</p>
                <div
                  className={cn(
                    "rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer",
                    versionDragOver ? "border-primary bg-primary/5" : "border-border"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setVersionDragOver(true); }}
                  onDragLeave={() => setVersionDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setVersionDragOver(false);
                    if (e.dataTransfer.files.length > 0) uploadNewVersion(e.dataTransfer.files);
                  }}
                  onClick={() => versionFileInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-5 w-5 text-muted-foreground mb-1.5" />
                  <p className="text-sm text-muted-foreground">
                    {uploadingVersion ? "Wird hochgeladen…" : "Datei hier ablegen oder klicken"}
                  </p>
                  <input
                    ref={versionFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files && uploadNewVersion(e.target.files)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="version-note" className="text-sm">Notiz (optional)</Label>
                  <Textarea
                    id="version-note"
                    value={versionNote}
                    onChange={(e) => setVersionNote(e.target.value)}
                    placeholder="Was hat sich geändert?"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Move File Dialog ── */}
      <Dialog open={!!moveFile} onOpenChange={(open) => { if (!open) setMoveFile(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="h-4 w-4 text-muted-foreground" />
              Datei verschieben
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Zielordner für <span className="font-medium text-foreground">{moveFile?.name}</span>:
            </p>
            <button
              className={cn(
                "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                moveFile?.folderId === null && "bg-accent"
              )}
              onClick={() => confirmMove(null)}
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span>Stammverzeichnis (Root)</span>
            </button>
            {allFolders.map((folder) => (
              <button
                key={folder.id}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                  moveFile?.folderId === folder.id && "bg-accent"
                )}
                onClick={() => confirmMove(folder.id)}
              >
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span>{folder.name}</span>
              </button>
            ))}
            {allFolders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Ordner vorhanden.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
