"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, Search } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";
import { openCommandPalette } from "@/components/command-palette";

interface TopbarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
    image?: string | null;
  };
}

export function Topbar({ user }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <button
        type="button"
        onClick={openCommandPalette}
        className="group hidden md:flex items-center gap-2 rounded-md border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-[280px]"
        aria-label="Suche öffnen"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Suche…</span>
        <kbd className="ml-auto hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted/50 px-1.5 text-meta font-mono">
          <span className="text-caption">⌘</span>K
        </kbd>
      </button>
      <button
        type="button"
        onClick={openCommandPalette}
        className="md:hidden text-muted-foreground hover:text-foreground p-2"
        aria-label="Suche öffnen"
      >
        <Search className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
      <NotificationsBell />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user.name || user.email}
          </span>
          <Avatar className="h-8 w-8">
            {user.image && <AvatarImage src={user.image} />}
            <AvatarFallback className="text-xs">
              {getInitials(user.name || user.email || "U")}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{user.name || "User"}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
            <User className="mr-2 h-3 w-3" />
            {user.role}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <Link href="/profile">
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Mein Profil
            </DropdownMenuItem>
          </Link>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
