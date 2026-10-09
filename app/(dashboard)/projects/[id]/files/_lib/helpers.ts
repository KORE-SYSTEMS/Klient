import { FileText, File as FileIcon, ImageIcon } from "lucide-react";
import { FileItem } from "./types";

export const FOLDER_COLORS = [
  "text-info",
  "text-violet-400",
  "text-warning",
  "text-success",
  "text-rose-400",
  "text-cyan-400",
  "text-warning",
  "text-pink-400",
];

export function folderColor(index: number) {
  return FOLDER_COLORS[index % FOLDER_COLORS.length];
}

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileText;
  return FileIcon;
}

export function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

export function currentVersion(file: FileItem): number {
  if (file.versions.length > 0) return file.versions[0].version;
  return 1;
}
