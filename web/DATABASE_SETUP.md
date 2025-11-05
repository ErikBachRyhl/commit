# Database Setup Guide

Quick guide to get your database running for the Commit web UI.

## Option 1: Hosted Database (Easiest - Recommended)

### Neon (Free Tier)

1. Go to https://neon.tech
2. Sign up with GitHub
3. Create a new project
4. Copy the connection string (it looks like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`)
5. Update your `.env.local` file:

```bash
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
```

### Vercel Postgres (If deploying to Vercel)

1. In your Vercel project, go to Storage
2. Create a Postgres database
3. Copy the connection string
4. Add to your environment variables

### Supabase (Alternative)

1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string
5. Update your `.env.local` file

## Option 2: Local PostgreSQL

### Install PostgreSQL (macOS)

```bash
# Install via Homebrew
brew install postgresql@15

# Start the service
brew services start postgresql@15

# Create database
createdb commit_dev
```

### Update `.env.local`

```bash
# Replace with your actual PostgreSQL username
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/commit_dev?schema=public"
```

**Find your PostgreSQL username:**
```bash
# Default is usually your macOS username
whoami

# Or check PostgreSQL config
psql postgres -c "SELECT current_user;"
```

### Common Issues

**If you get "password required":**
```bash
# Option 1: Set password in connection string
DATABASE_URL="postgresql://username:password@localhost:5432/commit_dev?schema=public"

# Option 2: Use trust authentication (development only)
# Edit /opt/homebrew/var/postgresql@15/pg_hba.conf
# Change "md5" to "trust" for local connections
```

**If port 5432 is in use:**
```bash
# Check what's using the port
lsof -i :5432

# Or use a different port
DATABASE_URL="postgresql://username@localhost:5433/commit_dev?schema=public"
```

## After Database Setup

Once your DATABASE_URL is correct:

```bash
cd web

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

## Verify Connection

Test your database connection:

```bash
# Using psql (if installed)
psql $DATABASE_URL

# Or use Prisma Studio
npx prisma studio
# Then open http://localhost:5555
```

## Quick Start Recommendation

For fastest setup, use **Neon**:
1. Sign up at neon.tech (30 seconds)
2. Create project → Copy connection string
3. Paste into `.env.local`
4. Run `npx prisma db push`

Done! 🎉

