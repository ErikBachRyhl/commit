# Commit Selector UX Improvements

## Fixed Issues

### 1. ✅ **Scrolling Enabled**
**Problem**: The commit list wasn't scrollable, making it impossible to see all commits.

**Solution**: 
- Changed `DialogContent` from `max-h-[85vh]` to `h-[85vh]` with `overflow-hidden` for fixed height
- Added `max-h-[50vh]` to the `ScrollArea` component to explicitly enable scrolling
- The commit list now properly scrolls when there are more commits than fit in the visible area

### 2. ✅ **Commit Count Restored**
**Problem**: The commit count summary was missing in the commit list view.

**Solution**:
- Added a summary box showing "Will process X commits since [SHA]" at the top of the commit list
- The count dynamically updates based on the selected commit
- Displays in a styled `bg-muted` box for better visibility

### 3. ✅ **Back Button Navigation Fixed**
**Problem**: After clicking Back, the "Since a specific commit" option stayed selected, requiring deselection and reselection to trigger the animation again.

**Solution**:
- Changed Back button behavior to reset mode to `'latest'` instead of keeping it at `'since'`
- Now clicking "Since a specific commit" always triggers the slide animation properly
- Clean state management ensures consistent UX

## Technical Details

### DialogContent Height
```tsx
<DialogContent className="max-w-2xl h-[85vh] flex flex-col overflow-hidden">
```

### ScrollArea Configuration
```tsx
<ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
  <div className="space-y-2 pr-4 pb-2">
    {/* Commit cards */}
  </div>
</ScrollArea>
```

### Commit Count Display
```tsx
{selectedCommit && (
  <div className="bg-muted p-2 rounded-lg">
    <p className="text-xs text-muted-foreground">
      {(() => {
        const index = commits.findIndex(c => c.sha === selectedCommit)
        if (index >= 0) {
          return `Will process ${index + 1} commit${index !== 0 ? 's' : ''} since ${commits[index].shortSha}`
        }
        return ''
      })()}
    </p>
  </div>
)}
```

### Back Button Reset
```tsx
<Button
  variant="outline"
  onClick={() => {
    setShowCommitList(false)
    setSelectedMode('latest') // Reset to latest instead of staying on 'since'
  }}
>
  <ArrowLeft className="h-4 w-4" />
  Back
</Button>
```

## Layout Structure

The commit list view now has a clean, fixed layout:

1. **Header** (fixed, doesn't scroll)
   - Title: "Select Starting Commit"
   - Description
   - Commit count summary (dynamic)

2. **Commit List** (scrollable area)
   - Takes up all available space
   - Max height of 50vh ensures proper scrolling
   - Shows commit cards with status badges

3. **Action Buttons** (fixed, doesn't scroll)
   - Back button (left)
   - Continue button (right)

## Testing

To test the fixes:
1. Click "Process Now" to open the commit selector
2. Select "Since a specific commit" - should smoothly slide to commit list
3. Scroll through the commit list - should see all 17+ commits
4. Click "Back" - should return to main view with "Latest commit only" selected
5. Click "Since a specific commit" again - should trigger animation properly
6. Select a commit and verify the count updates (e.g., "Will process 5 commits since 8952899")

