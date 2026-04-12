"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteInvitationButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Einladung wirklich löschen?")) return;
    
    setLoading(true);
    await fetch(`/api/invitations/${id}`, {
      method: "DELETE",
    });
    setLoading(false);
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
