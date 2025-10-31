# State File Guide

## Location

The state file is stored at:
```
~/.anki_tex_state.json
```

**On macOS/Linux:** `/Users/your-username/.anki_tex_state.json`  
**On Windows:** `C:\Users\your-username\.anki_tex_state.json`

---

## What It Contains

The state file tracks three main things:

1. **Last processed Git commit** - Which commits have been processed
2. **Note tracking** - Mapping of GUIDs to Anki note IDs and metadata
3. **LLM audit log** - Records of all LLM-generated cards (for debugging)

---

## Structure

```json
{
  "last_processed_sha": "abc123def4567890...",
  "note_hashes": {
    "guid-full-40-characters": {
      "anki_note_id": 1234567890,
      "deck": "Differential Topology",
      "content_hash": "hash-of-note-content",
      "created_at": "2025-01-31T12:00:00",
      "updated_at": "2025-01-31T12:00:00"
    },
    ...
  },
  "llm_generations": {
    "guid-full-40-characters": {
      "response": {...},
      "timestamp": "2025-01-31T12:00:00",
      "model": "gpt-4o-mini",
      "provider": "openai"
    },
    ...
  },
  "version": "0.2.0"
}
```

---

## Fields Explained

### `last_processed_sha`
- **Type:** String (40-char Git commit SHA) or `null`
- **Purpose:** Tracks which commit was last processed
- **Example:** `"498fa7dc67cb380ceacba2d0ed05fe8f03b5623c"`
- **Used for:** Determining which files changed since last run

### `note_hashes`
- **Type:** Dictionary (GUID → Note Info)
- **Purpose:** Maps every tracked card to its Anki note ID

**Each entry contains:**
- **`anki_note_id`:** Anki's internal note ID (used for updates)
- **`deck`:** Deck name where the card lives
- **`content_hash`:** SHA1 hash of note content (for change detection)
- **`created_at`:** ISO timestamp when card was first created
- **`updated_at`:** ISO timestamp when card was last updated

**Example:**
```json
"abc123def4567890abcdef1234567890abcdef12": {
  "anki_note_id": 1761874275057,
  "deck": "Differential Topology",
  "content_hash": "f92d398da22f716723b65f81fe20fec581e89548",
  "created_at": "2025-10-30T23:32:24.061218",
  "updated_at": "2025-10-30T23:32:24.061218"
}
```

### `llm_generations`
- **Type:** Dictionary (GUID → LLM Response)
- **Purpose:** Audit log of all LLM-generated cards
- **Used for:** Debugging, tracking costs, quality analysis

**Each entry contains:**
- **`response`:** Raw JSON response from LLM
- **`timestamp`:** When LLM was called
- **`model`:** Model name used (e.g., "gpt-4o-mini")
- **`provider`:** Provider name (e.g., "openai")

### `version`
- **Type:** String
- **Purpose:** State file format version (for migrations)
- **Current:** `"0.2.0"`

---

## How to Inspect It

### Option 1: View with `cat`

```bash
cat ~/.anki_tex_state.json
```

**Pretty-print with Python:**
```bash
python -m json.tool ~/.anki_tex_state.json | less
```

### Option 2: Use `stats` Command

```bash
python -m anki_tex.cli stats
```

**Output:**
```
AnkiTex State Statistics

  Total notes tracked: 26
  Last processed SHA: 498fa7dc
  Decks: Differential Topology
```

### Option 3: Query with Python

```python
import json
from pathlib import Path

state_file = Path.home() / ".anki_tex_state.json"
with open(state_file) as f:
    state = json.load(f)

print(f"Last SHA: {state['last_processed_sha']}")
print(f"Total notes: {len(state['note_hashes'])}")

# Find notes in a specific deck
deck = "Differential Topology"
deck_notes = [g for g, info in state['note_hashes'].items() 
               if info.get('deck') == deck]
print(f"Notes in '{deck}': {len(deck_notes)}")
```

### Option 4: Search with `jq` (if installed)

