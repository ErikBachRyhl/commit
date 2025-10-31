# Config File Name Fix ✅

## Problem

The app was still looking for `anki-tex.yml` instead of `renforce.yml` in your notes repository.

## Solution

Updated `renforce/config.py` to look for `renforce.yml` first, with fallback to legacy names:

```python
candidates = [
    repo_path / "renforce.yml",      # New name (first priority)
    repo_path / "renforce.yaml",
    repo_path / ".renforce.yml",
    # Legacy support
    repo_path / "anki-tex.yml",      # Still works for backward compatibility
    repo_path / "anki-tex.yaml",
    repo_path / ".anki-tex.yml",
]
```

---

## Testing

### 1. **Test with Existing renforce.yml**

You already have `renforce.yml` in your notes repo, so just test:

```bash
cd /Users/erik/Documents/Studie/learning

# Should now find renforce.yml
renforce process --repo . --limit 1 --dry-run
```

**Expected output:**
```
Loading configuration...
  Loaded config from renforce.yml  ← Should say renforce.yml now!
```

### 2. **Test Version**

```bash
renforce --version
# Should show: Renforce version 0.1.0
```

### 3. **Full Test**

```bash
renforce process --repo /Users/erik/Documents/Studie/learning --enable-llm --limit 2 --dry-run
```

---

## Commits Made

```
99958bc Fix config.py to look for renforce.yml (with anki-tex.yml legacy support)
19c46eb Update config file name from anki-tex.yml to renforce.yml (with legacy support)
1649197 Fix CLI version flag and update .gitignore
a938455 Add comprehensive rename completion guide
0e8ac84 Add GitHub Actions CI workflow
b07c8c5 Add RENAME.md guide and update README branding
198a946 Initial commit: Renforce
```

**7 commits ready to push!**

---

## Legacy Support

**Good news:** If anyone still has `anki-tex.yml`, it will still work!

The app tries files in this order:
1. `renforce.yml` ← New preferred name
2. `renforce.yaml`
3. `.renforce.yml`
4. `anki-tex.yml` ← Legacy (still works)
5. `anki-tex.yaml`
6. `.anki-tex.yml`

---

## Next Steps

1. ✅ **Test it works** (commands above)
2. 🚀 **Push to GitHub:**
   ```bash
   cd /Users/erik/Projects/apps/AnkiChat
   git push -u origin main
   ```

---

## If You Need to Reinstall

The package is already working, but if you need to reinstall:

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate
pip uninstall renforce
pip install -e .
```

Or just reload the shell:
```bash
deactivate
source venv/bin/activate
```

---

**Config file issue is now fixed! Test with the commands above.** ✅

