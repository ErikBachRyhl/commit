# State Reconciliation Guide

## The Problem

Sometimes your **state file** and **Anki** get out of sync:

- **You deleted decks/cards in Anki** → State still tracks them
- **Cards exist in Anki but not in state** → Orphaned cards
- **State file was lost/corrupted** → Need to rebuild

**Example:**
```
State says: 26 notes in "Differential Topology"
Anki says: 0 notes (you deleted the deck)
```

## The Solution: `reconcile-state`

The `reconcile-state` command compares state file with Anki and helps you sync them.

---

## Usage

```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes
```

**What it does:**
1. ✅ Connects to Anki
2. ✅ Loads state file
3. ✅ Compares notes in both
4. ✅ Shows differences
5. ✅ Asks you which is ground truth
6. ✅ Syncs accordingly

---

## Example Scenarios

### Scenario 1: You Deleted Decks in Anki

**Situation:**
- State tracks 26 notes
- Anki has 0 notes (you deleted the deck)

**Output:**
```
State file tracks 26 note(s)
No notes found in Anki with tags 'auto' and 'from-tex'

Differences:
  • State has 26 notes, Anki has 0
  • All 26 notes in state are missing from Anki

Do you want to clear state file to match Anki? [y/N]:
```

**Options:**
- **Yes** → Clear state (use Anki as truth)
- **No** → Keep state (maybe you'll recreate cards later)

---

### Scenario 2: Partial Differences

**Situation:**
- State tracks 50 notes
- Anki has 40 notes (you deleted 10)
- Anki has 5 orphaned notes (not in state)

**Output:**
```
Differences Found:

⚠ 10 note(s) in state but missing from Anki:
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┓
┃ GUID (first 24 chars)     ┃ Deck                 ┃ Anki Note ID  ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━┩
│ abc123def4567890ghijklmn   │ Differential Topology│ 1234567890    │
│ ...                        │ ...                  │ ...           │
└───────────────────────────┴──────────────────────┴───────────────┘

⚠ 5 note(s) in Anki but not in state:
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┓
┃ Anki Note ID               ┃ Deck                 ┃ Front Preview ┃
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━┩
│ 9876543210                 │ Differential Topology│ What is a...  │
│ ...                        │ ...                  │ ...           │
└───────────────────────────┴──────────────────────┴───────────────┘

Reconciliation Options:

1. Use Anki as ground truth
   → Remove missing notes from state
   → Add orphaned notes to state (with pseudo-GUIDs)
   → Result: State matches Anki

2. Keep state as-is
   → State file unchanged
   → Missing notes remain tracked (may be recreated on next process)
   → Orphaned notes remain untracked

3. Manual cleanup
   → Use 'check-orphans' to handle orphaned cards
   → Delete missing cards from state manually

Choose action [2]:
```

---

## Options Explained

### Option 1: Use Anki as Ground Truth

**What happens:**
- ✅ Removes notes from state that don't exist in Anki
- ✅ Adds orphaned Anki notes to state (with pseudo-GUIDs like `anki-123456`)
- ✅ Result: State matches Anki exactly

**When to use:**
- You deleted decks/cards and want to sync state
- Anki is the source of truth
- You want to clean up state file

**Example:**
```bash
# You deleted "Differential Topology" deck in Anki
python -m anki_tex.cli reconcile-state --repo /path/to/notes
# Choose option 1
# State is now synced (26 notes removed from state)
```

---

### Option 2: Keep State As-Is

**What happens:**
- ✅ State file unchanged
- ✅ Missing notes stay tracked (will be recreated if you reprocess)
- ✅ Orphaned notes stay untracked

**When to use:**
- You plan to recreate the cards later
- State file is more trustworthy than current Anki
- You want to investigate differences first

**Example:**
```bash
# You deleted cards but might reprocess them
python -m anki_tex.cli reconcile-state --repo /path/to/notes
# Choose option 2
# State unchanged, you can reprocess from old commit later
```

---

### Option 3: Manual Cleanup

**What happens:**
- ✅ Nothing changes automatically
- ✅ You handle cleanup manually

**When to use:**
- You want full control
- Need to review each difference
- Complex situations requiring careful handling

**Manual steps:**
```bash
# 1. Check orphans
python -m anki_tex.cli check-orphans --repo /path/to/notes

# 2. Delete orphaned cards in Anki (if needed)

# 3. Edit state file manually or use sync-state
python -m anki_tex.cli sync-state --repo /path/to/notes
```

---

## Non-Interactive Mode

Use `--force` flag to skip prompts:

```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes --force
```

**Note:** With `--force`, it only shows differences but doesn't make changes. Use this to inspect what would change.

---

## Comparison with Other Commands

### `reconcile-state` vs `sync-state`

**`sync-state`:**
- One-way: Anki → State
- Rebuilds state from scratch
- Use when state file is lost/corrupted

**`reconcile-state`:**
- Two-way comparison: State ↔ Anki
- Shows differences and lets you choose
- Use when state and Anki are out of sync

### `reconcile-state` vs `check-orphans`

**`check-orphans`:**
- Compares State vs LaTeX source (not Anki)
- Finds cards that should be deleted
- Generates Anki search queries

**`reconcile-state`:**
- Compares State vs Anki
- Finds sync mismatches
- Helps sync both directions

---

## Common Use Cases

### 1. Deleted Deck in Anki

**Situation:** You deleted a deck in Anki but state still tracks it.

```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes
# Shows: "26 notes in state but missing from Anki"
# Choose option 1 → State synced
```

### 2. State File Lost

**Situation:** You lost `~/.anki_tex_state.json`.

```bash
# Option A: Rebuild from Anki
python -m anki_tex.cli sync-state --repo /path/to/notes

# Option B: Rebuild from scratch (process everything)
python -m anki_tex.cli process --repo /path/to/notes --since <first-commit>
```

### 3. Orphaned Cards in Anki

**Situation:** Cards exist in Anki but not in state (manual imports, etc.).

```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes
# Shows: "5 notes in Anki but not in state"
# Choose option 1 → Adds them to state
```

### 4. Verify Sync Status

**Situation:** Want to check if state and Anki are in sync.

```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes --force
# Shows differences (if any) without making changes
```

---

## Best Practices

### 1. Run Before Major Changes

Before deleting decks or clearing cards:
```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes
# Review differences first
```

### 2. Use `--force` for Inspection

To see what would change without committing:
```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes --force
```

### 3. Backup State File

Before reconciliation:
```bash
cp ~/.anki_tex_state.json ~/.anki_tex_state.json.backup
```

### 4. Choose Ground Truth Carefully

- **Anki as truth:** You manually deleted cards, sync state
- **State as truth:** Cards were lost accidentally, keep state for recovery

---

## Troubleshooting

### "Cannot connect to AnkiConnect"

**Solution:**
- Make sure Anki is running
- Verify AnkiConnect is installed
- Try restarting Anki

### "No differences found" but stats show issues

**Check:**
- Are cards tagged with `auto` and `from-tex`?
- Are you checking the right repository?

### State cleared accidentally

**Recovery:**
```bash
# If you have backup
cp ~/.anki_tex_state.json.backup ~/.anki_tex_state.json

# Or rebuild from Anki
python -m anki_tex.cli sync-state --repo /path/to/notes

# Or reprocess everything
python -m anki_tex.cli process --repo /path/to/notes --since <old-commit>
```

---

## Summary

**`reconcile-state`** is your tool for keeping state file and Anki in sync:

✅ Shows differences clearly  
✅ Lets you choose ground truth  
✅ Syncs bidirectionally  
✅ Safe (shows before changing)  

**Use it when:**
- Decks/cards deleted in Anki
- State file seems out of sync
- Need to verify tracking is correct
- Recovering from mistakes

**Your situation:** You deleted the "Differential Topology" deck. Run `reconcile-state` and choose option 1 to sync state! 🎯

