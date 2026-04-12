"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/status-pill";

interface Props {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  };
  canEdit: boolean;
}

export function ProjectHeader({ project, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");

  async function handleStatusChange(newStatus: string) {
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(project.name);
    setDescription(project.description || "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-md border border-border/50 bg-card p-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="font-heading text-lg font-bold"
          placeholder="Projektname"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung..."
          rows={2}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Speichern
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {project.name}
        </h1>
        <StatusPill
          value={project.status}
          type="project"
          editable={canEdit}
          onChange={handleStatusChange}
        />
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {project.description && (
        <p className="text-sm text-muted-foreground max-w-2xl">
          {project.description}
        </p>
      )}
    </div>
  );
}
