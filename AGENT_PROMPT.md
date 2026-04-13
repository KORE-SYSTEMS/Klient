# KLIENT — Agent Coding Prompt

Lies zuerst `KLIENT_build_brief.md` vollständig durch. Das ist die Spezifikation.

Dann implementiere den kompletten MVP in dieser Reihenfolge:

---

## Phase 1 — Projekt-Grundgerüst

1. `npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*"`
2. shadcn/ui initialisieren: `npx shadcn@latest init`
   - Style: Default
   - Base color: Zinc
   - CSS variables: yes
3. Folgende shadcn/ui Komponenten installieren:
   `button, input, label, card, badge, avatar, dropdown-menu, dialog, sheet, tabs, table, textarea, select, separator, skeleton, toast, tooltip, popover, command, calendar`
4. Prisma setup: `npm install prisma @prisma/client && npx prisma init`
5. Schema aus dem Build Brief in `prisma/schema.prisma` schreiben
6. NextAuth.js v5 installieren: `npm install next-auth@beta`
7. Weitere Pakete: `npm install bcryptjs @types/bcryptjs zustand react-hook-form @hookform/resolvers zod nodemailer @types/nodemailer`

---

## Phase 2 — Design System

Passe `app/globals.css` und `tailwind.config.ts` an:

**Farben (CSS Variables in :root und .dark):**
```css
--background: 0 0% 4%;          /* #0a0a0a */
--foreground: 0 0% 95%;
--primary: 21 90% 48%;          /* #E8520A orange */
--primary-foreground: 0 0% 100%;
--card: 0 0% 7%;
--border: 0 0% 14%;
--muted: 0 0% 10%;
--muted-foreground: 0 0% 50%;
--accent: 21 90% 48%;
```

**Border Radius:** `--radius: 0.2rem` (eckig, nicht rund)

**Font:** Geist Mono für Labels/Badges, Geist Sans für Body

Dark mode ist Default — `<html class="dark">` im root layout.

---

## Phase 3 — Auth

Erstelle:
- `lib/auth.ts` — NextAuth config mit Credentials Provider (Email + Password)
- `lib/prisma.ts` — Prisma Client singleton
- `app/api/auth/[...nextauth]/route.ts`
- `app/(auth)/login/page.tsx` — Login-Seite im KORE-Stil
  - Schwarzer Hintergrund, zentriertes Card
  - KLIENT Logo/Wordmark oben
  - Email + Password Input
  - Orange Submit Button
- `app/(auth)/invite/[token]/page.tsx` — Invite-Seite (Passwort setzen)
- Middleware `middleware.ts` — schützt alle `/dashboard/*` Routen

---

## Phase 4 — Layout

Erstelle `app/(dashboard)/layout.tsx` mit:

**Sidebar** (kollabierbar, 240px / 60px collapsed):
- Logo "KLIENT" oben
- Navigation Items mit Lucide Icons:
  - Dashboard (LayoutDashboard)
  - Projects (FolderKanban)
  - Clients (Users) — nur Admin/Member
  - Settings (Settings) — nur Admin
- User-Avatar + Name unten mit Logout

**Topbar:**
- Breadcrumb der aktuellen Seite
- Notification Bell
- User Avatar Dropdown

---

## Phase 5 — Core Pages

### Dashboard (`app/(dashboard)/dashboard/page.tsx`)
- Admin View: Stats Cards (aktive Projekte, offene Tasks, Kunden), Recent Activity
- Client View: Nur seine Projekte als Cards, letzte Updates

### Projekte (`app/(dashboard)/projects/`)
- `page.tsx` — Grid von Project Cards
  - Card zeigt: Name, Status Badge, Fortschrittsbalken (Tasks done/total), Fälligkeitsdatum
  - "New Project" Button (nur Admin)
- `[id]/page.tsx` — Projekt Detail mit Tabs: Overview, Tasks, Files, Updates, Chat

