# 🧪 Test the Job Queue System Now

## Quick Start (2 minutes)

### 1. Run Automated Tests

```bash
cd /Users/erik/Projects/apps/AnkiChat/web
npx tsx scripts/test-job-queue.ts
```

**Expected output:**
```
🧪 Testing Job Queue System

Test 1: Pipeline Version
  ✅ Current version: parser-1.2/cards-v1

Test 2: Database Connection
  ✅ Connected to database

Test 3: Advisory Locks
  ✅ First lock acquired: true
  ✅ Second lock acquired: false (should be false)
  ✅ Lock released
  ✅ Third lock acquired: true (should be true)

Test 4: Job Creation
  ✅ Created job: [uuid]
  ✅ Job found in database: queued

Test 5: Idempotency
  ✅ Idempotency works: [uuid] === [uuid]

Test 6: Force Mode
  ✅ Force mode creates new jobs: [uuid1] !== [uuid2]

Test 7: Commit Status
  ✅ New commit status: new
  ✅ Processed commit status: processed
  ✅ Old version commit status: needs_rerun

==================================================
✅ Passed: 7
❌ Failed: 0
📊 Success rate: 100.0%

🎉 All tests passed! Ready for Phase 5-8.
```

### 2. Check Database

```bash
npx prisma studio
```

In Prisma Studio, you should see:
- ✅ `jobs` table with test job records
- ✅ `commit_runs` table with test commit records
- ✅ `Settings` model has `devMode` field

### 3. Manual API Test

Start the dev server:
```bash
npm run dev
```

In another terminal, test job creation:
```bash
# Sign in to http://localhost:3000 first, then get your session cookie from DevTools

curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "type": "reprocess",
    "selector": {
      "commit_ids": ["89528998", "c078f516"]
    },
    "force": false,
    "repoPath": "/Users/erik/Documents/Studie/learning"
  }'
```

---

## What You Can Test

### ✅ Working Now

1. **Job Creation**
   - Creates jobs with unique IDs
   - Stores in database
   - Background processing starts automatically

2. **Idempotency**
   - Same request twice = same job ID
   - Prevents duplicate processing

3. **Force Mode**
   - `force: true` bypasses idempotency
   - Always creates new job

4. **Advisory Locks**
   - Prevents concurrent processing of same repo
   - Automatically releases on completion

5. **Commit Status Tracking**
   - Knows which commits are new/processed/needs_rerun
   - Based on pipeline version

6. **Pipeline Versioning**
   - Current: `parser-1.2/cards-v1`
   - Bump this when you change parsers/prompts
   - Old commits automatically marked `needs_rerun`

### 🚧 Not Yet Implemented

- Dev mode UI toggle
- Commit selector status preview
- Job drawer UI
- AnkiConnect integration

---

## Next: Continue to Phase 5-8?

**Current progress: 60% complete**

If tests pass, we can continue with:
- Phase 5: Dev mode toggle + commit status preview UI
- Phase 6: AnkiConnect integration
- Phase 7: Backward compatibility
- Phase 8: Testing & polish

**Estimated time: 2-3 hours to complete all phases**

---

## Troubleshooting

### Test script fails with "Cannot find module"
```bash
npm install -D tsx
```

### Database connection fails
Check `.env` file has `DATABASE_URL` set correctly

### Advisory lock test fails
Your PostgreSQL version might not support advisory locks (requires 9.1+)

### "Test user not found" error
The script creates a test user automatically, but if it fails:
```sql
INSERT INTO "User" (id, email, name) 
VALUES ('test-user-id', 'test@example.com', 'Test User');
```

---

## Full Documentation

- `QUICK_TESTS.md` - Comprehensive testing guide
- `JOB_QUEUE_PROGRESS.md` - What's done, what's next
- `scripts/test-job-queue.ts` - Automated test script

---

**Ready to continue?** Let me know if tests pass or if you hit any issues! 🚀

