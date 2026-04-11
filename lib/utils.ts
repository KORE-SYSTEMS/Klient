import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    PLANNING: "bg-blue-500/20 text-blue-400",
    ACTIVE: "bg-green-500/20 text-green-400",
    REVIEW: "bg-yellow-500/20 text-yellow-400",
    COMPLETED: "bg-emerald-500/20 text-emerald-400",
    ON_HOLD: "bg-gray-500/20 text-gray-400",
    BACKLOG: "bg-gray-500/20 text-gray-400",
    TODO: "bg-blue-500/20 text-blue-400",
    IN_PROGRESS: "bg-orange-500/20 text-orange-400",
    IN_REVIEW: "bg-yellow-500/20 text-yellow-400",
    DONE: "bg-emerald-500/20 text-emerald-400",
  };
  return colors[status] || "bg-gray-500/20 text-gray-400";
}

export function getPriorityColor(priority: string) {
  const colors: Record<string, string> = {
    LOW: "text-gray-400",
    MEDIUM: "text-blue-400",
    HIGH: "text-orange-400",
    URGENT: "text-red-400",
  };
  return colors[priority] || "text-gray-400";
}
