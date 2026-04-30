# Klient Refactor & Roadmap — Fortschritt

> Wird nach jedem abgeschlossenen Schritt aktualisiert. Alles unter "In Arbeit" ist die aktuelle Position.

**Letzte Aktualisierung:** 2026-04-30

---

## Aktueller Stand

**Phase:** P1.4 — `tasks/page.tsx` (3.330 LOC) in Sub-Komponenten splitten
**In Arbeit:** Dialog-Sektionen extrahieren (TimeEntries ✅, als nächstes Checklist/Comments/Files/Activity)

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

### P1.4 · `tasks/page.tsx` splitten — in Arbeit 🔧

Quelldatei (vorher 3.386 LOC, jetzt noch 3.330):

```
app/(dashboard)/projects/[id]/tasks/
├── page.tsx                          # noch ~3.300 LOC, wird auf < 500 schrumpfen
├── _lib/
│   ├── types.ts                      ✅ alle Task-Domain-Interfaces
│   └── dnd.ts                        ✅ kanbanCollision + getNextStatus
└── _components/
    ├── inline-title.tsx              ✅ Doppelklick-zum-Bearbeiten
    ├── task-card.tsx                 ✅ Sortable Kanban-Card
    ├── kanban-column.tsx             ✅ Droppable Spalte
    ├── time-entries-section.tsx      ✅ Zeiterfassung im Dialog
    ├── checklist-section.tsx         ⏳ als nächstes
    ├── comments-section.tsx          ⏳
    ├── files-section.tsx             ⏳
    └── activity-timeline.tsx         ⏳
```

Nach Extraktion folgt: alte Definitionen + Imports aus `page.tsx` raus, dann TypeScript-Check, dann Commit.

### P1.7 · Filter-Bar + Quick-Chips zusammenführen — offen

Bar (Toggle) und Chips (immer sichtbar) lesen/schreiben dieselben State-Variablen. Eine `<TaskFilters>`-Komponente, die beides kann.

### P1.8 · `Card`-Komponente konsequent oder gar nicht — offen

`<Card>` wird teils benutzt, teils durch rohe `<div className="rounded-xl border bg-card p-4">` ersetzt.

---

## P2–P11 · noch nicht angefangen

Roadmap im ursprünglichen Plan-Posting (siehe Konversation). Reihenfolge nach P1:

- **P2** Design-System & UI-Konsistenz (Spacing, Type-Skala, Hex-Werte raus, Compact-Mode)
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
```
