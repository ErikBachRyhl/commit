# Documentation Index

Quick reference for all Renforce documentation.

## 📚 Start Here

1. **[COMPLETE_OVERVIEW.md](COMPLETE_OVERVIEW.md)** ⭐ **Read this first!**
   - Comprehensive guide to everything we've built
   - Architecture, features, usage, technical details
   - One-stop shop for understanding the entire system

2. **[README.md](README.md)**
   - Quick overview and installation
   - Basic commands and examples
   - Updated with links to detailed guides

## 🎯 Feature-Specific Guides

3. **[GUID_PERSISTENCE.md](GUID_PERSISTENCE.md)** 🔒
   - How GUID persistence works
   - Why it preserves review history
   - Examples and troubleshooting
   - **Essential reading** for understanding update behavior

4. **[LLM_PRODUCTION_READY.md](LLM_PRODUCTION_READY.md)** 🤖
   - LLM-powered card generation guide
   - Setup, configuration, usage
   - Cost estimates and examples
   - Provider switching (OpenAI/Anthropic/Gemini)

5. **[CHAT_FEATURE_STATUS.md](CHAT_FEATURE_STATUS.md)**
   - Chat mode status (not yet implemented)
   - What it would do
   - Current alternatives
   - Implementation plan

6. **[STATE_RECONCILIATION.md](STATE_RECONCILIATION.md)** 🔄
   - Reconcile state file with Anki
   - Handle deleted decks/cards
   - Choose ground truth and sync

7. **[STATE_FILE_GUIDE.md](STATE_FILE_GUIDE.md)** 📄
   - What the state file contains
   - How to inspect it
   - Understanding GUIDs
   - Common queries and troubleshooting

8. **[JSON_PARSING_FIX.md](JSON_PARSING_FIX.md)** 🔧
   - Why LLM JSON was failing to parse
   - LaTeX escaping in JSON
   - How the fix works
   - Troubleshooting LLM responses

9. **[LLM_IMPROVEMENTS.md](LLM_IMPROVEMENTS.md)** 🚀
   - Fixed empty cards error
   - Added `--limit` flag for testing
   - Improved LaTeX rendering in Anki
   - Quick testing workflow

10. **[DUPLICATE_FIX.md](DUPLICATE_FIX.md)** 🔄
   - Fixed MathJax delimiters (`\(...\)` not `$...$`)
   - Fixed duplicate card creation
   - Content-based GUIDs for LLM cards
   - Cleanup guide for existing duplicates

11. **[DELETION_GUIDE.md](DELETION_GUIDE.md)**
   - How to handle orphaned cards
   - Using `check-orphans` command
   - Anki search queries

## 🚀 Getting Started

7. **[QUICKSTART.md](QUICKSTART.md)**
   - 5-minute quick start
   - First run workflow
   - Basic examples

8. **[SETUP.md](SETUP.md)**
   - Detailed installation instructions
   - Virtual environment setup
   - SSL certificate fixes (macOS)
   - AnkiConnect installation

## 📖 Reference

- **Config Example:** `example/renforce.yml`
- **LaTeX Example:** `example/samples.tex`
- **API Keys Template:** `env.example`

---

## What Was Removed

The following files were removed as redundant:

- ✅ `START_HERE.md` → Covered by SETUP.md + QUICKSTART.md
- ✅ `INSTALL_SUCCESS.md` → Historical, no longer needed
- ✅ `LLM_IMPLEMENTATION_STATUS.md` → Outdated (features complete)
- ✅ `LLM_CORE_COMPLETE.md` → Redundant with LLM_PRODUCTION_READY.md
- ✅ `LLM_SETUP_INSTRUCTIONS.md` → Covered in LLM_PRODUCTION_READY.md
- ✅ `ORPHAN_CHECK_DEMO.md` → Covered in DELETION_GUIDE.md
- ✅ `FIXES_SUMMARY.md` → Historical fixes, no longer relevant

---

## Recommended Reading Order

**For New Users:**
1. `COMPLETE_OVERVIEW.md` (understand the system)
2. `QUICKSTART.md` (get running)
3. `GUID_PERSISTENCE.md` (understand how updates work)

**For LLM Features:**
1. `LLM_PRODUCTION_READY.md` (complete guide)
2. `COMPLETE_OVERVIEW.md` (context)

**For Troubleshooting:**
1. `STATE_RECONCILIATION.md` (sync mismatches, deleted decks)
2. `DELETION_GUIDE.md` (orphaned cards)
3. `SETUP.md` (installation issues)
4. `GUID_PERSISTENCE.md` (update problems)

**For Development:**
1. `COMPLETE_OVERVIEW.md` (architecture)
2. Source code comments
3. Individual feature guides

---

**All documentation is now consolidated and up-to-date! 🎉**

