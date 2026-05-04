# Klient Refactor & Roadmap — Fortschritt

> Wird nach jedem abgeschlossenen Schritt aktualisiert. Alles unter "In Arbeit" ist die aktuelle Position.

**Letzte Aktualisierung:** 2026-04-30

---

## Aktueller Stand

**Phase:** P3.8 (Recurring Tasks) abgeschlossen ✅
**Nächste Phase:** P3.9 — Automations · P5.1 — SSE · P4.2 — Timeline/Gantt

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

### P3.3 · Multi-Select + Bulk-Toolbar — abgeschlossen ✅

`_lib/use-selection.ts`: kleine Selection-State-Hook mit shift+klick Range-Select.

`_components/bulk-toolbar.tsx`: floating Toolbar unten zentriert, slidet ein
sobald ≥1 Task ausgewählt ist. Aktionen:

- **Status setzen** (Dropdown aus den Workflow-Statuses des Projekts)
- **Priorität setzen** (LOW/MEDIUM/HIGH/URGENT)
- **Assignee setzen** (alle Members + "Niemand zuweisen")
- **Löschen** (mit Confirm-Dialog)

Interaktion auf der Card:
- **Cmd/Ctrl+Click** → Selection toggle (Dialog öffnet *nicht*)
- **Shift+Click** → Range zwischen Anchor und Klick
- **Plain Click bei aktiver Selection** → toggle (verhindert versehentliches
  Verlieren der Bulk-Operation)
- **Plain Click ohne Selection** → öffnet Detail-Dialog wie gehabt
- **Esc** → Selection aufheben

Bulk-PATCH läuft parallel via `Promise.all` mit optimistic State-Update,
roll-back via `fetchTasks()` bei Fehler.

### P3.4 · Saved Views — abgeschlossen ✅

`_lib/use-saved-views.ts`: localStorage-backed View-Speicher pro Projekt
(Schlüssel `klient.savedViews.{projectId}`). MVP ohne DB-Persistenz —
sobald Teams das outgrown haben, neues Prisma-Modell + API-Sync.

`_components/saved-views-menu.tsx`: Dropdown im Toolbar für:
- Aktuelle Ansicht speichern (Name + Ansicht-Modus + Filter snapshot)
- View laden (Filter + view-mode werden gleichzeitig gesetzt)
- Umbenennen / Löschen via hover-action

Eine View speichert: Filter-State (search/assignees/priorities/epicId/due)
+ View-Modus (kanban/list). Beim Laden werden beide wiederhergestellt.

### P3.5 · Echte Subtasks — abgeschlossen ✅

Schema: `Task.parentId` als Self-Relation mit `onDelete: Cascade`. Migration
`prisma/migrations/0003_subtasks` (SQLite-Rebuild-Pattern).

API:
- `POST /api/tasks` akzeptiert `parentId`, validiert dass Parent zum gleichen
  Projekt gehört und nicht selbst Subtask ist (max. 1 Hierarchie-Level)
- `GET  /api/tasks?projectId=...` liefert standardmäßig nur Top-Level-Tasks
  (`parentId: null`); `?parentId=<id>` listet Subtasks
- Top-Level Tasks bekommen `_count.subtasks` und `_count.subtasksDone`
  (DONE-Category-Statuses) für Card-Counter ohne Round-Trip

UI:
- `_components/subtasks-section.tsx`: Subtask-Liste im Task-Dialog
  (Toggle done, Klick → Subtask im selben Dialog öffnen, Löschen,
  Inline-Add). Nur sichtbar bei Top-Level Tasks (`!parentId`).
- TaskCard zeigt `CheckCircle2 X/Y` Counter, wenn Subtasks vorhanden.

Subtasks haben volle Task-Eigenschaften (Status, Assignee, Priority,
Time-Tracking, Comments, Files, Approval). Sie werden im Board und in
der List nicht als Top-Level angezeigt — nur unter ihrem Parent.

### P3.6 · Bulk-Aktionen im List-View — abgeschlossen ✅

Die Multi-Select-Funktion aus P3.3 funktioniert jetzt auch in der Listenansicht:

- Hover-Checkbox am Anfang jeder Zeile (vorher: nur Circle-Icon)
- Cmd/Ctrl-Click toggelt, Shift-Click range-selektiert
- Plain-Click bei aktiver Selection toggelt (statt Dialog zu öffnen)
- Selektierte Zeile mit Primary-Tint + ring-inset hervorgehoben
- BulkToolbar (P3.3) wirkt automatisch auch hier — keine doppelte UI nötig

