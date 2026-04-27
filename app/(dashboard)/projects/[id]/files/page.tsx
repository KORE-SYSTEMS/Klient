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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  FolderPlus,
  Upload,
  Download,
  FileText,
  File as FileIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  History,
  X,
  Check,
  Move,
  ArrowUpToLine,
  Layers,
  ImageIcon,
  Grid2X2,
  List,
  Plus,
} from "lucide-react";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FolderCount {
  files: number;
  children: number;
}

interface Folder {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  createdAt: string;
  _count: FolderCount;
}

interface Uploader {
  id: string;
  name: string | null;
  email: string;
}

interface VersionEntry {
  id: string;
  fileId: string;
  version: number;
  path: string;
  size: number;
  note: string | null;
  uploadedById: string;
  uploadedBy: Uploader;
  createdAt: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  clientVisible: boolean;
  folderId: string | null;
  createdAt: string;
  uploadedBy: Uploader;
  versions: { version: number }[];
}

interface Breadcrumb {
  id: string | null;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FOLDER_COLORS = [
  "text-blue-400",
  "text-violet-400",
  "text-amber-400",
  "text-emerald-400",
  "text-rose-400",
  "text-cyan-400",
  "text-orange-400",
  "text-pink-400",
];

function folderColor(index: number) {
  return FOLDER_COLORS[index % FOLDER_COLORS.length];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileText;
  return FileIcon;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function currentVersion(file: FileItem): number {
  if (file.versions.length > 0) return file.versions[0].version;
  return 1;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InlineRename({
  value,
  onConfirm,
  onCancel,
}: {
  value: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (name.trim()) onConfirm(name.trim());
    }
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-7 text-sm px-2 py-0 w-40"
      />
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6"
        onClick={() => name.trim() && onConfirm(name.trim())}
      >
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancel}>
        <X className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

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
    if (res.ok) fetchContents();
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

// ─── FolderCard (grid) ────────────────────────────────────────────────────────

interface FolderCardProps {
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

function FolderCard({
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
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity -mr-1 -mt-1"
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

function FolderRow({
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
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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

// ─── FileCard (grid) ──────────────────────────────────────────────────────────

interface FileCardProps {
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

function FileCard({
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
                  className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mr-1"
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
          <Badge variant="secondary" className="font-mono text-[10px] px-1 h-4">v{ver}</Badge>
          {file.clientVisible && !isClient && (
            <Eye className="h-3 w-3 text-primary flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FileRow (list) ───────────────────────────────────────────────────────────

interface FileRowProps extends FileCardProps {
  isLast: boolean;
}

function FileRow({
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
      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 h-5 flex-shrink-0">
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
            : <EyeOff className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          }
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
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

interface FileActionsMenuProps {
  file: FileItem;
  isClient: boolean;
  onStartRename: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  onVersionHistory: () => void;
  onMove: () => void;
}

function FileActionsMenu({
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
