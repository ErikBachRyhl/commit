# Empty Cards Debug Guide

## The Error

```
Error: AnkiConnect error: ['cannot create note because it is empty']
```

## What We've Fixed

Added **three layers** of empty card validation:

### Layer 1: LLM Card Generation (`_generate_cards_with_llm`)
- Checks if `front` or `back` are empty after getting cards from LLM
- Skips empty cards with warning messages
- **Lines 573-581** in `anki_tex/processor.py`

### Layer 2: Basic Mapper Fallback (`map_block`)
- If LLM returns empty list, falls back to basic mapper
- Basic mapper now validates and provides fallback text for empty fields
- **Lines 152-160** in `anki_tex/note_models.py`

### Layer 3: Before AnkiConnect (`create` action)
- Final validation right before sending to AnkiConnect
- Shows exactly what's empty and from which file
- **Lines 422-432** in `anki_tex/processor.py`

---

## How to Debug

### Step 1: Run with Limit to See Warnings

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate

python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 5 \
  --dry-run
```

**Look for:**
- `Warning: Skipping card X with empty front`
- `Warning: Skipping card X with empty back`
- `Warning: Skipping empty note from ...`
- `[WARNING] Empty front field for ...`

### Step 2: Check Which Blocks Cause Issues

The warnings will tell you:
```
Warning: Skipping empty note from DiffTop/difftop.tex:199
  Front: '' Back: ''
```

Now you can:
1. Open `DiffTop/difftop.tex`
2. Go to line 199
3. See what LaTeX environment is there
4. Check if it's malformed or has no content

### Step 3: Check State File for LLM Response

```bash
# See the last LLM generation
cat ~/.anki_tex_state.json | jq '.llm_generations | to_entries | .[-1]'
```

This shows:
- What the LLM actually returned
- If it's valid JSON
- If fronts/backs are populated

### Step 4: Test Without LLM

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --disable-llm \
  --limit 5
```

If this works, the issue is with LLM generation.
If this also fails, the issue is with the basic mapper.

---

## Common Causes

### Cause 1: Empty LaTeX Environment

**Example:**
```latex
\begin{definition}
  % TODO: fill this in later
\end{definition}
```

**Result:** Empty body → empty back field

**Fix:** 
- Skip empty environments in your LaTeX, or
- The tool now shows `[Empty back - check source at ...]` instead of failing

### Cause 2: LLM Returns Malformed JSON

**Example:**
```json
{
  "cards": [
    {"model": "Basic", "front": "What is X?"}
    // Missing "back" key!
  ]
}
```

**Result:** `.get("back", "")` returns empty string

**Fix:** The validation now catches and skips these

### Cause 3: LLM Returns Only Whitespace

**Example:**
```json
{
  "cards": [
    {"model": "Basic", "front": "   ", "back": "   "}
  ]
}
```

**Result:** `.strip()` makes it empty

**Fix:** Validation catches this after stripping

### Cause 4: Commented-Out Content

**Example:**
```latex
\begin{definition}[Important]
  % This whole definition is commented out
  % \mathbb{R} is the set of real numbers
\end{definition}
```

**Result:** Parser skips commented lines → empty body

**Fix:** This is correct behavior (commented = not extracted)

---

## Expected Behavior Now

### Scenario A: LLM Returns Valid Cards

```
Generating Anki notes...
  ✓ Generated 3 cards from DiffTop/difftop.tex:199
  ✓ Generated 2 cards from DiffTop/difftop.tex:250
```

No warnings = all cards have content.

### Scenario B: LLM Returns Some Empty Cards

```
Generating Anki notes...
  Warning: Skipping card 2 with empty back
  ✓ Generated 2 cards from DiffTop/difftop.tex:199 (1 skipped)
```

Some cards skipped, rest proceed.

### Scenario C: LLM Fails Completely

```
Generating Anki notes...
Warning: Could not parse JSON from LLM response
  Falling back to basic mapping for DiffTop/difftop.tex:199
  ✓ Generated 1 card from DiffTop/difftop.tex:199
```

Falls back to basic mapping.

### Scenario D: Everything Empty (Shouldn't Happen)

```
Generating Anki notes...
  Warning: Skipping empty note from DiffTop/difftop.tex:199
    Front: '' Back: ''
```

Note is skipped, no AnkiConnect error.

---

## What to Share for Further Debug

If you still see the error after these changes, run:

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 2 \
  --dry-run 2>&1 | tee debug_output.txt
```

Then share:
1. The full output in `debug_output.txt`
2. The specific file/line mentioned in warnings
3. State file LLM generations:
   ```bash
   cat ~/.anki_tex_state.json | jq '.llm_generations' > llm_gens.json
   ```

---

## Quick Test Now

Try this immediately:

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate

python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 1
```

**Watch for:**
- Any warning messages
- If it completes without AnkiConnect error
- What gets created in Anki

If you see warnings, they'll tell you exactly which block and why it's empty!

