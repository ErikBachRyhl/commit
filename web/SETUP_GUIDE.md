# Setup Guide

Quick guide to get the Commit web UI running locally.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or hosted like Neon/Vercel Postgres)
- GitHub account
- Python 3.11+ with Commit CLI installed (in parent directory `../`)

## Step-by-Step Setup

### 1. Database Setup

**Quick Start (Recommended): Use Neon (Free Hosted Database)**
1. Go to https://neon.tech and sign up (30 seconds)
2. Create a new project
3. Copy the connection string
4. Paste it into `.env.local` as `DATABASE_URL`

**Option A: Local PostgreSQL**
```bash
# Install PostgreSQL (macOS)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb commit_dev
```

**Option B: Hosted Database (Neon)**
- Go to https://neon.tech
- Create a new project
- Copy the connection string

**See `DATABASE_SETUP.md` for detailed instructions**

### 2. GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: `Commit (Local Dev)`
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Generate a client secret
6. Copy Client ID and Client Secret

### 3. Environment Variables

Create `.env.local` file in `/web` directory:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/commit_dev?schema=public"

# NextAuth
NEXTAUTH_SECRET="generate-with-command-below"
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth
GITHUB_CLIENT_ID="your_client_id_here"
GITHUB_CLIENT_SECRET="your_client_secret_here"

# Optional: LLM API keys
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# Local Repository Path (REQUIRED for processing)
# Absolute path to your learning repository with LaTeX files
LOCAL_REPO_PATH="/Users/erik/Documents/Studie/learning"

# Python CLI paths (optional, defaults should work)
# PYTHON_PATH="python3"
# CLI_MODULE_PATH="../commit/cli.py"
```

**⚠️ Important:** `LOCAL_REPO_PATH` must point to your actual learning repository (the one you linked via GitHub). This is where the Python CLI will process your LaTeX files.

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 4. Install Dependencies

```bash
cd web
npm install
```

### 5. Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Create database schema
npx prisma db push

# Optional: Open Prisma Studio to view database
npx prisma studio
```

### 6. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## First Time Usage

1. **Sign In**: Click "Sign in with GitHub"
2. **Link Repository**: 
   - Click "Link Repository"
   - Select a repo containing `commit.yml`
   - Click to link it
3. **Import Config**:
   - Click "Import commit.yml"
   - This fetches and parses your configuration
4. **Process Notes**:
   - Click "Process Now" → Opens Commit Selector dialog
   - Choose commit range: "Latest only", "Since commit", or "All"
   - Select starting commit (defaults to 5 commits ago)
   - Click "Start Processing"
   - Watch live console output
   - Review generated cards in carousel
5. **Download Cards**:
   - Accept/discard cards using A/D keys
   - Click "Download .apkg"
   - Import into Anki

See [COMMIT_SELECTOR.md](./COMMIT_SELECTOR.md) for detailed info on the commit selector feature.

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Test connection
psql postgresql://user:password@localhost:5432/commit_dev
```

### Python CLI Not Found

Make sure the Commit Python package is installed:
```bash
cd ..
pip install -e .
python -m commit.cli --help
```

### GitHub OAuth Errors

- Verify callback URL matches exactly: `http://localhost:3000/api/auth/callback/github`
- Check Client ID and Secret are correct in `.env.local`
- Ensure you granted `repo` scope when creating the OAuth app

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database commands
npx prisma generate          # Regenerate Prisma client
npx prisma db push           # Push schema changes
npx prisma studio            # Open database UI
npx prisma migrate dev       # Create migration (for production)

# Add shadcn component
npx shadcn@latest add <component-name>
```

## Next Steps

- **Production Deployment**: See main README.md for Vercel deployment
- **Python Worker**: For production, set up dedicated Python worker (Modal/Fly.io)
- **Webhooks**: Configure GitHub webhooks for auto-processing
- **Testing**: Run `npm test` to execute test suite (when implemented)

## Architecture Notes

- **CLI Integration**: Web app spawns Python CLI as child process
- **SSE Streaming**: Real-time log streaming via Server-Sent Events
- **Database**: PostgreSQL stores users, repos, runs, and card suggestions
- **Auth**: NextAuth with GitHub OAuth and Prisma adapter
- **API**: REST API routes for all operations

## Support

For issues or questions:
1. Check console logs (browser & server)
2. Review `/web/README.md` for detailed documentation
3. Check Prisma Studio for database state
4. Verify Python CLI works standalone: `python -m commit.cli stats`

Happy learning! 🎓

