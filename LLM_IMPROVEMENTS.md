# LLM Improvements - Three Key Fixes

## Summary of Changes

Fixed three critical issues with LLM card generation:

1. **Empty cards causing AnkiConnect errors** ✅
2. **Too many blocks processed during testing** ✅  
3. **LaTeX not rendering properly in Anki** ✅

---

## Problem 1: Empty Cards ("cannot create note because it is empty")

### Issue

The LLM was sometimes returning cards with empty `front` or `back` fields, causing AnkiConnect to reject them with:

```
Error: AnkiConnect error: ['cannot create note because it is empty']
```

This resulted in only 1 out of 44 potential cards being created.

### Root Cause

The LLM might return incomplete JSON like:

```json
{
  "cards": [
    {"model": "Basic", "front": "What is...", "back": ""},  ← Empty back
    {"model": "Basic", "front": "", "back": "Answer"}      ← Empty front
  ]
}
```

### Fix

Added validation in `anki_tex/processor.py` (lines 562-570):

```python
# Skip empty cards (LLM sometimes returns incomplete cards)
if not front:
    console.print(f"[yellow]  Warning: Skipping card {i+1} with empty front[/yellow]")
    continue

# For Basic cards, back is required; for Cloze, back is optional
if model_name == "Basic" and not back:
    console.print(f"[yellow]  Warning: Skipping Basic card {i+1} with empty back[/yellow]")
    continue
```

**Result:** Empty cards are now skipped with clear warnings, preventing AnkiConnect errors.

---

## Problem 2: Too Many Blocks During Testing

### Issue

When running with `--dry-run --enable-llm`, the tool would process **all 44 blocks**, making it:
- Slow to test
- Expensive (LLM API costs)
- Hard to evaluate card quality

User wanted: "Only make 2 example cards so I can rapidly test quality!"

### Solution

Added `--limit` flag to process only N blocks.

### Usage

**Test with just 2 blocks:**
```bash
python -m anki_tex.cli process \
  --repo /path/to/notes \
  --enable-llm \
  --limit 2 \
  --dry-run
```

**Test with 5 blocks:**
```bash
python -m anki_tex.cli process \
  --repo /path/to/notes \
  --enable-llm \
  --limit 5
```

**Process everything (no limit):**
```bash
python -m anki_tex.cli process \
  --repo /path/to/notes \
  --enable-llm
```

### Implementation

**CLI (`anki_tex/cli.py`):**
```python
limit: Optional[int] = typer.Option(
    None,
    "--limit",
    "-l",
    help="Limit number of blocks to process (useful for testing)",
),
```

**Processor (`anki_tex/processor.py`):**
- Stops extracting blocks once limit is reached
- Works across all files (stops early if needed)
- Shows accurate stats: "Extracted 2 block(s)" when `--limit 2`

---

## Problem 3: LaTeX Not Rendering in Anki

### Issue

The LLM-generated card fronts didn't render LaTeX properly. Instead of showing **ℝⁿ**, Anki displayed the raw text.

**Example broken output:**
```
Front: "What is the relationship between TS^1 and S^1 × R?"
```

Should have been:
```
Front: "What is the relationship between $TS^1$ and $S^1 \times \mathbb{R}$?"
```

### Root Cause

The LLM wasn't consistently wrapping math expressions in `$...$` delimiters, which Anki's MathJax renderer requires.

### Fix

Enhanced the system prompt in `anki_tex/prompts.py` with explicit LaTeX rendering rules:

**Added section:**
```
CRITICAL JSON + LATEX RULES:
- Use $...$ for inline math, $$...$$ for display math (Anki MathJax format)
- ALWAYS include $ delimiters around ALL math: $x^2$, $\\int f dx$, $\\mathbb{R}$

LATEX RENDERING EXAMPLES (what Anki will display):
- Write: "What is $\\alpha$?" → Anki shows: "What is α?"
- Write: "The space $\\mathbb{R}^n$" → Anki shows: "The space ℝⁿ"
- Write: "Recall that $$\\int_0^1 x dx = \\frac{1}{2}$$" → Anki shows centered equation
- WRONG: "What is x^2" → Shows literal "x^2" (not superscript)
- RIGHT: "What is $x^2$" → Shows "x²" (rendered math)
```

**Key points:**
- Emphasizes `$...$` for inline math
- Provides clear examples of correct vs. wrong formatting
- Shows what the user will actually see in Anki
- Reminds LLM that double-escaping is still needed (`\\\\alpha` in JSON → `\alpha` after parsing)

---

## Complete Testing Workflow

### 1. Quick Quality Check (2 cards)

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate

python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 2 \
  --dry-run
```

**What this does:**
- ✅ Processes only 2 blocks (fast!)
- ✅ Shows generated cards (for quality review)
- ✅ No actual Anki changes (dry-run)
- ✅ Costs very little (2 LLM calls)

**Inspect output:**
- Check if LaTeX renders (look for `$...$`)
- Check if fronts/backs are non-empty
- Check if cards make sense

### 2. Test with 5 Blocks (More Thorough)

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 5 \
  --dry-run
```

