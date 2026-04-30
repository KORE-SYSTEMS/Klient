"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Paperclip, Upload, X } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import type { TaskFile } from "../_lib/types";

interface FilesSectionProps {
  taskId: string;
  isClient: boolean;
  canUpload: boolean;
}

/** Files attached directly to a task (separate from the project-level files page). */
export function FilesSection({ taskId, isClient, canUpload }: FilesSectionProps) {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/files`);
    if (res.ok) setFiles(await res.json());
    setLoading(false);
  }, [taskId]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) formData.append("files", selectedFiles[i]);
    try {
      await fetch(`/api/tasks/${taskId}/files`, { method: "POST", body: formData });
      fetchFiles();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileId: string) {
    await fetch(`/api/tasks/${taskId}/files?fileId=${fileId}`, { method: "DELETE" });
    fetchFiles();
  }

  return (
    <div className="space-y-2">
      {canUpload && (
        <div>
          <input
            ref={fileInputRef} type="file" multiple onChange={handleUpload}
            className="hidden" id="task-file-upload"
          />
          <Button
            type="button" variant="outline" size="sm" className="h-8 w-full gap-2"
            onClick={() => fileInputRef.current?.click()} disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Wird hochgeladen..." : "Datei hochladen"}
          </Button>
        </div>
      )}
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : files.length === 0 ? (
        <EmptyState icon={Paperclip} title="Noch keine Dateien" compact />
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <div key={file.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.size)} - {file.uploadedBy.name || file.uploadedBy.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={`/api/files/${file.id}`}
                  className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Herunterladen"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                {!isClient && (
                  <button
                    type="button" onClick={() => handleDelete(file.id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
