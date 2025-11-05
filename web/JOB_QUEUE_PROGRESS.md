# Job Queue & Reprocessing System - Progress Report

## ✅ Phase 1-4: COMPLETE (Core System)

### What's Working Now

**1. Clean Architecture**
- ❌ Removed hacky state file manipulation
- ❌ Fixed database connection storm
- ✅ Optimized polling with exponential backoff (5s base)

**2. Database Schema**
- ✅ `jobs` table with idempotency support
- ✅ `commit_runs` table with pipeline versioning
- ✅ `devMode` field in Settings (ready for UI)

**3. Job Queue Core**
- ✅ Pipeline version tracking (`parser-1.2/cards-v1`)
- ✅ PostgreSQL advisory locks (prevents concurrent processing)
- ✅ Idempotent job creation (duplicate requests return same job)
- ✅ Commit status checking (new/processed/needs_rerun)
- ✅ Job worker with automatic lock management

**4. API Endpoints**
- ✅ `POST /api/jobs` - Create job (with idempotency)
- ✅ `GET /api/jobs/[id]` - Job status & commit runs
- ✅ `POST /api/commits/status` - Batch status checking

### Test It Now

**Quick automated test:**
```bash
cd /Users/erik/Projects/apps/AnkiChat/web
npm install -D tsx  # If not already installed
npx tsx scripts/test-job-queue.ts
```

**Manual tests:** See `QUICK_TESTS.md` for comprehensive testing guide

---

## 🚧 Phase 5-8: TODO (UI & Polish)

### Phase 5: Dev Mode & UI Updates

**What needs to be built:**

1. **Settings Page - Dev Mode Toggle**
   ```typescript
   // In app/settings/page.tsx
   <Checkbox 
     checked={settings.devMode} 
     onChange={handleDevModeToggle}
   />
   ```

2. **Commit Selector - Status Preview**
   ```typescript
   // Enhanced commit-selector.tsx
   - Fetch statuses: POST /api/commits/status
   - Display badges: 🆕 New | ✅ Processed | 🔄 Needs Re-run
   - Summary: "5 new, 2 already processed, 1 needs re-run"
   - Collapsible list with status pills
   ```

3. **Dev Mode Features**
   - "Force Reprocess" checkbox (only visible in dev mode)
   - Verbose logging toggle
   - Show commit hashes and processing details

**Files to create/modify:**
- `app/settings/page.tsx` - Add dev mode section
- `components/commit-selector.tsx` - Add status preview
- `app/api/settings/route.ts` - Add devMode update endpoint

---

### Phase 6: Minimal AnkiConnect Integration

**What needs to be built:**

1. **Settings Schema Update**
   ```typescript
   syncTarget: "apkg" | "ankiconnect"
   ankiConnectUrl: "http://127.0.0.1:8765"
   ```

2. **AnkiConnect Client** (`lib/ankiconnect.ts`)
   ```typescript
   - checkAnkiConnect(url): Promise<boolean>
   - syncCards(url, cards): Promise<void>
   - Fallback to .apkg if Anki unreachable
   ```

3. **Export Flow Update**
   - Check syncTarget setting
   - Try AnkiConnect, fall back to .apkg
   - Toast: "Anki not detected, exported .apkg instead"

**Files to create/modify:**
- `prisma/schema.prisma` - Add syncTarget, ankiConnectUrl to Settings
- `lib/ankiconnect.ts` - New file
- `app/api/export/route.ts` - Update with AnkiConnect logic
- `app/settings/page.tsx` - Add sync target selector

---

### Phase 7: Backward Compatibility

**What needs to be done:**

1. **Keep Old Endpoints Working**
   - `POST /api/process` should create a Job internally
   - Return both `runId` (for compatibility) and `jobId`
   - Old SSE streams (`/api/process/stream`) map to job logs

2. **Migration Strategy**
   - ProcessingRun records continue to work
   - Gradually migrate UI to use Jobs
   - Keep both systems running for 1-2 releases

**Files to modify:**
- `app/api/process/route.ts` - Map to createJob
- `app/api/process/stream/route.ts` - Stream from job logs

---

### Phase 8: Testing & Polish

**What needs to be done:**

1. **UI Enhancements**
   - Toast on job start: "Processing queued" (with link)
   - Toast on completion: "8 cards generated" (with link)
   - Toast on idempotent job: "Job already running" (open existing)

2. **Error Handling**
   - Lock contention: "Another process is running" → show active job
   - Failed jobs: Show retry button
   - Cancellation: Allow stopping queued/running jobs

3. **Job Drawer** (`components/job-drawer.tsx`)
   - Right-side drawer
   - List active jobs with status chips
   - Progress indicators
   - Cancel/Retry buttons
   - Log tail (in dev mode)

4. **End-to-End Tests**
   - Full flow: Select commits → Create job → Process → View cards
   - Idempotency: Duplicate requests handled correctly
   - Force mode: Creates new job
   - Status preview: Shows correct badges

**Files to create:**
- `components/job-drawer.tsx`
- `app/api/jobs/[id]/cancel/route.ts`
- `tests/e2e/job-queue.spec.ts`

---

## Architecture Summary

### Current Flow

```
User clicks "Process Now"
         ↓
Commit Selector opens
         ↓
Select commits (e.g., last 5)
         ↓
POST /api/jobs
   - Creates Job (or returns existing if duplicate)
   - Acquires advisory lock
   - Spawns processJob() in background
         ↓
Job Worker processes each commit:
   - Check if already processed (skip if not force)
   - Run CLI for new commits
   - Create CommitRun records
   - Store artifacts & metrics
         ↓
Job completes, releases lock
         ↓
User sees results in Job drawer or Run detail page
```

### Key Benefits

1. **No Race Conditions**: Advisory locks prevent concurrent processing
2. **No Duplicates**: Idempotency ensures same request = same job
3. **Pipeline Versioning**: Automatically reprocess when parsers/prompts change
4. **Testing-Friendly**: Force mode for dev testing
5. **Clean State**: No more state file hacks
6. **Scalable**: Ready for worker queue (Modal/Fly) later

---

## Next Steps

**Option A: Continue Implementation** (Phases 5-8)
- Estimated: 2-3 hours
- Delivers: Full UI with dev mode, AnkiConnect, job drawer
- Result: Production-ready system

**Option B: Test & Iterate**
- Run tests now
- Find issues
- Polish core before adding UI

**Option C: Ship Core, Iterate UI**
- Deploy Phases 1-4 (backend is solid)
- Use curl/Postman for testing
- Build UI incrementally

**Recommendation: Option A** - We're 60% done, finishing now delivers maximum value and avoids context switching.

---

## Quick Reference

**Test the system:**
```bash
npx tsx scripts/test-job-queue.ts
```

**Check database:**
```bash
npx prisma studio
```

**Create a job (curl):**
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "reprocess",
    "selector": {"commit_ids": ["SHA1", "SHA2"]},
    "repoPath": "/path/to/repo"
  }'
```

**Pipeline version:**
```typescript
import { PIPELINE_VERSION } from '@/lib/constants'
// Current: "parser-1.2/cards-v1"
// Bump when parsers/prompts/templates change
```

