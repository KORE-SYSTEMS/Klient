"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import type { TaskComment, ProjectMember } from "../_lib/types";

interface CommentsSectionProps {
  taskId: string;
  members: ProjectMember[];
  currentUserId: string;
}

/** Comment thread on a task with @mention autocomplete. */
export function CommentsSection({ taskId, members }: CommentsSectionProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/tasks/${taskId}/comments`);
    if (res.ok) setComments(await res.json());
    setLoading(false);
  }, [taskId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comments]);

  function handleCommentChange(value: string) {
    setNewComment(value);
    const lastAtPos = value.lastIndexOf("@");
    if (lastAtPos !== -1) {
      const afterAt = value.substring(lastAtPos + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
        return;
      }
    }
    setShowMentions(false);
  }

  function insertMention(member: ProjectMember) {
    const lastAtPos = newComment.lastIndexOf("@");
    const before = newComment.substring(0, lastAtPos);
    const displayName = member.name || member.email;
    setNewComment(`${before}@${displayName} `);
    setShowMentions(false);
    textareaRef.current?.focus();
  }

  async function handleSubmit() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    const mentionedIds: string[] = [];
    for (const m of members) {
      const displayName = m.name || m.email;
      if (newComment.includes(`@${displayName}`)) mentionedIds.push(m.id);
    }
    try {
      await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim(), mentions: mentionedIds }),
      });
      setNewComment("");
      fetchComments();
    } finally {
      setSubmitting(false);
    }
  }

  const filteredMembers = members.filter((m) => {
    const name = (m.name || m.email).toLowerCase();
    return name.includes(mentionFilter);
  });

  function renderCommentContent(content: string) {
    const parts = content.split(/(@\S+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="rounded bg-primary/10 px-1 py-0.5 font-medium text-primary">
            {part}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="max-h-[250px] space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-12 w-full rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Noch keine Kommentare" compact />
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className="text-micro">
                  {getInitials(comment.author.name || comment.author.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">
                    {comment.author.name || comment.author.email}
                  </span>
                  {comment.author.role === "CLIENT" && (
                    <Badge variant="outline" className="text-micro px-1 py-0 h-4">
                      Kunde
                    </Badge>
                  )}
                  <span className="text-meta text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString("de-DE", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
                  {renderCommentContent(comment.content)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => handleCommentChange(e.target.value)}
              placeholder="Kommentar schreiben... (@Name zum Erwähnen)"
              rows={2}
              className="pr-10 resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {showMentions && filteredMembers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-full rounded-lg border bg-popover p-1 shadow-md z-10">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id} type="button" onClick={() => insertMention(m)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-micro">{getInitials(m.name || m.email)}</AvatarFallback>
                    </Avatar>
                    <span>{m.name || m.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            type="button" size="sm"
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="self-end h-9 px-3"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
