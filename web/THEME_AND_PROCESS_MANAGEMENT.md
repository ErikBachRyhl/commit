# Theme Toggle & Process Management

## What's New

### 1. ✅ Light/Dark Theme Toggle

**Default**: Light theme (as requested!)

**How to Use**:
- Look for the sun/moon icon in the top-right header
- Click to open theme menu
- Choose:
  - ☀️ **Light** - Light mode
  - 🌙 **Dark** - Dark mode  
  - 💻 **System** - Follow system preference

**Features**:
- Persists your choice across sessions
- Smooth transitions
- Respects system preferences if "System" is selected
- Available on all pages

### 2. ✅ Kill/Stop Running Process

**Problem**: Process stuck showing "running" even after completion

**Solution**: 
- Red "Stop Process" button appears next to status badge when a process is running
- Click to kill the process
- Confirmation dialog to prevent accidents
- Updates status to "failed" immediately
- Works even for stuck processes

**How to Use**:
1. Navigate to a running process detail page
2. Look for the "Stop Process" button (red, top right)
3. Click and confirm
4. Process will be killed and marked as failed

### 3. ✅ Auto-Refresh for Stuck Processes

The system now properly handles process completion:
- Exit events update database status
- Live console shows real-time output
- Status badge reflects actual state

---

## Technical Details

### Theme System

**Package**: `next-themes`
**Files**:
- `components/theme-provider.tsx` - Theme context provider
- `components/theme-toggle.tsx` - Toggle button component
- `components/providers.tsx` - Updated to include theme
- `components/ui/dropdown-menu.tsx` - shadcn dropdown menu

**Default Theme**: Light mode (set in `providers.tsx`)

```typescript
<ThemeProvider
  attribute="class"
  defaultTheme="light"  // ← Starts with light mode
  enableSystem
  disableTransitionOnChange
>
```

### Process Management

**New API Endpoint**: `POST /api/process/[id]/kill`

**Files**:
- `app/api/process/[id]/kill/route.ts` - Kill process endpoint
- `components/run-detail-content.tsx` - Added stop button + handler
- `lib/process-manager.ts` - Already had kill functionality

**Flow**:
1. User clicks "Stop Process"
2. Confirmation dialog appears
3. API kills the child process
4. Unregisters from process manager
5. Updates database status to "failed"
6. Page refreshes to show new status

---

## UI Changes

### Dashboard Header (Before)
```
[Commit] [Repo Badge]          [Settings] [Sign Out]
```

### Dashboard Header (After)
```
[Commit] [Repo Badge]    [🌙] [Settings] [Sign Out]
```

### Run Detail Page (Before)
```
Processing Run              [Status Badge]
```

### Run Detail Page (After)
```
Processing Run         [Status Badge] [Stop Process]
                                       ↑ Only shows if running
```

---

## Theme Toggle Component

The theme toggle uses a dropdown menu with three options:

```tsx
<ThemeToggle />
```

**Appearance**:
- ☀️ Sun icon in light mode
- 🌙 Moon icon in dark mode
- Smooth rotation animation on toggle
- Outline style button to match design system

---

## Fixing Your Stuck Process

For the process that's been stuck for 40 minutes:

1. **Navigate to the run detail page**
2. **Look for the red "Stop Process" button** (top right, next to status)
3. **Click it** and confirm
4. **Process will be marked as failed** and removed from active processes

If the button doesn't appear, refresh the page - the process may have already completed but the status wasn't updated.

---

## Theme Persistence

Your theme choice is saved in localStorage:
- Key: `theme`
- Values: `"light"`, `"dark"`, or `"system"`

To reset to default (light):
```javascript
// In browser console
localStorage.removeItem('theme')
location.reload()
```

---

## Keyboard Shortcuts (Coming Soon)

Potential future enhancements:
- `Cmd/Ctrl + T` - Toggle theme
- `Cmd/Ctrl + K` - Kill active process
- `Escape` - Close modals

---

## Testing

### Test Theme Toggle
1. Refresh the page - should show **light mode** by default
2. Click sun icon → Switch to dark mode
3. Refresh - should stay in dark mode
4. Click moon icon → Switch back to light

### Test Process Kill
1. Start a new process
2. While running, click "Stop Process"
3. Confirm dialog
4. Status should immediately change to "failed"
5. Process should stop (check terminal output)

---

## Troubleshooting

### Theme not changing
- Check browser console for errors
- Clear localStorage: `localStorage.clear()`
- Hard refresh: `Cmd/Ctrl + Shift + R`

### Stop button not appearing
- Refresh the page
- Check database: Process status might be stuck
- Look in browser console for API errors

### Process still running after stop
- Check terminal - process should show as killed
- Database should show status="failed"
- If still stuck, restart dev server

---

## Summary

✅ **Light theme by default** - As requested!  
✅ **Theme toggle** - Top-right header, three options  
✅ **Stop Process button** - Red button, appears when running  
✅ **Confirmation dialog** - Prevents accidental kills  
✅ **Immediate feedback** - Toast notifications  
✅ **Persists across sessions** - localStorage  

🎨 **Try it now!** Refresh your page - it should load in beautiful light mode! ☀️