### P3.7 · Task-Templates — abgeschlossen ✅

Schema: `TaskTemplate`-Tabelle mit name/title/description/priority + optional
statusId/epicId. Subtasks als JSON-Array (`subtaskTitles`) — separate Tabelle
wäre bei der erwarteten Größe Overkill. Migration `0004_task_templates`.

API:
- `GET    /api/projects/[id]/task-templates`
- `POST   /api/projects/[id]/task-templates`
- `PATCH  /api/projects/[id]/task-templates/[templateId]`
- `DELETE /api/projects/[id]/task-templates/[templateId]`

UI:
- `_components/templates-menu.tsx` ersetzt den "Task hinzufügen"-Button mit
  einem Dropdown (`Plus + ChevronDown`):
  - "Leerer Task" (mit C-Shortcut-Hint)
  - Alle Vorlagen — Click legt Parent-Task + Subtasks an
  - "Neue Vorlage…" öffnet Editor-Dialog
- Editor-Dialog: Name, Titel, Beschreibung, Priorität, Status/Epic optional,
  inline Subtask-Liste mit add/remove
- `lib/api/projects.ts` erweitert um `taskTemplates` / `createTaskTemplate` /
  `updateTaskTemplate` / `removeTaskTemplate`

### P3.7b · Tasks Import / Export — abgeschlossen ✅

CSV als Standard (Excel/Numbers/Sheets-friendly), JSON als Power-Format.

- `lib/csv.ts`: minimaler RFC-4180-light Encoder/Decoder ohne npm-Dep
- `GET /api/projects/[id]/tasks/export?format=csv|json[&sample=true]`
  - CSV liefert UTF-8 mit BOM (Excel erkennt Encoding korrekt)
  - `sample=true` lädt eine fest verdrahtete Beispiel-Vorlage
- `POST /api/projects/[id]/tasks/import?dryRun=true&createMissingEpics=true`
  - Akzeptiert sowohl `text/csv` als auch `application/json`
  - **Two-Pass**: erst Top-Level (parentTitle leer), dann Subtasks per
    title→id Map auflösen
  - Status / Epic per case-insensitive Name-Match, Assignee per E-Mail
  - Mit `createMissingEpics=true` werden unbekannte Epics on-the-fly angelegt
  - `dryRun` validiert ohne zu schreiben — UI zeigt Vorschau mit Warnings/Skipped
- UI: `_components/import-export-menu.tsx` als Icon-Button rechts vom
  Spalten-Button. Dropdown:
  - Export: CSV / JSON (echte Daten)
  - Vorlage: Beispiel-CSV laden (zum Befüllen)
  - Import: Datei-Upload mit Vorschau + Direct-Import
- `Projekte` → Neues Projekt → "Erstellen & Tasks importieren" navigiert
  direkt zu `/projects/[id]/tasks?import=true` und öffnet den File-Picker
  automatisch

### P3.8 · Recurring Tasks — abgeschlossen ✅

**Pragmatischer Ansatz ohne Background-Job:** Folge-Instanz wird beim
Erledigen automatisch erzeugt — kein Cron, keine Worker, keine Race-
Conditions. Schema-Migration `0005_recurring_tasks` fügt `recurrenceRule`
als JSON-String hinzu.

`lib/recurrence.ts`: typed `RecurrenceRule` (daily/weekly/monthly), Parser
mit defensivem Re-Encoding, `nextOccurrence()` für die Datumsberechnung
(DST-safe via 12:00-Normalisierung), `describeRecurrence()` für UI-Labels.

API:
- `POST /api/tasks` und `PATCH /api/tasks/[id]` akzeptieren `recurrenceRule`
  (JSON-String oder Objekt, defensiv normalisiert)
- Beim PATCH: wenn der Status von einem **nicht-DONE** in einen **DONE**-
  Category-Status wechselt UND `recurrenceRule` gesetzt ist, legt der
  Server eine Folge-Instanz mit neu berechnetem dueDate an. Original
  verliert dabei die Rule (verhindert Doppel-Trigger bei Re-Open + Done).

UI:
- `_components/recurrence-picker.tsx`: Pill "Wiederholen…" im Task-Dialog
  unter dem DueDate. Klick öffnet Mini-Editor mit Rhythmus (täglich /
  wöchentl. / monatl.), `everyN`-Spinner und passenden Sub-Inputs:
  Wochentage-Toggle bei wöchentlich, Tag-im-Monat bei monatlich
