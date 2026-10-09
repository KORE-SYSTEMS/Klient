# Klient Refactor & Roadmap — Fortschritt

> Wird nach jedem abgeschlossenen Schritt aktualisiert. Alles unter "In Arbeit" ist die aktuelle Position.

**Letzte Aktualisierung:** 2026-05-06

---

## Aktueller Stand

**Phase:** P3.8 (Recurring Tasks) abgeschlossen ✅
**Nächste Phase:** **PX.0 — Design-Overhaul** (Blocker vor weiteren Feature-Phasen)

---

## ⚠ PX.0 · Design-Overhaul — TEIL 1 ABGESCHLOSSEN ✅ (Foundation + Hauptseiten)

**Status:** Foundation + Sidebar/Topbar/Layout + Dashboard + TaskCard + Kanban + MyDay + Inbox überarbeitet.

**Was wurde geändert:**

**Foundation (`globals.css`, Tokens):**
- Border heller (`0 0% 13%` → `0 0% 15%`) für bessere Sichtbarkeit
- Muted-foreground heller (`52%` → `55%`) — bessere Lesbarkeit
- Radius `0.5rem` → `0.625rem` (shadcn v4 Standard)
- Eigene Sidebar-Tokens (`--sidebar`, `--sidebar-border` etc.)
- Shadow-Skala: `--shadow-xs` neu, `--shadow-sm` weicher
- Compact-Mode-Padding entspannt: `1.25rem` → `1.5rem`, Cards `0.75rem` → `1rem`

**Base-Komponenten (shadcn v4 Niveau):**
- `Button`: neue `xs`/`icon-xs`/`icon-sm` Sizes, `gap-2`, `shadow-xs`, Focus-Ring `[3px] ring-ring/50`, `[&_svg]` shrinks-0
- `Card`: `rounded-sm` → `rounded-xl`, `flex-col gap-6 py-6`, `shadow-sm` — endlich konsistente innere Spacing
- `Badge`: `rounded-sm` → `rounded-full`, neue `ghost` Variant, `gap-1`, transparenter Border

**Layout:**
- Sidebar: eigene Hintergrundfarbe (sidebar-token), Active-State `bg-primary/10 text-primary` → `bg-accent text-foreground` + 3px Primary-Strich (Primary nur als Akzent), Items `rounded-sm` → `rounded-lg`, mehr Spacing (space-y-0.5 → space-y-1, py-3 → py-4, space-y-4 → space-y-6)
- Topbar: `bg-card` → `bg-background` (klarere Trennung zur Sidebar)
- Main-Padding: `p-8` → `px-8 py-10`

**Dashboard:**
- Section-Spacing `space-y-6` → `space-y-8`
- Card-Header pb-3-Hack raus (Card hat jetzt eigenes Spacing)
- StatCard: `p-4 mb-1` → `p-5 mb-2`, neuer `shadow-sm`
- Listen-Items: Padding größer (`px-3 py-2.5` → `px-3.5 py-3`), Hover `hover:bg-accent` → `hover:bg-accent/60`
- Icons im Card-Header: `text-primary` → `text-muted-foreground` (außer warning-Icons)
- Hover-Titel `group-hover:text-primary` → `group-hover:text-foreground`
- Project-Grid Gap `gap-2` → `gap-3`

**Task-Board (Kanban):**
- TaskCard: `p-3.5` → `p-4`, neuer `shadow-sm` + `hover:border-border/80`, `space-y-3` → `space-y-3.5`
- Kolumnen: `min-w-[280px]` → `min-w-[300px]`, `rounded-lg` → `rounded-xl`, Drop-State `bg-primary/5` → `bg-accent/40`, mehr Header-Padding
- Card-Spacing in Spalte: `space-y-2` → `space-y-2.5`
- "Task hinzufügen"-Button: weicheres Hover

**My Day:**
- Greeting-Icon: `bg-primary/10 text-primary` → `bg-muted text-foreground` (Primary entfernt)
- Section-Spacing `space-y-6` → `space-y-8`, Stats-Gap `gap-3` → `gap-4`
- StatCard: `p-3` → `p-4 shadow-sm`, mehr inneres Spacing
- Heute-Bucket: `text-primary bg-primary/10` → `text-foreground bg-muted`
- Bucket-Container: `rounded-lg border` → `rounded-xl border bg-card shadow-sm`
- Task-Rows: mehr vertikales Padding, weichere Hover

**Inbox:**
- Header-Icon: `text-primary` → `text-muted-foreground`
- Filter-Chips Gap `gap-1.5` → `gap-2`
- Liste: `rounded-lg border` → `rounded-xl border bg-card shadow-sm`
- Ungelesen-Background: `bg-primary/5` → `bg-accent/30` (subtiler, weniger orange)
- Type-Counts (inaktiv): `bg-primary/15 text-primary` → `bg-muted text-foreground`

**Verifiziert:** `tsc --noEmit` grün — keine Type-Fehler.

---

