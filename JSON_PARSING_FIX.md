# JSON Parsing Fix - LLM Integration

## Problem

The LLM was generating what *looked* like valid JSON, but Python's `json.loads()` was failing with errors like:

```
Warning: Could not parse JSON from LLM response
Response preview: {
  "cards": [
    {
      "model": "Basic",
      "front": "What is \(TS^1\)?",
      ...
```

**Error:** `Invalid \escape: line 5 column 25 (char 69)`

---

## Root Cause

**LaTeX uses backslashes** (`\times`, `\mathbb{R}`, `\(`, `\)`) which are **NOT valid JSON escape sequences**.

When the LLM wrote:
```json
{
  "front": "What is \(TS^1\)?"
}
```

Python's JSON parser saw `\(` as an invalid escape sequence and rejected it.

---

## Valid JSON Escape Sequences

JSON only allows these escape sequences:
- `\"` - double quote
- `\\` - backslash
- `\/` - forward slash
- `\b` - backspace
- `\f` - form feed
- `\n` - newline
- `\r` - carriage return
- `\t` - tab
- `\uXXXX` - unicode

**Everything else** (including `\(`, `\)`, `\t` when followed by `imes`, etc.) is **INVALID**.

---

## Solution

### 1. Updated System Prompt

Modified `anki_tex/prompts.py` to be **extremely explicit** about JSON escaping:

**Before:**
```
- LaTeX math must be properly escaped (use double braces for literal braces)
```

**After:**
```
CRITICAL JSON RULES:
- Output ONLY valid JSON - no markdown, no code blocks, no extra text
- ALL LaTeX backslashes MUST be double-escaped: write \\\\ not \\
- Use $...$ for inline math (Anki format)
- For cloze deletions: {{{{{{{{c1::text}}}}}}}} (8 braces total)
- For math braces: {{{{R}}}} (4 braces for literal single brace)
- Never use \( or \) - these break JSON parsing
- Test mentally: your output must be parseable by Python's json.loads()
```

**Example in prompt now shows:**
```json
{
  "back": "A set $M$ with a distance function $d: M \\\\times M \\\\to \\\\mathbb{{R}}$ ..."
}
```

Note the **double backslashes** (`\\\\`) which become single backslashes when parsed.

### 2. Improved JSON Parser

Updated `anki_tex/llm_client.py` to be more robust:

- Try direct JSON parse first
- Fall back to extracting from markdown code blocks (```json ... ```)
- Use `json.JSONDecoder.raw_decode()` for more lenient parsing
- Better error messages

---

## How It Works Now

### What LLM Should Output

```json
{
  "cards": [
    {
      "model": "Basic",
      "front": "What is a 1-form?",
      "back": "A 1-form on $M$ is a smooth map $\\\\omega: TM \\\\to \\\\mathbb{R}$",
      "tags": ["auto", "from-tex"]
    }
  ]
}
```

**Key points:**
- Uses `$...$` for inline math (Anki's format)
- **All backslashes doubled:** `\\\\omega`, `\\\\mathbb{R}`
- When JSON is parsed, single backslashes remain: `\omega`, `\mathbb{R}`
- Anki then renders the LaTeX correctly

### Brace Escaping

**For math braces** (like `\mathbb{R}`):
- JSON needs: `\\\\mathbb{{{{R}}}}`
- After JSON parse: `\mathbb{R}`
- Anki renders: **ℝ**

**For cloze braces** (like `{{c1::text}}`):
- JSON needs: `{{{{{{{{c1::text}}}}}}}}`
- After JSON parse: `{{c1::text}}`
- Anki interprets as cloze deletion

---

## Testing

### Valid Format (Should Parse)

```python
import json

test_json = """{
  "cards": [{
    "front": "What is $\\\\pi$?",
    "back": "Pi is approximately 3.14159"
  }]
}"""

data = json.loads(test_json)
print(data['cards'][0]['front'])
# Output: What is $\pi$?
```

### Invalid Format (Will Fail)

```python
bad_json = """{
  "front": "What is \\(\\pi\\)?"
}"""

json.loads(bad_json)  # ❌ Invalid \escape
```

---

## Next Steps

### For Users

**Try processing again:**
```bash
python -m anki_tex.cli process --repo /path/to/notes --enable-llm
```

The updated prompt should guide the LLM to produce valid JSON.

### If Issues Persist

1. **Check API quota:** Make sure you have OpenAI credits
2. **Try different model:** GPT-4 may follow instructions better than gpt-4o-mini
3. **Check response in state file:** Inspect `~/.anki_tex_state.json` under `llm_generations`
4. **Disable LLM temporarily:** Process without `--enable-llm` flag

---

## Why This Happens

LLMs are trained on LaTeX documents where:
- `\(` and `\)` are inline math delimiters
- Single backslashes are normal

But they're **not** trained heavily on JSON with embedded LaTeX, so they naturally write:
```json
{"text": "\(x^2\)"}  ❌ Invalid JSON
```

Instead of:
```json
{"text": "$x^2$"}  ✓ Valid JSON + Anki format
```

Or:
```json
{"text": "\\\\(x^2\\\\)"}  ✓ Valid JSON but wrong Anki format
```

**Our solution:** Use `$...$` which is:
- ✓ Valid JSON (no backslashes)
- ✓ Correct Anki format
- ✓ More natural for LLMs

---

## Files Changed

1. **`anki_tex/prompts.py`**
   - Added explicit JSON escaping rules
   - Updated example with double-escaped backslashes
   - Emphasized `$...$` format

2. **`anki_tex/llm_client.py`**
   - Improved `_parse_json_response()` method
   - Added fallback for markdown code blocks
   - Added `raw_decode()` attempt
   - Better error reporting

---

## Summary

**Problem:** LLM was using `\(` and `\)` which break JSON parsing  
**Solution:** Updated prompt to require `$...$` and double-escaped backslashes  
**Result:** LLM should now produce valid, parseable JSON with correct LaTeX

**Test it now!** Run `process --enable-llm` and check if JSON parsing succeeds.

---

## Debugging

If you still see parsing errors, save the raw LLM response:

```python
# In anki_tex/llm_client.py, add after line 58:
response_text = self._call_api(system_prompt, user_content)
print(f"\n[DEBUG] Raw LLM response:\n{response_text}\n")  # Add this
return self._parse_json_response(response_text)
```

Then share the output so we can diagnose further!

