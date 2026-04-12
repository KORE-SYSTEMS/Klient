<p align="center">
  <img src="public/klinet-logo-shadow.png" alt="Klient Logo" width="200" />
</p>

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

**Klient** is a modern, self-hosted client portal. Manage projects, tasks, files, and client communication in one place. Single container, zero configuration, just start it.

## Features

- **Project Management** -- Status tracking, deadlines, color-coded projects
- **Kanban Board** -- Drag-and-drop tasks across 5 columns
- **File Sharing** -- Upload files, control per-file client visibility
- **Project Chat** -- Real-time messaging per project
- **Client Portal** -- Isolated client access with granular permissions
- **Team & Roles** -- Admin, Member, Client roles
- **Single Container** -- SQLite database, no external dependencies
- **Zero Config** -- Auto-generates secrets, creates database on first start

---

## Quick Start

```bash
docker run -d --name klient -p 8399:3000 \
  -v klient-data:/app/data \
  -v klient-uploads:/app/uploads \
  --restart unless-stopped \
  ghcr.io/kore-systems/klient:latest
```

Open **http://localhost:8399** -- done.

| | |
|---|---|
| **Email** | `admin@klient.local` |
| **Password** | `changeme123` |

No `.env` file needed. No database setup. No secrets to generate. The container handles everything on first start.

---

## Unraid

### Option 1: XML Template (easiest)

1. Go to **Docker** > **Add Container** > **Template Repositories**
2. Add: `https://github.com/KORE-SYSTEMS/Klient`
3. Select **Klient**, click **Apply**

### Option 2: Docker Run

```bash
docker run -d --name klient -p 8399:3000 \
  -v /mnt/user/appdata/klient/data:/app/data \
  -v /mnt/user/appdata/klient/uploads:/app/uploads \
  --restart unless-stopped \
  ghcr.io/kore-systems/klient:latest
```

### Option 3: Docker Compose

```bash
mkdir -p /mnt/user/appdata/klient && cd /mnt/user/appdata/klient
git clone https://github.com/KORE-SYSTEMS/Klient.git .
docker compose up -d
```

---

## Any Server (Linux / VPS / Raspberry Pi)

```bash
docker run -d --name klient -p 8399:3000 \
  -v /opt/klient/data:/app/data \
  -v /opt/klient/uploads:/app/uploads \
  --restart unless-stopped \
  ghcr.io/kore-systems/klient:latest
```

Or with Docker Compose:

```bash
git clone https://github.com/KORE-SYSTEMS/Klient.git && cd Klient
docker compose up -d
```

---

## Reverse Proxy

If you put Klient behind a reverse proxy (Nginx Proxy Manager, Traefik, Caddy), set the public URL:

```bash
docker run -d --name klient -p 8399:3000 \
  -v klient-data:/app/data \
  -v klient-uploads:/app/uploads \
  -e NEXTAUTH_URL=https://klient.yourdomain.com \
  --restart unless-stopped \
  ghcr.io/kore-systems/klient:latest
```

The only time you need to set any environment variable is when using a custom domain.

---

## Updates

```bash
docker pull ghcr.io/kore-systems/klient:latest
docker stop klient && docker rm klient
# Re-run your docker run command — data volumes persist
```

Or with Docker Compose:

```bash
docker compose pull && docker compose up -d
```

On Unraid with [Watchtower](https://containrrr.dev/watchtower/), updates happen automatically.

Klient shows available updates in **Settings > Version & Updates**.

---

## Backups

All data lives in two directories:

| Path | Contains |
|------|----------|
| `/app/data` | SQLite database + session secret |
| `/app/uploads` | Uploaded files |

```bash
# Backup
cp /path/to/klient/data/klient.db backup_$(date +%Y%m%d).db
cp -r /path/to/klient/uploads/ backup_uploads/

# On Unraid: backup /mnt/user/appdata/klient/
```

---

## Configuration (all optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXTAUTH_URL` | auto-detected | Only needed behind a reverse proxy |
| `NEXTAUTH_SECRET` | auto-generated | Session secret, persisted in `/app/data` |
| `DATABASE_URL` | `file:/app/data/klient.db` | SQLite path |

---

## Development

```bash
npm install
echo 'DATABASE_URL="file:./dev.db"' > .env
echo 'NEXTAUTH_SECRET="dev-secret"' >> .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | SQLite |
| Auth | NextAuth.js v5 |
| UI | shadcn/ui + Tailwind CSS |
| Language | TypeScript |

---

## Contributing

[Issues](https://github.com/KORE-SYSTEMS/Klient/issues) and [Pull Requests](https://github.com/KORE-SYSTEMS/Klient/pulls) welcome.

## License

[MIT](LICENSE)

---

<p align="center">
  Built by <a href="https://github.com/KORE-SYSTEMS">KORE SYSTEMS</a>
</p>
