<p align="center">
  <img src="public/klinet-logo-shadow.png" alt="Klient Logo" width="200" />
</p>

<h1 align="center">Klient</h1>

<p align="center">
  <strong>Self-hosted Client Portal for Freelancers & Agencies</strong>
</p>

<p align="center">
  <a href="https://github.com/KORE-SYSTEMS/Klient/releases"><img src="https://img.shields.io/github/v/release/KORE-SYSTEMS/Klient?style=flat-square&color=F5A623" alt="Release"></a>
  <a href="https://github.com/KORE-SYSTEMS/Klient/blob/main/LICENSE"><img src="https://img.shields.io/github/license/KORE-SYSTEMS/Klient?style=flat-square" alt="License"></a>
  <a href="https://github.com/KORE-SYSTEMS/Klient/stargazers"><img src="https://img.shields.io/github/stars/KORE-SYSTEMS/Klient?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/KORE-SYSTEMS/Klient/issues"><img src="https://img.shields.io/github/issues/KORE-SYSTEMS/Klient?style=flat-square" alt="Issues"></a>
  <img src="https://img.shields.io/badge/docker-ready-blue?style=flat-square&logo=docker" alt="Docker">
</p>

---

**Klient** is a modern, self-hosted client portal built for freelancers and agencies. Manage projects, tasks, files, and client communication in one place -- fully under your control, no SaaS fees, no vendor lock-in.

## Features

- **Project Management** -- Create projects with status tracking, deadlines, and color-coded organization
- **Kanban Board** -- Drag-and-drop task management with Backlog, Todo, In Progress, Review, and Done columns
- **File Sharing** -- Upload and share files with clients, control visibility per file
- **Project Chat** -- Real-time messaging within each project
- **Client Portal** -- Clients only see what you share -- isolated access with granular visibility controls
- **Team Collaboration** -- Invite team members and assign roles (Admin, Member, Client)
- **Project Updates** -- Post milestones, info, warnings, and requests on a timeline
- **In-App Updates** -- Check for new versions and update directly from the settings page
- **Dark Theme** -- Clean, modern UI built with shadcn/ui

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Auth | NextAuth.js v5 |
| UI | shadcn/ui + Radix UI + Tailwind CSS |
| Language | TypeScript |
| Deployment | Docker + Docker Compose |

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/KORE-SYSTEMS/Klient.git
cd Klient
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set your values:

```env
# Required
DB_PASSWORD=your-secure-database-password
NEXTAUTH_SECRET=your-random-secret-string
NEXTAUTH_URL=http://localhost:8399

# Optional: SMTP for email notifications
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@klient.local
```

> **Tip:** Generate a secure secret with `openssl rand -base64 32`

### 3. Start the application

```bash
docker compose up -d
```

The app will be available at **http://localhost:8399**.

### 4. Login

Use the default admin credentials:

| | |
|---|---|
| **Email** | `admin@klient.local` |
| **Password** | `changeme123` |

> **Important:** Change the admin password immediately after first login.

---

## Installation Guides

### Unraid Installation

1. **Install the Docker Compose plugin** if you haven't already -- available in the Unraid Community Apps store.

2. **Open a terminal** in Unraid (SSH or web terminal) and clone the repo:

   ```bash
   mkdir -p /mnt/user/appdata/klient
   cd /mnt/user/appdata/klient
   git clone https://github.com/KORE-SYSTEMS/Klient.git .
   ```

3. **Create the environment file:**

   ```bash
   cp .env.example .env
   nano .env
   ```

   Set the following values:

   ```env
   DB_PASSWORD=a-strong-password-here
   NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
   NEXTAUTH_URL=http://YOUR-UNRAID-IP:8399
   ```

4. **Start the stack:**

   ```bash
   docker compose up -d
   ```

5. **Access Klient** at `http://YOUR-UNRAID-IP:8399`

6. **Data persistence:** The PostgreSQL data is stored in a Docker volume (`postgres_data`). Uploaded files are stored in `./uploads`.

#### Unraid: Using Docker Compose Manager

If you prefer the UI-based approach with the **Docker Compose Manager** plugin:

