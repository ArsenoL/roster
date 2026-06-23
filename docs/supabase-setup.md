# Phase 2: Supabase Project Setup + Data Migration

## Step 1: Create the Supabase project

1. Go to https://supabase.com and sign in
2. Click **New Project**
3. Settings:
   - **Name:** `roster` (or whatever you prefer)
   - **Database Password:** generate a strong one, save it somewhere safe
   - **Region:** pick the one closest to your users
   - **Pricing Plan:** Free tier is fine for dev
4. Wait ~2 minutes for provisioning to complete

## Step 2: Get your project credentials

Go to **Project Settings → API** and copy:

| Credential | Example | Where it goes |
|---|---|---|
| Project URL | `https://abcdefgh.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| anon public key | `eyJhbGc...` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role secret key | `eyJhbGc...` | `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose) |

Also go to **Project Settings → Database → Connection string → URI** and copy the Postgres connection string. It looks like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres
```
Replace `[YOUR-PASSWORD]` with your database password. This goes in `DATABASE_URL`.

## Step 3: Update your `.env`

```bash
# Database (Supabase Postgres)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   # server-only, never expose to client

# Auth (kept for Phase 2 — will be removed in Phase 3)
AUTH_SECRET=[your existing 32-char hex secret]

# Email (kept as-is)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=Roster <noreply@roster.local>
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Cron secret (for /api/cron/* endpoints)
CRON_SECRET=[generate with: openssl rand -hex 32]

# AI
GEMINI_API_KEY=
```

## Step 4: Push the schema to Supabase

```bash
cd /home/z/my-project/roster
npx prisma db push --accept-data-loss
```

This creates all 61 tables in your Supabase Postgres database.

## Step 5: Migrate data from SQLite to Postgres (if you have existing data)

### Option A: Using pgloader (recommended — handles type conversion automatically)

```bash
# Install pgloader
# macOS: brew install pgloader
# Ubuntu: apt install pgloader

pgloader \
  --no-ssl-cert-verification \
  /home/z/my-project/roster/db/custom.db \
  postgresql://postgres:[YOUR-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres
```

### Option B: Fresh seed (if you don't need existing data)

```bash
npx tsx scripts/seed.ts
npx tsx scripts/seed-phase2.ts
npx tsx scripts/seed-phase3.ts
```

## Step 6: Verify the migration

```bash
npx prisma generate
bun run dev
# Visit http://localhost:3000
```

## Step 7: Apply RLS policies (Phase 4)

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.abcdefgh.supabase.co:5432/postgres" \
  -f supabase/rls-policies.sql
```

---

## Troubleshooting

### "Can't reach database server"
- Check your `DATABASE_URL` password is URL-encoded
- Check Supabase project is not paused (free tier pauses after inactivity)

### "relation does not exist"
- Run `npx prisma db push` again

### Prisma client out of sync
- Run `npx prisma generate` after any schema change
