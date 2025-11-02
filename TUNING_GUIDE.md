# Commit LLM Tuning Guide

## Problem Analysis

You identified two cases where the LLM incorrectly skipped valuable content:

### Case 1: Line 341 - Trivial Vector Bundle Example
**Content:** 
```latex
\begin{example}[Trivial Vector Bundle]
    The trivial vector bundle has \(E = \mathcal{M}\times \mathbb{R} ^k\), 
    \(\pi = \pi _1 : \mathcal{M}\times \mathbb{R} ^k \to M\). 
\end{example}
```

**LLM Decision:** "Definition already covered in a more general context"

**Why This Was Wrong:** This is a concrete example with specific mathematical notation that's valuable for understanding. Even if "trivial vector bundles" were mentioned elsewhere, this specific construction is worth a flashcard.

### Case 2: Line 397 - Exactness in ℝⁿ
**Content:**
```latex
It turns out that in \(\mathbb{R} ^n\), one can show that exactness is equivalent 
to the statement that \begin{align*}
    \frac{\partial \alpha _i}{\partial x^j} = \frac{\partial \alpha _j}{\partial x^i}  
\end{align*} 
for all \(i, j = 1, \dots , n\). We ended with an example of how this can fail...
```

**LLM Decision:** "Definition is important but redundant with other selected cards"

**Why This Was Wrong:** This is a crucial equivalence condition with a specific mathematical formula. Not redundant at all!

---

## Root Causes

### 1. **Truncation Too Aggressive**
**Problem:** Body truncated at 2000 chars, neighbor context at 1000 chars
- The LLM wasn't seeing enough content to properly evaluate each block
- It couldn't distinguish between "related topics" and "exact duplicates"

**Fix Applied:** 
- Increased `body` truncation: 2000 → 5000 chars
- Increased `neighbor_context`: 1000 → 2000 chars

### 2. **Prompt Too Conservative**
**Problem:** Original prompt said "SKIP: Minor examples, trivial remarks, redundant content"
- LLM interpreted "redundant" too broadly
- It skipped examples thinking they were "minor" when they were actually valuable

**Fix Applied:**
- Clarified that examples are often valuable
- Defined "redundant" as EXACT duplication, not related topics
- Added "when in doubt, include it" guidance

### 3. **No User Control Over Conservativeness**
**Problem:** Users couldn't easily tune how aggressive/conservative the LLM should be

**Fix Applied:** 
- New config parameter: `selection_conservativeness` (0.0-1.0)
- Dynamically adjusts prompt guidance based on setting

---

## How to Tune Selection Behavior

### Quick Tuning: `selection_conservativeness`

Edit your `commit.yml`:

```yaml
llm:
  # ... other settings ...
  
  # Selection conservativeness (0.0-1.0)
  # 0.0 = very liberal (create cards for almost everything)
  # 0.5 = balanced (default)
  # 1.0 = very conservative (only highest-value content)
  selection_conservativeness: 0.3  # ← Tune this!
```

**What This Does:**

| Value | Behavior | Prompt Guidance |
|-------|----------|----------------|
| `0.0 - 0.29` | **Very Liberal** | "Create cards for most blocks that have learning value. Err on the side of creating more cards." |
| `0.3 - 0.69` | **Balanced** | "Select blocks with clear learning value, skip only obviously redundant content." |
| `0.7 - 1.0` | **Very Conservative** | "Only select the highest-value, most essential blocks." |

### Recommended Settings by Use Case

#### 📚 **Learning New Material** → Use `0.2 - 0.3`
You want lots of cards to build understanding. Better to have too many than miss important concepts.

```yaml
selection_conservativeness: 0.3
daily_new_limit: 40
```

#### 🎯 **Focused Review** → Use `0.5`
You know the material well, just want cards for the most important stuff.

```yaml
selection_conservativeness: 0.5
daily_new_limit: 20
```

