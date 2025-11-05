# What's New - Commit Selector & Safe Config

## 🎯 Fixed Issues

### 1. ✅ Your commit.yml is Safe Now
- **Problem**: Web app was temporarily overwriting your `commit.yml` and the backup restoration failed, deleting your config
- **Solution**: Web app now **never modifies your repo files**. Your `commit.yml` stays in your repo, managed by you.

### 2. ✅ No More "Waiting for output..."
- **Problem**: Processing would show "Waiting for output..." when there were no new commits to process
- **Solution**: New **Commit Selector** lets you choose exactly which commits to process

---

## 🚀 New Feature: Commit Selector

When you click "Process Now", you now get a beautiful dialog with 3 options:

### 📍 Latest commit only
Process just the most recent commit. Perfect for:
- Quick iterations
- Testing a single small change
- Verifying your workflow

### 📅 Since a specific commit (Recommended)
Browse recent commits and select one as the starting point. The CLI will process all commits **after** that one.

**Features**:
- Visual commit browser with 20 recent commits
- Shows commit SHA, message, author, and relative date
- Default selection: 5 commits ago (smart default)
- Clear preview: "Process 5 commits since abc1234"

### 🔄 All commits
Reprocess the entire repository from scratch.

**Use when**:
- First time setup
- You want to regenerate all cards
- Major config changes

---

## 📖 How to Use

### Prerequisites

**IMPORTANT**: Install Python dependencies first!

```bash
# Navigate to project root
cd /Users/erik/Projects/apps/AnkiChat

# Install the Commit CLI package
pip3 install -e .

# Verify it works
python3 -m commit.cli --help
```

See [PYTHON_SETUP.md](./PYTHON_SETUP.md) if you get any errors.

### Start the Web UI

1. **Make sure** `commit.yml` exists in your repo:
   ```bash
   ls -la $LOCAL_REPO_PATH/commit.yml
   ```
   I've restored it for you at `/Users/erik/Documents/Studie/learning/commit.yml`

2. **Start the dev server**:
   ```bash
   cd /Users/erik/Projects/apps/AnkiChat/web
   npm run dev
   ```

3. **Navigate to** http://localhost:3000

4. **Click "Process Now"**

5. **Commit Selector opens**:
   - Choose your mode (Latest / Since / All)
   - For "Since" mode: click on a commit to select it
   - Click "Start Processing"

6. **Watch live logs** as the Python CLI processes your LaTeX

7. **View generated cards** in the carousel

8. **Download your .apkg file**

---

## 🏗️ Architecture

```
Your Repo (commit.yml)  →  Python CLI  →  Web UI (displays results)
     ✅ You manage           ✅ Reads         ✅ Shows cards
     ✅ Never touched        ✅ Processes     ✅ Triggers CLI
```

**Single Source of Truth**: Your `commit.yml` in your repo  
**Python CLI**: Reads config directly from your repo  
**Web UI**: Views config (imports to DB) + triggers processing with commit selection

---

## 📝 New Files

- `lib/git.ts` - Git utilities (read commits, branches, etc.)
- `app/api/git/commits/route.ts` - API to fetch commits
- `components/commit-selector.tsx` - Beautiful commit selector dialog
- `components/ui/radio-group.tsx` - shadcn radio button component

---

## 🔧 Modified Files

- `app/api/process/route.ts` - Removed dangerous file overwriting
- `components/dashboard-content.tsx` - Added commit selector integration
- `lib/cli.ts` - Supports `--config` flag (for future web-managed config)

---

## 📚 Documentation

- [SAFE_CONFIG_AND_COMMIT_SELECTOR.md](./SAFE_CONFIG_AND_COMMIT_SELECTOR.md) - Full technical overview
- [COMMIT_SELECTOR.md](./COMMIT_SELECTOR.md) - Detailed commit selector guide
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Updated setup instructions

---

## 🎨 What You'll See

### Dashboard
- Courses from your `commit.yml`
- Big "Process Now" button
- Recent runs history

### Commit Selector Dialog
- Clean, Notion-like UI
- 3 processing modes with radio buttons
- Scrollable commit list with:
  - Commit hash (colorful)
  - Commit message (truncated nicely)
  - Author name
  - Relative date ("2 hours ago")
- Selected commit highlighted with accent color
- Summary: "Process 5 commits since abc1234"

### Run Detail Page
- Live log streaming (ANSI colors preserved)
- Real-time statistics
- Card carousel when processing completes
- Download button for .apkg

---

## 🐛 Troubleshooting

### Commit selector shows "No commits found"
```bash
# Verify LOCAL_REPO_PATH is set
echo $LOCAL_REPO_PATH

# Check commits exist
cd $LOCAL_REPO_PATH && git log --oneline -10
```

### "No commit.yml found" error
```bash
# Check file exists
ls -la $LOCAL_REPO_PATH/commit.yml

# Your config is at:
cat /Users/erik/Documents/Studie/learning/commit.yml
```

### Still seeing "Waiting for output..."
Try selecting "All commits" mode to reprocess everything, or choose an older commit in "Since" mode.

---

## ✨ What's Next?

For full web-managed config editing (future iteration):

1. Add `--config` flag to Python CLI
2. Build settings editor in web UI
3. Enable "Write back to repo" via GitHub PR

But for now, the current approach is **safe, simple, and powerful!**

---

## 🙏 Summary

**Before**: Dangerous file overwriting, unclear what's being processed  
**After**: Safe, visual commit selection, complete control

**Try it now**: Click "Process Now" and explore the commit selector! 🚀

