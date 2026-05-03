import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ClientActions } from "./client-actions";
import { DeleteInvitationButton } from "./invitation-actions";
import { EditClientDialog } from "./edit-client-dialog";
import { EmptyState } from "@/components/empty-state";
import {
  Users,
  FolderKanban,
  CalendarClock,
  TrendingUp,
  Building2,
  Phone,
  ArrowRight,
} from "lucide-react";

const LEAD_STATUS_STYLES: Record<string, string> = {
  LEAD:      "bg-slate-500/15 text-slate-400",
  PROSPECT:  "bg-info/15 text-info",
  QUALIFIED: "bg-violet-500/15 text-violet-400",
  PROPOSAL:  "bg-warning/15 text-warning",
  WON:       "bg-success/15 text-success",
  LOST:      "bg-destructive/15 text-destructive",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  LEAD: "Lead", PROSPECT: "Prospect", QUALIFIED: "Qualifiziert",
  PROPOSAL: "Angebot", WON: "Gewonnen", LOST: "Verloren",
};

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") redirect("/dashboard");

  const [clients, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CLIENT", active: true },
      include: {
        projects: { include: { project: true } },
        clientActivities: { orderBy: { date: "desc" }, take: 1 },
        _count: { select: { clientNotes: true, clientActivities: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invitation.findMany({
      where: { used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalProjects = clients.reduce((s, c) => s + c.projects.length, 0);
  const totalActivities = clients.reduce((s, c) => s + c._count.clientActivities, 0);
  const leadsCount = clients.filter((c) => c.leadStatus && !["WON", "LOST"].includes(c.leadStatus)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Kunden</h1>
          <p className="text-muted-foreground text-sm">Kunden verwalten und einladen</p>
        </div>
        <ClientActions />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Users,       label: "Kunden gesamt", value: clients.length },
          { icon: FolderKanban, label: "Projekte",      value: totalProjects },
          { icon: CalendarClock, label: "Aktivitäten", value: totalActivities },
          { icon: TrendingUp,  label: "Offene Leads",  value: leadsCount },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-caption uppercase tracking-wider font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-muted-foreground">Ausstehende Einladungen</h2>
          </div>
          <div className="divide-y">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.name && `${inv.name} · `}Gültig bis {formatDate(inv.expiresAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-warning">Ausstehend</Badge>
                  <DeleteInvitationButton id={inv.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clients grid */}
      {clients.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Users}
            title="Noch keine Kunden"
            description="Lade deinen ersten Kunden ein, damit er sich im Portal anmelden kann."
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const lastActivity = client.clientActivities[0];
            return (
              <Card key={client.id} className="group relative overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Avatar + identity */}
                    <Link href={`/clients/${client.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="h-10 w-10 shrink-0 border-2 border-background">
                        <AvatarFallback className="font-semibold bg-primary/10 text-primary text-sm">
                          {getInitials(client.name || client.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {client.name || "Kein Name"}
                        </div>
                        {client.company && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                            <Building2 className="h-3 w-3 shrink-0" />
                            {client.company}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground truncate">
                          {client.email.startsWith("placeholder-") ? "Keine E-Mail" : client.email}
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {client.leadStatus && (
                        <span className={cn("rounded-full px-2 py-0.5 text-meta font-semibold", LEAD_STATUS_STYLES[client.leadStatus])}>
                          {LEAD_STATUS_LABELS[client.leadStatus]}
                        </span>
                      )}
                      <EditClientDialog client={client} />
                    </div>
                  </div>

                  {/* Contact chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {client.phone && (
                      <div className="flex items-center gap-1 text-caption text-muted-foreground">
                        <Phone className="h-3 w-3" />{client.phone}
                      </div>
                    )}
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-meta gap-1">
                        <FolderKanban className="h-2.5 w-2.5" />
                        {client.projects.length} Projekte
                      </Badge>
                      {client._count.clientActivities > 0 && (
                        <Badge variant="secondary" className="text-meta gap-1">
                          <CalendarClock className="h-2.5 w-2.5" />
                          {client._count.clientActivities} Aktivitäten
                        </Badge>
                      )}
                      {!client.active && <Badge variant="destructive" className="text-meta">Deaktiviert</Badge>}
                    </div>
                    {lastActivity && (
                      <span className="text-caption text-muted-foreground shrink-0">
                        {formatDate(lastActivity.date)}
                      </span>
                    )}
                  </div>

                  {/* Detail link */}
                  <Link
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors pt-1 border-t"
                  >
                    Details öffnen
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
