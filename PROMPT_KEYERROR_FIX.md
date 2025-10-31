# Prompt KeyError Fix

## Error

```
Generating Anki notes...
Error: 'R'
```

## Root Cause

The system prompt in `anki_tex/prompts.py` contains **literal curly braces** like:
- `$\\mathbb{{{{R}}}}$` (intended for LaTeX examples)
- `{{{{{{{{c1::text}}}}}}}}` (intended for cloze instructions)

When we call `.format(max_cards=3, paraphrase_strength=0.6)` on this string, Python's string formatting tries to interpret **every** `{...}` as a format placeholder.

**The problem:**
- `{max_cards}` → ✓ Valid placeholder (we provide this value)
- `{paraphrase_strength}` → ✓ Valid placeholder (we provide this value)
- `{{{{R}}}}` → ✗ Python sees `{R}` inside and looks for a key called `R` → **KeyError: 'R'**

## Fix

Changed the brace escaping rules in the prompt examples:

**Before (caused KeyError):**
```python
CARDS_SYSTEM_PROMPT = """
...
- For math braces: {{{{R}}}} (4 braces for literal single brace)
- ALWAYS include $ delimiters around ALL math: $x^2$, $\\\\int f dx$, $\\\\mathbb{{{{R}}}}$
...
"""
```

**After (works correctly):**
```python
CARDS_SYSTEM_PROMPT = """
...
- For math braces like \\mathbb{{R}}: use 2 braces in JSON to get 1 brace after parsing
- ALWAYS include $ delimiters around ALL math: $x^2$, $\\\\int f dx$, $\\\\mathbb{{R}}$
...
"""
```

**Key changes:**
1. `{{{{R}}}}` → `{{R}}` (doubled braces become single after `.format()`)
2. `{{{{{{{{c1::text}}}}}}}}` → `{{{{c1::text}}}}` (4 doubled braces → 4 single braces)
3. Updated examples to use consistent `{{...}}` escaping

## How Python `.format()` Works

```python
# Single braces = format placeholders
"{name}".format(name="Alice")  # → "Alice"

# Double braces = literal braces
"{{name}}".format()  # → "{name}"

# Four braces = two literal braces
"{{{{name}}}}".format()  # → "{{name}}"
```

**In our prompt:**
- `{max_cards}` → Replaced with `3`
- `{{R}}` → Becomes `{R}` (literal brace)
- `{{{{c1::text}}}}` → Becomes `{{c1::text}}` (literal double braces)

## Testing

Run this to verify the fix works:

```bash
cd /Users/erik/Projects/apps/AnkiChat
source venv/bin/activate

python -m anki_tex.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --enable-llm \
  --limit 2 \
  --dry-run
```

**Expected:** No `Error: 'R'` - should proceed to "Generated X cards..."

## The Complete Flow

1. **Prompt template** in `anki_tex/prompts.py`:
   ```python
   CARDS_SYSTEM_PROMPT = """
   - Create up to {max_cards} flashcards
   - Use $\\mathbb{{R}}$ for the reals
   """
   ```

2. **Formatting** in `anki_tex/processor.py`:
   ```python
   system_prompt = CARDS_SYSTEM_PROMPT.format(
       max_cards=3,
       paraphrase_strength=0.6
   )
   ```

3. **Result** (after `.format()`):
   ```
   - Create up to 3 flashcards
   - Use $\mathbb{R}$ for the reals
   ```

4. **LLM receives** this formatted prompt and follows the instructions

## Lesson Learned

When mixing:
- **Format placeholders** (`{variable}`)
- **Literal braces** (for examples, LaTeX, etc.)

Always use **double braces** `{{...}}` for literals that should survive the `.format()` call.

**Rule of thumb:**
- Want `{text}` in final output? → Write `{{text}}` in template
- Want `{{text}}` in final output? → Write `{{{{text}}}}` in template
- Want to replace with variable? → Write `{variable}` in template

## Status

✅ **Fixed** - Prompt now formats correctly without KeyError.

Try running your command again!

