# UI Improvements: Dialog Spacing & Settings Styling

## ✅ Fixed Issues

### 1. **Dialog Height & Spacing**
**Problem**: The commit selector dialog was awkwardly tall with too much whitespace on full-screen displays.

**Solution**:
- Changed from fixed `h-[85vh]` to `max-h-[85vh]` to allow natural sizing
- Removed `flex-1 min-h-0` from main view content to prevent forced expansion
- Changed main view from `ScrollArea` wrapper to simple `div` since it doesn't need scrolling
- Main view now auto-sizes based on content, eliminating excessive whitespace
- Commit list view still uses proper flex layout with `ScrollArea` for scrolling

**Before**:
```tsx
<DialogContent className="max-w-2xl h-[85vh] flex flex-col overflow-hidden">
  <motion.div className="flex-1 min-h-0">
    <ScrollArea className="h-full pr-4">
      <div className="space-y-4">
```

**After**:
```tsx
<DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
  <motion.div className="flex-shrink-0">
    <div className="space-y-4">
```

### 2. **Settings Panel Styling**
**Problem**: Sync and Developer tabs used old blue highlight styling (`border-blue-500`, `bg-blue-50`) that didn't look good in light mode.

**Solution**:
- Replaced all blue-styled info panels with the new muted design
- Updated both "AnkiConnect Setup" (Sync tab) and "Developer Mode Active" (Developer tab)
- Uses consistent styling: `border border-border bg-muted p-3 rounded-lg`
- All text uses `text-muted-foreground` for proper theme adaptation

**Before**:
```tsx
<div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-r-lg">
  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
```

**After**:
```tsx
<div className="border border-border bg-muted p-3 rounded-lg">
  <AlertCircle className="h-4 w-4 text-muted-foreground" />
  <p className="text-sm font-semibold">
```

## Updated Components

1. **`web/components/commit-selector.tsx`**
   - Dialog height changed from fixed to max-height
   - Main view content simplified to auto-size naturally
   - Commit list view maintains proper scrolling behavior

2. **`web/components/settings-content.tsx`**
   - Sync tab: AnkiConnect Setup panel updated
   - Developer tab: Developer Mode Active panel updated
   - Both now use consistent muted styling

## Result

- ✅ Dialog now has natural height without excessive whitespace
- ✅ All info panels use consistent, theme-adaptive muted styling
- ✅ Better visual consistency across the application
- ✅ Improved light/dark mode compatibility

