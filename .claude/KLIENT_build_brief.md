# KLIENT — Build Brief für AI Vibe Coding Agent

## Projektübersicht

Baue **Klient** — eine self-hosted Client Portal Web-App für Freelancer und Agenturen.
Deployed via Docker + Nginx Proxy Manager, erreichbar unter einer eigenen Domain.
Repository: `github.com/[user]/klient`

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **Icons**: Lucide React
- **State**: Zustand
- **Forms**: React Hook Form + Zod

### Backend
- **API**: Next.js API Routes (oder separates Express/Fastify wenn nötig)
- **Auth**: NextAuth.js v5 (Email/Password + Magic Link)
- **ORM**: Prisma
- **DB**: PostgreSQL
- **File Storage**: lokales Filesystem (Docker Volume) — S3-kompatibel optional

### Deployment
- Docker Compose (alles in einem Stack)
- Nginx Proxy Manager kompatibel (kein eingebauter SSL nötig)
- `.env` Datei für alle Secrets

---

## Design Language

### Referenz
Die App orientiert sich am KORE-Brand (kore-systems.com):
- **Palette**: Schwarz (`#0a0a0a`), Weiß, Orange-Akzent (`#E8520A` oder ähnlich)
- **Typografie**: Stark, modern, technisch — kein generisches Inter/Roboto
- **Stil**: Professionell wie eine SaaS-App (ähnlich Linear, Vercel Dashboard) — aber mit dem KORE-Charakter: kantig, präzise, kein unnötiger Schnickschnack

### shadcn/ui Anpassungen
- Dark Mode als Default
- Primärfarbe: Orange-Akzent
- Border-Radius: klein (0.25rem) — eckig, nicht rund
- Keine Schatten, stattdessen klare Borders

### Layout
- Sidebar Navigation (kollabierbar)
- Topbar mit Workspace-Switcher + User-Avatar
- Content-Bereich mit klaren Sektionen

---

## Funktionsumfang

### Rollen
| Rolle | Beschreibung |
|-------|-------------|
| `admin` | Freelancer / Agentur-Inhaber — voller Zugriff |
| `member` | Internes Teammitglied |
| `client` | Kunde — sieht nur seine eigenen Projekte/Dateien |

### Module

#### 1. Auth
- Login via Email + Passwort
- Magic Link (optional)
- Passwort reset
- Session-Management (NextAuth)
- Kunden erhalten Einladungs-Email mit Setup-Link

#### 2. Dashboard
- Übersicht: offene Tasks, aktuelle Projekte, ungelesene Nachrichten
- Unterschiedliche Views für Admin vs. Client

#### 3. Projekte
- Projekt anlegen (Name, Beschreibung, Status, Fälligkeitsdatum, Farbe/Label)
- Projekt einem oder mehreren Kunden zuweisen
- Projekt-Status: `planning` | `active` | `review` | `completed` | `on_hold`
- Projekt-Detail-Seite mit allen verknüpften Tasks, Dateien, Updates, Nachrichten

#### 4. Task Tracking
- Tasks innerhalb von Projekten
- Felder: Titel, Beschreibung, Assignee, Priorität, Status, Fälligkeitsdatum
- Status: `backlog` | `todo` | `in_progress` | `in_review` | `done`
- Kanban-Board View + List View
- Kunden sehen nur Tasks die für sie freigegeben sind (`client_visible: boolean`)

#### 5. Datei-Sharing
- Dateien hochladen (Drag & Drop)
- Dateien einem Projekt zuordnen
- Kunden können nur freigegebene Dateien sehen und herunterladen
- Vorschau für PDF, Bilder
- Versionierung (optional v2)

#### 6. Updates / Timeline
- Admin postet Projekt-Updates (wie LinkedIn-Posts, aber intern)
- Update-Types: `info` | `milestone` | `warning` | `request`
- Kunden sehen Updates ihres Projekts in chronologischer Timeline
- Optional: Kommentar-Funktion

#### 7. Messaging / Chat
- Einfacher Projekt-Chat (kein Echtzeit-Pflicht, Polling reicht für v1)
- Thread pro Projekt
- Ungelesen-Indikator
- Datei-Anhänge im Chat

#### 8. Kunden-Management
- Kunden anlegen (Name, Email, Firma, Logo optional)
- Kunden-Profil mit allen verknüpften Projekten
- Einladungslink generieren und versenden

#### 9. Einstellungen (Admin)
- Workspace-Name, Logo, Primärfarbe (White-Label basics)
- Email-SMTP konfigurieren
- User-Management (invite, deactivate)

---

## Datenbankschema (Prisma — Überblick)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(CLIENT)
  password  String?
  createdAt DateTime @default(now())
  projects  ProjectMember[]
  tasks     Task[]   @relation("assignee")
  messages  Message[]
}

