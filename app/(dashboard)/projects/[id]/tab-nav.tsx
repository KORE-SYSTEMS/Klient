"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CheckSquare,
  FileIcon,
  Bell,
  MessageSquare,
  Receipt,
} from "lucide-react";
import { useSession } from "next-auth/react";

const allTabs = [
  { label: "Übersicht",  href: "",          icon: LayoutDashboard, staffOnly: false },
  { label: "Tasks",      href: "/tasks",    icon: CheckSquare,     staffOnly: false },
  { label: "Dateien",    href: "/files",    icon: FileIcon,        staffOnly: false },
  { label: "Updates",    href: "/updates",  icon: Bell,            staffOnly: false },
  { label: "Chat",       href: "/chat",     icon: MessageSquare,   staffOnly: false },
  { label: "Rechnungen", href: "/invoices", icon: Receipt,         staffOnly: true  },
];

export function ProjectTabNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";

  const tabs = allTabs.filter((t) => !t.staffOnly || !isClient);

  return (
    <nav className="flex gap-1 border-b overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const isActive =
          tab.href === ""
            ? pathname === base
            : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