### Tasks (`app/(dashboard)/projects/[id]/tasks/page.tsx`)
- Kanban Board mit 5 Spalten: Backlog, Todo, In Progress, In Review, Done
- Drag & Drop (nutze `@dnd-kit/core`)
- Task Card zeigt: Titel, Assignee Avatar, Priority Badge, Fälligkeitsdatum
- "Add Task" öffnet Dialog
- Toggle: Board View / List View
- Client sieht nur `clientVisible: true` Tasks

### Files (`app/(dashboard)/projects/[id]/files/page.tsx`)
- Drag & Drop Upload Zone
- File Grid: Icon nach Typ, Name, Größe, Upload-Datum, Download-Button
- Delete nur für Admin
- Client sieht nur `public: true` Files

### Updates (`app/(dashboard)/projects/[id]/updates/page.tsx`)
- Chronologische Timeline
- Update Types haben verschiedene Farben: Info (blau), Milestone (grün), Warning (orange), Request (rot)
- Admin kann Updates erstellen (Markdown-Textarea)
- Client kann nur lesen

### Chat (`app/(dashboard)/projects/[id]/chat/page.tsx`)
- Einfacher Message Thread
- Messages mit Avatar, Name, Timestamp
- Input unten mit Send-Button
- Polling alle 10 Sekunden für neue Messages

### Clients (`app/(dashboard)/clients/`)
- `page.tsx` — Tabelle aller Clients
- `[id]/page.tsx` — Client Detail mit verknüpften Projekten
- "Invite Client" Button → Dialog mit Email-Eingabe → generiert Invite-Token, sendet Email (oder zeigt Link wenn kein SMTP)

---

## Phase 6 — API Routes

Erstelle alle API Routes unter `app/api/`:

```
/api/projects          GET (list), POST (create)
/api/projects/[id]     GET, PATCH, DELETE
/api/tasks             POST (create)
/api/tasks/[id]        PATCH, DELETE
/api/tasks/reorder     POST (Kanban drag&drop)
/api/files/upload      POST (multipart)
/api/files/[id]        GET (download), DELETE
/api/messages          GET, POST
/api/clients           GET, POST
/api/clients/[id]      GET, PATCH
/api/invitations       POST (create invite)
/api/invitations/[token] GET (validate), POST (accept)
/api/updates           GET, POST
```

Jede Route prüft:
1. Session existiert (`getServerSession`)
2. User hat die nötige Rolle
3. Client-User sieht nur eigene Daten

---

## Phase 7 — Seed Script

`prisma/seed.ts`:
```typescript
// Erstellt:
// - Admin User: admin@klient.local / changeme123
// - Demo Client: client@example.com / demo1234
// - 1 Demo Projekt "Website Relaunch"
// - 3 Tasks im Projekt
// - 1 Update
```

In `package.json` hinzufügen:
```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

---

## Phase 8 — next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs']
  }
}
```

`output: 'standalone'` ist kritisch für das Dockerfile.

---

## Wichtige Patterns

### Server Action Pattern (bevorzugt für Forms):
```typescript
'use server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function createProject(data: FormData) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'CLIENT') throw new Error('Unauthorized')
  // ...
}
```

### Client-Isolation Pattern:
```typescript
// In jeder API Route die Client-Daten zurückgibt:
if (session.user.role === 'CLIENT') {
  // Nur Projekte zurückgeben wo der User ein Member ist
  where.members = { some: { userId: session.user.id } }
}
```

---

## Abschluss-Checklist

Bevor du fertig bist, stelle sicher:
- [ ] `npm run build` läuft ohne Fehler
- [ ] `npx prisma migrate dev` erstellt alle Tabellen
- [ ] Seed Script läuft durch
- [ ] Login funktioniert mit `admin@klient.local` / `changeme123`
- [ ] Client-User sieht nur eigene Projekte
- [ ] Docker Compose startet ohne Fehler
- [ ] Alle shadcn/ui Imports sind korrekt
- [ ] Dark Mode ist überall aktiv

---

Starte jetzt mit Phase 1 und arbeite dich durch bis Phase 8.
Bei Unklarheiten entscheide selbst — halte dich an den Design Brief.
