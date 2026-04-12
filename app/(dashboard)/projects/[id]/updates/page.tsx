"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Info,
  Star,
  AlertTriangle,
  MessageSquareWarning,
  Send,
  Trash2,
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";

const UPDATE_TYPES = [
  { value: "INFO", label: "Info", icon: Info, color: "text-blue-400 bg-blue-500/10" },
  { value: "MILESTONE", label: "Meilenstein", icon: Star, color: "text-green-400 bg-green-500/10" },
  { value: "WARNING", label: "Warnung", icon: AlertTriangle, color: "text-yellow-400 bg-yellow-500/10" },
  { value: "REQUEST", label: "Anfrage", icon: MessageSquareWarning, color: "text-orange-400 bg-orange-500/10" },
];

interface Update {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

export default function UpdatesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [type, setType] = useState("INFO");
  const [submitting, setSubmitting] = useState(false);

  const fetchUpdates = useCallback(async () => {
    const res = await fetch(`/api/updates?projectId=${projectId}`);
    if (res.ok) setUpdates(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  async function createUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    await fetch("/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, content, type }),
    });
    setContent("");
    setType("INFO");
    setSubmitting(false);
    fetchUpdates();
  }

  async function deleteUpdate(id: string) {
    await fetch(`/api/updates/${id}`, { method: "DELETE" });
    fetchUpdates();
  }

  if (loading) return <div className="text-muted-foreground">Lade Updates...</div>;

  return (
    <div className="space-y-6">
      {!isClient && (
        <form onSubmit={createUpdate} className="space-y-3 rounded-sm border p-4">
          <div className="flex items-center gap-3">
            <Label className="shrink-0">Typ</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPDATE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className="h-3 w-3" />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Update schreiben..."
            rows={3}
          />
          <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
            <Send className="mr-1 h-4 w-4" />
            {submitting ? "Wird gepostet..." : "Update posten"}
          </Button>
        </form>
      )}

      {updates.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Noch keine Updates vorhanden</p>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          {updates.map((update) => {
            const typeConfig = UPDATE_TYPES.find((t) => t.value === update.type) || UPDATE_TYPES[0];
            const TypeIcon = typeConfig.icon;
            return (
              <div key={update.id} className="relative flex gap-4 pb-6">
                <div
                  className={cn(
                    "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-sm",
                    typeConfig.color
                  )}
                >
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 rounded-sm border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[9px]">
                          {getInitials(update.author.name || update.author.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {update.author.name || update.author.email}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px]", typeConfig.color)}>
                        {typeConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(update.createdAt)}
                      </span>
                      {!isClient && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteUpdate(update.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {update.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
