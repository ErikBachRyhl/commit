# Config File Name Fix ✅

## Problem

The app was still looking for `anki-tex.yml` instead of `commit.yml` in your notes repository.

## Solution

Updated `commit/config.py` to look for `commit.yml` first, with fallback to legacy names:

```python
candidates = [
    repo_path / "commit.yml",      # New name (first priority)
    repo_path / "commit.yaml",
    repo_path / ".commit.yml",
    # Legacy support
    repo_path / "anki-tex.yml",      # Still works for backward compatibility
    repo_path / "anki-tex.yaml",
    repo_path / ".anki-tex.yml",
]
```

---

## Testing

### 1. **Test with Existing commit.yml**

You already have `commit.yml` in your notes repo, so just test:

```bash
cd /Users/erik/Documents/Studie/learning

# Should now find commit.yml
commit process --repo . --limit 1 --dry-run
```

**Expected output:**
```
Loading configuration...
  Loaded config from commit.yml  ← Should say commit.yml now!
```

### 2. **Test Version**

```bash
commit --version
# Should show: Commit version 0.1.0
```

### 3. **Full Test**

```bash
commit process --repo /Users/erik/Documents/Studie/learning --enable-llm --limit 2 --dry-run
```

---

## Commits Made

```
99958bc Fix config.py to look for commit.yml (with anki-tex.yml legacy support)
19c46eb Update config file name from anki-tex.yml to commit.yml (with legacy support)
1649197 Fix CLI version flag and update .gitignore
a938455 Add comprehensive rename completion guide
0e8ac84 Add GitHub Actions CI workflow
b07c8c5 Add RENAME.md guide and update README branding
198a946 Initial commit: Commit
```

**7 commits ready to push!**

---

## Legacy Support

**Good news:** If anyone still has `anki-tex.yml`, it will still work!

The app tries files in this order:
1. `commit.yml` ← New preferred name
2. `commit.yaml`
3. `.commit.yml`
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
pip uninstall commit
pip install -e .
```

Or just reload the shell:
```bash
deactivate
source venv/bin/activate
```

---

**Config file issue is now fixed! Test with the commands above.** ✅

