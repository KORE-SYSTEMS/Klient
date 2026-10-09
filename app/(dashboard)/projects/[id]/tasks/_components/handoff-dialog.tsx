"use client";

import { ClipboardCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface HandoffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  message: string;
  setMessage: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  /** True when the client was already chosen via assignee selection. */
  clientLocked: boolean;
  setClientLocked: (v: boolean) => void;
  submitting: boolean;
  onConfirm: () => void;
}

/** Shown when staff moves a task into an approval column — hands it over to the client. */
export function HandoffDialog({
  open,
  onOpenChange,
  members,
  message,
  setMessage,
  clientId,
  setClientId,
  clientLocked,
  setClientLocked,
  submitting,
  onConfirm,
}: HandoffDialogProps) {
  const clients = members.filter((m) => m.role === "CLIENT");
  const selected = members.find((m) => m.id === clientId);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!submitting) {
        onOpenChange(o);
        if (!o) setClientLocked(false);
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-warning" />
            {clientLocked ? "Zur Kunden-Abnahme übergeben" : "Übergabe an Kunden"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            {clientLocked
              ? "Schreibe dem Kunden eine Nachricht dazu, was er prüfen oder abnehmen soll."
              : "Schreibe eine Nachricht an den Kunden und weise den Task zu. Der Kunde kann den Task dann genehmigen oder ablehnen."}
          </p>

          {/* Client: locked display (from assignee selection) OR dropdown (from column drag) */}
          {clientLocked ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Zugewiesen an</Label>
              <div className="flex items-center gap-2 rounded-sm border bg-muted/30 px-3 py-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-micro">
                    {getInitials(selected?.name || selected?.email || "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {selected?.name || selected?.email}
                </span>
                <span className="ml-auto text-meta text-muted-foreground rounded-full border px-1.5 py-0.5">Kunde</span>
              </div>
            </div>
          ) : (
            clients.length > 0 && (
              <div className="space-y-2">
                <Label>Kunden auswählen</Label>
                <select
                  className="w-full rounded-sm border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">— Kein Kunde zuweisen —</option>
                  {clients.map((m) => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </div>
            )
          )}

          {/* Handoff message */}
          <div className="space-y-2">
            <Label>
              Übergabe-Nachricht <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Was wurde umgesetzt? Was soll der Kunde prüfen? Gibt es besondere Hinweise?"
              rows={4}
              className="resize-none"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); setClientLocked(false); }} disabled={submitting}>
              Abbrechen
            </Button>
            <Button
              onClick={onConfirm}
              disabled={submitting || !message.trim()}
              className="gap-2"
            >
              {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              <ClipboardCheck className="h-4 w-4" />
              Übergabe starten
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