## ✅ PX.1 · Design-Overhaul — TEIL 2 ABGESCHLOSSEN (restliche Pages)

**Zusätzlich gemacht:**
- **Projects-List**: `space-y-6` → `space-y-8`, Card mit `gap-4 py-5 hover:border-border/80`
- **Tasks-Page (List-View)**: `bg-primary` Badge/Filter-Buttons → `bg-foreground text-background`, Container `rounded-lg` → `rounded-xl bg-card shadow-sm`
- **Task-Filter Chips**: Active-State `border-primary/40 bg-primary/10 text-primary` → `border-foreground/30 bg-accent text-foreground` (Primary nur noch im "Mehr Filter" Counter)
- **Tab-Nav (Project-Detail)**: Active-Border/Text `border-primary text-primary` → `border-foreground text-foreground`
- **Clients-Page**: Avatar-Fallback `bg-primary/10 text-primary` → `bg-muted text-foreground`, Card `gap-4 py-5 hover:border-border/80`, Hover-Texts auf foreground
- **Invoices/Proposals**: Check-Icons im Status-Dropdown → `text-foreground`
- **Settings (Update verfügbar)**: `bg-primary/10 text-primary` → `bg-warning/10 text-warning` (semantisch korrekter)
- **Sub-Sections** (Tasks): Subtasks-Toggle, Import-Dialog-Icon, Task-Filter Check-Icon → `text-foreground`/`text-muted-foreground`

**Was bewusst Primary geblieben ist (semantisch korrekt):**
- Aktive Filter-Button im "Mehr Filter"-Counter (CTA)
- Selected-State auf TaskCards (`ring-2 ring-primary`)
- Drag-Overlay Placeholder
- Today-Highlight im Kalender
- Running-Timer Indicator (live-Status)
- Recurrence-Picker aktive Toggles
- Reports-Charts (Datenvisualisierung)
- Progress-Bars (Fortschritt)
- Mention-Highlight in Comments

**Verifiziert:** `tsc --noEmit` grün — keine Type-Fehler.

**Visuelle Verifikation steht aus** — Worktree hat keine `.env`-DB. Sobald die App läuft, kann man die Änderungen im Browser checken.

---

## 🎯 PX.2 · UX-Roadmap (aus UX-Audit 2026-05-10)

> Vollständiges Audit: siehe **`UX_AUDIT.md`** im Repo-Root. Ziel: großer Funktionsumfang ohne Überladung, schnelle Bearbeitung, bessere Client-UX.

### Hauptbefunde aus dem Audit

**Globale Patterns die fehlen:**
- `Cmd+Enter` zum Speichern fehlt in allen Forms (Task-Dialog, Kommentare, Epic, Spalten, Invoice)
- Native `confirm()`/`alert()` an 4 Stellen statt shadcn `AlertDialog`
- Kein Autosave-Indikator im Task-Dialog (User weiß nicht ob gespeichert)
- Fetch-Fehler werden still geschluckt (kein Inline-Error-State, kein Retry)
- View-Mode (Board/Liste/Kalender) nicht in URL → SavedViews verlieren View

**Client-UX Lücken (Priorität!):**
- Clients können keine Anfragen/Feedback-Tasks selbst erstellen
- Keine Fortschrittsanzeige auf Projekt-Cards für Clients (wichtigster Kontext fehlt)
- Abnahme-Workflow versteckt — keine dedizierte `/approvals`-Route in Sidebar
- Time-Entries für Clients unleserlich (rohe Tabelle statt "X Stunden abgerechnet"-Summary)
- Clients können keine eigenen Files (Briefings, Brand-Assets) hochladen

**Speed-of-Use Bremsen:**
- Status, Assignee, DueDate, Priorität alle nur über Task-Dialog änderbar (kein Inline-Edit in List-View / Cards)
- Kein `Cmd+Enter` für Comment-Submit (größter Power-User-Breaker)
- Form-Hierarchie falsch: Epic-Feld steht oben, Titel danach

**Information Density:**
- TaskCard mit bis zu 12 sichtbaren Elementen (Tags wrappen → ungleiche Card-Heights)
- Filter-Bar bricht auf 13"-Laptops bei 7 Elementen in einer Zeile
- Dashboard für Clients zu wenig informativ (Progress fehlt)

### Priorisierte Roadmap

**P-UX-1 · Quick Wins (gesamt < 1 Tag):**
- [ ] `Cmd+Enter` in Task-Form + Comment-Textarea
- [ ] Autofocus auf Titel-Input beim Task-Dialog
- [ ] Form-Order: Titel zuerst, Epic ans Ende
- [ ] `AlertDialog` für 4× `confirm()`/`alert()`
- [ ] Unread-Badge auf Inbox-Sidebar-Item
- [ ] `href="/tasks?due=overdue"` an Überfällig-StatCard
- [ ] shadcn `Switch` statt nacktem Checkbox für `clientVisible`
- [ ] `!`-Badge in "Mehr Filter" → Zahl
- [ ] URL-Param `?view=kanban|list|calendar|timeline`

