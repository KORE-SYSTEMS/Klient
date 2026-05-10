# UX-Audit · 2026-05-10

> Code-basiertes UX-Audit nach Design-Overhaul. Fokus: großer Funktionsumfang ohne Überladung, schnelle Bearbeitung, Client-UX.

---

## A · Globale Patterns die fehlen / inkonsistent sind

**Cmd+Enter zum Speichern fehlt komplett.**
Im Task-Dialog (`tasks/page.tsx` L1427–1588) gibt es ein `<form onSubmit={saveTask}>`, aber kein globales `keydown`-Handling auf `Cmd+Enter`. Der User muss immer zur Maus wechseln oder Tab zum Submit-Button. Gilt auch für Kommentare (`comments-section.tsx` L65–80), Epic-Dialog, Spalten-Dialog, Invoice-Dialog.

**`confirm()` / `alert()` statt Confirmation-Dialog bei Destructive Actions.**
Mindestens 4 Stellen: `deleteColumn` (L401: `alert()`), `bulkDelete` (L714: `confirm()`), `deleteRead` in inbox (L171: `confirm()`), `deleteTask`. Native Browser-Dialoge blockieren JS-Thread, sehen in Dark-Mode schlecht aus, nicht stylebar. Ein shadcn `AlertDialog` wäre konsistent.

**Kein Autosave-Indikator im Task-Dialog.**
Der Dialog hat Optimistic Updates für Kanban, aber bei Bestandstask-Änderungen kein "Gespeichert ✓" Feedback. Kein Dirty-State Indicator. User weiß nicht ob Klick außerhalb verwirft.

**Error-States nur als Toast, nie inline.**
Fetch-Fehler in `fetchTasks`, `fetchStatuses`, `fetchEpics` (L220–241) werden still geschluckt. Kanban bleibt leer ohne Erklärung. Gleiches in `my-day/page.tsx` (L80–87). Mindestens Retry-Button im EmptyState.

**Inkonsistente Checkbox-Implementierung.**
List-View (`tasks/page.tsx` L1102–1115) und Inbox: `<button>` mit Opacity-0-auf-Hover-Trick, kein `role="checkbox"` und kein `aria-checked` — Screen-Reader kaputt.

**Kein Loading-Skeleton in `projects/[id]/page.tsx`.**
Beim ersten Laden flackert leere Seite bevor Daten kommen.

**View-Mode (Board/Liste/Kalender) nicht in URL.**
Lokaler State (L143). Direkter Link zu `/projects/[id]/tasks` öffnet immer Kanban. Saved Views und geteilte URLs verlieren den View-Mode.

---

## B · Client-spezifische UX (Priorität!)

**Was Clients aktuell können:** Kanban lesen (greyed-out für nicht-zugewiesene), Kommentare, Files ansehen, Abnahme (Approve/Reject mit Kommentar), My Day, Dashboard, Inbox, Rechnungen.

### Was fehlt für "großen Funktionsumfang ohne Überladung":

**1. Feedback-Requests selbst initiieren.**
Clients können keine Tasks erstellen. Schlanker "Anfrage stellen"-Flow: ein Formular (Titel + Beschreibung + optional File-Upload) → erzeugt Task mit `clientVisible: true`, landet in Team-Approval-Queue. Umgekehrter Approval-Flow.

**2. Inline-Kommentar bei Approval-Reject zu unprominent.**
Textarea (`tasks/page.tsx` L1371–1376) ist `placeholder="Optionaler Kommentar..."` — klingt optional. Bei Ablehnung sollte Begründung `required` sein oder Hinweis "Bitte erkläre kurz was überarbeitet werden soll."

**3. Client sieht keine Gesamtfortschrittsanzeige im Projekt.**
`dashboard/page.tsx` zeigt Client generischen Stand-Text (L139). Projekt-Cards zeigen nur Task-Count und Member-Count (L378–389), keine Progress-Bar. Eine `done/total` Progress-Bar wäre für Clients der wichtigste Kontext.

**4. Client kann keine eigenen Files beisteuern.**
`files-section.tsx` hat `canUpload`-prop (L11). Client sollte Referenz-Dateien (Brand-Assets, Briefings) hochladen dürfen.

