"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Copy, Check } from "lucide-react";

export function ClientActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
      }),
    });

    const data = await res.json();
    if (res.ok && data.token) {
      const link = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(link);
    }
    setLoading(false);
    router.refresh();
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setInviteLink(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1 h-4 w-4" />
          Kunden einladen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuen Kunden einladen</DialogTitle>
        </DialogHeader>
        {inviteLink ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Einladungslink erstellt. Teilen Sie diesen Link mit dem Kunden:
            </p>
            <div className="flex items-center gap-2">
              <Input value={inviteLink} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => { setOpen(false); setInviteLink(""); }}>Fertig</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input id="name" name="name" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Wird erstellt..." : "Einladung erstellen"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
