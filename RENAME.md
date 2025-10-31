# 🎉 Welcome to Renforce!

## Why "Renforce"?

**Renforce** = **Reinforce** + **Enforce** + French wordplay (renforcer = to strengthen)

This name perfectly captures what this tool does:
- **Reinforce** learning through intelligent flashcards
- **Enforce** consistent study habits with automated note extraction
- **Renforcer** (French) = to strengthen, fortify, reinforce

---

## What Changed?

### Package Name
- **Old:** `anki-tex` / `anki_tex` / `AnkiTex`
- **New:** `renforce` / `Renforce`

### Command Line
```bash
# OLD
python -m anki_tex.cli process --repo /path/to/notes

# NEW
python -m renforce.cli process --repo /path/to/notes

# Or with installed command:
renforce process --repo /path/to/notes
```

### Config File
- **Old:** `anki-tex.yml`
- **New:** `renforce.yml`

### State File Location
- **Still:** `~/.anki_tex_state.json`
- **Reason:** Backward compatibility - your existing state will keep working!

### Python Package
```python
# OLD
from anki_tex.config import AppConfig
from anki_tex.processor import process_repository

# NEW
from renforce.config import AppConfig
from renforce.processor import process_repository
```

### Documentation
All documentation files have been updated:
- References to "AnkiTex" → "Renforce"
- Command examples updated
- Package imports updated

---

## Migration Guide

### If You're Already Using AnkiTex

#### 1. Update Your Virtual Environment

```bash
cd /path/to/renforce  # (formerly AnkiChat)
source venv/bin/activate
pip uninstall anki-tex  # Remove old
pip install -e .  # Install new
```

#### 2. Update Your Config Files

Rename your config file:
```bash
# In your notes repository
cd /path/to/your/notes
mv anki-tex.yml renforce.yml
```

The content stays the same! Just the filename changed.

#### 3. Update Any Custom Scripts

If you have scripts that call the tool:

```bash
# OLD
python -m anki_tex.cli process --repo .

# NEW
python -m renforce.cli process --repo .

# Or simply:
renforce process --repo .
```

#### 4. Your State File is Safe!

The state file at `~/.anki_tex_state.json` will continue to work.

All your:
- Tracked notes
- GUIDs
- Review history
- LLM generations

...are preserved!

---

## Git Repository

The project is now version controlled:

**Repository:** https://github.com/ErikBachRyhl/renforce

```bash
# Check your git status
git status

# View commit history
git log

# Push to GitHub (when ready)
git push -u origin main
```

---

## Features Unchanged

Everything still works the same:
- ✅ LaTeX environment extraction
- ✅ Git-based change detection
- ✅ GUID-based note tracking
- ✅ LLM integration (OpenAI/Anthropic/Gemini)
- ✅ AnkiConnect sync
- ✅ Content-based duplicate detection
- ✅ GUID persistence in LaTeX
- ✅ State reconciliation
- ✅ Orphan detection

---

## Quick Test

After migrating, test that everything works:

```bash
cd /path/to/renforce
source venv/bin/activate

# Check version
python -m renforce.cli --version

# Test with limit
python -m renforce.cli process \
  --repo /path/to/your/notes \
  --limit 1 \
  --dry-run

# Check state
python -m renforce.cli stats
```

---

## Documentation

All guides have been updated:
- `README.md` - Project overview
- `QUICKSTART.md` - 5-minute quick start
- `COMPLETE_OVERVIEW.md` - Comprehensive guide
- `DOCUMENTATION_INDEX.md` - Full index

Just replace `anki-tex` with `renforce` in your mental model!

---

## Questions?

The rename is purely cosmetic:
- Same functionality
- Same architecture
- Same configuration format
- Better name! 😎

**Old state files, configs, and data all remain compatible.**

---

## Summary

| Aspect | Old | New |
|--------|-----|-----|
| Name | AnkiTex | Renforce |
| Package | `anki_tex` | `renforce` |
| Command | `anki-tex` | `renforce` |
| Config | `anki-tex.yml` | `renforce.yml` |
| State | `~/.anki_tex_state.json` | (unchanged) |
| GitHub | - | github.com/ErikBachRyhl/renforce |

**Welcome to Renforce - a tool to renforce your learning! 🚀**

