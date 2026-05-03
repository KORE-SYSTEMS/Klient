import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Phone,
  Mail,
  Users,
  Presentation,
  Handshake,
  MessageSquare,
  Clock,
  ThumbsUp,
  Minus,
  ThumbsDown,
} from "lucide-react";

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  CALL:     Phone,
  EMAIL:    Mail,
  MEETING:  Users,
  DEMO:     Presentation,
  PROPOSAL: Handshake,
  OTHER:    MessageSquare,
};

const ACTIVITY_LABELS: Record<string, string> = {
  CALL: "Anruf", EMAIL: "E-Mail", MEETING: "Meeting",
  DEMO: "Demo", PROPOSAL: "Angebot", OTHER: "Sonstiges",
};

const OUTCOME_CONFIG = {
  POSITIVE: { label: "Positiv",  icon: ThumbsUp,   cls: "text-success" },
  NEUTRAL:  { label: "Neutral",  icon: Minus,       cls: "text-muted-foreground" },
  NEGATIVE: { label: "Negativ",  icon: ThumbsDown,  cls: "text-destructive" },
};

function groupByDay(activities: { date: string | Date; [k: string]: unknown }[]) {
  const groups = new Map<string, typeof activities>();
  for (const act of activities) {
    const day = new Date(act.date).toISOString().slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(act);
  }
  return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function formatDayLabel(dateStr: string) {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "Heute";
  if (d.getTime() === yesterday.getTime()) return "Gestern";
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default async function ActivitiesPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") redirect("/dashboard");

  const activities = await prisma.clientActivity.findMany({
    orderBy: { date: "desc" },
    include: {
      client: {
        select: { id: true, name: true, email: true, company: true },
      },
    },
    take: 200,
  });

  const grouped = groupByDay(activities as typeof activities);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Aktivitäten</h1>
        <p className="text-muted-foreground text-sm">Alle Kundenkontakte chronologisch</p>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Noch keine Aktivitäten erfasst</p>
          <p className="text-[13px] text-muted-foreground/60 mt-1">
            Öffne einen Kunden und erfasse Anrufe, Meetings oder E-Mails.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayActivities]) => (
            <div key={day}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDayLabel(day)}
                </span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-caption text-muted-foreground">{dayActivities.length} Aktivität{dayActivities.length !== 1 ? "en" : ""}</span>
              </div>

              {/* Activity cards */}
              <div className="space-y-2">
                {(dayActivities as (typeof activities[number])[]).map((act) => {
                  const Icon = ACTIVITY_ICONS[act.type] ?? MessageSquare;
                  const outcome = act.outcome ? OUTCOME_CONFIG[act.outcome as keyof typeof OUTCOME_CONFIG] : null;
                  const OutcomeIcon = outcome?.icon;

                  return (
                    <div key={act.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                      {/* Type icon */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                              {ACTIVITY_LABELS[act.type] ?? act.type}
                            </span>
                            {outcome && OutcomeIcon && (
                              <span className={cn("flex items-center gap-1 text-caption font-medium", outcome.cls)}>
                                <OutcomeIcon className="h-3 w-3" />
                                {outcome.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-caption text-muted-foreground shrink-0">
                            {act.duration && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />{act.duration}min
                              </span>
                            )}
                            <span>{new Date(act.date).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>

                        <p className="text-[13px] font-medium mt-0.5">{act.title}</p>
                        {act.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{act.description}</p>
                        )}
                      </div>

                      {/* Client chip */}
                      <Link
                        href={`/clients/${act.client.id}`}
                        className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-caption font-medium hover:bg-accent transition-colors shrink-0"
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px]">{getInitials(act.client.name || act.client.email)}</AvatarFallback>
                        </Avatar>
                        <span className="max-w-[100px] truncate">{act.client.name || act.client.email}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