**5. Abnahme-Workflow versteckt.**
Einstieg nur über Task-Click im Kanban oder Dashboard-Link. Keine dedizierte "Zur Abnahme"-Sidebar-Sektion. Sidebar-Client zeigt: Inbox, Mein Tag, Dashboard, Projekte, Meine Tasks, Rechnungen — keine `/approvals`-Route.

**6. Time-Entries für Client unleserlich.**
TimeEntriesSection wird im Client-Read-Only gerendert (L1352), aber rohe Einträge mit Datum/Uhrzeit. Keine Summary "Bisher 4h 20min an diesem Task gearbeitet."

---

## C · Pro Page — konkrete UX-Probleme + Lösungsvorschlag

### Dashboard (`dashboard/page.tsx`)

**Funktioniert gut:** Klare Stat-Cards, "Bald fällig" mit farbcodiertem Datum-Widget, parallele Queries.

**Reibungspunkte:**
- "Überfällig"-StatCard (L157–162) hat keinen `href` — sollte zu `/tasks?due=overdue` linken
- "Ausstehende Abnahmen"-StatCard (L163–169) hat keinen `href` — Clients haben keine `/approvals`-Route
- `take: 6` Projekte / `take: 8` Tasks (L70) — kein Count ("8 von 23")

**Quick Wins:** `href` an die StatCards. "Ausstehende Abnahmen" für Clients als großer CTA.

**Größer:** Fortschrittsbalken auf Projekt-Cards für Clients. "Aktivität heute"-Feed.

### My Day (`my-day/page.tsx`)

**Funktioniert gut:** Bucket-Struktur (Überfällig/Heute/Woche/Später/Ohne Datum), Loading-Skeleton, Refetch on visibility.

**Reibungspunkte:**
- `markDone` (L190–208) hardcoded `status: "DONE"` — bei Server-Reject still rückgängig, kein Toast
- Click navigiert zu `/projects/[id]/tasks?task=[id]` (L386) — Full-Navigation statt Slide-over
- Kein "Heute planen"-Drag von Bucket zu Bucket

**Quick Wins:** Toast bei `markDone` Fehler. "Datum setzen"-Inline-Action via DatePicker-Popover.

**Größer:** Slide-over-Panel statt Full-Navigation. Drag zwischen Buckets.

### Inbox (`inbox/page.tsx`)

**Funktioniert gut:** Multi-Select + Bulk-Mark-Read, Type-Filter-Chips, timeAgo, Hover-Delete.

**Reibungspunkte:**
- `confirm()` für deleteRead (L171)
- Limit hardcoded auf 100, kein "Mehr laden"
- `router.push(n.link)` (L207) verlässt Inbox ohne Slide-over
- Keine Keyboard-Shortcuts (j/k Navigation, Enter Open, e Mark-Read)

**Quick Wins:** `j/k/e`-Shortcuts. `AlertDialog` statt `confirm()`.

**Größer:** Virtual Scroll. Preview-Panel rechts.

### Tasks/Kanban (`projects/[id]/tasks/page.tsx`)

**Funktioniert gut:** Optimistic Updates, Multi-Select, DnD mit Placeholder, View-Toggle, SavedViews, Filter-URL-Sync, Loading-Skeleton (L747–791).

**Reibungspunkte:**
- Dialog-Größe wechselt zwischen Edit (`max-w-2xl`) und Create (`max-w-lg`) → Größensprung
- **Epic-Feld steht oben** im Form (L1428–1443), Titel danach (L1444) → falsche kognitive Hierarchie
- `formDescription` Textarea (L1449–1451) ohne Markdown-Preview — Read-Only-View nutzt nur `whitespace-pre-wrap`
- Nacktes `<input type="checkbox">` für "clientVisible" (L1584) statt shadcn Switch
- List-View ohne Inline-Edit für Titel (Kanban hat InlineTitle)
- `deleteTask` (L368–372) ohne Confirmation
- **Kein Cmd+Enter im Task-Form**

**Quick Wins:**
- Autofocus auf Titel-Input
- Form-Order: Titel → Beschreibung → Status/Priorität → Assignee → Dates → Epic
- `Cmd+Enter` global submit
- shadcn `Switch` für clientVisible
- `AlertDialog` für Delete

**Größer:**
- Markdown-Editor mit Preview-Toggle
- Inline-Edit in List-View
- Side-Panel statt zentrierter Dialog (Linear-Style)

