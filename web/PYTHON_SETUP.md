# Python CLI Setup for Web UI

## The Problem

When you see this error:
```
ModuleNotFoundError: No module named 'typer'
```

It means the Python environment doesn't have the Commit CLI dependencies installed.

## Quick Fix

### Option 1: Install in Current Environment (Quickest)

```bash
# Navigate to project root
cd /Users/erik/Projects/apps/AnkiChat

# Install the Commit package in development mode
pip3 install -e .
```

This installs all dependencies listed in `pyproject.toml` or `setup.py`.

### Option 2: Use a Virtual Environment (Recommended)

```bash
# Navigate to project root
cd /Users/erik/Projects/apps/AnkiChat

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install the package
pip install -e .

# Note the path to this Python
which python
# Example: /Users/erik/Projects/apps/AnkiChat/venv/bin/python
```

Then add to your `/web/.env`:
```bash
PYTHON_PATH=/Users/erik/Projects/apps/AnkiChat/venv/bin/python
```

### Option 3: Install Dependencies Manually

```bash
pip3 install typer rich gitpython anthropic openai python-dotenv pyyaml
```

## Verify Installation

Test that the CLI works:

```bash
cd /Users/erik/Projects/apps/AnkiChat
python3 -m commit.cli --help
```

You should see the Commit CLI help menu without errors.

## Update Web UI Config

If you're using a virtual environment, update `/web/.env`:

```bash
# Use the Python from your venv
PYTHON_PATH=/Users/erik/Projects/apps/AnkiChat/venv/bin/python

# Your repo path
LOCAL_REPO_PATH=/Users/erik/Documents/Studie/learning

# Database
DATABASE_URL=postgresql://...

# GitHub OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# NextAuth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

## Restart Dev Server

After installing dependencies:

```bash
cd /Users/erik/Projects/apps/AnkiChat/web
npm run dev
```

Now try "Process Now" again!

## Troubleshooting

### "Command not found: python3"
Use `python` instead:
```bash
python -m commit.cli --help
```

### "Permission denied" errors
Add `--user` flag:
```bash
pip3 install --user -e .
```

### Still getting module errors
Check which Python is being used:
```bash
which python3
python3 -m pip list | grep typer
```

If `typer` isn't listed, reinstall:
```bash
python3 -m pip install typer
```

## What the Web UI Needs

The web UI spawns the Python CLI using:
- `process.env.PYTHON_PATH` (if set) OR
- `python3` (default)

The Python must have these packages installed:
- `typer` - CLI framework
- `rich` - Terminal formatting
- `gitpython` - Git operations
- `anthropic` / `openai` - LLM providers
- `pyyaml` - YAML parsing
- Plus your Commit package itself

## Summary

**Quickest Fix**:
```bash
cd /Users/erik/Projects/apps/AnkiChat
pip3 install -e .
```

**Then restart** your web dev server and try again! 🚀

