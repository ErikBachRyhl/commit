# GUID Persistence System 🔒

## 🎯 The Problem We Solved

**Before:** GUIDs were based on content hash. When you edited a definition (e.g., changed 3 words), the GUID changed, and the system treated it as a **new card**, losing all review history.

**After:** GUIDs are stored **directly in your LaTeX source** as comments. This means:
- ✅ **Edit content** → Same GUID → **Update in place** → Preserves review history
- ✅ **Move blocks around** → GUID moves with it → Still tracked correctly
- ✅ **No data loss** → Your Anki cards are permanently linked to source locations

---

## 🔧 How It Works

### 1. GUID Format

GUIDs are stored as **12-character** shortened hashes in LaTeX comments for readability:

```latex
% anki-tex-guid: abc123def456
\begin{definition}[Metric Space]
A metric space is a set $M$ with a distance function...
\end{definition}
```

**Why 12 characters?**
- **Collision probability for 10,000 cards:** ~1 in 281 trillion (safe!)
- **Much more readable** than 40-character GUIDs
- **Still unique enough** for typical user scale (thousands of cards over years)

**Alternative formats supported:**
```latex
% GUID: abc123def456
% anki-tex-guid: abc123def456
```

**Full GUIDs (40 chars) are stored internally** in state files and Anki metadata. The short version in LaTeX is just for readability and matching.

### 2. GUID Extraction

When processing LaTeX files, the system:
1. Looks for GUID comments within **20 lines before** each environment
2. Searches backwards from `\begin{...}` to find the nearest GUID
3. **Matches short GUID (12 chars) to full GUID (40 chars)** in state file
4. Uses that full GUID for tracking if unique match found
5. Generates a new GUID if not found or collision detected (then injects short version)

### 3. GUID Injection

When creating a **new card** (not in dry-run mode):
1. System successfully adds card to Anki
2. Checks if GUID comment exists in context window
3. If not found, **injects shortened GUID comment** (12 chars) right before `\begin{...}`
4. Writes back to source file

**Example:**
```latex
% Before:
\begin{definition}
...

% After first processing:
% anki-tex-guid: abc123def456
\begin{definition}
...
```

**The system stores:**
- **In LaTeX:** Short 12-character GUID (readable, unobtrusive)
- **In state file:** Full 40-character GUID (complete tracking)
- **In Anki:** Full GUID in note metadata (permanent record)

### 4. Update Behavior

When you **edit content**:
1. System extracts the **same GUID** from comment
2. Detects **content hash changed** (new hash ≠ old hash)
3. **Updates the existing card** in Anki (same note ID)
4. Adds `rev:YYYYMMDD` tag
5. **Preserves all review history** ✅

---

## 📝 User Workflow

### First Time Processing

```bash
# Process your notes
anki-tex process --enable-llm

# System:
# 1. Extracts environments
# 2. Checks for GUIDs (none found)
# 3. Generates new GUIDs
# 4. Creates cards in Anki
# 5. Injects GUIDs into source files ✨
```

**Result:** Your `.tex` files now contain GUID comments!

### Editing Content

```latex
% anki-tex-guid: abc123def4567890abcdef1234567890abcdef12
\begin{definition}[Metric Space]
A metric space is a set $M$ with a distance function $d$ that...
%                        ^ You edit this part
\end{definition}
```

```bash
git add .
git commit -m "Clarify metric space definition"

anki-tex process
```

**System behavior:**
- ✅ Extracts **same GUID** (`abc123...`)
- ✅ Detects content changed (new hash)
- ✅ **Updates existing card** in place
- ✅ Preserves review history
- ✅ Adds `rev:20250131` tag

### Moving Blocks Around

```latex
% anki-tex-guid: abc123def4567890abcdef1234567890abcdef12
\begin{definition}
... (moved from line 50 to line 200)
\end{definition}
```