### Task-Card (`task-card.tsx`)

**Funktioniert gut:** Checklist-Progressbar, Avatar, Overdue-Highlight, Timer, InlineTitle, NextPhase-Hover-Button.

**Reibungspunkte:**
- Bis zu 6 Tags in Tag-Row (L165–193) → wrappen auf 2 Zeilen → ungleiche Card-Heights
- Description (L195–200) immer Whitespace selbst bei kurzem Inhalt
- Client-Greyed-Out (L131): `opacity-50` auf gesamter Card schwer lesbar — besser `opacity-60` nur auf Body

**Quick Wins:** Max 3 Tags sichtbar, Rest hinter "+2 mehr". Description trim().

### Task-Filters (`task-filters.tsx`)

**Funktioniert gut:** Preset-Chips + Advanced-Panel, resultSummary, Clear-All.

**Reibungspunkte:**
- "Mehr Filter"-Button zeigt `!`-Badge (L194) statt Zahl
- Advanced-Panel inline-Block statt Popover/Flyout — überlagert Content auf kleinen Screens
- Due-Date-Segment-Control im Advanced (L371–393) dupliziert "Überfällig"-Chip → 2 Wege für 1 Setting
- Suche `w-44` fix — auf Mobile zu klein, Desktop verschwendet

**Quick Wins:** `!` durch Zahl. Duplikat entfernen. Suche flexibel.

### Sidebar (`sidebar.tsx`)

**Funktioniert gut:** Collapse-Toggle, Auto-expand, Role-based Nav, Indicator-Bar.

**Reibungspunkte:**
- Kein Unread-Badge auf "Inbox"-Item (L47, 88, 100)
- Collapsed-Zustand: keine Tooltips für Sub-Items (Children werden nicht gerendert)
- Keine "Schnell zu Projekt"-Sektion (Projektliste in Sidebar)
- Footer mit GitHub/Ko-fi (L315–354) lenkt produktive Teams ab

**Quick Wins:** Unread-Count-Badge auf Inbox. `title` für collapsed Sub-Items.

**Größer:** Aktuelle Projekte als collapsible Nav-Sektion (Linear-Style).

### Clients (`clients/page.tsx`)

**Funktioniert gut:** LeadStatus-Badges, Invitation-Management, parallele Queries.

**Reibungspunkte:**
- Kein Suchfeld bei >10 Clients
- `/clients/pipeline` separate Route, sehr ähnlich Übersicht — Tab-Toggle wäre schlanker

**Quick Wins:** Suchfeld mit `filter()` (kein Server-Request). Sort by Name/LastActivity.

### Reports (`reports/page.tsx`)

**Reibungspunkte:**
- Kein Client-Access auf Reports — keine eigenen abgerechneten Stunden sichtbar
- Nur Tabellen, keine visuellen Charts

### Invoices (`invoices/page.tsx`)

**Reibungspunkte:**
- Clients sehen Rechnungen, aber keine "Bezahlen"-CTA bei offenen
- Keine Sortierung nach Betrag/Status

---

## D · Speed-of-Use: was bremst die tägliche Arbeit?

**1. Status-Änderung erfordert Dialog.**
List-View hat keinen Inline-Status-Toggle. Klick auf Status-Badge sollte Mini-Popover mit verfügbaren Statuses öffnen.

**2. Assignee-Wechsel nur über Dialog.**
Avatar-Klick sollte Mini-Dropdown mit Mitgliedern öffnen (Card + List-Row).

**3. Due-Date nur über Dialog (außer Calendar-View).**
Datum-Text in Card/Row sollte inline DatePicker öffnen.

**4. Priorität nur über Dialog.**
PriorityPill nur Display. Klick sollte Priority-Picker-Popover öffnen.

**5. Kommentar-Submit erfordert Maus.**
`CommentsSection` (L65–80): kein `Cmd+Enter`. Größter Workflow-Breaker für Power-User.

**6. Kein "Zuletzt besucht"-Tracker.**
Dashboard → Task → zurück landet auf `/dashboard`, nicht vorherigem Board.

**7. Template-Menü nicht discoverable.**
`TemplatesMenu` rechts in Toolbar (L908–915), neue User finden's nicht. Hinweis im EmptyState wäre besser.

