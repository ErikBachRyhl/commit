# Quick Start Guide

## Installation

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Install AnkiConnect** (for online mode):
   - Open Anki
   - Go to Tools → Add-ons → Get Add-ons
   - Enter code: `2055492159`
   - Restart Anki

## First Run

1. **Create a test repository** (or use existing LaTeX notes):
   ```bash
   # Copy example files to your notes directory
   cp example/commit.yml /path/to/your/notes/
   cp example/samples.tex /path/to/your/notes/test.tex
   ```

2. **Initialize git** (if not already a repo):
   ```bash
   cd /path/to/your/notes
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **Test with dry-run**:
   ```bash
   cd /Users/erik/Projects/apps/AnkiChat
   python -m commit.cli process --repo /path/to/your/notes --dry-run
   ```

4. **Sync to Anki** (make sure Anki is running):
   ```bash
   python -m commit.cli process --repo /path/to/your/notes
   ```

## Example Workflow

### Scenario: Taking lecture notes

1. **Create/edit LaTeX notes**:
   ```latex
   \begin{definition}[Vector Space]
   A vector space over field $F$ is a set $V$ with operations...
   \end{definition}
   
   \begin{theorem}[Dimension Theorem]
   For any finite-dimensional vector space...
   \end{theorem}
   ```

2. **Commit changes**:
   ```bash
   git add notes.tex
   git commit -m "Add vector space definitions"
   ```

3. **Sync to Anki**:
   ```bash
   python -m commit.cli process --repo .
   ```

4. **Review in Anki**:
   - Open Anki
   - Select your deck (e.g., "M214")
   - Study the automatically created cards!

## Tips

- **Use `--dry-run`** first to preview what will be created
- **Check tags** in Anki to find notes by commit, file, or environment type
- **Update notes** by editing the LaTeX and committing - Commit will update existing cards
- **Offline mode** with `--offline` if you want to manually import the .apkg file

## Troubleshooting

### "Config file not found"
Make sure `commit.yml` exists in your repository root.

### "Cannot connect to AnkiConnect"
- Verify Anki is running
- Check AnkiConnect is installed
- Try `--offline` mode instead

### "No .tex files changed"
- Make sure you've committed your changes
- Check that file paths match patterns in `commit.yml`

## Next Steps

- Customize `commit.yml` for your courses
- Add custom LaTeX environments to `envs_to_extract`
- Run `python -m commit.cli stats` to see tracked notes
- Check `~/.commit_state.json` to see what's been processed

