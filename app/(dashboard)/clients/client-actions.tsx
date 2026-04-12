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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Copy, Check, Link, User } from "lucide-react";

export function ClientActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState("invite");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const createDirectly = mode === "manual";

    const emailValue = form.get("email");
    const emailData = emailValue ? emailValue.toString().trim() : "";

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailData,
        name: form.get("name"),
        createDirectly,
      }),
    });

    const data = await res.json();
    if (res.ok && data.token && !createDirectly) {
      const link = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(link);
    } else if (res.ok && createDirectly) {
      setOpen(false);
      setInviteLink("");
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
          Kunden hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuen Kunden {mode === "invite" ? "einladen" : "anlegen"}</DialogTitle>
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
          <Tabs value={mode} onValueChange={setMode} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="invite"><Link className="h-4 w-4 mr-2" /> Einladen</TabsTrigger>
              <TabsTrigger value="manual"><User className="h-4 w-4 mr-2" /> Manuell</TabsTrigger>
            </TabsList>
            
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail {mode === "manual" && "(optional)"}</Label>
                <Input id="email" name="email" type={mode === "manual" ? "text" : "email"} required={mode === "invite"} />
                {mode === "manual" && (
                  <p className="text-xs text-muted-foreground">
                    Wenn keine E-Mail angegeben wird, wird ein Platzhalter erzeugt.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input id="name" name="name" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Wird verarbeitet..." : (mode === "invite" ? "Einladung erstellen" : "Kunde anlegen")}
                </Button>
              </DialogFooter>
            </form>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