### 3. Actually Create Cards (Small Batch)

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 5
```

**No `--dry-run`** → Cards are actually created in Anki.

**Review in Anki:**
- Open Anki
- Check if LaTeX renders properly (should see α, ℝ, ∫, etc.)
- Check if card fronts/backs are complete
- Test card review experience

### 4. Full Production Run

Once satisfied with quality:

```bash
python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm
```

Processes all 44 (or however many) blocks.

---

## Expected Output (Improved)

### Before Fixes

```
Extracted 44 block(s)
Generating Anki notes...
Warning: Could not parse JSON from LLM response
  Falling back to basic mapping...
Warning: Could not parse JSON from LLM response
  Falling back to basic mapping...
...
Error: AnkiConnect error: ['cannot create note because it is empty']
✓ 1 card created
```

### After Fixes

```
Extracted 2 block(s)  ← Limited!
Generating Anki notes...
  Generated 3 cards from block 1
  Generated 2 cards from block 2
  Warning: Skipping card 3 with empty back  ← Validation!
✓ 4 cards created (1 skipped)
```

**And in Anki, you'll see:**
- Front: "What is $\alpha$?" → Renders as "What is α?"
- Back: "The space $\mathbb{R}^n$ ..." → Renders as "The space ℝⁿ ..."

---

## Common Issues & Solutions

### Issue: Still seeing empty cards

**Check:**
1. Is the LLM returning valid JSON? (check state file or add debug prints)
2. Are warnings showing which cards are skipped?
3. Try a different model (GPT-4 vs gpt-4o-mini)

**Solution:**
```bash
# Use more capable model
python -m anki_tex.cli process \
  --repo /path/to/notes \
  --enable-llm \
  --provider openai \
  --model gpt-4 \
  --limit 2
```

### Issue: LaTeX still not rendering

**Check in Anki:**
1. Go to Tools → Manage Note Types
2. Select "Basic" note type
3. Click "Cards..."
4. Verify that MathJax is enabled (should be by default)

**If MathJax is disabled:**
- Edit card template
- Add to the front/back template:
  ```html
  <script type="text/javascript">
    MathJax = {
      tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']]
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  ```

**Check LLM output:**
```bash
# Inspect state file
cat ~/.anki_tex_state.json | jq '.llm_generations | to_entries | .[0].value.response'
```

Look for `$...$` delimiters in the `front` and `back` fields.

### Issue: Limit not working

**Symptoms:**
- Still processes 44 blocks even with `--limit 2`

**Diagnosis:**
```bash
# Check version
python -m anki_tex.cli --version

# Reinstall
cd /Users/erik/Projects/apps/AnkiChat
pip install -e .
```

**Verify:**
```bash
python -m anki_tex.cli process --help
# Should show:
#   --limit, -l INTEGER  Limit number of blocks to process (useful for testing)
```

---

## Files Changed

1. **`anki_tex/processor.py`**
   - Added `limit_blocks` parameter
   - Added empty card validation (lines 562-570)
   - Early stopping when limit reached

2. **`anki_tex/cli.py`**
   - Added `--limit` / `-l` flag
   - Passes `limit_blocks` to processor

3. **`anki_tex/prompts.py`**
   - Enhanced "CRITICAL JSON RULES" section
   - Added "LATEX RENDERING EXAMPLES" section
   - Emphasized `$...$` delimiters

---

## Quick Reference

### Testing Commands

```bash
# Ultra-fast test (2 blocks, dry-run)
python -m anki_tex.cli process --repo <path> --enable-llm --limit 2 --dry-run

# Create 5 test cards
python -m anki_tex.cli process --repo <path> --enable-llm --limit 5

# Full production run
python -m anki_tex.cli process --repo <path> --enable-llm
```

### Debug Commands

```bash
# Check state file
cat ~/.anki_tex_state.json | jq '.'

# Check last LLM generation
cat ~/.anki_tex_state.json | jq '.llm_generations | to_entries | .[0]'

# Count tracked notes
cat ~/.anki_tex_state.json | jq '.note_hashes | length'

# List all decks
cat ~/.anki_tex_state.json | jq '.note_hashes[].deck' | sort -u
```

---

## Summary

**Three problems, three fixes:**

1. ✅ **Empty cards** → Skip with validation
2. ✅ **Too many blocks** → Add `--limit` flag
3. ✅ **LaTeX not rendering** → Improve prompt with explicit examples

**Recommended workflow:**
1. Test with `--limit 2 --dry-run` first
2. Create 5 cards with `--limit 5` (no dry-run)
3. Check Anki to verify LaTeX rendering
4. Run full batch if satisfied

**Next time you change notes:**
```bash
python -m anki_tex.cli process --repo /path/to/notes --enable-llm --limit 2 --dry-run
```

Fast iteration, high quality! 🚀

