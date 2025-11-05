# Phase 5: Developer Mode UI ✅

## Overview
Added a complete Developer Mode feature to enable advanced testing and development workflows, including force reprocessing and preparation for detailed status previews.

---

## Changes Made

### 1. Settings UI - Developer Tab
**File**: `/web/components/settings-content.tsx`

- Added new "Developer" tab with `Code2` icon
- Created toggle switch for enabling/disabling Developer Mode
- Added informative panel showing active features when dev mode is on:
  - Force Reprocess
  - Status Preview (coming in Phase 6)
  - Verbose Logs

**Key Features:**
```tsx
- Toggle persisted to database (Settings.devMode)
- Visual indicator when active (blue info panel)
- Helpful tips for using force reprocess
```

### 2. Commit Selector - Force Reprocess
**File**: `/web/components/commit-selector.tsx`

- Fetches devMode status when dialog opens
- Shows "Force Reprocess" checkbox when dev mode is enabled
- Passes `force: true` flag to API when checkbox is checked
- Clear visual distinction with blue info panel matching settings

**User Experience:**
- Only visible to developers who opt in
- Clear explanation of what force reprocess does
- Contextual help text about use cases

### 3. API Endpoints
**Created:**
- `/web/app/api/settings/dev-mode/route.ts` - Toggle dev mode on/off
- `/web/app/api/settings/dev-mode-status/route.ts` - Get current dev mode state

**Updated:**
- `/web/app/api/process/route.ts` - Accept `force` parameter, log when active

### 4. Database Integration
**Schema:**
```prisma
model Settings {
  // ...
  devMode Boolean @default(false)
}
```

### 5. UI Components Added
- `shadcn/ui Switch` component for toggle
- `Checkbox` component for force reprocess option

---

## How to Use

### For Developers/Testers:
1. Navigate to **Settings → Developer** tab
2. Toggle **"Enable Developer Mode"** ON
3. When processing commits:
   - Select commits as usual
   - Check **"Force Reprocess"** to override cached state
   - Process runs with cleared state file

### Force Reprocess Use Cases:
- Testing new LLM prompts on already-processed commits
- Verifying deleted file handling
- Re-running after manual config changes
- Debugging card generation issues

---

## Technical Details

### Force Mode Behavior:
Currently, force mode works alongside the existing state file clearing mechanism:
- State file (`~/.commit_state.json`) is cleared before every run
- Force flag is passed through to the API
- Logged with 🔥 emoji for visibility

**Future Integration:**
When fully migrated to the job queue system:
- Force flag will integrate with `jobs.force` field
- Will bypass `commit_runs` cache checking
- Will create new entries even for already-processed commits

### Dev Mode Persistence:
- Stored in `Settings` table per user
- Fetched on settings page load
- Re-fetched when commit selector opens
- Toggleable without page refresh

---

## Testing Checklist

- [ ] Toggle dev mode ON in settings
- [ ] Verify info panel appears with feature list
- [ ] Open commit selector, verify "Force Reprocess" checkbox appears
- [ ] Select a commit, check "Force Reprocess", process
- [ ] Verify terminal logs show "🔥 FORCE MODE" message
- [ ] Toggle dev mode OFF, verify checkbox disappears from commit selector
- [ ] Verify state persists across page refreshes

---

## Next Steps (Phase 6)

Add commit status preview:
- Show "New", "Processed", or "Needs re-run" badges on commits
- Call `/api/commits/status` endpoint with selected commit SHAs
- Display status using `getCommitStatus()` from `lib/job-queue.ts`
- Warn user if selecting already-processed commits without force mode

---

## Files Modified
- ✅ `/web/components/settings-content.tsx`
- ✅ `/web/components/commit-selector.tsx`
- ✅ `/web/app/api/settings/dev-mode/route.ts` (new)
- ✅ `/web/app/api/settings/dev-mode-status/route.ts` (new)
- ✅ `/web/app/api/process/route.ts`
- ✅ `/web/components/ui/switch.tsx` (added via shadcn)

---

**Status**: ✅ Complete - Ready for Phase 6!

