"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Github,
  Coffee,
  BarChart3,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const adminNav = [
  {
    section: "Navigation",
    items: [
      { label: "Dashboard",    href: "/dashboard", icon: LayoutDashboard },
      { label: "Projekte",     href: "/projects",  icon: FolderKanban },
      { label: "Meine Tasks",  href: "/tasks",     icon: CheckSquare },
      { label: "Kunden",       href: "/clients",   icon: Users },
      { label: "Reports",      href: "/reports",   icon: BarChart3 },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Einstellungen", href: "/settings", icon: Settings },
    ],
  },
];

const memberNav = [
  {
    section: "Navigation",
    items: [
      { label: "Dashboard",   href: "/dashboard", icon: LayoutDashboard },
      { label: "Projekte",    href: "/projects",  icon: FolderKanban },
      { label: "Meine Tasks", href: "/tasks",     icon: CheckSquare },
      { label: "Reports",     href: "/reports",   icon: BarChart3 },
    ],
  },
];

const clientNav = [
  {
    section: "Navigation",
    items: [
      { label: "Dashboard",   href: "/dashboard", icon: LayoutDashboard },
      { label: "Projekte",    href: "/projects",  icon: FolderKanban },
      { label: "Meine Tasks", href: "/tasks",     icon: CheckSquare },
    ],
  },
];

export function Sidebar({ role, logo }: { role: string; logo?: string | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sections =
    role === "CLIENT" ? clientNav : role === "MEMBER" ? memberNav : adminNav;

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / header */}
      <div className="flex h-14 items-center border-b px-3">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2 flex-1 min-w-0">
            {logo ? (
              <img
                src={logo}
                alt="Workspace Logo"
                className="h-6 max-w-[120px] w-auto object-contain"
              />
            ) : (
              <Image
                src="/klient-k.png"
                alt="Klient"
                width={90}
                height={24}
                className="h-6 w-auto"
                priority
              />
            )}
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground",
            collapsed ? "mx-auto" : "ml-auto"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        {sections.map((section) => (
          <div key={section.section}>
            {/* Section label */}
            {!collapsed && (
              <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                {section.section}
              </p>
            )}

            <div className="space-y-0.5 px-2">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-sm py-2 text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "px-3",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                    )}
                  >
                    {/* Left accent bar for active state */}
                    {isActive && !collapsed && (
                      <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-primary" />
                    )}

                    <item.icon
                      className={cn(
                        "shrink-0 transition-colors",
                        collapsed ? "h-4 w-4" : "h-4 w-4",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed ? (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-[10px] text-muted-foreground/50 font-mono">
            v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
          </span>
          <div className="flex items-center gap-0.5">
            <a
              href="https://github.com/KORE-SYSTEMS/Klient"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://ko-fi.com/nikore"
              target="_blank"
              rel="noopener noreferrer"
              title="Support on Ko-fi"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-accent hover:text-[#FF5E5B]"
            >
              <Coffee className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 border-t px-2 py-3">
          <a
            href="https://github.com/KORE-SYSTEMS/Klient"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://ko-fi.com/nikore"
            target="_blank"
            rel="noopener noreferrer"
            title="Support on Ko-fi"
            className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-accent hover:text-[#FF5E5B]"
          >
            <Coffee className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </aside>
  );
}
