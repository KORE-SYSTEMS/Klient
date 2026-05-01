# Klient Refactor & Roadmap — Fortschritt

> Wird nach jedem abgeschlossenen Schritt aktualisiert. Alles unter "In Arbeit" ist die aktuelle Position.

**Letzte Aktualisierung:** 2026-04-30

---

## Aktueller Stand

**Phase:** P3.2 (Filter-State in URL) abgeschlossen ✅
**Nächste Phase:** P3.3 — Bulk-Aktionen (Multi-Select + Bulk-Toolbar)

---

## P0 · Stabilisieren

- [x] **DnD Drop-Indicator** — Dragged-Card wird zur gestrichelten Platzhalter-Box, Spalten-Hover bekommt Primary-Ring (commit `c894f7e`)
- [x] **DnD Auto-Scroll** — `autoScroll` mit höherem Threshold + acceleration (commit `c894f7e`)
- [x] **DnD Grab-Punkt** — `snapToCursor`-Modifier raus, Card hängt jetzt an exakt dem Greifpunkt (commit vor Plan-Erstellung)
- [x] **Polling raus** — Chat (war 5s) und Project-Detail (war 10s) refetchen nur noch bei `visibilitychange`/`focus` (commit `c894f7e`)
- [ ] **Dialog/DnD Interaktion** — sicherstellen, dass Drag den Detail-Dialog nicht in inkonsistenten State bringt
- [ ] **Toast-Konsistenz** — über `run()`-Helper konsequent durchziehen (kommt mit P1.4 Refactor)

## P1 · Aufräumen & Schlankheit

### P1.1–1.3 · Helper-Konsolidierung — abgeschlossen ✅

Commit `80a059c`:

- [x] `lib/task-meta.ts` als Single Source of Truth für `PRIORITY_*`, `PROJECT_STATUS_*`, `APPROVAL_*`, `ACTIVITY_*`, `LINK_TYPES`
- [x] `components/task/priority-pill.tsx` — ersetzt 3× duplizierten Inline-Code
- [x] `components/task/approval-badge.tsx` — ersetzt inline `ApprovalBadge`
- [x] `components/task/project-status-badge.tsx`
- [x] `components/task/due-date-label.tsx` — neu, einheitliches Overdue/Today/Upcoming
- [x] `components/status-pill.tsx` — toten `TASK_STATUSES`-Block entfernt
- [x] `lib/utils.ts` — ungenutzten `getStatusColor` entfernt

### P1.5 · API-Layer — abgeschlossen ✅

Commit `04598d8`:

- [x] `lib/api.ts` — typsicherer fetch-Wrapper mit `ApiError` und `run()`-Helper
- [x] `lib/api/tasks.ts` — typed wrapper für `/api/tasks/*`
- [x] `lib/api/projects.ts` — typed wrapper für `/api/projects/*`

### P1.6 · Toast-Pattern — abgeschlossen ✅

- [x] `run(promise, { success, error })` aus `lib/api.ts` als Standard
- [ ] Bestehende Pages auf `run()` umstellen — passiert iterativ in P1.4

### P1.4 · `tasks/page.tsx` splitten — abgeschlossen ✅

Commits `ffb7006` + `e0a43d8`. Hauptdatei von 3.386 → 1.884 LOC (-43%):

```
app/(dashboard)/projects/[id]/tasks/
├── page.tsx                          1.884 LOC  Layout, State, Routing, Dialoge
├── _lib/
│   ├── types.ts                        103 LOC  alle Task-Domain-Interfaces
│   └── dnd.ts                           33 LOC  kanbanCollision + getNextStatus
└── _components/
    ├── inline-title.tsx                 70 LOC  Doppelklick-zum-Bearbeiten
    ├── task-card.tsx                   269 LOC  Sortable Kanban-Card
    ├── kanban-column.tsx               164 LOC  Droppable Spalte
    ├── time-entries-section.tsx        314 LOC  Zeiterfassung im Dialog
    ├── checklist-section.tsx           262 LOC  Sub-Tasks mit Toggle
    ├── comments-section.tsx            199 LOC  @mention-Thread
    ├── files-section.tsx               119 LOC  Datei-Anhänge
    └── activity-timeline.tsx           142 LOC  Aktivitäts-Log
```

`tsc --noEmit` und `next build` grün.

### P1.7 · Filter-Bar + Quick-Chips zusammenführen — abgeschlossen ✅

`_components/task-filters.tsx` (398 LOC) ersetzt:

- den separaten Filter-Toggle-Button im Toolbar
- den eigenständigen Quick-Chips-Block
- die toggleable Filter-Bar darunter

Single State-Objekt `TaskFilterState` ersetzt fünf einzelne useStates.
Search ist jetzt always-on, Chips immer sichtbar als Presets, "Mehr Filter"
expandiert die Multi-Selects nur wenn nötig — kein redundantes Toggle-Button mehr.

### P1.8 · `Card`-Komponente — Entscheidung getroffen ✅

`<Card>` wird in 19 Files konsequent für Auth-Forms + Dashboard-Summary-Cards
benutzt. Rohe `<div className="rounded-xl border bg-card p-4">` für simple
bordered Container. Klare Rollen, keine weitere Migration nötig.

---

## P2 · Design-System & UI-Konsistenz

### P2.1+P2.2 · Type-Skala + Bulk-Replace — abgeschlossen ✅

Commit `fed9101`. Drei neue Tokens in `tailwind.config.ts`:

- `text-micro`   = 9px (Avatar-Initialen, dichte Badges)
- `text-meta`    = 10px (Date-Stamps, Mini-Counter)
- `text-caption` = 11px (Chips, Pills, sekundäre Labels)

