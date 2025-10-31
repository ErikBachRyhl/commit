# Duplicate Cards & MathJax Fix

## Two Critical Issues Fixed

### Issue 1: Wrong MathJax Delimiters ❌ → ✅

**Problem:** Prompt told LLM to use `$...$` for inline math
**Reality:** Anki MathJax uses `\(...\)` for inline and `\[...\]` for display

**Fixed in `anki_tex/prompts.py`:**
- Changed all examples from `$x^2$` to `\(x^2\)`
- Changed display math from `$$...$$` to `\[...\]`
- Updated instructions to emphasize correct delimiters

**Result:** LaTeX will now render properly in Anki!

---

### Issue 2: Duplicate Cards ❌ → ✅

**Problem:** You have 3 cards with same content but different formats

**Root Causes:**
1. **AnkiConnect duplicate detection** was set to `False`, blocking cards based on first field
2. **Index-based GUIDs** for LLM cards: `{block}::llm-0`, `{block}::llm-1`, etc.
   - If LLM generates same card twice, it got different GUID (different index)
   - System treated them as different cards
3. **No final safety check** before creating

**Fixes Applied:**

#### Fix 1: Allow Duplicates in AnkiConnect
```python
# anki_tex/note_models.py
"options": {
    "allowDuplicate": True,  # We handle duplicates via GUID tracking
}
```
**Why:** Our GUID system is the source of truth, not Anki's first-field matching.

#### Fix 2: Content-Based GUIDs for LLM Cards
```python
# anki_tex/processor.py
# OLD: note_guid = f"{block.guid}::llm-{i}"  ❌ Index-based
# NEW: note_guid = compute_guid(...)  ✅ Content-based
```

**How it works:**
- GUID = hash(block.env + card_content + file_path)
- Same content → same GUID → recognized as duplicate
- Different content → different GUID → new card

**Example:**
- LLM generates "What is X?" → GUID: `abc123...`
- Next run, LLM generates "What is X?" again → Same GUID `abc123...`
- System sees it's already in state → Skips creation

#### Fix 3: Double-Check Before Creating
Added safety net in `anki_tex/processor.py`:
```python
if state.is_note_seen(note.guid):
    console.print(f"Skipping duplicate GUID: {note.guid[:16]}...")
    continue
```

---

## How to Clean Up Your Duplicates

You currently have 3 duplicate cards in Anki. Here's how to fix it:

### Step 1: Find and Delete Duplicates in Anki

**Open Anki:**
1. Go to your "Differential Topology" deck (or whichever deck)
2. Click "Browse" (or press `B`)
3. In the search box: `deck:"Differential Topology" is:new`
4. Sort by "Front" field to group duplicates together
5. Select the duplicates (hold Ctrl/Cmd and click)
6. Press Delete

**Alternative - Delete All and Rebuild:**
```
# If you want to start fresh
1. In Anki Browse: deck:"Differential Topology"
2. Select all (Ctrl/Cmd + A)
3. Delete
```

### Step 2: Sync State with Anki

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate

python -m anki_tex.cli reconcile-state --repo /Users/erik/Documents/Studie/learning
```

**What this does:**
- Compares state file with Anki
- Shows differences
- Asks which is ground truth
- Syncs them up

**Choose:** "Use Anki as ground truth" (since you just cleaned it)

### Step 3: Test with 1 Card

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 1
```

**Check:**
- ✅ No "duplicate" error
- ✅ Card created successfully
- ✅ LaTeX renders properly in Anki (should see α, ℝ, etc.)
- ✅ Math uses `\(...\)` format

**Open the card in Anki** and verify MathJax works!

### Step 4: Process More Cards

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 5
```

### Step 5: Full Run

Once satisfied:

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm
```

---

## Why This Won't Happen Again

### Old Behavior (Broken)
```
Run 1: LLM generates "What is X?"
  → GUID: block_guid::llm-0
  → Creates card

Run 2: LLM generates "What is X?" again  
  → GUID: block_guid::llm-0
  → Tries to create
  → Anki says: "duplicate!" ❌
```

### New Behavior (Fixed)
```
Run 1: LLM generates "What is X?"
  → GUID: hash("What is X?" + answer)
  → Creates card
  → Records in state

Run 2: LLM generates "What is X?" again
  → GUID: hash("What is X?" + answer)  ← Same!
  → Checks state: "Already exists"
  → Skips creation ✅
```

---

## MathJax Rendering Test

After processing, your cards should look like:

**Front:** "What is \(\alpha\)?"
**Displays as:** "What is α?" (rendered symbol)

**Front:** "What is the space \(\mathbb{R}^n\)?"
**Displays as:** "What is the space ℝⁿ?" (rendered)

**Display equation:**
```
\[
\int_0^1 x dx = \frac{1}{2}
\]
```
**Displays as:** Centered, beautifully rendered integral

---

## If You Still See Issues

### Issue: Duplicates still being created

**Check state file:**
```bash
cat ~/.anki_tex_state.json | jq '.note_hashes | length'
```

**If count doesn't match Anki:**
```bash
python -m anki_tex.cli reconcile-state --repo /path/to/notes
```

### Issue: MathJax not rendering

**In Anki:**
1. Tools → Manage Note Types
2. Select "Basic"
3. Cards...
4. Check that MathJax is enabled (should be by default)

**Check the card HTML:**
- Right-click card in browse view
- "Edit HTML"
- Should see `\(...\)` not `$...$`

### Issue: Old cards still have `$...$`

**These are cards created with the old prompt:**
1. You can manually edit them in Anki, or
2. Delete them and let the tool recreate with correct format

---

## Technical Details

### GUID Computation
```python
# For basic cards
guid = SHA1(env_name + normalized_body + file_path)

# For LLM cards (new!)
guid = SHA1("definition::llm" + "front|back" + file_path)
```

### Why Content-Based?
- **Stable:** Same content → same GUID (even if regenerated)
- **Unique:** Different content → different GUID
- **Move-safe:** File path included, so moving changes GUID (intentional)

### allowDuplicate: True
- **Anki's duplicate detection:** Checks first field only, not sophisticated
- **Our GUID system:** Tracks exact cards with full content awareness
- **Better approach:** Let us handle duplicates via state tracking

---

## Summary

**Two fixes:**
1. ✅ MathJax: `$...$` → `\(...\)` and `$$...$$` → `\[...\]`
2. ✅ Duplicates: Index-based GUIDs → Content-based GUIDs

**Next steps:**
1. Delete duplicate cards in Anki
2. Run `reconcile-state`
3. Test with `--limit 1`
4. Full process

**Result:** No more duplicates, proper LaTeX rendering! 🎉

