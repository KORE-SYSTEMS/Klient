"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  filePath?: string;
  fileName?: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
}

export default function ChatPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?projectId=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return time;
    return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${time}`;
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] flex-col rounded-sm border">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Noch keine Nachrichten. Schreiben Sie die erste!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.author.id === session?.user?.id;
          return (
            <div
              key={msg.id}
              className={cn("flex gap-3", isOwn && "flex-row-reverse")}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-[10px]">
                  {getInitials(msg.author.name || msg.author.email)}
                </AvatarFallback>
              </Avatar>
              <div className={cn("max-w-[70%]", isOwn && "text-right")}>
                <div className="mb-1 flex items-center gap-2">
                  {!isOwn && (
                    <span className="text-xs font-medium">
                      {msg.author.name || msg.author.email}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div
                  className={cn(
                    "inline-block rounded-sm px-3 py-2 text-sm",
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {msg.content}
                </div>
                {msg.fileName && (
                  <div className="mt-1">
                    <a
                      href={`/api/files/${msg.filePath}`}
                      className="text-xs text-primary underline"
                    >
                      {msg.fileName}
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nachricht schreiben..."
          disabled={sending}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
