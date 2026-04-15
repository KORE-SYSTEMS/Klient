import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatDate } from "@/lib/utils";
import { ClientActions } from "./client-actions";
import { DeleteInvitationButton } from "./invitation-actions";
import { EditClientDialog } from "./edit-client-dialog";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") redirect("/dashboard");

  const [clients, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CLIENT", active: true },
      include: { projects: { include: { project: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invitation.findMany({
      where: { used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Kunden</h1>
          <p className="text-muted-foreground">Kunden verwalten und einladen</p>
        </div>
        <ClientActions />
      </div>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ausstehende Einladungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-sm border p-3">
                <div>
                  <div className="text-sm font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.name && `${inv.name} · `}Gültig bis {formatDate(inv.expiresAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-yellow-400">Ausstehend</Badge>
                  <DeleteInvitationButton id={inv.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.length === 0 && (
          <div className="col-span-full rounded-sm border bg-card">
            <EmptyState
              icon={Users}
              title="Noch keine Kunden"
              description="Lade deinen ersten Kunden ein, damit er sich im Portal anmelden kann."
            />
          </div>
        )}
        {clients.map((client) => (
          <Card key={client.id}>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getInitials(client.name || client.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">{client.name || "Kein Name"}</div>
                  <div className="text-xs text-muted-foreground">
                    {client.email.startsWith("placeholder-") ? "Keine E-Mail" : client.email}
                  </div>
                  {client.company && (
                    <div className="text-xs text-muted-foreground">{client.company}</div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {client.projects.length} Projekte
                    </Badge>
                    {!client.active && (
                      <Badge variant="destructive" className="text-[10px]">Deaktiviert</Badge>
                    )}
                  </div>
                </div>
              </div>
              <EditClientDialog client={client} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
