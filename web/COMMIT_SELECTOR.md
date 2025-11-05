# Commit Selector Feature

## Overview

The Commit Selector gives you fine-grained control over which commits to process for flashcard generation. No more "Waiting for output..." when there are no new commits!

## Features

### 3 Processing Modes

1. **Latest commit only** 🎯
   - Process just the most recent commit
   - Great for quick iterations
   - Use when you've just made a small change

2. **Since a specific commit** 📅
   - Process all commits after a selected commit
   - Most common use case
   - Default: processes last ~5 commits
   - Browse and select from recent commit history

3. **All commits** 🔄
   - Reprocess the entire repository
   - Use when you want to regenerate all cards
   - Warning: Can take a long time for large repos!

## How to Use

1. **From Dashboard**, click "Process Now" button
2. **Commit Selector Dialog** opens showing recent commits
3. **Choose your mode**:
   - For first run: Use "All commits" to process everything
   - For regular use: Use "Since a specific commit"
   - For quick check: Use "Latest commit only"
4. **Select a commit** (if using "Since" mode)
   - Browse through recent commits with:
     - Commit hash (short SHA)
     - Commit message
     - Author name
     - Relative date (e.g., "2 hours ago")
5. **Start Processing** - Your selection is sent to the Python CLI

## Why This Helps

### Problem
- Python CLI tracks processed commits in `.commit_state.json`
- If latest commit was already processed, you'd see "Waiting for output..."
- No way to reprocess older commits or specific ranges

### Solution
- Visual commit browser
- Flexible range selection
- Clear feedback on what will be processed
- Bypasses `.commit_state.json` when needed

## Technical Details

### API Endpoints

- `GET /api/git/commits?repoId={id}&limit={n}` - Fetch recent commits from local repo
- Uses native `git log` command to read commit history

### CLI Parameters

The commit selector passes these parameters to `/api/process`:

```typescript
{
  repoId: string,
  sinceSha?: string, // Optional: process commits since this SHA
  // Other options: offline, enableLlm, etc.
}
```

### Under the Hood

1. **Fetch Commits**: Uses `lib/git.ts` to run `git log` on your local repo
2. **Display UI**: Shows commits in a scrollable, selectable list
3. **Submit**: Sends `sinceSha` to the Python CLI via `--since` flag
4. **Process**: CLI processes commits in the specified range

## Tips

- **Default selection**: Automatically selects 5 commits ago as a safe default
- **Commit count**: Shows "Process X commits since abc1234" before starting
- **Empty state**: If no commits found, shows helpful error message
- **Loading state**: Smooth loading indicators while fetching commits

## Future Enhancements

- [ ] Remember last processed commit per repo
- [ ] Show which commits have been processed before (with indicator)
- [ ] Filter commits by file/path
- [ ] Date range picker
- [ ] Branch selector
- [ ] Diff preview before processing

## Troubleshooting

**"No commits found"**
- Make sure `LOCAL_REPO_PATH` is set correctly
- Verify your repo has commits: `cd $LOCAL_REPO_PATH && git log`

**"Failed to fetch commits"**
- Check that the repo path exists
- Ensure git is installed and accessible
- Verify you have read permissions on the repo

**Commit selector not opening**
- Make sure you've linked a repository first
- Check browser console for errors
- Refresh the page and try again

