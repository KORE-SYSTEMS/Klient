import { cn } from "@/lib/utils";

export function StatCard({
  label, value, icon: Icon, iconClass, accent,
}: {
  label: string; value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} />
        <span className="text-caption uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={cn("text-2xl font-bold tabular-nums", accent)}>{value}</div>
    </div>
  );
}
