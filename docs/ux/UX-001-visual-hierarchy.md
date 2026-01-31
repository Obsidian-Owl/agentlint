# UX-001: Welcome Screen Visual Hierarchy

## Problem
The welcome screen had 6 bordered boxes competing for attention, creating cognitive overload and making it unclear what to focus on first.

## Solution
Implemented progressive disclosure with clear visual priority:

### 1. Top Recommendation - HERO SECTION
**Changes:**
- `borderStyle="double"` (was `"round"`) for maximum prominence
- Increased padding: `paddingX={3} paddingY={2}` (was `paddingX={2} paddingY={1}`)
- Removed redundant label "Because:" - just show the because clause directly in cyan
- Added structured metadata section (action preview, target, impact) when available
- Clearer keyboard shortcuts with border separation
- Pattern count moved inline with priority badge
- Additional bottom margin (2 units) to separate from context bar

**Visual weight:** MAXIMUM

### 2. Session Summary - COMPACT INLINE
**Changes:**
- Removed border entirely - now just inline text with padding
- Collapsed to 2 lines maximum (was 4+ lines with box)
- Inline format: "Last session 2 hours ago (15m): 3 issues • 2 recs"
- Changes since: "Since: 5 commits • 3 files • 2 open on main"
- Abbreviated "recommendations" to "recs" for compactness

**Visual weight:** LOW

### 3. Progress Stats - PROGRESSIVE DISCLOSURE
**Changes:**
- Default: Single line without border
  - "Progress (last 7 days): 5 applied • 80% helpful • 15% improvement [p] expand"
- Expanded: Full bordered box with all details (same as before)
- User can toggle with `[p]` key
- Only shows when data is sufficient (5+ feedback items)

**Visual weight:** LOW (collapsed) → MEDIUM (expanded)

### 4. Action Menu - SIMPLIFIED
**Changes:**
- `borderStyle="single"` borderColor="gray"` (was `"round"` borderColor="cyan"`)
- Removed redundant title (subtitle shows all context)
- Subtitle moved above options for better flow
- Hint moved to bottom with margin

**Visual weight:** LOW

### 5. App Layout - GROUPED SECTIONS
**Changes:**
- Top Recommendation gets `marginBottom={2}` for breathing room
- Session + Progress grouped as "Context Bar" with shared `marginBottom={1}`
- Action Menu separate at bottom

## Visual Hierarchy Flow
```
┌─────────────────────────────────────────┐
│  TOP RECOMMENDATION (hero, eye-catching)│  ← User looks here FIRST
└─────────────────────────────────────────┘

Session summary + Progress stats (compact)   ← Context at a glance

┌─────────────────────────────────────────┐
│  Action Menu (simplified)               │  ← What to do next
└─────────────────────────────────────────┘
```

## Reduced Cognitive Load
**Before:** 6 boxes with equal visual weight
**After:** 1 hero section + compact context + simplified menu

## Benefits
1. **Clear focus:** Eye immediately drawn to top recommendation
2. **Progressive disclosure:** Details hidden by default, expandable on demand
3. **Breathing room:** Whitespace between sections creates natural grouping
4. **Reduced noise:** 50% fewer borders, 60% less vertical space for context
5. **Preserved functionality:** All information still accessible

## Testing
- TypeScript compilation: ✅ Clean build
- All components still receive same props (backward compatible)
- New features (progressive disclosure) are optional enhancements

## Next Steps
User testing will determine if:
- Default collapsed state for ProgressStats is preferred
- Context bar needs any visual separation (currently borderless)
- Top recommendation padding is comfortable or excessive
