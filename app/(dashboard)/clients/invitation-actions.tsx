"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/confirm-dialog";
import { api, run } from "@/lib/api";

export function DeleteInvitationButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!(await confirmDialog({ title: "Einladung löschen?" }))) return;
    
    setLoading(true);
    const ok = await run(
      api(`/api/invitations/${id}`, { method: "DELETE" }),
      { error: "Einladung konnte nicht gelöscht werden" },
    );
    setLoading(false);
    if (ok === null) return;
    router.refresh();
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleDelete} 
      disabled={loading}
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
      <span className="sr-only">Löschen</span>
    </Button>
  );
}
