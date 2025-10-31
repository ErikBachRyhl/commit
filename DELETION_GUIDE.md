# Handling Deleted/Changed LaTeX Content

## The Problem

When you delete or significantly modify LaTeX environments in your notes, the corresponding Anki cards don't automatically get deleted. This is **intentional for safety** - we don't want to accidentally delete cards with valuable scheduling history.

## Why Manual Deletion?

**Automatic deletion is risky because:**
1. File renames would delete all cards from that file
2. Temporary git branch switches could trigger mass deletions
3. Accidentally deleting important cards with months of scheduling data is painful
4. False positives (thinking content is gone when it's just moved) are hard to detect

**Manual deletion gives you control** to review before removing cards.

## Workflow for Handling Deleted Content

### 1. Check for Orphaned Cards

Run the orphan checker periodically:

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate
python -m anki_tex.cli check-orphans --repo /path/to/your/notes
```

This will show you:
- Cards that exist in Anki but not in current LaTeX files
- Their GUID, deck, and Anki note ID
- Whether they might be false positives

### 2. Review the List

Common reasons for "orphans":
- ✅ **Intentionally deleted** - Content you removed on purpose
- ⚠️ **Commented out** - Now fixed! Commented LaTeX is ignored
- ⚠️ **Moved to different file** - Would show as orphan + new note
- ⚠️ **Modified substantially** - Different content hash = different GUID

### 3. Delete Manually in Anki

**The Easy Way (Recommended):**

The `check-orphans` command now generates a ready-to-paste Anki search query!

1. Run `check-orphans` (see above)
2. The search query is automatically **copied to your clipboard** ✨
3. Open Anki → Click "Browse"
4. Paste (Cmd+V / Ctrl+V) into the search box
5. All orphaned cards appear instantly!
6. Review and delete (select all with Cmd+A, then Delete)

**Example output:**
```
📋 Copy this search query for Anki:
nid:1234567890,9876543210,1111111111

✓ Copied to clipboard!
```

**Manual alternatives** (if clipboard doesn't work):
- **Option A**: Copy the `nid:...` query manually and paste into Anki Browser
- **Option B**: Search one at a time by note ID: `nid:1234567890`
- **Option C**: Search by GUID tag: `tag:guid:abc123456789` (use first 12 chars from table)

### 4. Clean Up State (Optional)

If you've deleted cards from Anki, you may want to clean the state file:

```bash
# Remove orphaned entries from state
python -m anki_tex.cli clear-cache --force

# Then re-sync to rebuild clean state
python -m anki_tex.cli process --repo /path/to/your/notes
```

**Warning**: This will re-create cards for all current content, so only do this if you're confident the Anki collection is correct.

## Example: Your Commented-Out Example

Your case:
```latex
%\begin{example}
%\end{example}
```

**What happened:**
1. First run: Created card (bug - should have been ignored)
2. You deleted the commented lines
3. Second run: Didn't detect it as orphan because it was never valid content

**Now fixed:**
- Commented-out environments are now ignored ✅
- The bad card remains in Anki (one-time cleanup needed)

**To clean up:**
```bash
# Find the orphan
python -m anki_tex.cli check-orphans --repo /Users/erik/Documents/Studie/learning

# In Anki, search for the GUID or note ID shown
# Delete it manually
```

## Future: Semi-Automatic Deletion (Potential Feature)

We could add a `--delete-orphans` flag that:
1. Runs orphan check
2. Shows you the list
3. Asks for confirmation before deleting each/all
4. Calls AnkiConnect to delete the notes

This would be safer than fully automatic but still require manual review.

## Best Practices

1. **Run `check-orphans` periodically** (weekly/monthly) to catch accumulating cruft
2. **Don't stress about a few orphans** - they won't hurt, just add clutter
3. **Be careful with major refactors** - might want to suspend cards during big reorganizations
4. **Use git history** - if unsure if content was deleted or moved, check `git log`
5. **Comment strategy** - If temporarily disabling content, comment it out (now properly ignored!)

## Tags to Help

All AnkiTex cards have these tags:
- `from-tex` - All auto-generated cards
- `course:CourseName` - Which course
- `file:path_to_file` - Which file (sanitized)
- `commit:abc123` - Which commit created it
- `guid:abc123...` - Unique identifier

Use these in Anki Browser to bulk operations:
- Find all cards from a deleted file: `file:old_filename`
- Find all cards from a specific commit: `commit:abc123`

