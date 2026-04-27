import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Building2, Euro, TrendingUp, Users, Plus } from "lucide-react";

// Pipeline stages in order
const STAGES = [
  { value: "LEAD",      label: "Lead",           color: "bg-slate-500",   light: "bg-slate-500/10 border-slate-500/20 text-slate-400" },
  { value: "PROSPECT",  label: "Prospect",        color: "bg-blue-500",    light: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
  { value: "QUALIFIED", label: "Qualifiziert",    color: "bg-violet-500",  light: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
  { value: "PROPOSAL",  label: "Angebot gestellt", color: "bg-amber-500",  light: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
  { value: "WON",       label: "Gewonnen",        color: "bg-emerald-500", light: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" },
  { value: "LOST",      label: "Verloren",        color: "bg-red-500",     light: "bg-red-500/10 border-red-500/20 text-red-400" },
];

function formatEur(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") redirect("/dashboard");

  const clients = await prisma.user.findMany({
    where: { active: true, role: "CLIENT", leadStatus: { not: null } },
    include: {
      projects: { include: { project: { select: { id: true, name: true, status: true } } } },
      clientActivities: { orderBy: { date: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by stage
  const byStage = new Map<string, typeof clients>(STAGES.map((s) => [s.value, []]));
  for (const c of clients) {
    if (c.leadStatus && byStage.has(c.leadStatus)) {
      byStage.get(c.leadStatus)!.push(c);
    }
  }

  const totalValue = clients.reduce((s, c) => s + (c.leadValue ?? 0), 0);
  const wonValue = (byStage.get("WON") ?? []).reduce((s, c) => s + (c.leadValue ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground text-sm">Leads und Deals im Überblick</p>
        </div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Kunde anlegen
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Users,     label: "Leads gesamt",    value: clients.length },
          { icon: TrendingUp, label: "Potenzial",       value: formatEur(totalValue) },
          { icon: Euro,       label: "Gewonnen",        value: formatEur(wonValue) },
          { icon: Users,      label: "Offen",           value: clients.filter((c) => !["WON", "LOST"].includes(c.leadStatus ?? "")).length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
            </div>
            <div className="text-xl font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageClients = byStage.get(stage.value) ?? [];
          const stageValue = stageClients.reduce((s, c) => s + (c.leadValue ?? 0), 0);

          return (
            <div key={stage.value} className="min-w-[240px] max-w-[280px] flex flex-col gap-2">
              {/* Column header */}
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", stage.color)} />
                  <span className="text-[13px] font-semibold">{stage.label}</span>
                  <span className="text-[12px] text-muted-foreground font-medium">{stageClients.length}</span>
                </div>
                {stageValue > 0 && (
                  <span className="text-[11px] text-muted-foreground font-mono">{formatEur(stageValue)}</span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {stageClients.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-[12px] text-muted-foreground">
                    Keine Einträge
                  </div>
                ) : (
                  stageClients.map((client) => {
                    const lastActivity = client.clientActivities[0];
                    return (
                      <Link
                        key={client.id}
                        href={`/clients/${client.id}`}
                        className="block rounded-lg border bg-card p-3.5 group"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                              {getInitials(client.name || client.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">
                              {client.name || client.email}
                            </p>
                            {client.company && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Building2 className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{client.company}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {client.leadValue != null && client.leadValue > 0 && (
                          <div className="flex items-center gap-1 text-[12px] font-semibold text-foreground mb-2">
                            <Euro className="h-3 w-3 text-muted-foreground" />
                            {formatEur(client.leadValue)}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {client.leadSource && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {client.leadSource}
                              </Badge>
                            )}
                            {client.projects.length > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {client.projects.length} Projekt{client.projects.length !== 1 ? "e" : ""}
                              </span>
                            )}
                          </div>
                          {lastActivity && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatDate(lastActivity.date)}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