---

## E · Information Density — "viel ohne Überladung"

**Task-Card grenzwertig.** Bis zu 12 sichtbare Elemente: Titel, Epic, Priority, Approval, Recurrence, ClientVisible, Description, Checklist, Avatar, DueDate, 4 Counter, Timer.

Empfehlung:
- **Immer:** Titel, Priority-Pill, Avatar, DueDate, Checklist-Bar
- **Hover:** NextPhase, Timer
- **Tooltip:** Recurrence (✓ schon Icon-only), ApprovalBadge als farbiger Rand statt Pille
- **Counter:** Subtask + Comment immer; File + Time hover-only oder kombiniert

**Filter-Bar zu lang** mit Epics. 4 Chips + Mehr Filter + Zurücksetzen + resultSummary = 7 Elemente, bricht auf 13"-Laptops. "Mir zugewiesen" + "Ohne Assignee" → ein Assignee-Dropdown. "Hoch-Prio" → in "Mehr Filter".

**Sidebar nicht überladen** (clientNav 6, adminNav 9 mit Children).

**Dashboard-Widgets:** 4 StatCards + 4 Panels = 8 Blöcke. Für Admins ok, für Clients zu wenig Info-Dichte (Projekt-Fortschritt fehlt).

**Kanban-Spalten-Header:** Name + Count + Total-Time gut. Optional WIP-Limit-Indikator.

---

## F · Priorisierte Roadmap

### P-UX-1 · Quick Wins (je < 2h, gesamt < 1 Tag)

- [ ] `Cmd+Enter` als Form-Submit in Task-Dialog + Comment-Textarea
- [ ] Autofocus auf Titel-Input beim Task-Dialog-Öffnen
- [ ] Form-Order Task-Dialog: Titel zuerst, Epic ans Ende
- [ ] `AlertDialog` für alle `confirm()`/`alert()`: deleteTask, deleteColumn, bulkDelete, deleteRead (Inbox) — 4 Stellen
- [ ] Unread-Count-Badge auf Inbox-Sidebar-Item
- [ ] `href="/tasks?due=overdue"` an Überfällig-StatCard
- [ ] shadcn `Switch` statt nacktem Checkbox für `clientVisible`
- [ ] `!`-Badge in "Mehr Filter" durch Zahl ersetzen
- [ ] URL-Param `?view=kanban|list|calendar|timeline` für persistierbaren View

### P-UX-2 · Mittel (je 1–3 Tage, gesamt ~1 Woche)

- [ ] **Inline Status-Toggle** in List-View: Klick auf Status-Badge → Mini-Popover + Optimistic Update
- [ ] **Inline Assignee-Toggle** in List-View und Kanban-Card: Avatar-Klick → Members-Dropdown
- [ ] **Inline Due-Date-Picker** in List-View: Klick → DatePicker-Popover
- [ ] **Progress-Bar auf Projekt-Cards** (Dashboard + Übersicht): `done/total` Tasks
- [ ] **Dedicated Approvals-Seite** für Clients: `/approvals` Route + clientNav-Eintrag, listet Tasks mit `approvalStatus: PENDING`
- [ ] **Toast + Retry** bei fetch-Fehlern in tasks/page.tsx und my-day/page.tsx

### P-UX-3 · Größere Features (je > 3 Tage)

- [ ] **Client Request/Feedback-Flow:** "Anfrage stellen"-Button für CLIENT → Task mit `clientVisible: true` + `approvalStatus: PENDING` → Team-Inbox (umgekehrter Approval)
- [ ] **Side-Panel statt Dialog** für Task-Detail (Linear-Style): Slide-over rechts, Board bleibt sichtbar
- [ ] **Inline Drag in My Day:** Drag zwischen Buckets oder "Auf Heute setzen"-Action
- [ ] **Markdown in Task-Beschreibung:** Editor mit Preview-Toggle
- [ ] **Client-Zeitübersicht:** Task-Detail "X Stunden abgerechnet" Summary statt roher TimeEntries; optional exportierbar

---

*Audit basiert auf Code-Analyse der 15+ wichtigsten Files im Worktree `ecstatic-mendel-cb9c0a` (2026-05-10). File-Referenzen relativ zum Repo-Root.*
