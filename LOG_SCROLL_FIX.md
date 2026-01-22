# Log Viewer Scroll Fix

## Problem
The Logs tab was scrolling the entire page instead of just the log content area. This made the filter controls and buttons scroll out of view when viewing many logs.

## Root Cause
The outer container didn't have `overflow-hidden` set, and the scroll container wasn't properly constrained, allowing the entire component to scroll instead of just the log text area.

## Solution

### File: `desktop/src/renderer/components/LogViewer/index.tsx`

**Changes Made:**

1. **Outer Container** - Added `overflow-hidden` to prevent page-level scrolling:
   ```tsx
   <div className="h-full flex flex-col overflow-hidden">
   ```

2. **Fixed Header** - Added `flex-shrink-0` to keep the header fixed at the top:
   ```tsx
   <div className="flex-shrink-0 border-b border-border px-4 py-2 ...">
   ```

3. **Scrollable Content Area** - Changed to `overflow-y-auto overflow-x-hidden`:
   ```tsx
   <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 font-mono text-xs">
   ```

## Behavior After Fix

✅ **Header stays fixed**: Filter controls, level selector, and buttons remain visible at the top
✅ **Only logs scroll**: The log messages area scrolls independently
✅ **Vertical scroll only**: No horizontal scrolling
✅ **No page scroll**: The entire page doesn't scroll, maintaining the layout
✅ **Auto-scroll works**: Auto-scroll to bottom still functions correctly

## Layout Structure

```
┌─────────────────────────────────────┐
│ Header (Fixed)                      │
│ [Filters] [Level] [Refresh] [Clear]│  ← Stays in place
├─────────────────────────────────────┤
│                                     │
│ Log messages (Scrollable)           │  ← Only this area scrolls
│ - Log entry 1                       │
│ - Log entry 2                       │
│ - Log entry 3                       │
│ ... (many more logs)                │
│                                     ↕  ← Scroll bar only here
│                                     │
└─────────────────────────────────────┘
```

## Testing

1. Open the desktop app
2. Navigate to the Logs tab
3. Start an evolution run to generate logs
4. Verify:
   - Header stays fixed at the top
   - Only the log content area scrolls
   - Filter controls remain accessible
   - Auto-scroll works correctly
   - No horizontal scrolling appears
   - The entire page doesn't scroll

## Related Files
- `desktop/src/renderer/components/LogViewer/index.tsx` - Main component fix
- `desktop/src/renderer/components/Dashboard/index.tsx` - Parent container (already correct with `overflow-hidden`)
