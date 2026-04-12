# Klient

> Self-hosted client portal for freelancers and agencies.  
> Built with Next.js, shadcn/ui, Prisma, PostgreSQL — deployed via Docker.

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/KORE-SYSTEMS/Klient.git
cd Klient
```

### 2. Configure

```bash
cp .env.example .env
```

Set these values in `.env`:

```env
DB_PASSWORD=your_strong_password
NEXTAUTH_SECRET=generate_with_openssl_rand_hex_32
NEXTAUTH_URL=http://YOUR_UNRAID_IP:8399
```

### 3. Start

```bash
docker compose up -d --build
```

### 4. Login

Open `http://YOUR_UNRAID_IP:8399`

```
Email:    admin@klient.local
Password: changeme123
```

**Change the password after first login.**

---

## Unraid Setup

1. SSH into your Unraid server or use the terminal
2. Clone to appdata: `cd /mnt/user/appdata && git clone https://github.com/KORE-SYSTEMS/Klient.git && cd Klient`
3. `cp .env.example .env && nano .env` (set DB_PASSWORD, NEXTAUTH_SECRET, NEXTAUTH_URL)
4. `docker compose up -d --build`
5. Access at `http://YOUR_UNRAID_IP:8399`

### With Nginx Proxy Manager

1. Add Proxy Host: `klient.yourdomain.com` -> `klient-app:3000`
2. Enable SSL via Let's Encrypt
3. Update `NEXTAUTH_URL=https://klient.yourdomain.com` in `.env`
4. `docker compose down && docker compose up -d`

---

## Update

```bash
cd /mnt/user/appdata/Klient
git pull
docker compose down
docker compose up -d --build
```

---

## Backup

```bash
# Database
docker exec klient-db pg_dump -U klient klient > backup_$(date +%Y%m%d).sql

# Files
tar -czf klient_uploads_$(date +%Y%m%d).tar.gz ./uploads
```

---

## Development

```bash
npm install
cp .env.example .env.local
# Set DATABASE_URL to a local postgres
npx prisma migrate dev
npx prisma db seed
npm run dev
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| UI | shadcn/ui + Tailwind CSS |
| Auth | NextAuth.js v5 |
| ORM | Prisma |
| Database | PostgreSQL 15 |
| Storage | Local filesystem (Docker volume) |
| Port | 8399 (default) |

---

## License

MIT — built by [KORE Systems](https://kore-systems.com)
