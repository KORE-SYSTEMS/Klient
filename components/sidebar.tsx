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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const adminNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projekte", href: "/projects", icon: FolderKanban },
  { label: "Kunden", href: "/clients", icon: Users },
  { label: "Einstellungen", href: "/settings", icon: Settings },
];

const clientNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projekte", href: "/projects", icon: FolderKanban },
];

export function Sidebar({ role, logo }: { role: string; logo?: string | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const nav = role === "CLIENT" ? clientNav : adminNav;

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
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
          className={cn("ml-auto h-8 w-8", collapsed && "mx-auto")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {nav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <span className="text-[11px] text-muted-foreground">
            v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
          </span>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/KORE-SYSTEMS/Klient"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://ko-fi.com/nikore"
              target="_blank"
              rel="noopener noreferrer"
              title="Support on Ko-fi"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[#FF5E5B]"
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
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
          </a>
          <a
            href="https://ko-fi.com/nikore"
            target="_blank"
            rel="noopener noreferrer"
            title="Support on Ko-fi"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-[#FF5E5B]"
          >
            <Coffee className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </aside>
  );
}
