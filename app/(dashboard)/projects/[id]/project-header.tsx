"use client";

import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/status-pill";

interface Props {
  project: {
    id: string;
    name: string;
    color: string | null;
    status: string;
  };
  canEdit: boolean;
}

export function ProjectHeader({ project, canEdit }: Props) {
  const router = useRouter();

  async function handleStatusChange(newStatus: string) {
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-4 w-4 shrink-0 rounded-sm"
        style={{ backgroundColor: project.color || "#E8520A" }}
      />
      <h1 className="font-heading text-2xl font-bold tracking-tight">
        {project.name}
      </h1>
      <StatusPill
        value={project.status}
        type="project"
        editable={canEdit}
        onChange={handleStatusChange}
      />
    </div>
  );
}