```bash
# Count total notes
jq '.note_hashes | length' ~/.anki_tex_state.json

# List all GUIDs
jq -r '.note_hashes | keys[]' ~/.anki_tex_state.json

# Find notes by deck
jq -r '.note_hashes | to_entries | 
  map(select(.value.deck == "Differential Topology")) | 
  .[].key' ~/.anki_tex_state.json

# Get all Anki note IDs
jq -r '.note_hashes[].anki_note_id' ~/.anki_tex_state.json
```

---

## Your Current State File

Based on your state file, here's what it contains:

**Summary:**
- **26 notes tracked** (all with pseudo-GUIDs like `anki-1761874275057`)
- **Last processed:** Commit `498fa7dc...`
- **All notes in deck:** "Differential Topology"
- **Note:** These are pseudo-GUIDs from `sync-state` (they start with `anki-`)

**What this means:**
- Your state file was rebuilt from Anki using `sync-state`
- GUIDs are pseudo-GUIDs (not from LaTeX source)
- Real GUIDs would be full SHA1 hashes (40 chars)
- If you process notes now, real GUIDs will replace these

---

## Understanding GUIDs

### Pseudo-GUIDs (from `sync-state`)

**Format:** `anki-{note_id}`  
**Example:** `anki-1761874275057`

**When you see these:**
- State was rebuilt from Anki
- Can't match back to LaTeX source perfectly
- Will be replaced when you process notes with real GUIDs

### Real GUIDs (from LaTeX processing)

**Format:** 40-character SHA1 hash  
**Example:** `abc123def4567890abcdef1234567890abcdef12`

**When you see these:**
- Normal processing with GUID extraction
- Can match back to LaTeX source via GUID comments
- Permanent tracking

### Short GUIDs (in LaTeX files)

**Format:** 12-character prefix  
**Example:** `abc123def456` (in LaTeX comment)

**Stored in:** LaTeX source files as comments  
**Used for:** Matching to full GUIDs in state

---

## Common Queries

### Find all notes in a deck

```bash
jq '.note_hashes | to_entries | 
  map(select(.value.deck == "Differential Topology")) | 
  length' ~/.anki_tex_state.json
```

### Get all Anki note IDs

```bash
jq -r '.note_hashes[].anki_note_id' ~/.anki_tex_state.json | sort -n
```

### Find recently updated notes

```bash
jq -r '.note_hashes | to_entries | 
  sort_by(.value.updated_at) | 
  reverse | 
  .[0:5] | 
  .[] | "\(.key[:12])... \(.value.deck) \(.value.updated_at)"' \
  ~/.anki_tex_state.json
```

### Check for duplicate Anki IDs

```bash
jq -r '.note_hashes[].anki_note_id' ~/.anki_tex_state.json | \
  sort | uniq -d
# (Should output nothing if no duplicates)
```

### Count notes by deck

```bash
jq -r '.note_hashes[].deck' ~/.anki_tex_state.json | \
  sort | uniq -c | sort -rn
```

---

## State File Size

**Typical sizes:**
- **100 notes:** ~15-20 KB
- **1,000 notes:** ~150-200 KB
- **10,000 notes:** ~1.5-2 MB

**Your file:** ~26 notes = ~4-5 KB

---

## When State File Updates

### During `process`:
- ✅ Records new note GUIDs → Anki ID mappings
- ✅ Updates `content_hash` when content changes
- ✅ Updates `last_processed_sha` to current commit
- ✅ Records LLM generations (if LLM used)

### During `reconcile-state`:
- ✅ Removes notes missing from Anki (if you choose)
- ✅ Adds orphaned notes from Anki (if you choose)
- ❌ Doesn't change `last_processed_sha`

### During `sync-state`:
- ✅ Rebuilds entire state from Anki
- ✅ Sets `last_processed_sha` to current commit
- ✅ Creates pseudo-GUIDs for all Anki notes

---

## Safety

### Backup State File

```bash
# Before major changes
cp ~/.anki_tex_state.json ~/.anki_tex_state.json.backup
```

### Restore from Backup

