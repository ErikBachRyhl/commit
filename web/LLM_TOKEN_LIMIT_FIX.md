# LLM Token Limit Fix - Truncated JSON Response

## The Problem

**Error**: `Expecting ',' delimiter: line 106 column 1 (char 4127)`

**Root Cause**: The LLM response was being **truncated** because `max_tokens` was only **1200**. 

### What Happened

You extracted **31 blocks** and the LLM tried to generate cards for 8 of them, but:
- Each card needs ~100-200 tokens (front + back + tags + reasoning)
- 8 cards × 150 tokens = ~1200 tokens
- **Response got cut off mid-JSON** at line 106

The JSON ended like this:
```json
      ]
    }  // ← We got here
  ]    // ← Missing closing brace!
}      // ← Never reached this
```

Python's JSON parser hit the end unexpectedly and failed.

---

## The Fix

### 1. Increased Default `max_tokens` from 1200 → 4096

**Files Changed**:

#### `commit/llm_client.py`
```python
# Before
max_tokens: int = 1200,

# After
max_tokens: int = 4096,
```

#### `commit/config.py`
```python
# Before
max_output_tokens: int = Field(default=1200, ...)

# After
max_output_tokens: int = Field(default=4096, ...)
```

#### `/Users/erik/Documents/Studie/learning/commit.yml`
```yaml
llm:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.2
  max_output_tokens: 4096  # ← ADDED
  enable_generated: true
  max_cards_per_block: 2
  selection_conservativeness: 0.1
```

### 2. Why 4096?

- **gpt-4o-mini** supports up to **16,384 output tokens**
- **4096** is a safe default that allows:
  - ~20-30 cards per batch (enough for most use cases)
  - Still well within model limits
  - Good balance of cost vs. completeness

---

## LaTeX Format Clarification

### You Asked About `$...$` vs `\(...\)`

You're absolutely right! **Anki uses**:
- `\(...\)` for **inline math**
- `\[...\]` for **display/block math**

### The LLM is Already Doing This Correctly!

In the debug file, you saw:
```json
"back": "A (rank \\(k\\), real, smooth) vector bundle..."
```

**What's happening**:
1. **In JSON**: `\\(` (double backslash, escaped)
2. **After JSON parsing**: `\(` (single backslash)
3. **In Anki**: Renders as inline math! ✓

**Example flow**:
```
LLM outputs:   "back": "Let \\(x \\in \\mathbb{R}\\)"
                        ↓ (JSON parse)
Python gets:   "back": "Let \(x \in \mathbb{R}\)"
                        ↓ (Send to Anki)
Anki renders:  Let 𝑥 ∈ ℝ  ✓
```

So the format is **already correct**! The JSON just looked weird because of the double-escaping required for valid JSON.

---

## Test It Now!

### From Web UI

1. Click **"Process Now"**
2. Select your commits
3. Watch the live console

You should now see:
```
Extracted 31 block(s)
Generating Anki notes...
✓ LLM selected 8 blocks, skipped 23  ← Cards created!
Building .apkg file...
✓ Created notes.apkg with 8 cards
```

### From Terminal

```bash
cd /Users/erik/Projects/apps/AnkiChat
python3 -m commit.cli process \
  --repo /Users/erik/Documents/Studie/learning \
  --since c078f516 \
  --offline \
  --output /tmp/test.apkg
```

---

## Expected Results

With `max_output_tokens: 4096`, you should now get:

### Batch of 31 Blocks
- **Selected**: ~8-10 blocks (based on priority)
- **Cards generated**: ~8-10 cards (1 per block typically)
- **No truncation**: Complete JSON response

### LaTeX Rendering
All math should render correctly in Anki:
- `\(x^2\)` → inline math
- `\[\int_a^b f(x) dx\]` → display math
- `\mathbb{R}`, `\alpha`, etc. → rendered symbols

---

## Cost Implications

**Before**: 1200 tokens max
**After**: 4096 tokens max

**Cost difference** (gpt-4o-mini):
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

**Per run** (31 blocks):
- Input: ~3000 tokens (blocks + prompt) = $0.00045
- Output: ~2000 tokens (8 cards) = $0.0012
- **Total: ~$0.0016 per run** (less than a penny!)

Even with the higher limit, it's still very cheap.

---

## Troubleshooting

### If cards still don't generate:

1. **Check the console output** for the new error
2. **Look for**:
   ```
   ✓ LLM selected X blocks, skipped Y
   ```
   If both are 0, there's still a parsing issue.

3. **Check debug file**:
   ```bash
   cat /tmp/llm_batch_response_debug.txt
   ```
   Should now show complete JSON with closing braces.

4. **Verify config loaded**:
   ```bash
   cat /Users/erik/Documents/Studie/learning/commit.yml | grep max_output
   ```
   Should show: `max_output_tokens: 4096`

### If you see "Response too long" error:

The LLM tried to generate too many cards. Solutions:
- Increase `selection_conservativeness` (currently 0.1) to be more selective
- Decrease `max_cards_per_block` (currently 2)
- Process fewer blocks at once with `--limit`

---

## Summary

✅ **Increased token limit** from 1200 → 4096  
✅ **Updated config files** (Python + YAML)  
✅ **Clarified LaTeX format** (already correct!)  
✅ **Ready to test** - should generate cards now!

**Try running the process again!** You should now see complete JSON and actual card generation. 🎉

---

## Next Steps

Once cards are generating successfully:

1. **Review card quality** in Anki
2. **Adjust settings** if needed:
   - `selection_conservativeness`: How picky the LLM is
   - `max_cards_per_block`: Cards per environment
   - `paraphrase_strength`: How much to rephrase
3. **Process more commits** with confidence!