**System behavior:**
- ✅ GUID moves with the block (it's in the source!)
- ✅ Finds GUID in context window
- ✅ Uses same GUID → same Anki card
- ✅ Everything continues to work!

---

## 🛡️ Safety Guarantees

### 1. No Data Loss

- GUIDs are stored in **your source files** (under version control)
- Even if state file is lost, GUIDs can be recovered from LaTeX
- Anki cards are permanently linked to source

### 2. No Duplicates

- If GUID exists → use it → same card
- If GUID missing → generate → inject → track
- System prevents duplicate cards automatically

### 3. Graceful Degradation

- If GUID injection fails → logs warning → continues processing
- If file can't be written → non-fatal error
- System never crashes due to GUID issues

---

## ⚙️ Technical Details

### GUID Generation

When no GUID exists, we generate one using:
```python
guid = hash(env_name + normalized_content + file_path)
```

This ensures:
- **Deterministic** (same inputs = same GUID)
- **Unique** (different content/location = different GUID)
- **Stable** (until injected, then persisted in source)

### Context Window

- **Search range:** Up to 20 lines before `\begin{...}`
- **Search direction:** Backwards (most recent GUID wins)
- **Why 20 lines?** Covers typical spacing + comments before environments

### Edge Cases Handled

1. **Multiple GUIDs in window:** Uses the **closest** one (searches backwards)
2. **GUID in wrong format:** Pattern matching is flexible (`%GUID:` or `% anki-tex-guid:`)
3. **File read-only:** Logs warning, continues (non-fatal)
4. **Git conflicts:** GUIDs are comments, easy to merge

---

## 🔍 Finding GUIDs in Your Files

### Manual Check

```bash
# Search for all GUIDs
grep -r "anki-tex-guid:" /path/to/your/notes/

# See which blocks have GUIDs
grep -B 2 "anki-tex-guid:" *.tex
```

### In Anki

Each card's GUID is stored in Anki's note metadata. You can:
- Search by tags to find cards
- Use `check-orphans` to see tracked GUIDs
- View state file: `~/.anki_tex_state.json`

---

## 🚨 Troubleshooting

### "GUID not found but card exists"

**Cause:** GUID might have been deleted from source, or context window changed.

**Solution:**
```bash
# Rebuild state from Anki
anki-tex sync-state --repo /path/to/notes

# Or reprocess from beginning
anki-tex process --since <old-commit-sha>
```

### "GUID injection failed"

**Cause:** File might be read-only, or path issue.

**Check:**
- File permissions (`ls -l file.tex`)
- File path is correct
- Disk space available

**Impact:** Card still created in Anki, just no GUID in source. Will generate new GUID on next run (creating duplicate).

**Fix:** Manually add GUID comment, or reprocess.

### "Multiple cards for same block"

**Cause:** GUID wasn't injected, system generated new GUID on next run.

**Solution:**
1. Check source file for GUID comment
2. If missing, manually add it based on state file
3. Or delete old cards and reprocess

---

## 🎯 Best Practices

### 1. Commit GUID Comments

```bash
# After first processing, you'll see:
git status
# Shows: modified: notes.tex (GUIDs added)

# Commit them!
git add notes.tex
git commit -m "Add AnkiTex GUIDs for tracking"
```

### 2. Don't Delete GUID Comments

- GUID comments are **harmless** (they're comments!)
- Deleting them breaks tracking
- Keep them for permanent card linking

### 3. Handle Git Merges Carefully

If two branches add different GUIDs:
- Keep both (if blocks are different)
- Or manually resolve (choose one GUID per block)

---

## 📊 Example: Complete Lifecycle

### Day 1: Create Definition

```latex
\begin{definition}[Group]
A group is a set with a binary operation...
\end{definition}
```

**Process:**
```bash
anki-tex process
```

**After:**
```latex
% anki-tex-guid: def789abc123
\begin{definition}[Group]
A group is a set with a binary operation...
\end{definition}
```

**Anki:** Card created with 0 reviews

---

### Day 30: Edit Definition

```latex
% anki-tex-guid: def789abc123
\begin{definition}[Group]
A group is a set $G$ with a binary operation $\cdot$ satisfying...
%                     ^ Added notation
\end{definition}
```

**Process:**
```bash
git commit -m "Add notation to group definition"
anki-tex process
```

**Result:**
- ✅ **Same GUID** extracted (short version matched to full in state)
- ✅ Content hash changed → **update in place**
- ✅ **20+ reviews preserved** 🎉
- ✅ Tag added: `rev:20250131`

**Anki:** Card updated, 20+ reviews intact

---

### Day 60: Move Definition

You reorganize your notes, move definition to different section:

```latex
% (now at line 500, was at line 50)
% anki-tex-guid: def789abc123
\begin{definition}[Group]
...
\end{definition}
```

**Process:**
```bash
anki-tex process
```

**Result:**
- ✅ GUID found in context window
- ✅ **Same card** (GUID unchanged)
- ✅ **All review history preserved** 🎉

---

## ✨ Summary

The GUID persistence system ensures:

1. **✅ No data loss** - Cards permanently linked to source
2. **✅ Edit-friendly** - Content changes update in place
3. **✅ Move-friendly** - GUIDs travel with blocks
4. **✅ Git-friendly** - GUIDs in source = version controlled
5. **✅ Recoverable** - State can be rebuilt from source

**Your Anki cards are now permanently and safely tracked!** 🔒

