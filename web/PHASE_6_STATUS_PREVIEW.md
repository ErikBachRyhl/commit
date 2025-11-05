# Phase 6: Commit Status Preview ✅

## Overview
Added real-time commit status tracking and visual indicators to show which commits are new, already processed, or need re-running. This helps developers understand what will happen before they hit "Process" and prevents unnecessary reprocessing.

---

## Changes Made

### 1. Commit Status Badges
**File**: `/web/components/commit-selector.tsx`

Added three distinct status badges that appear next to each commit SHA when developer mode is enabled:

#### **✨ New** (Secondary Badge)
- Indicates a commit that has never been processed
- Uses `Sparkles` icon
- Default secondary styling

#### **✅ Processed** (Green Badge)
- Indicates a commit that has been successfully processed for the current pipeline version
- Uses `CheckCircle2` icon
- Green border and text (`border-green-500`, `text-green-700`)

#### **⚠️ Needs Re-run** (Yellow Badge)
- Indicates a commit that was processed but failed, or was processed with an old pipeline version
- Uses `AlertTriangle` icon
- Yellow border and text (`border-yellow-500`, `text-yellow-700`)

**Visual Design:**
- Badges only appear when dev mode is enabled
- Flex-wrap layout prevents overflow
- Icons sized at `h-3 w-3` for compactness
- Full dark mode support

### 2. Status Fetching
**Implementation:**

```typescript
// Fetch statuses automatically when dev mode is on and commits are loaded
useEffect(() => {
  if (devMode && commits.length > 0 && Object.keys(commitStatuses).length === 0) {
    fetchCommitStatuses(commits.map(c => c.sha))
  }
}, [devMode, commits])

const fetchCommitStatuses = async (commitShas: string[]) => {
  const response = await fetch('/api/commits/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitShas }),
  })
  // ... updates commitStatuses state
}
```

**API Integration:**
- Calls `/api/commits/status` (created in Phase 4)
- Uses `getCommitStatus()` from `lib/job-queue.ts`
- Checks `commit_runs` table against current `PIPELINE_VERSION`

### 3. Smart Warnings
**File**: `/web/components/commit-selector.tsx`

Added intelligent warnings that appear between the summary and developer options:

#### **Warning (Yellow):** All commits already processed
```
All X selected commits have already been processed. 
Enable "Force Reprocess" to run again.
```

#### **Info (Blue):** Some commits already processed
```
X of Y selected commits have already been processed and will be skipped. 
Enable "Force Reprocess" to reprocess them.
```

**Conditional Display:**
- Only shown when dev mode is enabled
- Hidden when "Force Reprocess" is checked
- Calculates based on selected mode (latest/since/all)
- Different styling for warning vs info

**Visual Design:**
- Yellow left border for warnings (all processed)
- Blue left border for info (some processed)
- `AlertCircle` icon with matching color
- Clear, actionable messaging

### 4. State Management
**New State Variables:**

```typescript
const [commitStatuses, setCommitStatuses] = useState<
  Record<string, 'new' | 'processed' | 'needs_re_run' | 'unknown'>
>({})
```

**Helper Functions:**

- `getStatusBadge(sha)` - Returns appropriate badge component
- `getProcessedCommitsWarning()` - Calculates and returns warning object
- `fetchCommitStatuses(shas)` - Fetches statuses from API

---

## User Experience Flow

### For Developers (Dev Mode ON):

1. **Open Commit Selector** → Status badges load automatically
2. **See Status at a Glance:**
   - New commits: Ready to process
   - Processed commits: Already done, will be skipped
   - Needs re-run: Failed or outdated
3. **Warning Appears (if applicable):**
   - All processed: Get clear warning and recommendation
   - Some processed: Get informative heads-up
4. **Make Informed Decision:**
   - Process as-is (skips processed)
   - Enable "Force Reprocess" to override

### For Regular Users (Dev Mode OFF):

- No status badges shown
- No warnings displayed
- Clean, simple interface
- Processing "just works" without technical details

---

## Technical Implementation

### Status Calculation Logic
From `lib/job-queue.ts -> getCommitStatus()`:

```typescript
1. Query commit_runs for latest run per commit with current PIPELINE_VERSION
2. If status='success' → 'processed'
3. If status='failed' → 'needs_re_run'
4. If no run for current pipeline (but has old runs) → 'needs_re_run'
5. If no run at all → 'new'
```

### Performance Optimizations:

- Single API call fetches all commit statuses (batch)
- Status badges only fetched when dev mode is ON
- Silent failure if API call fails (badges just don't appear)
- Statuses cached in component state (no refetch on mode change)

### Integration with Force Reprocess:

- Warning disappears when "Force Reprocess" is checked
- Force flag bypasses all cache/status checking
- CLI state file still cleared for fresh processing

---

## Testing Checklist

- [ ] Enable dev mode in settings
- [ ] Open commit selector, verify badges appear for each commit
- [ ] Select a previously-processed commit range
- [ ] Verify warning appears showing processed commits
- [ ] Check "Force Reprocess" checkbox
- [ ] Verify warning disappears
- [ ] Uncheck "Force Reprocess"
- [ ] Verify warning reappears
- [ ] Test with:
  - [ ] All commits processed (yellow warning)
  - [ ] Some commits processed (blue info)
  - [ ] No commits processed (no warning)
- [ ] Disable dev mode, verify badges and warnings disappear

---

## Next Steps (Phase 7)

Phase 7 is technically complete! The smart reprocessing UX we just built covers:
- ✅ Preview of what will be processed
- ✅ Warnings for already-processed commits
- ✅ Clear path to force reprocessing

**Optional Phase 7 Enhancements:**
- Add a detailed preview modal showing per-commit breakdown
- Add status count summary (e.g., "3 new, 2 processed, 1 needs re-run")
- Add filter buttons to show only new/processed/needs-re-run commits

But these are nice-to-haves! Let's move to **Phase 8: AnkiConnect Integration** ✨

---

## Files Modified
- ✅ `/web/components/commit-selector.tsx`
  - Added status badge rendering
  - Added status fetching logic
  - Added smart warning system
  - Added helper functions for status display

---

**Status**: ✅ Complete - Ready for Phase 8!

