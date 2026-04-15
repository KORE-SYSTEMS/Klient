"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileIcon,
  ImageIcon,
  FileText,
  Download,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  clientVisible: boolean;
  createdAt: string;
  uploadedBy: { name: string; email: string };
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileText;
  return FileIcon;
}

export default function FilesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/files?projectId=${projectId}`);
    if (res.ok) setFiles(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  async function uploadFiles(fileList: FileList | File[]) {
    setUploading(true);
    const formData = new FormData();
    formData.append("projectId", projectId);
    Array.from(fileList).forEach((f) => formData.append("files", f));

    await fetch("/api/files", { method: "POST", body: formData });
    setUploading(false);
    fetchFiles();
  }

  async function toggleVisibility(id: string, visible: boolean) {
    await fetch(`/api/files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientVisible: visible }),
    });
    fetchFiles();
  }

  async function deleteFile(id: string) {
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    fetchFiles();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="rounded-sm border-2 border-dashed border-border p-8 flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
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
            <div className="flex gap-1.5">
              <Skeleton className="h-8 w-8 rounded-sm" />
              <Skeleton className="h-8 w-8 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {!isClient && (
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-sm border-2 border-dashed p-8 transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Dateien hierher ziehen oder{" "}
            <button
              className="text-primary underline"
              onClick={() => fileInputRef.current?.click()}
            >
              durchsuchen
            </button>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          {uploading && <p className="mt-2 text-sm text-primary">Wird hochgeladen...</p>}
        </div>
      )}

      {files.length === 0 ? (
        <EmptyState
          icon={FileIcon}
          title="Noch keine Dateien"
          description={isClient ? "Noch keine Dateien freigegeben." : "Lade Dateien hoch indem du sie hierher ziehst oder auf 'Durchsuchen' klickst."}
          compact
        />
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = getFileIcon(file.mimeType);
            return (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-sm border p-3"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} · {formatDate(file.createdAt)} · {file.uploadedBy.name || file.uploadedBy.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isClient && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={file.clientVisible ? "Für Kunden verstecken" : "Für Kunden sichtbar machen"}
                      onClick={() => toggleVisibility(file.id, !file.clientVisible)}
                    >
                      {file.clientVisible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  )}
                  <a href={`/api/files/${file.id}`} download>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                  {!isClient && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
