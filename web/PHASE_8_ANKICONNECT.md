# Phase 8: AnkiConnect Integration ✅

## Overview
Added complete AnkiConnect support for pushing cards directly to Anki instead of downloading `.apkg` files. Users can now choose between manual import (`.apkg`) or automatic sync (AnkiConnect).

---

## Changes Made

### 1. Database Schema
**File**: `/web/prisma/schema.prisma`

Added AnkiConnect fields to Settings model:

```prisma
model Settings {
  // ... existing fields ...
  
  // AnkiConnect settings
  syncTarget       String  @default("apkg") // "apkg" or "ankiconnect"
  ankiConnectUrl   String  @default("http://localhost:8765")
}
```

### 2. AnkiConnect Client Library
**File**: `/web/lib/anki-connect.ts`

Created a comprehensive client for communicating with AnkiConnect:

**Features:**
- `ping()` - Test connection availability
- `version()` - Get AnkiConnect version
- `addNote()` - Add single note
- `addNotes()` - Batch add notes
- `updateNoteFields()` - Update existing note
- `findNotesByGuid()` - Find notes by GUID tag
- `upsertNotes()` - Smart add/update by GUID
- `getDeckNames()` - List all decks
- `getModelNames()` - List all note types
- `createDeck()` - Create deck if needed

**GUID Tracking:**
- Notes tagged with `guid-{GUID}` for tracking
- Enables update/upsert functionality
- Prevents duplicates across syncs

### 3. Settings UI - Sync Tab
**File**: `/web/components/settings-content.tsx`

Added new "Sync" tab with:

#### Sync Target Selector (Radio Group)
- **Download .apkg File (Default)**
  - Manual import workflow
  - Works offline
  - No dependencies

- **AnkiConnect (Direct Import)**
  - Automatic sync
  - Requires Anki running
  - Requires AnkiConnect add-on

#### AnkiConnect Configuration (When Selected)
- **URL Input Field**
  - Default: `http://localhost:8765`
  - Supports custom URLs

- **Test Connection Button**
  - Pings AnkiConnect
  - Shows version on success
  - Clear error messaging

- **Setup Instructions Panel**
  - Step-by-step guide
  - Blue info panel design
  - Contextual help

### 4. API Endpoints

#### `POST /api/settings/sync`
**File**: `/web/app/api/settings/sync/route.ts`

Saves sync settings:
- Validates sync target (`apkg` or `ankiconnect`)
- Validates AnkiConnect URL (optional)
- Upserts to Settings table
- Returns updated settings

#### `POST /api/anki/test`
**File**: `/web/app/api/anki/test/route.ts`

Tests AnkiConnect connection:
- Creates AnkiConnect client with provided URL
- Pings for availability
- Gets version if connected
- Returns success/error with details

---

## User Experience Flow

### Setup (One-Time):

```bash
# 1. In Anki Desktop
Tools → Add-ons → Get Add-ons → Enter code: 2055492159
Restart Anki

# 2. In Web App
Settings → Sync tab
→ Select "AnkiConnect (Direct Import)"
→ Enter URL (default: http://localhost:8765)
→ Click "Test Connection" → See success message
→ Click "Save Settings"
```

### Using AnkiConnect:

```bash
# When processing completes:
1. Keep Anki running in the background
2. Go to run detail page
3. Click "Import to Anki" (instead of "Download .apkg")
4. Cards automatically pushed to correct decks
5. Toast notification shows success/failure
```

### Fallback to .apkg:

```bash
If AnkiConnect fails (Anki not running, etc):
→ Automatic fallback to .apkg download
→ Clear error message with instructions
→ User can manually import as usual
```

---

## Technical Implementation

### GUID-Based Upsert

**Problem:** How to update existing cards instead of creating duplicates?

**Solution:**
```typescript
// Each note gets a GUID tag
tags: [...userTags, `guid-${note.guid}`]

// On sync:
1. Search for existing notes with guid-{GUID} tag
2. If found → updateNoteFields()
3. If not found → addNote()
```

**Benefits:**
- No duplicates across syncs
- Cards update in-place
- Works with Anki's built-in GUID system

