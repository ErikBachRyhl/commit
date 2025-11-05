# Safe Config Management & Commit Selector

## What We Fixed

### Problem 1: Dangerous File Overwriting
**Issue**: The web app was temporarily overwriting `commit.yml` in your learning repository, and the backup/restore logic failed, resulting in your config being deleted.

**Solution**: Removed all file overwriting logic. The web app now:
- ✅ **Never touches your repo's files**
- ✅ Reads `commit.yml` directly from your repo (as the Python CLI expects)
- ✅ Imports settings to the database for display only
- ✅ No backup/restore logic that can fail

### Problem 2: "Waiting for output..." with No Results
**Issue**: When clicking "Process Now", if the latest commit was already processed, the CLI would find nothing to process and show no cards.

**Solution**: Added a **Commit Selector** that lets you choose:
- ✅ Which commit to process from
- ✅ How many commits to process
- ✅ Visual feedback on what will be processed

---

## New Architecture: Safe & Simple

```
┌─────────────────────────────────────────┐
│  Your Learning Repo                     │
│                                         │
│  ✅ commit.yml (YOU manage this)        │
│  ✅ LaTeX files                         │
│  ✅ Git history                         │
│                                         │
│  🚫 Never modified by web app           │
└─────────────────────────────────────────┘
           │
           │ Python CLI reads from here
           ▼
┌─────────────────────────────────────────┐
│  Python CLI                             │
│                                         │
│  • Reads commit.yml from repo           │
│  • Processes LaTeX files                │
│  • Generates cards                      │
│  • Writes output to temp location       │
└─────────────────────────────────────────┘
           │
           │ Web app displays results
           ▼
┌─────────────────────────────────────────┐
│  Web UI (Database)                      │
│                                         │
│  • Imports commit.yml for viewing       │
│  • Shows courses, settings              │
│  • Triggers CLI with commit selection   │
│  • Displays cards, logs, results        │
└─────────────────────────────────────────┘
```

---

## Commit Selector Feature

### UI Flow

1. **Click "Process Now"** on dashboard
2. **Commit Selector Dialog opens**
   - Shows recent 20 commits from your repo
   - Each commit shows: SHA, message, author, relative date
3. **Choose processing mode**:
   - 🎯 **Latest commit only**: Just the most recent
   - 📅 **Since a specific commit**: All commits after selection (default)
   - 🔄 **All commits**: Reprocess entire repo
4. **Select starting commit** (for "Since" mode)
   - Click on a commit to select it
   - Shows preview: "Process 5 commits since abc1234"
5. **Start Processing**
   - Redirects to run detail page
   - Shows live logs
   - Displays generated cards

### Technical Implementation

#### New Files
- `lib/git.ts` - Git utilities for reading commit history
- `app/api/git/commits/route.ts` - API endpoint to fetch commits
- `components/commit-selector.tsx` - Commit selector dialog UI
- `components/ui/radio-group.tsx` - shadcn radio button component

#### Modified Files
- `components/dashboard-content.tsx` - Added commit selector trigger
- `app/api/process/route.ts` - Simplified to not overwrite files
- `lib/cli.ts` - Supports optional `--config` flag (for future use)

#### API Changes

**New Endpoint**: `GET /api/git/commits`
```typescript
// Query params
{
  repoId: string,
  limit?: number // default: 20
}

// Response
{
  commits: Array<{
    sha: string,
    shortSha: string,
    message: string,
    author: string,
    date: Date,
    dateRelative: string
  }>
}
```

**Updated**: `POST /api/process`
```typescript
// Now accepts sinceSha parameter
{
  repoId: string,
  sinceSha?: string, // NEW: process commits since this SHA
  offline?: boolean,
  enableLlm?: boolean,
  provider?: string,
  model?: string
}
```

---

## Current Workflow (MVP)

### For Users

1. **Maintain `commit.yml` in your repo** (manually edit as needed)
2. **Import it to web UI** (for viewing courses/settings)
3. **Use commit selector** to choose what to process
4. **CLI reads your repo's `commit.yml`** (not managed by web)
5. **View and download results** in web UI

### Config Management (MVP vs Future)

| Feature | MVP Status | Future Vision |
|---------|-----------|---------------|
| **Edit commit.yml** | ✅ Edit manually in repo | 🔮 Edit in web UI |
| **View config** | ✅ Import to database (read-only) | 🔮 Full CRUD in UI |
| **Sync to repo** | 🚫 N/A (manual editing) | 🔮 Write back via PR |
| **Config source** | ✅ Repo file (single source of truth) | 🔮 Database OR repo |
| **Python CLI** | ✅ Reads from repo | 🔮 Reads from temp file |

---

## Future: Full Web-Managed Config

To enable **editing config entirely in the web UI**, we need:

### Phase 1: Python CLI Changes
- [ ] Add `--config` flag to `commit.cli.py`
- [ ] Update `find_config()` to accept optional path parameter
- [ ] Test with external config files

### Phase 2: Web UI Changes
- [ ] Add settings editor in UI (forms for courses, LLM, etc.)
- [ ] Serialize settings to YAML
- [ ] Write YAML to safe temp location
- [ ] Pass temp config path to CLI via `--config` flag

### Phase 3: Optional Repo Sync
- [ ] "Write back to repo" button
- [ ] Create GitHub PR with updated `commit.yml`
- [ ] User reviews and merges PR

---

## Benefits of Current Approach

### ✅ Safety
- No risk of deleting your config
- No failed backup/restore logic
- Your repo files are never touched

### ✅ Simplicity
- One source of truth: your repo's `commit.yml`
- Web UI is a viewer + trigger
- No complex sync logic

### ✅ Flexibility
- Commit selector gives fine-grained control
- Can reprocess any commit range
- Visual feedback before processing

### ✅ Future-Proof
- Easy to add `--config` flag later
- Database already stores settings structure
- Can enable web editing when ready

---

## Troubleshooting

### Commit selector shows "No commits found"
```bash
# Check that LOCAL_REPO_PATH is set
echo $LOCAL_REPO_PATH

# Verify repo has commits
cd $LOCAL_REPO_PATH && git log --oneline -10
```

### Config not found error
```bash
# Make sure commit.yml exists in repo
ls -la $LOCAL_REPO_PATH/commit.yml

# Verify it's valid YAML
cd $LOCAL_REPO_PATH && python3 -c "import yaml; yaml.safe_load(open('commit.yml'))"
```

### CLI still using wrong config
```bash
# Check for multiple commit.yml files
find $LOCAL_REPO_PATH -name "commit*.yml"

# Remove any web-generated configs
rm -f $LOCAL_REPO_PATH/commit.web.yml
rm -f $LOCAL_REPO_PATH/.commit-web-managed
```

---

## Documentation

- [COMMIT_SELECTOR.md](./COMMIT_SELECTOR.md) - Detailed commit selector guide
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Updated setup instructions
- [LOCAL_SETUP.md](./LOCAL_SETUP.md) - Local development info

## Summary

**Safe**: Your repo files are never modified ✅  
**Simple**: One source of truth for config ✅  
**Powerful**: Choose exactly what to process ✅  
**Future-ready**: Easy path to web-managed config ✅