#### ⚡ **Time-Constrained** → Use `0.7 - 0.8`
Only want cards for absolutely essential content.

```yaml
selection_conservativeness: 0.8
daily_new_limit: 10
```

---

## Other Tuning Parameters

### 1. **Daily New Limit**
```yaml
daily_new_limit: 30  # Max cards per commit run
```

**Effect:** Hard cap on total cards generated
- LLM will never exceed this
- Treated as quality threshold, not target
- LLM may generate fewer if blocks don't meet quality bar

**Recommendation:** Set based on your daily study capacity
- Light study: 10-15
- Normal study: 20-30
- Intensive: 40-50

### 2. **Max Cards Per Block**
```yaml
llm:
  max_cards_per_block: 2  # Cards per LaTeX environment
```

**Effect:** How many different angles to test per concept
- 1 = One card per definition/theorem
- 2 = Multiple perspectives (recommended)
- 3 = Very thorough coverage

**Recommendation:** 
- Definitions/Theorems: 2-3
- Examples: 1-2

### 3. **Paraphrase Strength**
```yaml
llm:
  paraphrase_strength: 0.6  # 0.0-1.0
```

**Effect:** How much LLM rephrases vs. using exact wording
- 0.0 = Stay very close to source text
- 0.5 = Moderate paraphrasing
- 1.0 = Strong rephrasing

**Recommendation:**
- Math/Physics with precise notation: 0.3-0.5
- Conceptual material: 0.6-0.8

### 4. **Neighbor Context Lines**
```yaml
llm:
  neighbor_context_lines: 20  # Lines around each block
```

**Effect:** How much surrounding context LLM sees
- More context = better understanding of relationships
- Too much context = slower processing

**Recommendation:** 20-40 lines (10-20 above + 10-20 below)

---

## Your Current Configuration

Based on the issues you found, I've set your config to:

```yaml
llm:
  selection_conservativeness: 0.3  # More liberal
  max_cards_per_block: 2
  neighbor_context_lines: 20
  daily_new_limit: 30
```

This should:
- ✅ Generate more cards (less aggressive skipping)
- ✅ Not skip important examples like the trivial vector bundle
- ✅ Not skip important equivalences like the exactness condition

---

## Testing Your New Settings

```bash
cd /Users/erik/Documents/Studie/learning

# Test with your latest commit
commit process --repo . --dry-run --enable-llm

# If you like the results, run for real
commit process --repo . --enable-llm
```

**Look for:**
- Fewer "skipped" messages for examples and definitions
- More cards generated overall
- Still skipping truly redundant content

---

## Fine-Tuning Workflow

1. **Start with `selection_conservativeness: 0.3`**
2. **Run a dry-run and check the skipped blocks:**
   ```bash
   commit process --repo . --dry-run --enable-llm | grep "Skipped"
   ```
3. **Adjust based on results:**
   - Too many cards? Increase to 0.4-0.5
   - Still missing important stuff? Decrease to 0.2
   - Skipping obvious junk? Increase to 0.5-0.6

4. **Iterate until it feels right for your learning style**

---

## Advanced: Course-Specific Priorities

You can make the LLM focus more on certain courses:

```yaml
priorities:
  DiffTop: 8        # ← Very high priority (lots of cards)
  PDE: 5            # ← Medium-high priority
  ComplexAnalysis: 3  # ← Medium priority
  QFT: 2            # ← Lower priority
```

**Effect:** 
- High-priority courses get more cards even at same conservativeness
- LLM weighs priority when deciding which blocks to skip
- Use for your current focus areas

---

## Summary of Fixes Applied

1. ✅ **Increased truncation limits** (more content for LLM to evaluate)
2. ✅ **Updated prompt** (clarified what "redundant" means, less aggressive)
3. ✅ **Added `selection_conservativeness`** (easy user tuning)
4. ✅ **Set your config to 0.3** (more liberal, should fix the issues you saw)

**Test it out and let me know if it's generating the right amount and type of cards now!**

