# Theme Toggle Fix

## What Was Wrong

### Issue 1: Missing Export
**Error**: `Export unregisterProcess doesn't exist in target module`

**Cause**: The kill process route was trying to import `unregisterProcess` from `process-manager.ts`, but it didn't exist.

**Fix**: Added the missing `unregisterProcess` function to `lib/process-manager.ts`.

### Issue 2: Theme Toggle Not Working
**Problem**: Theme toggle button appeared but clicking it didn't change the theme.

**Cause**: Two issues:
1. **Missing Tailwind Config**: No `tailwind.config.ts` file, so dark mode wasn't configured
2. **Wrong CSS Variables**: `globals.css` was using Tailwind v4 syntax but wasn't set up for class-based dark mode (next-themes uses `class="dark"`)

**Fix**: 
1. Created `tailwind.config.ts` with `darkMode: ["class"]`
2. Updated `globals.css` with proper shadcn/ui CSS variables
3. Added `.dark` class selector for dark mode styles
4. Installed `tailwindcss-animate` dependency

---

## What Changed

### Files Modified

1. **`lib/process-manager.ts`**
   - Added `unregisterProcess()` function to delete processes from the map
   
2. **`app/api/process/[id]/kill/route.ts`**
   - Fixed to use `processInfo.process.kill()` instead of `processHandle.kill()`
   
3. **`app/globals.css`**
   - Complete rewrite with proper shadcn/ui CSS variables
   - Added `:root` for light mode
   - Added `.dark` for dark mode
   - Uses HSL color format for all theme variables

4. **`tailwind.config.ts`** (NEW)
   - Created Tailwind config file
   - Enabled class-based dark mode
   - Configured all theme colors to use CSS variables
   - Added `tailwindcss-animate` plugin

---

## How It Works Now

### Theme System

```
User clicks theme toggle
  ↓
next-themes changes <html> attribute
  ↓
<html class="dark"> or <html class="light">
  ↓
CSS applies .dark selector styles
  ↓
All components update automatically
```

### Process Management

```
User clicks "Stop Process"
  ↓
API kills child process
  ↓
unregisterProcess() removes from map
  ↓
Database updated to "failed"
  ↓
UI refreshes
```

---

## Testing

### Test Theme Toggle (Should Work Now!)

1. **Refresh the page** - Should load in light mode (default)
2. **Click sun icon** (top-right) - Opens theme menu
3. **Click "Dark"** - Page should immediately turn dark
4. **Refresh page** - Should stay dark (persisted)
5. **Click moon icon** → "Light" - Back to light mode

### Test Stop Process

1. **Start a new process** from dashboard
2. **Navigate to run detail page**
3. **Click "Stop Process"** (red button)
4. **Confirm dialog**
5. **Status changes to "failed"** immediately
6. **No build errors**

---

## CSS Variables Reference

### Light Mode (`:root`)
```css
--background: 0 0% 100%;     /* White */
--foreground: 0 0% 3.9%;     /* Near black */
--primary: 0 0% 9%;          /* Dark gray */
--muted: 0 0% 96.1%;         /* Light gray */
/* ... etc */
```

### Dark Mode (`.dark`)
```css
--background: 0 0% 3.9%;     /* Near black */
--foreground: 0 0% 98%;      /* Near white */
--primary: 0 0% 98%;         /* Light */
--muted: 0 0% 14.9%;         /* Dark gray */
/* ... etc */
```

---

## Why HSL Format?

The CSS variables use HSL (Hue, Saturation, Lightness) format without the `hsl()` wrapper:

```css
/* CSS Variable */
--background: 0 0% 100%;

/* Used in Tailwind */
background: hsl(var(--background));
```

This allows Tailwind to:
- Add opacity: `bg-background/50` (50% opacity)
- Modify values dynamically
- Maintain consistency across themes

---

## Troubleshooting

### Theme still not working after refresh?

1. **Clear browser cache**:
   ```javascript
   // In browser console
   localStorage.clear()
   location.reload()
   ```

2. **Check HTML element**:
   - Open DevTools → Elements
   - Look at `<html>` tag
   - Should have `class="light"` or `class="dark"`

3. **Check CSS variables**:
   - DevTools → Elements → Select `<body>`
   - Look at Computed styles
   - Search for `--background`
   - Should show different values in light vs dark

### Stop Process error?

1. **Check console** for error messages
2. **Verify process exists** in database
3. **Refresh page** - Process might have already stopped
4. **Check if process manager has the process**:
   ```typescript
   // In API route, add logging
   console.log('Process info:', getProcess(runId))
   ```

---

## Summary

✅ **Theme toggle now works!**
- Light mode by default
- Click to switch themes
- Persists across sessions
- Proper dark mode colors

✅ **Stop Process button works!**
- No more build errors
- Kills process properly
- Updates UI immediately
- Cleans up resources

🎨 **Try it now**: Refresh and click the theme toggle! You should see an immediate visual change.