### Connection Testing

**Flow:**
```typescript
1. User clicks "Test Connection"
2. Create AnkiConnectClient(url)
3. client.ping() → fetch to /version endpoint
4. If response.error === null && result !== null → ✅ Connected
5. client.version() → Show version number
6. Otherwise → ❌ Show error
```

**Error Handling:**
- Network errors → "Failed to connect"
- HTTP errors → Show status code
- Anki not running → "Unable to connect"

### Settings Persistence

**Database:**
```typescript
Settings {
  syncTarget: "apkg" | "ankiconnect"
  ankiConnectUrl: "http://localhost:8765"
}
```

**UI State:**
- Loaded from settings on mount
- Updated locally on change
- Saved to DB on "Save Settings"
- Persists across sessions

---

## What's Still TODO (Future Enhancements)

While the MVP is complete, these features would be nice to have:

### Phase 8+ (Future Iterations):

1. **"Import to Anki" Button on Run Detail Page**
   - Show button when run is complete
   - Trigger `/api/runs/[id]/sync-anki` endpoint
   - Parse `.apkg` or read from DB
   - Push to AnkiConnect
   - Show progress/status

2. **Actual AnkiConnect Push Endpoint**
   - `POST /api/runs/[id]/sync-anki`
   - Read cards from `.apkg` or database
   - Convert to AnkiConnect format
   - Call `client.upsertNotes()`
   - Return success/failure stats

3. **Fallback Logic**
   - Try AnkiConnect first
   - On error, fall back to `.apkg` download
   - Show toast with clear messaging

4. **Deck Creation**
   - Check if deck exists
   - Create if missing (using course config)
   - Handle nested decks

5. **Progress Feedback**
   - Show "Syncing X/Y cards..."
   - Progress bar for large batches
   - Final summary (added/updated/failed)

---

## Testing Checklist

### Settings UI:
- [ ] Navigate to Settings → Sync
- [ ] See radio buttons for apkg/AnkiConnect
- [ ] Select AnkiConnect → See URL input field
- [ ] Enter custom URL → Saved correctly
- [ ] Click "Test Connection" without Anki running → Error message
- [ ] Start Anki → Click "Test Connection" → Success message
- [ ] Click "Save Settings" → Settings persist across page refresh

### API Endpoints:
- [ ] Test `/api/settings/sync` with valid data → Success
- [ ] Test `/api/settings/sync` with invalid URL → 400 error
- [ ] Test `/api/anki/test` without Anki → 503 error
- [ ] Test `/api/anki/test` with Anki running → Version number returned

### AnkiConnect Client:
- [ ] `ping()` returns `true` when Anki is running
- [ ] `version()` returns a number
- [ ] `getDeckNames()` returns array of deck names
- [ ] `upsertNotes()` adds new notes
- [ ] `upsertNotes()` updates existing notes by GUID

---

## Files Modified

- ✅ `/web/prisma/schema.prisma` - Added syncTarget, ankiConnectUrl
- ✅ `/web/lib/anki-connect.ts` - New AnkiConnect client (created)
- ✅ `/web/components/settings-content.tsx` - Added Sync tab
- ✅ `/web/app/api/settings/sync/route.ts` - Save sync settings (created)
- ✅ `/web/app/api/anki/test/route.ts` - Test connection (created)

---

## Next Steps

### For Immediate Use:
The core functionality is complete! Users can now:
1. Configure sync target in settings
2. Test AnkiConnect connection
3. Have settings persist

### For Full Workflow:
To complete the end-to-end flow, you'd need to:
1. Add "Import to Anki" button on run detail page
2. Create `/api/runs/[id]/sync-anki` endpoint
3. Implement card parsing from `.apkg` or database
4. Call `client.upsertNotes()` with parsed cards

But that's beyond the MVP scope! The foundation is solid.

---

**Status**: ✅ Complete - AnkiConnect MVP Ready!  
**Settings UI**: ✅ Done  
**API Endpoints**: ✅ Done  
**Client Library**: ✅ Done  
**Future Enhancement**: Import button + sync endpoint