enum Role {
  ADMIN
  MEMBER
  CLIENT
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      ProjectStatus @default(PLANNING)
  color       String?
  dueDate     DateTime?
  createdAt   DateTime @default(now())
  members     ProjectMember[]
  tasks       Task[]
  files       File[]
  updates     Update[]
  messages    Message[]
}

enum ProjectStatus {
  PLANNING
  ACTIVE
  REVIEW
  COMPLETED
  ON_HOLD
}

model Task {
  id            String     @id @default(cuid())
  title         String
  description   String?
  status        TaskStatus @default(BACKLOG)
  priority      Priority   @default(MEDIUM)
  clientVisible Boolean    @default(false)
  dueDate       DateTime?
  project       Project    @relation(fields: [projectId], references: [id])
  projectId     String
  assignee      User?      @relation("assignee", fields: [assigneeId], references: [id])
  assigneeId    String?
}

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model File {
  id        String   @id @default(cuid())
  name      String
  path      String
  size      Int
  mimeType  String
  project   Project  @relation(fields: [projectId], references: [id])
  projectId String
  public    Boolean  @default(false)
  createdAt DateTime @default(now())
}

model Update {
  id        String     @id @default(cuid())
  content   String
  type      UpdateType @default(INFO)
  project   Project    @relation(fields: [projectId], references: [id])
  projectId String
  createdAt DateTime   @default(now())
}

enum UpdateType {
  INFO
  MILESTONE
  WARNING
  REQUEST
}

model Message {
  id        String   @id @default(cuid())
  content   String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  project   Project  @relation(fields: [projectId], references: [id])
  projectId String
  createdAt DateTime @default(now())
}

model ProjectMember {
  user      User    @relation(fields: [userId], references: [id])
  userId    String
  project   Project @relation(fields: [projectId], references: [id])
  projectId String
  @@id([userId, projectId])
}
```

---

## Docker Setup

### `docker-compose.yml`
```yaml
services:
  app:
    build: .
    container_name: klient-app
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://klient:${DB_PASSWORD}@db:5432/klient
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - db
    networks:
      - klient-net

  db:
    image: postgres:15-alpine
    container_name: klient-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: klient
      POSTGRES_USER: klient
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - klient-net

volumes:
  postgres_data:

networks:
  klient-net:
    driver: bridge
```

### `.env.example`
```env
DB_PASSWORD=change_me
NEXTAUTH_SECRET=generate_with_openssl_rand_hex_32
NEXTAUTH_URL=https://klient.yourdomain.com
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

---

## Projekt-Struktur

```
klient/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── invite/[token]/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar + Topbar
│   │   ├── dashboard/
│   │   ├── projects/
│   │   │   ├── page.tsx        # Projektliste
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Projekt-Detail
│   │   │       ├── tasks/
│   │   │       ├── files/
│   │   │       ├── updates/
│   │   │       └── chat/
│   │   ├── clients/
│   │   └── settings/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── projects/
│       ├── tasks/
│       ├── files/
│       ├── messages/
│       └── invitations/
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── project-card.tsx
│   ├── task-board.tsx
│   └── file-uploader.tsx
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

---

## Wichtige Hinweise für den Agent

1. **Kunden-Isolation ist kritisch** — ein Client darf niemals Daten anderer Clients sehen. Jede API-Route muss die Session-Rolle prüfen.
2. **Mobile-first** — das Portal wird von Kunden auch auf dem Handy genutzt.
3. **Dark Mode Default** — shadcn/ui dark theme von Anfang an.
4. **Keine externen Abhängigkeiten** zur Laufzeit — alles muss offline funktionieren (außer SMTP).
5. **Seed-Script** einbauen (`prisma/seed.ts`) der einen Admin-User anlegt damit man direkt einloggen kann.
6. **README.md** mit klarer Installations-Anleitung: Clone → `.env` → `docker compose up`.

---

## v1 Scope (MVP — was fertig sein muss)

- [ ] Auth (Login, Invite, Logout)
- [ ] Dashboard (Admin + Client View)
- [ ] Projekte CRUD
- [ ] Tasks mit Kanban Board
- [ ] Datei-Upload + Download
- [ ] Projekt-Updates Timeline
- [ ] Einfacher Chat pro Projekt
- [ ] Kunden-Management + Einladung
- [ ] Docker Compose läuft out-of-the-box

## v2 (später)

- [ ] Email-Benachrichtigungen
- [ ] Aktivitäts-Log
- [ ] Rechnungen/Angebote
- [ ] Zeiterfassung
- [ ] White-Label (eigenes Logo pro Workspace)
- [ ] S3-Storage Option
