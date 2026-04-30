"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Bell,
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

const UPDATE_TYPES = [
  { value: "INFO",      label: "Info",       icon: Info,                color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  { value: "MILESTONE", label: "Meilenstein", icon: Star,               color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { value: "WARNING",   label: "Warnung",    icon: AlertTriangle,       color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { value: "REQUEST",   label: "Anfrage",    icon: MessageSquareWarning, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
];

interface Update {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

export default function UpdatesPage() {
  const params    = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const isClient  = session?.user?.role === "CLIENT";

  const [updates,    setUpdates]    = useState<Update[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [content,    setContent]    = useState("");
  const [type,       setType]       = useState("INFO");
  const [submitting, setSubmitting] = useState(false);

  const fetchUpdates = useCallback(async () => {
    const res = await fetch(`/api/updates?projectId=${projectId}`);
    if (res.ok) setUpdates(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

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
    setUpdates((prev) => prev.filter((u) => u.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-32 bg-muted rounded" />
                <div className="h-2.5 w-20 bg-muted rounded" />
              </div>
            </div>
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compose */}
      {!isClient && (
        <form onSubmit={createUpdate} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Bell className="h-3.5 w-3.5" />
            <span className="text-caption uppercase tracking-wider font-medium">Neues Update</span>
          </div>
          <div className="flex items-center gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPDATE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className={cn("h-3.5 w-3.5", t.color)} />
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
            placeholder="Update schreiben…"
            rows={3}
            className="resize-none text-sm"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={submitting || !content.trim()} className="gap-2">
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Wird gepostet…" : "Update posten"}
            </Button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {updates.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Bell}
            title="Noch keine Updates"
            description="Updates informieren das Team und Kunden über Fortschritte, Meilensteine und wichtige Hinweise."
          />
        </div>
      ) : (
        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-[19px] top-5 bottom-5 w-px bg-border" />

          <div className="space-y-3">
            {updates.map((update) => {
              const cfg    = UPDATE_TYPES.find((t) => t.value === update.type) ?? UPDATE_TYPES[0];
              const TypeIcon = cfg.icon;
              return (
                <div key={update.id} className="relative flex gap-3">
                  {/* icon dot */}
                  <div className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                    cfg.bg, cfg.border
                  )}>
                    <TypeIcon className={cn("h-4 w-4", cfg.color)} />
                  </div>

                  {/* card */}
                  <div className="flex-1 rounded-xl border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-micro font-semibold">
                            {getInitials(update.author.name || update.author.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {update.author.name || update.author.email}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta font-semibold border",
                          cfg.bg, cfg.color, cfg.border
                        )}>
                          <TypeIcon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-caption text-muted-foreground">
                          {formatDate(update.createdAt)}
                        </span>
                        {!isClient && (
                          <button
                            type="button"
                            onClick={() => deleteUpdate(update.id)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                      {update.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
