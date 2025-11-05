# Debugging LLM Parsing Issue

## The Problem

The Python CLI shows:
```
Warning: Could not parse batch response from LLM
Response preview: {
"selected_blocks": [
  {
    "block_index": 3,
    ...
✓ LLM selected 0 blocks, skipped 0
```

The LLM **is** generating JSON with cards, but the parser is failing.

## What I Just Fixed

### 1. Added Better Error Logging
Changed line 133 from:
```python
except json.JSONDecodeError:
    pass
```

To:
```python
except json.JSONDecodeError as e:
    print(f"  Direct parse failed: {e}")
    pass
```

Now you'll see **why** the JSON parsing failed.

### 2. Added Debug File Output
When parsing fails, the full LLM response is now saved to:
```
/tmp/llm_batch_response_debug.txt
```

This lets us see exactly what the LLM returned.

## Next Steps

### 1. Run the Process Again

From the web UI, click "Process Now" and select commits, OR run from terminal:

```bash
cd /Users/erik/Projects/apps/AnkiChat
python3 -m commit.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --since c078f516 \
  --offline \
  --output /tmp/test.apkg
```

### 2. Check the Output

Look for lines like:
```
Direct parse failed: Invalid \escape: line 5 column 25 (char 69)
Full response saved to: /tmp/llm_batch_response_debug.txt
```

This tells us:
- **What** went wrong (the specific JSON error)
- **Where** to find the full response

### 3. Inspect the Debug File

```bash
cat /tmp/llm_batch_response_debug.txt
```

Or from the web UI logs, it will show the file path.

## Common Issues & Fixes

### Issue 1: LaTeX Backslashes (`\`)

**Error**: `Invalid \escape: line X column Y`

**Cause**: LaTeX uses `\alpha`, `\(`, `\)` etc. which are invalid in JSON

**Fix**: The LLM prompt needs to be updated to double-escape backslashes:
- Wrong: `"back": "Let \(x\) be..."`
- Right: `"back": "Let $x$ be..."` (use `$...$` for math)
- Or: `"back": "Let \\\\(x\\\\) be..."` (double backslash)

### Issue 2: Unclosed Quotes

**Error**: `Expecting ',' delimiter: line X column Y`

**Cause**: LaTeX might have unescaped quotes

**Fix**: Ensure all quotes in the JSON values are escaped

### Issue 3: Truncated JSON

**Error**: `Expecting property name enclosed in double quotes`

**Cause**: LLM response cut off mid-JSON

**Fix**: Increase max_tokens in the LLM call

## After You Get the Debug Info

Once you have the error message and debug file, share:
1. The error message (e.g., "Invalid \escape: line 5 column 25")
2. The contents of `/tmp/llm_batch_response_debug.txt` (first 100 lines)

Then I can create a targeted fix!

## Quick Fix to Try Now

If the issue is LaTeX escaping (most common), try this temporary workaround:

```bash
# Set a very conservative selection to process fewer blocks
cd /Users/erik/Projects/apps/AnkiChat

# Edit commit.yml temporarily
# Change: selection_conservativeness: 0.1
# To: selection_conservativeness: 0.9

# Then process
python3 -m commit.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --since c078f516 \
  --limit 5 \
  --offline \
  --output /tmp/test.apkg
```

This processes fewer blocks, reducing chances of hitting LaTeX escaping issues.

