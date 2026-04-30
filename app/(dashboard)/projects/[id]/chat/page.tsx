"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, MessageSquare } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

interface Message {
  id: string;
  content: string;
  filePath?: string;
  fileName?: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

function formatTime(dateStr: string) {
  const d   = new Date(dateStr);
  const now  = new Date();
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · ${time}`;
}

function getDayLabel(dateStr: string) {
  const d   = new Date(dateStr);
  const now  = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === now.toDateString())       return "Heute";
  if (d.toDateString() === yesterday.toDateString()) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}

export default function ChatPage() {
  const params    = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?projectId=${projectId}`);
    if (res.ok) setMessages(await res.json());
  }, [projectId]);

  useEffect(() => {
    fetchMessages();
    // Refetch when the tab regains focus instead of polling — saves background
    // requests when nobody is looking. Real-time will move to SSE in P5.
    function onVisible() {
      if (document.visibilityState === "visible") fetchMessages();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", fetchMessages);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", fetchMessages);
    };
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, content: input }),
    });
    setInput("");
    setSending(false);
    fetchMessages();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as unknown as React.FormEvent);
    }
  }

  // group messages by day
  const grouped: { day: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const day = new Date(msg.createdAt).toDateString();
    const last = grouped[grouped.length - 1];
    if (last?.day === day) last.messages.push(msg);
    else grouped.push({ day, messages: [msg] });
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col rounded-xl border bg-card overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={MessageSquare}
              title="Noch keine Nachrichten"
              description="Schreib die erste Nachricht und starte die Unterhaltung."
            />
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.day} className="space-y-3">
              {/* Day separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 whitespace-nowrap">
                  {getDayLabel(group.messages[0].createdAt)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {group.messages.map((msg, i) => {
                const isOwn    = msg.author.id === session?.user?.id;
                const prev     = group.messages[i - 1];
                const showMeta = !prev || prev.author.id !== msg.author.id;
                return (
                  <div key={msg.id} className={cn("flex items-end gap-2.5", isOwn && "flex-row-reverse")}>
                    {/* Avatar — only for first in a run */}
                    <div className="w-7 shrink-0">
                      {showMeta && (
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[9px] font-semibold">
                            {getInitials(msg.author.name || msg.author.email)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>

                    <div className={cn("flex flex-col gap-0.5 max-w-[72%]", isOwn && "items-end")}>
                      {showMeta && (
                        <div className={cn("flex items-baseline gap-2", isOwn && "flex-row-reverse")}>
                          <span className="text-[11px] font-semibold">
                            {isOwn ? "Du" : (msg.author.name || msg.author.email)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className={cn(
                        "px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                          : "bg-muted text-foreground rounded-2xl rounded-bl-md"
                      )}>
                        {msg.content}
                      </div>
                      {msg.fileName && (
                        <a
                          href={`/api/files/${msg.filePath}`}
                          className="text-[11px] text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {msg.fileName}
                        </a>
                      )}
                      {!showMeta && (
                        <span className="text-[10px] text-muted-foreground/40">
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="border-t bg-card/80 backdrop-blur-sm px-4 py-3 flex items-end gap-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht schreiben… (Enter zum Senden, Shift+Enter für neue Zeile)"
          disabled={sending}
          rows={1}
          className="flex-1 min-h-[36px] max-h-32 resize-none text-sm py-2 leading-snug"
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={sending || !input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
