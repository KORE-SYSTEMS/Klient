import { cn } from "@/lib/utils";

export interface StatusConfig {
  label: string;
  class: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Pill badge; each page passes its own status → label/colour/icon map. */
export function StatusBadge({
  status,
  config,
}: {
  status: string;
  config: Record<string, StatusConfig>;
}) {
  const cfg = config[status] ?? config.DRAFT;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full h-5 px-2 text-[10px] leading-none font-medium", cfg.class)}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}