**P-UX-2 · Mittel (gesamt ~1 Woche):**
- [ ] Inline Status-Toggle in List-View (Klick auf Badge → Mini-Popover)
- [ ] Inline Assignee-Toggle (Avatar-Klick → Members-Dropdown) in Card + List
- [ ] Inline Due-Date-Picker in List-View
- [ ] Progress-Bar auf Projekt-Cards (für Clients essentiell)
- [ ] Dedicated `/approvals`-Seite für Clients + Sidebar-Eintrag
- [ ] Toast + Retry bei Fetch-Fehlern (tasks/page.tsx, my-day/page.tsx)

**P-UX-3 · Größere Features (je > 3 Tage):**
- [ ] Client Request/Feedback-Flow (Clients erstellen Tasks mit `clientVisible + PENDING` → Team-Inbox)
- [ ] Side-Panel statt zentrierter Dialog (Linear-Style) für Task-Detail
- [ ] Drag zwischen My-Day-Buckets oder "Auf Heute setzen"-Action
- [ ] Markdown in Task-Beschreibung mit Preview-Toggle
- [ ] Client-Zeitübersicht: "X Stunden abgerechnet"-Summary, optional exportierbar

**Empfohlene Reihenfolge:**
1. P-UX-1 komplett (1 Tag) → spürbarer Speed-Boost
2. Progress-Bar auf Projekt-Cards + `/approvals`-Route (P-UX-2 Client-Block) → größter Client-Wert
3. Inline-Edits in List-View (P-UX-2 Speed-Block) → Power-User-Workflow
4. Side-Panel + Markdown (P-UX-3) → strategisch, schöneres Endspiel

**Problem-Analyse:**

Das aktuelle Design hat mehrere grundlegende Schwächen, die sich durch die schnelle Feature-Entwicklung akkumuliert haben:

1. **Zu wenig Spacing / gequetschtes Layout** — Elemente stehen zu eng beieinander, fehlende Abstände zwischen Sections, Cards, Buttons und Inline-Elementen. Braucht konsistente Spacing-Skala (8px-Grid).
2. **Überlappende Elemente** — Komponenten überlagern sich teilweise, z.B. in dichten Views (Kanban-Cards, Dialog-Sections, Filter-Bars). Klare Trennung und ausreichend Breathing-Room nötig.
3. **Highlight-/Accent-Color zu häufig eingesetzt** — Primary-Color wird inflationär verwendet (Buttons, Badges, Pills, Links, Hover-States gleichzeitig). Muss reduziert werden auf gezielte CTA-Elemente. Restliche UI neutral/muted halten.
4. **Buttons passen nicht zum Stil** — Inkonsistente Button-Styles (Größen, Radii, Padding, Varianten). Müssen an ein einheitliches System angepasst werden.
5. **Generell kein kohärentes Design-System** — Einzelne Komponenten sehen isoliert okay aus, aber das Gesamtbild wirkt zusammengewürfelt.

**Design-Richtung:**

- **Referenz:** [shadcn/ui](https://ui.shadcn.com/) als Baseline für Spacing, Typografie, Farbbalance und Komponentenstruktur
- **Ziel:** shadcn-Qualität als Fundament, aber visuell ansprechender/moderner ("sexier") — z.B. subtilere Animationen, elegantere Card-Designs, bessere visuelle Hierarchie
- **Kernprinzipien:**
  - Mehr Whitespace, großzügigere Abstände
  - Zurückhaltender Farb-Einsatz (Accent nur für primäre CTAs)
  - Konsistente Komponentengrößen und -abstände
  - Klare visuelle Hierarchie durch Typografie und Spacing statt durch Farbe
  - Buttons: einheitliches System (default/destructive/outline/ghost/link) wie shadcn, aber mit eigenem Feinschliff

**Scope (noch zu definieren):**

- [ ] Spacing-Audit: alle Pages durchgehen, Gap/Padding/Margin vereinheitlichen
- [ ] Color-Audit: Primary-Farbe auf CTAs reduzieren, Rest muted/neutral
- [ ] Button-Overhaul: Varianten + Sizes an shadcn-System angleichen
- [ ] Card/Container-Spacing: innere Padding + Abstände zwischen Cards
- [ ] Dialog-Layout: Sections besser trennen, Scrolling-Verhalten prüfen
- [ ] Kanban-Board: Card-Spacing, Column-Spacing, Overflow-Handling
- [ ] Filter-Bar / Toolbar: Abstände, Alignment, visuelles Gewicht
- [ ] Typography-Hierarchy: Headings, Labels, Body-Text klarer staffeln
- [ ] Hover/Focus-States: subtiler, weniger "laut"
- [ ] Global CSS Tokens: Spacing-Skala, Border-Radii, Schatten konsolidieren

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
1fdfa05 P3.8: Recurring Tasks (recurrenceRule + auto-create on Done)
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