1. Go to **Docker** > **Compose** in the Unraid web UI
2. Click **Add New Stack**
3. Set the compose file path to `/mnt/user/appdata/klient/docker-compose.yml`
4. Add the environment variables in the stack settings
5. Click **Compose Up**

### Generic Docker Installation

Works on any Linux server, VPS, Raspberry Pi, or local machine with Docker installed.

```bash
# Clone
git clone https://github.com/KORE-SYSTEMS/Klient.git
cd Klient

# Configure
cp .env.example .env
nano .env  # Set DB_PASSWORD, NEXTAUTH_SECRET, NEXTAUTH_URL

# Start
docker compose up -d

# View logs
docker compose logs -f app
```

The app runs on port **8399** by default. To change it, edit the `ports` mapping in `docker-compose.yml`:

```yaml
ports:
  - "YOUR_PORT:3000"
```

---

## Reverse Proxy Setup

### Nginx Proxy Manager

1. Add a new **Proxy Host**
2. Set the following:
   - **Domain:** `klient.yourdomain.com`
   - **Scheme:** `http`
   - **Forward Hostname/IP:** Your server IP (or `klient-app` if on the same Docker network)
   - **Forward Port:** `8399`
3. Enable **SSL** via Let's Encrypt
4. Update your `.env`:

   ```env
   NEXTAUTH_URL=https://klient.yourdomain.com
   ```

5. Restart the app:

   ```bash
   docker compose restart app
   ```

### Traefik / Caddy

Point your reverse proxy to `http://localhost:8399` and set `NEXTAUTH_URL` to your public domain.

---

## Updates

### In-App Updates

1. Go to **Settings** in the Klient dashboard
2. The **Version & Updates** section shows your current version
3. Click **Check for Updates** to see if a new release is available
4. Click **Update** to pull the latest version and rebuild automatically

The updater sidecar container handles the update process -- it pulls the latest code from GitHub and rebuilds the app container.

### Manual Updates

```bash
cd /path/to/Klient
git pull
docker compose up -d --build --no-deps app
```

---

## Backups

### Database

```bash
# Create backup
docker exec klient-db pg_dump -U klient klient > backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i klient-db psql -U klient klient < backup_20240101.sql
```

### Files

Uploaded files are stored in the `./uploads` directory. Include this in your backup routine.

### Full Backup (Unraid)

If running on Unraid, you can back up the entire `/mnt/user/appdata/klient` directory using the **Unraid Backup** plugin or any standard backup solution.

---

## Development

```bash
# Prerequisites: Node.js 20+, PostgreSQL

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Configure DATABASE_URL to point to your local PostgreSQL

# Run migrations
npm run db:migrate

# Seed the database
npm run db:seed

# Start dev server
npm run dev
```

The dev server runs at `http://localhost:3000`.

---

## Project Structure

```
Klient/
├── app/                  # Next.js App Router pages & API routes
│   ├── (auth)/           # Login, invitation pages
│   ├── (dashboard)/      # Dashboard, projects, clients, settings
│   └── api/              # REST API endpoints
├── components/           # Reusable UI components
├── lib/                  # Auth, Prisma client, utilities
├── prisma/               # Schema, migrations, seed
├── public/               # Static assets, logos
├── updater/              # Update sidecar container
├── docker-compose.yml    # Production Docker stack
├── Dockerfile            # Multi-stage production build
└── docker-entrypoint.sh  # Startup script (migrations + seed)
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_PASSWORD` | Yes | -- | PostgreSQL password |
| `NEXTAUTH_SECRET` | Yes | -- | Random secret for session encryption |
| `NEXTAUTH_URL` | Yes | -- | Public URL of your Klient instance |
| `SMTP_HOST` | No | -- | SMTP server for email notifications |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | -- | SMTP username |
| `SMTP_PASS` | No | -- | SMTP password |
| `SMTP_FROM` | No | `noreply@klient.local` | Sender email address |

---

## Contributing

Contributions are welcome! Please open an [issue](https://github.com/KORE-SYSTEMS/Klient/issues) or submit a [pull request](https://github.com/KORE-SYSTEMS/Klient/pulls).

## License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  Built with care by <a href="https://github.com/KORE-SYSTEMS">KORE SYSTEMS</a>
</p>