```bash
# If something goes wrong
cp ~/.anki_tex_state.json.backup ~/.anki_tex_state.json
```

### Manual Editing (Advanced)

**⚠️ Warning:** Only edit if you know what you're doing!

```bash
# Edit with your preferred editor
vim ~/.anki_tex_state.json
# or
nano ~/.anki_tex_state.json
# or
code ~/.anki_tex_state.json  # VS Code
```

**Common edits:**
- Remove specific GUIDs (if note deleted)
- Fix deck names
- Clear `last_processed_sha` (to reprocess everything)

**Validation:**
After editing, verify JSON is valid:
```bash
python -m json.tool ~/.anki_tex_state.json > /dev/null && echo "Valid JSON"
```

---

## Troubleshooting

### State file corrupted

**Symptom:** `stats` command fails or shows errors

**Fix:**
```bash
# Backup corrupted file
cp ~/.anki_tex_state.json ~/.anki_tex_state.json.corrupted

# Rebuild from Anki
python -m anki_tex.cli sync-state --repo /path/to/notes
```

### State file too large

**Symptom:** File grows very large (rare)

**Fix:**
- LLM generations can grow large
- Clear LLM history: (need to add command, or manually edit)
  ```python
  from anki_tex.state import StateManager
  state = StateManager()
  state.clear_llm_history()
  state.save()
  ```

### Wrong commit SHA

**Symptom:** `last_processed_sha` points to wrong commit

**Fix:**
```bash
# Reset to specific commit
python -m anki_tex.cli set-since <correct-sha>

# Or clear and reprocess
python -m anki_tex.cli clear-cache --force
python -m anki_tex.cli process --repo /path/to/notes --since <first-commit>
```

---

## Example: Real State File

Here's what a typical state file looks like (with real GUIDs from LaTeX):

```json
{
  "last_processed_sha": "498fa7dc67cb380ceacba2d0ed05fe8f03b5623c",
  "note_hashes": {
    "abc123def4567890abcdef1234567890abcdef12": {
      "anki_note_id": 1761874275057,
      "deck": "Differential Topology",
      "content_hash": "f92d398da22f716723b65f81fe20fec581e89548",
      "created_at": "2025-10-30T23:32:24.061218",
      "updated_at": "2025-10-30T23:32:24.061218"
    },
    "def789abc1234567890def789abc1234567890de": {
      "anki_note_id": 1761874275073,
      "deck": "Differential Topology",
      "content_hash": "1aebaf533b7fd44f0ea2acf9bd128f2e7d38d798",
      "created_at": "2025-10-30T23:32:24.061252",
      "updated_at": "2025-11-15T10:45:12.345678"
    }
  },
  "llm_generations": {
    "abc123def4567890abcdef1234567890abcdef12": {
      "response": {
        "cards": [
          {
            "model": "Basic",
            "front": "What is a 1-form?",
            "back": "A 1-form is...",
            "tags": ["auto", "from-tex", "kind:definition"]
          }
        ]
      },
      "timestamp": "2025-10-30T23:32:24.061250",
      "model": "gpt-4o-mini",
      "provider": "openai"
    }
  },
  "version": "0.2.0"
}
```

---

## Summary

**State file location:** `~/.anki_tex_state.json`

**Contains:**
- ✅ Last processed Git commit SHA
- ✅ GUID → Anki note ID mapping
- ✅ Content hashes (for change detection)
- ✅ LLM audit log
- ✅ Timestamps (created/updated)

**How to view:**
- `cat ~/.anki_tex_state.json` (raw)
- `python -m json.tool ~/.anki_tex_state.json` (pretty)
- `python -m anki_tex.cli stats` (summary)
- `jq` commands (advanced queries)

**Your current state:**
- 26 notes tracked (pseudo-GUIDs from sync-state)
- All in "Differential Topology" deck
- Last processed: `498fa7dc...`

**After you process with real LaTeX:** GUIDs will be replaced with real 40-char hashes matching GUIDs in your source files!

---

**Questions?** Check `STATE_RECONCILIATION.md` for syncing state with Anki!