- TaskCard zeigt einen Repeat-Icon-Indicator (Tooltip = beschreibender Text)
- Card-Indicator nutzt info-Token für visuelle Konsistenz mit anderen
  Status-Pills

---

## P4 · Views

### P4.5 · Inbox-Page (`/inbox`) — abgeschlossen ✅

Eigene Daily-Use-Page für Notifications statt nur dem Bell-Dropdown.

API: `GET /api/notifications` erweitert um `types=` Filter und `typeCounts`
für Filter-Badges.

UI (`app/(dashboard)/inbox/page.tsx`):
- Preset-Chips: Alle / Ungelesen + 5 Type-Gruppen mit Live-Badges
- Multi-Select per hover-Checkbox + Bulk-Mark-as-Read + "Alle"-Button
- Hover-Delete pro Zeile, Header-Buttons "Alle gelesen" + "Gelesene löschen"
- Click → `markRead` (optimistic) + Navigation zum verlinkten Task
- Refetch nur bei `visibilitychange` / `focus` (kein Polling)

Sidebar: `Inbox` als oberster Eintrag in admin/member/client Nav.

### P4.1 · Calendar-View — abgeschlossen ✅

`_components/calendar-view.tsx`: Monatsraster (7×6 Grid) mit Tasks per dueDate.

- Header: Vorheriger / Heute / Nächster + Monats-Label + "N ohne Datum"
- Wochenstart Montag (`date-fns` mit `de` Locale)
- Tag-Cell: Datum oben rechts (heute = primary-Pill), Task-Chips drunter,
  "+N weitere" wenn > 4
- Task-Chip: Priority-Dot · Titel · Avatar
- Drag-and-Drop:
  - Task auf Tag droppen → `dueDate` = Tag
  - Task in "Ohne Datum"-Zone droppen → `dueDate` = null
  - Drag von "Ohne Datum" auf Tag setzt das Datum
- Eigener `DndContext` (separat vom Kanban — andere Drag-Semantik)
- Click auf Task → öffnet Detail-Dialog (re-uses parent dialog)
- Optimistic Update direkt im State, PATCH async hinterher

View-Toggle erweitert: **Board / Liste / Kalender**. SavedViews unterstützen
den neuen View-Mode mit angepasstem Label.

Subtasks erscheinen nicht im Kalender — nur Top-Level-Tasks (parentId leer).

### P4.4 · My Day / Focus-Mode — abgeschlossen ✅

`/my-day` Page als Daily-Briefing für die mir zugewiesenen Tasks:

- Greeting nach Tageszeit (Morgen/Mittag/Abend) mit passendem Icon
- 4-Stat-Cards: Heute · Überfällig · Diese Woche · Erledigt jetzt
- Buckets gestapelt (nur sichtbar wenn nicht leer):
  - **Überfällig** (destructive) — vor allem oben sichtbar
  - **Heute** (primary, der Tagesfokus)
  - **Diese Woche** (info, vorausschauend)
  - **Später** (muted)
  - **Ohne Datum** (muted)
- Quick-Mark-Done per Hover-Click direkt in der Liste — Task verschwindet
  optimistisch, "Erledigt jetzt"-Counter zählt hoch (Pomodoro-Feeling)
- Task-Row: Priority-Pill, Due-Date mit Tone, Status-Badge, Project + Epic
- Click → öffnet Task in Project-Tasks-Page mit `?task=<id>`
- Sidebar-Eintrag "Mein Tag" + Tastatur-Shortcut `g+m`
- Refetch nur bei `visibilitychange` / `focus` (kein Polling)

### P4.2 + P4.3 · Timeline / Swimlanes — offen

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
30b2b04 P3.2: Filter-State in URL (useUrlFilters)
a8ac333 P3.3: Multi-Select + Bulk-Toolbar
25b1958 P3.4: Saved Views (per Projekt in localStorage)
021d72d P3.5: Echte Subtasks (Task.parentId + UI)
1fee6df P4.5: Inbox-Page (/inbox)
8cf34c8 P3.7: Task-Templates pro Projekt
31a46c8 P3.6: Bulk-Aktionen im List-View
06f0456 P3.7b: Tasks Import/Export (CSV+JSON) + Sample-Vorlage
721eb8d Semantische Tailwind-Farben → Theme-Tokens
97e9fed P4.1: Calendar-View (Monatsraster, DnD für DueDate)
f3b075c P4.4: My Day / Focus-Mode (eigene Daily-Briefing-Page)
<HEAD>  P3.8: Recurring Tasks (recurrenceRule + auto-create on Done)
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
