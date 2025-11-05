# Quick Tests for Job Queue System

## 1. Database Schema Verification

Check that the new tables exist:

```bash
cd /Users/erik/Projects/apps/AnkiChat/web
npx prisma studio
```

In Prisma Studio, verify:
- ✅ `jobs` table exists with fields: id, type, selector, force, idempotencyKey, status, etc.
- ✅ `commit_runs` table exists with fields: commitSha, pipelineVersion, runVersion, status, etc.
- ✅ `Settings` model has `devMode` boolean field

## 2. Manual API Tests (using curl)

### Test 1: Create a Job

```bash
# First, get your session (sign in to the web app, then check cookies)
# Replace TOKEN with your session token from browser DevTools

curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "type": "reprocess",
    "selector": {
      "commit_ids": ["89528998", "c078f516"]
    },
    "force": false,
    "repoPath": "/Users/erik/Documents/Studie/learning"
  }'
```

Expected response:
```json
{
  "jobId": "uuid-here",
  "message": "Job queued successfully"
}
```

### Test 2: Check Job Status

```bash
curl http://localhost:3000/api/jobs/YOUR_JOB_ID \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

Expected response:
```json
{
  "job": {
    "id": "...",
    "status": "running" or "done" or "queued",
    "commitRuns": [...]
  }
}
```

### Test 3: Test Idempotency (Same Request Twice)

Run the same job creation request again:

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "type": "reprocess",
    "selector": {
      "commit_ids": ["89528998", "c078f516"]
    },
    "force": false,
    "repoPath": "/Users/erik/Documents/Studie/learning"
  }'
```

Expected: **Same jobId** returned (no duplicate job created)

### Test 4: Check Commit Statuses

```bash
curl -X POST http://localhost:3000/api/commits/status \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "commitShas": ["89528998", "c078f516", "some-new-sha"]
  }'
```

Expected response:
```json
{
  "statuses": [
    { "sha": "89528998", "status": "new" or "processed" or "needs_rerun" },
    { "sha": "c078f516", "status": "..." },
    { "sha": "some-new-sha", "status": "new" }
  ]
}
```

## 3. Test Advisory Locks

Open two terminal windows and run simultaneously:

**Terminal 1:**
```bash
cd /Users/erik/Projects/apps/AnkiChat/web
node -e "
const { acquireRepoLock, releaseRepoLock } = require('./lib/db-lock.ts');
(async () => {
  console.log('T1: Acquiring lock...');
  const acquired = await acquireRepoLock('/test/repo');
  console.log('T1: Lock acquired:', acquired);
  await new Promise(resolve => setTimeout(resolve, 10000)); // Hold for 10s
  await releaseRepoLock('/test/repo');
  console.log('T1: Lock released');
})();
"
```

**Terminal 2** (run immediately after T1):
```bash
node -e "
const { acquireRepoLock, releaseRepoLock } = require('./lib/db-lock.ts');
(async () => {
  console.log('T2: Acquiring lock...');
  const acquired = await acquireRepoLock('/test/repo');
  console.log('T2: Lock acquired:', acquired); // Should be false
  await releaseRepoLock('/test/repo');
})();
"
```

Expected: T2 should log `Lock acquired: false` because T1 holds the lock

## 4. Integration Test via Web UI

1. **Start the dev server:**
   ```bash
   cd /Users/erik/Projects/apps/AnkiChat/web
   npm run dev
   ```

2. **Open browser** to `http://localhost:3000`

3. **Sign in** with GitHub

4. **Open browser DevTools** → Network tab

5. **Click "Process Now"** → Select commits → Click "Start Processing"

6. **In Network tab**, look for:
   - ✅ POST to `/api/jobs` (returns jobId)
   - ✅ Console should show: "Created new job [jobId]"
   - ✅ Console should show: "Processing X commits for job [jobId]"

7. **Check database** (Prisma Studio):
   - ✅ New row in `jobs` table with status "running" or "done"
   - ✅ New rows in `commit_runs` table for each commit

## 5. Test Force Mode

```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "type": "reprocess",
    "selector": {
      "commit_ids": ["89528998"]
    },
    "force": true,
    "repoPath": "/Users/erik/Documents/Studie/learning"
  }'
```

Run it twice - should create **two different jobs** (force bypasses idempotency)

## 6. Check Pipeline Version

```bash
cd /Users/erik/Projects/apps/AnkiChat/web
node -e "
const { PIPELINE_VERSION } = require('./lib/constants.ts');
console.log('Current pipeline version:', PIPELINE_VERSION);
"
```

Should output: `parser-1.2/cards-v1`

## 7. Server Logs Check

Watch the server logs while running tests:

```bash
cd /Users/erik/Projects/apps/AnkiChat/web
npm run dev | grep -E "(job|commit|lock)"
```

Look for:
- ✅ "Created new job [id]"
- ✅ "Processing X commits for job [id]"
- ✅ "Skipping commit [sha] - already processed"
- ✅ "Commit [sha] processed successfully"
- ✅ "Job [id] completed successfully"
- ✅ "Released lock for repo [path]"

## Quick Checklist

- [ ] Database tables exist (jobs, commit_runs)
- [ ] Can create a job via API
- [ ] Idempotency works (duplicate request returns same job)
- [ ] Commit status endpoint works
- [ ] Advisory locks prevent concurrent processing
- [ ] Jobs show up in Prisma Studio
- [ ] Server logs show job processing
- [ ] Force mode creates new jobs

## Troubleshooting

### "Job stays queued"
- Check server logs for lock acquisition failures
- Verify `LOCAL_REPO_PATH` is set correctly

### "Idempotency not working"
- Check that `idempotencyKey` is being set in the database
- Verify the selector JSON is identical between requests

### "Advisory lock not working"
- Ensure PostgreSQL version supports advisory locks (9.1+)
- Check database connection is stable

## Next: Ready for Phase 5-8!

Once these tests pass, we'll continue with:
- ✅ Dev mode UI toggle
- ✅ Commit selector with status preview
- ✅ AnkiConnect integration
- ✅ Backward compatibility
- ✅ Full end-to-end testing

