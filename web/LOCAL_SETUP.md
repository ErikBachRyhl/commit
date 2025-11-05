# Local Development Setup

## Quick Fix for "LOCAL_REPO_PATH Required" Error

If you see an error about `LOCAL_REPO_PATH` when trying to process commits, follow these steps:

### 1. Add LOCAL_REPO_PATH to your .env file

Open your `.env` file in the `/web` directory and add:

```bash
LOCAL_REPO_PATH=/Users/erik/Documents/Studie/learning
```

Replace the path with the absolute path to your local Git repository containing your LaTeX files.

### 2. Restart the development server

```bash
npm run dev
```

### 3. How it works

When you click "Process Now":

1. The web UI reads your configuration from the database
2. It writes this config to a **safe temporary directory** (not your repo!)
3. The Python CLI processes your LaTeX files using this temp config
4. After processing, the temp directory is cleaned up

**Your repository files are never modified.** The config lives in the database and is only written to temp storage during processing.

## Why is this needed?

For MVP, the web UI needs to know where your learning repository is located on your local machine. This is **only for reading your LaTeX files** - we never modify your repo.

In future versions, the web UI will:

- Automatically clone repositories from GitHub
- Process commits in isolated cloud environments
- Support deployment without local file access

But for now, this approach lets you get started quickly while keeping your files safe.

## Troubleshooting

### "Git error: Invalid commit SHA"

This error means the Python CLI found a state file (`.commit_state.json`) with a commit SHA that no longer exists in your repository. 

**Fix:** Delete the state file and try again:

```bash
cd /Users/erik/Documents/Studie/learning
rm .commit_state.json
```

### "No configuration found"

This means you haven't imported your `commit.yml` yet. Go to Settings and click "Import commit.yml".

### "Repository link not found"

Make sure you've linked your GitHub repository on the dashboard before trying to process commits.

