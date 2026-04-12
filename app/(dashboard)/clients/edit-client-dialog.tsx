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
import { Edit2 } from "lucide-react";

export function EditClientDialog({ client }: { client: { id: string; name: string | null; email: string; company: string | null; active: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    
    await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        name: form.get("name"),
        company: form.get("company"),
      }),
    });

    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Kunde wirklich löschen?")) return;
    setLoading(true);
    await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  const defaultEmail = client.email.startsWith("placeholder-") ? "" : client.email;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Edit2 className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kunde bearbeiten</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" defaultValue={defaultEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={client.name || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Firma</Label>
            <Input id="company" name="company" defaultValue={client.company || ""} />
          </div>
          <DialogFooter className="flex sm:justify-between items-center w-full gap-2 mt-4">
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
              Löschen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
