# Commit Web UI

A Next.js web interface for the Commit CLI tool that converts LaTeX notes to Anki flashcards with AI.

## Features

- **GitHub OAuth**: Sign in with your GitHub account
- **Repository Linking**: Connect your LaTeX notes repository
- **Configuration Import**: Automatically import `commit.yml` settings
- **Live Processing**: Watch CLI output in real-time via SSE
- **Card Review**: Tinder-style carousel to accept/discard generated flashcards
- **APKG Export**: Download flashcards as `.apkg` files for Anki import

## Tech Stack

- **Framework**: Next.js 14+ (App Router), TypeScript
- **Styling**: TailwindCSS + shadcn/ui
- **Database**: Prisma + PostgreSQL
- **Auth**: NextAuth.js with GitHub provider
- **Validation**: Zod
- **Animation**: Framer Motion
- **Process Management**: Node.js child_process + SSE

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon, Vercel Postgres, or local)
- GitHub OAuth app credentials
- Python 3.11+ with Commit CLI installed (in parent directory)

### Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env.local` and fill in the values:

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

3. **Create GitHub OAuth App:**

Go to https://github.com/settings/developers and create a new OAuth app:
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`
- Scopes needed: `read:user`, `user:email`, `repo`

4. **Set up database:**

```bash
npx prisma generate
npx prisma db push
```

5. **Run the development server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/web/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth routes
│   │   ├── github/        # GitHub integration
│   │   ├── process/       # CLI process management
│   │   ├── runs/          # Run status & details
│   │   ├── cards/         # Card actions
│   │   └── settings/      # Config management
│   ├── auth/              # Auth pages
│   ├── runs/              # Run detail pages
│   ├── settings/          # Settings page
│   └── page.tsx           # Dashboard
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   ├── dashboard-content.tsx
│   ├── card-carousel.tsx
│   ├── live-console.tsx
│   └── repo-picker.tsx
├── lib/                   # Utilities
│   ├── auth.ts            # NextAuth config
│   ├── prisma.ts          # Prisma client
│   ├── github.ts          # GitHub API wrapper
│   ├── yaml.ts            # YAML parsing
│   ├── cli.ts             # Python CLI spawner
│   ├── sse.ts             # SSE utilities
│   └── process-manager.ts # Process tracking
└── prisma/
    └── schema.prisma      # Database schema
```

## How It Works

1. **Authentication**: User signs in with GitHub OAuth
2. **Repo Linking**: User selects a repository containing `commit.yml`
3. **Config Import**: App fetches and parses `commit.yml` from GitHub
4. **Processing**: User clicks "Process" → spawns Python CLI as child process
5. **Streaming**: CLI output is streamed to UI via Server-Sent Events
6. **Card Review**: Generated cards are displayed in a carousel for review
7. **Export**: Accepted cards are built into `.apkg` file via CLI

## Architecture

The Python CLI remains the **single source of truth** for all processing logic. The web app:
- Orchestrates CLI execution
- Provides a UI for configuration and card review
- Manages user authentication and persistence
- Streams CLI output to the browser

This ensures the web UI and CLI stay perfectly in sync.

## Development

### Database Management

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database
npx prisma db push

# Open Prisma Studio
npx prisma studio
```

### Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

**Note**: For production, you'll need to set up a separate Python worker service (Modal, Fly.io, Railway) to run the CLI, as Vercel serverless functions have execution time limits.

### Environment Variables for Production

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Random secret for NextAuth
- `NEXTAUTH_URL`: Your production URL
- `GITHUB_CLIENT_ID`: GitHub OAuth app ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app secret
- `PYTHON_PATH`: Path to Python executable (for CLI spawning)
- `CLI_MODULE_PATH`: Path to Commit CLI module

## Limitations & Future Work

### MVP Limitations

- Process execution limited by serverless function timeouts
- No webhook support for auto-processing on push
- Recreate feature logs request but doesn't regenerate
- No write-back to repo via PR (read-only config import)

### Planned Features

- GitHub webhook integration for auto-processing
- Dedicated Python worker service for long-running jobs
- Config editing with PR creation
- Commit picker (process any past commit)
- Advanced maintenance screens (reconcile, clear cache, etc.)
- Local helper app for AnkiConnect sync

## License

MIT

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests if applicable
4. Submit a pull request
