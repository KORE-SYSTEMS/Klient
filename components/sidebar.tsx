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
  ChevronDown,
  Github,
  Coffee,
  BarChart3,
  CheckSquare,
  LayoutList,
  TrendingUp,
  CalendarClock,
  Receipt,
  FileSignature,
  SlidersHorizontal,
  Mail,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

type NavChild = { label: string; href: string; icon: LucideIcon; exact?: boolean };
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
};
type NavSection = { section: string; items: NavItem[] };

const adminNav: NavSection[] = [
  {
    section: "Navigation",
    items: [
      { label: "Dashboard",   href: "/dashboard", icon: LayoutDashboard },
      { label: "Projekte",    href: "/projects",  icon: FolderKanban },
      { label: "Meine Tasks",  href: "/tasks",      icon: CheckSquare },
      { label: "Angebote",     href: "/proposals",  icon: FileSignature },
      { label: "Rechnungen",   href: "/invoices",   icon: Receipt },
      {
        label: "Kunden",
        href: "/clients",
        icon: Users,
        children: [
          { label: "Übersicht",   href: "/clients",            icon: LayoutList,    exact: true },
          { label: "Pipeline",    href: "/clients/pipeline",   icon: TrendingUp },
          { label: "Aktivitäten", href: "/clients/activities", icon: CalendarClock },
        ],
      },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    section: "System",
    items: [
      {
        label: "Einstellungen",
        href: "/settings",
        icon: Settings,
        children: [
          { label: "Allgemein",   href: "/settings",          icon: SlidersHorizontal, exact: true },
          { label: "Mail",        href: "/settings/mail",     icon: Mail },
          { label: "Abrechnung",  href: "/settings/billing",  icon: CreditCard },
        ],
      },
    ],
  },
];

const memberNav: NavSection[] = [
  {
    section: "Navigation",
    items: [
      { label: "Dashboard",   href: "/dashboard", icon: LayoutDashboard },
      { label: "Projekte",    href: "/projects",  icon: FolderKanban },
      { label: "Meine Tasks", href: "/tasks",     icon: CheckSquare },
      { label: "Rechnungen",  href: "/invoices",  icon: Receipt },
      { label: "Reports",     href: "/reports",   icon: BarChart3 },
    ],
  },
];

const clientNav: NavSection[] = [
  {
    section: "Navigation",
    items: [
      { label: "Dashboard",   href: "/dashboard", icon: LayoutDashboard },
      { label: "Projekte",    href: "/projects",  icon: FolderKanban },
      { label: "Meine Tasks", href: "/tasks",     icon: CheckSquare },
      { label: "Rechnungen",  href: "/invoices",  icon: Receipt },
    ],
  },
];

export function Sidebar({ role, logo }: { role: string; logo?: string | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Track which parent items are expanded (by href)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sections =
    role === "CLIENT" ? clientNav : role === "MEMBER" ? memberNav : adminNav;

  // Auto-expand parent items whose children match current route
  useEffect(() => {
    const toExpand = new Set<string>();
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children?.some((c) => isChildActive(c, pathname))) {
          toExpand.add(item.href);
        }
      }
    }
    setExpanded(toExpand);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function isChildActive(child: NavChild, path: string) {
    return child.exact ? path === child.href : path === child.href || path.startsWith(child.href + "/");
  }

  function toggleExpanded(href: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  }

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
            {!collapsed && (
              <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                {section.section}
              </p>
            )}

            <div className="space-y-0.5 px-2">
              {section.items.map((item) => {
                const hasChildren = !!item.children?.length;
                const isExpanded = expanded.has(item.href);
                const isParentActive =
                  pathname === item.href ||
                  (hasChildren
                    ? item.children!.some((c) => isChildActive(c, pathname))
                    : pathname.startsWith(item.href + "/"));

                return (
                  <div key={item.href}>
                    {/* Parent row */}
                    {hasChildren ? (
                      <button
                        onClick={() => {
                          if (!collapsed) toggleExpanded(item.href);
                        }}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-sm py-2 text-sm font-medium transition-colors",
                          collapsed ? "justify-center px-2" : "px-3",
                          isParentActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        )}
                      >
                        {isParentActive && !collapsed && (
                          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "shrink-0 h-4 w-4 transition-colors",
                            isParentActive ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </>
                        )}
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-sm py-2 text-sm font-medium transition-colors",
                          collapsed ? "justify-center px-2" : "px-3",
                          isParentActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        )}
                      >
                        {isParentActive && !collapsed && (
                          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "shrink-0 h-4 w-4 transition-colors",
                            isParentActive ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    )}

                    {/* Sub-items */}
                    {hasChildren && isExpanded && !collapsed && (
                      <div className="mt-0.5 space-y-0.5 pl-3">
                        {item.children!.map((child) => {
                          const isActive = isChildActive(child, pathname);
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2.5 rounded-sm py-1.5 pl-4 pr-3 text-[13px] font-medium transition-colors border-l-2",
                                isActive
                                  ? "border-foreground/25 text-foreground bg-accent"
                                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                              )}
                            >
                              <child.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-foreground/80" : "text-muted-foreground")} />
                              <span>{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
