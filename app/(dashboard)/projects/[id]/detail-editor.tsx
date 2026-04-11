"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, getStatusColor } from "@/lib/utils";

interface Props {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  };
  canEdit: boolean;
}

export function ProjectDetailEditor({ project, canEdit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [status, setStatus] = useState(project.status);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, status }),
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
    setStatus(project.status);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className={cn("text-xs", getStatusColor(project.status))}
          >
            {project.status.replace("_", " ")}
          </Badge>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
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

  return (
    <div className="space-y-3 rounded-sm border p-4">
      <div className="space-y-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="font-heading text-lg font-bold"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung..."
          rows={2}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PLANNING">Planung</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="REVIEW">Review</SelectItem>
            <SelectItem value="COMPLETED">Abgeschlossen</SelectItem>
            <SelectItem value="ON_HOLD">Pausiert</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