234 Vorkommen von `text-[Npx]` in 42 Files durch semantische Tokens ersetzt.

### P2.3 · Empty-State — abgeschlossen ✅

Commit `e8b3b89`. Neuer EmptyState mit drei Größen (default/compact/inline)
und drei Tones (default/info/error).

### P2.4 · Hover-Pattern (`.hover-action`) — abgeschlossen ✅

Commit `e8b3b89`. CSS-Utility ersetzt 16 verschiedene Schreibweisen von
`opacity-0 group-hover:opacity-100 transition-...`. Inkl. `:focus-within`
für Tastatur-User.

### P2.5 · Compact-Mode — abgeschlossen ✅

- `components/density-provider.tsx`: React Context + localStorage-Persistenz
- `[data-density="compact"]` Selektoren in globals.css (main padding, card padding)
- Toggle in **Settings → Design** und **Topbar** (Maximize/Minimize-Icon)

### P2.6 · Light-Theme + System-Preference — verschoben ⏸

Die App ist aktuell Dark-Only (`<html className="dark">` hartkodiert, nur
`:root` in globals.css = Dark-Palette). Ein echter Light/Dark-Switch braucht
separate Design-Arbeit für die Light-Palette und Component-Audit. Nicht
blockiert P3 — wird als Standalone-Task später angegangen.

---

## P3 · Daily-Use Power-Features

### P3.1 · Tastatur-Shortcuts — abgeschlossen ✅

Bestehender `useKeyboardShortcuts`-Hook + Overlay erweitert um:

- `g+t` → Meine Tasks (war noch nicht da)
- `g+i` → Rechnungen
- `c` → "Neuer Task" via Custom-Event `klient:new-task`
- `d` → Dichte umschalten (Compact ↔ Comfortable)

Das `c`-Shortcut sendet ein DOM-Event, auf das die Task-Page hört —
sauber entkoppelt, jede Task-Seite kann sich selbst registrieren.
Cheatsheet-Overlay (`?`) zeigt alle aktualisiert.

### P3.2 · Filter-State in URL — abgeschlossen ✅

`_lib/use-url-filters.ts`: Two-way sync zwischen `TaskFilterState` und Query-String.

- URL-Format: `?q=...&assignee=u1,u2&priority=HIGH,URGENT&epic=...&due=overdue`
- Browser back/forward navigiert durch Filter-History
- Hard-Refresh behält die View
- Search ist 300ms debounced, Chips/Selects schreiben sofort
- `router.replace` (kein History-Eintrag pro Klick)

Views sind jetzt shareable: Link kopieren, Kollege öffnet — exakt derselbe gefilterte State.

### P3.3 — P3.x · Bulk-Aktionen, Saved Views, Subtasks, Recurring, Templates, Automations — offen

Bar (Toggle) und Chips (immer sichtbar) lesen/schreiben dieselben State-Variablen. Eine `<TaskFilters>`-Komponente, die beides kann.

### P1.8 · `Card`-Komponente konsequent oder gar nicht — offen

`<Card>` wird teils benutzt, teils durch rohe `<div className="rounded-xl border bg-card p-4">` ersetzt.

---

## P2–P11 · noch nicht angefangen

Roadmap im ursprünglichen Plan-Posting (siehe Konversation). Reihenfolge nach P1:

- **P3** Daily-Use Power-Features (Tastatur, Bulk-Aktionen, Saved Views, Subtasks, Recurring, Templates, Automations)
- **P4** Views (Calendar, Timeline/Gantt, Swimlanes, My Day, Inbox)
- **P5** Real-time (SSE, Optimistic Updates flächendeckend, Presence)
- **P6** Files & Content (In-App Preview, Markdown/Rich-Text)
- **P7** Mobile & Touch (Drawer, PWA)
- **P8** CRM & Pipeline ausbauen
- **P9** Reports (Burn-Down, Velocity, Budget)
- **P10** Integrations (Public API, Webhooks, Slack, Zapier, iCal)
- **P11** Sicherheit & Tests (Vitest, Playwright, CI, 2FA, Rate-Limit, Postgres-Option)

---

## Commit-Historie dieses Refactors

```
80a059c P1.1-1.3: Konsolidiere Task-Metadaten-Helpers
c894f7e P0: Polling raus + DnD Drop-Indicator + Auto-Scroll
04598d8 P1.5/P1.6: API-Layer + run() Toast-Helper
ffb7006 P1.4: Add kanban task components and types (Sub-Komponenten)
e0a43d8 P1.4: Splitte tasks/page.tsx in Sub-Komponenten (Imports + Cleanup)
ecb8e7e P1.7: <TaskFilters> ersetzt Quick-Chips + Filter-Bar
fed9101 P2.1+P2.2: Type-Skala + Bulk-Replace text-[Npx]
e8b3b89 P2.3+P2.4: EmptyState polished + .hover-action utility
c0fc99a P2.5: Compact-Mode (Density-Provider + Topbar-Toggle)
c79053a P3.1: Tastatur-Shortcuts erweitert (g+t, g+i, c, d)
<HEAD>  P3.2: Filter-State in URL (useUrlFilters)
```

---

## LOC-Vergleich tasks-Route

| | Vorher | Nachher |
|---|---:|---:|
| `page.tsx` | 3.386 | **1.580** |
| Sub-Komponenten | 0 | 1.937 |
| Lib-Module | 0 | 136 |
| **Gesamt** | 3.386 | 3.653 |

Code-Volumen ist marginal gewachsen wegen Komponenten-Boilerplate (Imports, Props-Types), aber die Wartbarkeit ist um Welten besser: kein File mehr > 400 LOC, jede Sub-Komponente isoliert testbar, Hot-Reload schneller.
