---
name: dev-verify-wiring
description: Detect unintegrated features before they become dead code. Catches the "Ink component pattern" - code that exists but isn't wired.
---

# dev.verify-wiring

> Detect unintegrated features before they become dead code.

## When to Use

Use this skill when:
- Before creating a PR (after dev.integration-check)
- After any "wire X to Y" task
- When suspicious that built code might not be connected
- As part of Phase 6 (Integration) in every epic

## Invocation

```
/dev.verify-wiring [options]
```

**Options:**
- `--scope=feature` - Check only changed files (default)
- `--scope=all` - Check entire src/ directory
- `--strict` - Fail on any warning (not just errors)

---

## Execution Steps

### Phase 1: Build Export Manifest

Identify all exports from changed files (or all src/ if --scope=all):

```bash
# For feature scope (changed files)
git diff --name-only main...HEAD | grep '\.tsx\?$' | while read file; do
  grep -E "^export (function|const|class|interface|type)" "$file"
done

# For all scope
find src/ -name "*.ts" -o -name "*.tsx" | while read file; do
  grep -E "^export (function|const|class|interface|type)" "$file"
done
```

### Phase 2: Build Import Graph

Map which files import each export:

```bash
# For each exported symbol, find imports
grep -r "import.*${symbol}" src/ --include="*.ts" --include="*.tsx"
```

### Phase 3: Trace Entry Point Paths

Entry points are the roots of the import graph:
- **CLI**: `src/cli.ts` or `program.ts`
- **Tools**: `tool-registry.ts`
- **Orchestrator**: `orchestrator.ts`
- **Commands**: `src/cli/commands/*.ts`

For each export, trace the import chain back to an entry point.
A valid path means the export is reachable from user-facing code.

**CRITICAL**: Check not just imports but **actual invocation**:
```typescript
// INSUFFICIENT: File is imported but export not used
import { InkRenderer } from './renderers';
// InkRenderer is never instantiated or called

// SUFFICIENT: Export is actually invoked
import { InkRenderer } from './renderers';
const renderer = new InkRenderer();  // Actually used
```

### Phase 4: Identify Patterns

| Pattern | Detection | Severity |
|---------|-----------|----------|
| Orphaned Export | Export with no imports in src/ | FAIL |
| Disconnected Subgraph | Group imports each other but nothing imports any | FAIL |
| Test-Only Usage | Export only imported by tests/ | WARNING |
| Wiring Task Incomplete | "Wire X to Y" but no import exists | FAIL |
| **Imported But Unused** | Import exists but export never invoked | FAIL |

**Orphaned Export:**
```
export function App() { ... }  // Never imported anywhere in src/
```

**Disconnected Subgraph:**
```
// A.tsx imports B.tsx
// B.tsx imports C.tsx
// C.tsx imports A.tsx
// Nothing outside this group imports any of them
```

**Imported But Unused (NEW):**
```typescript
// index.ts exports InkRenderer
export { InkRenderer } from './ink-renderer';

// Some file imports but never uses
import { InkRenderer } from './tui';
// InkRenderer never instantiated, called, or passed anywhere
```

---

## Phase 5: Criticality Assessment (NEW - REQUIRED)

**This phase is CRITICAL. Do not skip or defer issues without explicit justification.**

For EACH flagged issue, determine criticality by checking:

### 5.1: Epic Scope Check

Read the current epic's spec to determine if the unintegrated code is IN SCOPE:

```
specs/<current-epic>/spec.md
specs/<current-epic>/plan.md
specs/<current-epic>/tasks.md
```

**Questions to answer:**
1. Is this export listed in the epic's deliverables?
2. Does the plan reference this component being wired?
3. Are there tasks for wiring this component?

| Scope Status | Criticality |
|--------------|-------------|
| Explicitly in epic deliverables | **CRITICAL** - Must be wired before PR |
| Mentioned in plan but no wiring task | **HIGH** - Likely missing wiring task |
| Not mentioned anywhere | **MEDIUM** - May be future work or dead code |

### 5.2: Intent Verification

Read the source file's JSDoc/comments to understand intent:

```typescript
/**
 * InkRenderer - Ink-based TUI Renderer
 *
 * Used by CLI when TTY is detected for interactive mode.
 * Wired via createRenderer() in src/cli/renderers/index.ts
 */
```

**Check if:**
- Comments describe HOW it should be wired
- Comments say "for future use" (defer is valid)
- Comments say it's an internal helper (test-only may be OK)

### 5.3: Cross-Reference Linear Tasks

Check Linear for related wiring tasks:

```
mcp__linear__list_issues with label "wiring" or search "wire"
```

| Linear Status | Interpretation |
|---------------|----------------|
| Wiring task exists, status=Done | **FAIL** - Wiring incomplete despite "Done" |
| Wiring task exists, status=Todo | **HIGH** - Wiring deferred but planned |
| No wiring task exists | **HIGH** - Missing task, needs triage |

### 5.4: Assign Final Criticality

| Criticality | Criteria | Action Required |
|-------------|----------|-----------------|
| **CRITICAL** | In epic scope + should be wired per spec | Block PR, fix immediately |
| **HIGH** | In epic scope but ambiguous | Clarify with user, likely needs fix |
| **REQUIRES_USER_DECISION** | Not explicitly in scope | MUST ask user - cannot assume |

**IMPORTANT**: There is no "MEDIUM" or "LOW" that allows deferral without user input.

If code appears unintegrated and is not explicitly documented as "for future use" in the spec, you MUST ask the user:

```
WIRING DECISION REQUIRED

Export: InkRenderer in src/tui/renderers/ink-renderer.ts
Status: Built but not wired to any entry point

This export is not explicitly mentioned in the current epic spec.
I cannot determine if this is:
  A) Missing wiring that should be fixed now
  B) Intentionally deferred for a future epic

Please confirm:
  1. FIX NOW - This should be wired in this PR
  2. DEFER - This is explicitly for future work (I will create a tracking issue)
  3. REMOVE - This is dead code and should be deleted
```

**NEVER assume code is "for future use" without explicit user confirmation.**

---

## Phase 6: Deep Validation (Subagent)

**For all CRITICAL and HIGH issues, spawn a validation subagent.**

The subagent performs deep verification:

### 6.1: Subagent Prompt

```
You are verifying a potential wiring issue.

ISSUE: {export_name} in {file_path} appears unintegrated.
DETECTION: {detection_method}
INITIAL_CRITICALITY: {criticality}

Your task:
1. Read the source file to understand what the export does
2. Read the epic spec (specs/{epic}/spec.md, plan.md, tasks.md)
3. Search for any usage patterns that might have been missed
4. Check if there are conditional code paths that use this export
5. Determine if this is truly unintegrated or a false positive

CRITICAL RULES:
- You CANNOT decide something is "for future use" on your own
- You CANNOT assume code is scaffolding or utility that's OK to skip
- If you cannot PROVE it's wired or PROVE it's in epic scope, return REQUIRES_USER_DECISION

Report (choose ONE):
- VERIFIED_CRITICAL: Unintegrated AND explicitly in epic scope - must fix
- VERIFIED_HIGH: Unintegrated, likely should be in scope - should fix
- FALSE_POSITIVE: Actually wired via {specific_code_path}
- REQUIRES_USER_DECISION: Cannot determine - user must decide

You MUST NOT return any "deferred" or "medium" status. If unsure, return REQUIRES_USER_DECISION.
```

### 6.2: Subagent Checks

The subagent MUST check:

1. **Conditional Paths**: Is the export used in an if/switch branch?
   ```typescript
   if (mode === 'interactive') {
     return new InkRenderer();  // Might be missed by static analysis
   }
   ```

2. **Factory Functions**: Is it created dynamically?
   ```typescript
   const renderers = { ink: InkRenderer, headless: HeadlessRenderer };
   return new renderers[mode]();
   ```

3. **Re-exports**: Is it exported for external consumers?
   ```typescript
   // index.ts
   export { InkRenderer } from './ink-renderer';
   // Even if not used internally, may be public API
   ```

4. **Spec Alignment**: Does the spec say this should work?
   ```markdown
   ## Deliverables
   - InkRenderer wired to CLI via TTY detection
   ```
   If spec says it should be wired but it isn't → CRITICAL

### 6.3: Subagent Verdict

The subagent returns one of:
- `VERIFIED_CRITICAL`: Confirmed unintegrated, in epic scope, blocks PR
- `VERIFIED_HIGH`: Confirmed issue, should fix before PR
- `FALSE_POSITIVE`: Actually integrated, detection was wrong
- `REQUIRES_USER_DECISION`: Cannot determine scope/intent, MUST ask user

**IMPORTANT**: There is no "MEDIUM" or "DEFERRED" option that allows the agent to skip issues without user input.

If the subagent cannot definitively prove:
1. The export is actually wired (FALSE_POSITIVE), OR
2. The export is explicitly in epic scope (CRITICAL/HIGH)

Then it MUST return `REQUIRES_USER_DECISION` and the skill MUST ask the user before proceeding.

---

## Phase 7: Generate Report

```markdown
## Wiring Verification Report

| Category | Count | Status |
|----------|-------|--------|
| Exports Analyzed | 50 | - |
| Fully Integrated | 35 | PASS |
| Test-Only | 12 | WARNING |
| NOT INTEGRATED | 3 | FAIL |

### Criticality Summary

| Criticality | Count | Blocking? |
|-------------|-------|-----------|
| CRITICAL | 1 | YES - Must fix |
| HIGH | 2 | YES - Should fix |
| REQUIRES_USER_DECISION | 1 | YES - Cannot proceed without user input |
| FALSE_POSITIVE | 1 | NO - Resolved |

### CRITICAL: Must Fix Before PR

#### src/tui/renderers/ink-renderer.ts
- **Export**: `InkRenderer` (class)
- **Detection**: Orphaned - only imported by index.ts re-export
- **Epic Scope**: YES - EP17 spec says "InkRenderer wired to CLI"
- **Linear Task**: T045 "Wire TUI to CLI" marked Done
- **Subagent Verdict**: VERIFIED_CRITICAL
  - Checked createRenderer() - always returns HeadlessRenderer
  - Spec explicitly requires TTY detection to use InkRenderer
  - This is the "Ink component pattern" - code exists but isn't wired
- **Fix**: Modify createRenderer() to check TTY and instantiate InkRenderer

#### src/tui/components/Progress.tsx
- **Export**: `Progress` (React Component)
- **Detection**: Disconnected subgraph with App.tsx, FindingsList.tsx
- **Epic Scope**: YES - EP17 deliverable
- **Subagent Verdict**: VERIFIED_CRITICAL
  - App.tsx imports Progress but App.tsx itself is never used
  - Entry point trace fails: analyse.ts → createRenderer → HeadlessRenderer (not InkRenderer)
- **Fix**: Wire InkRenderer first, then Progress will be reachable

### HIGH: Should Fix Before PR

#### src/tui/permissions/tui-permission-handler.ts
- **Export**: `TuiPermissionHandler` (class)
- **Detection**: Test-only usage
- **Epic Scope**: YES - EP17 deliverable for TUI permission dialogs
- **Subagent Verdict**: VERIFIED_HIGH
  - Only imported by tests and by index.ts re-export
  - Orchestrator uses readline-based handler instead
  - Should be wired to orchestrator when TUI mode is active
- **Fix**: Add canUseTool config option, wire TuiPermissionHandler

### REQUIRES USER DECISION (Cannot proceed without input)

#### src/tui/utils/helpers.ts
- **Export**: `formatDuration` (function)
- **Detection**: Only imported by tests
- **Epic Scope**: NOT MENTIONED in spec
- **Subagent Verdict**: REQUIRES_USER_DECISION
  - Cannot determine if this is:
    A) A utility that should be wired to Progress component
    B) A test helper that's correctly test-only
    C) Dead code that should be removed
- **User must choose**:
  1. FIX NOW - Wire to Progress.tsx
  2. DEFER - Create tracking issue
  3. REMOVE - Delete as unused

### Resolved: False Positives

#### src/tui/utils/tty.ts
- **Export**: `determineRenderMode` (function)
- **Detection**: Appeared orphaned
- **Subagent Verdict**: FALSE_POSITIVE
  - PROOF: Used in createRenderer() at line 63 in conditional branch
  - Was checking wrong import path initially
- **Resolution**: Actually wired, no action needed
```

---

## Detection Details

### Orphaned Export Detection

```bash
# Find all exports
exports=$(grep -rn "^export " src/ --include="*.ts" | grep -v "\.d\.ts")

# For each export, check if imported
for exp in $exports; do
  file=$(echo "$exp" | cut -d: -f1)
  symbol=$(echo "$exp" | grep -oP "export (function|const|class) \K\w+")

  # Check for imports (excluding the file itself)
  imports=$(grep -r "import.*$symbol" src/ --include="*.ts" | grep -v "$file")

  if [ -z "$imports" ]; then
    echo "ORPHANED: $symbol in $file"
  fi
done
```

### Invocation Check (NEW)

For each imported symbol, verify it's actually used:

```bash
# Check if symbol is invoked (not just imported)
grep -E "(new ${symbol}|${symbol}\(|${symbol}\.)" "$importing_file"
```

### Disconnected Subgraph Detection

1. Build directed graph: file → files it imports
2. Find strongly connected components (SCCs)
3. Check if any SCC has no incoming edges from outside the SCC
4. Report disconnected SCCs as failures

### Entry Point Path Tracing

```
Entry points:
  - src/cli.ts
  - src/cli/commands/*.ts (all command files)
  - src/orchestration/tool-registry.ts
  - src/orchestration/orchestrator.ts

For each export:
  1. Find all files that import it
  2. For each importing file, recursively find its importers
  3. Stop when reaching an entry point (PASS) or exhausting graph (FAIL)
  4. If PASS, verify the import is actually INVOKED (not just imported)
```

---

## Anti-Patterns to Catch

### The "Ink Component Pattern"

Components are built but never wired to the command that should use them:

```
src/tui/components/App.tsx      ← Built
src/tui/components/Progress.tsx  ← Built
src/tui/renderers/ink-renderer.ts ← Built
src/cli/commands/analyse.ts      ← Uses HeadlessRenderer only!
```

**Detection**: Trace from analyse.ts → createRenderer() → HeadlessRenderer
**Miss**: InkRenderer exists but is never in the execution path

### The "Index Re-export Illusion"

A module's index.ts re-exports everything, creating false impression of usage:

```typescript
// src/tui/index.ts
export { InkRenderer } from './renderers/ink-renderer';
export { HeadlessRenderer } from './renderers/headless-renderer';

// Somewhere else
import { HeadlessRenderer } from './tui';
// InkRenderer is NOT imported, but appears "used" because index.ts imports it
```

**Detection**: Check actual imports at use sites, not just index.ts

### The "Future Feature Excuse" (NEVER ACCEPT WITHOUT USER CONFIRMATION)

Code flagged as unintegrated is dismissed as "for a future feature":

```
"This will be wired when we implement interactive mode"
→ But the epic deliverables SAY interactive mode should work NOW
```

**CRITICAL RULE**: You CANNOT decide that code is "for future use" on your own.

Even if:
- The code looks like a utility that might be used later
- The component seems like scaffolding for future features
- You think it's obvious this isn't needed yet

You MUST still ask the user. The pattern of "I'll assume this is for later" is exactly how EP17's TUI wiring was missed.

**Detection**: Cross-reference with spec. If not explicitly in scope, ASK THE USER.

---

## Integration with Other Skills

| Skill | Relationship |
|-------|--------------|
| `/dev.integration-check` | Phase 3.5 calls this verification |
| `/dev.implement-epic` | Step 6.5 performs per-task wiring check |
| `/dev.testing` | Suggests wiring tests for integration |

---

## Output

On completion:
```
Wiring verification complete!

  Scope:     feature (12 changed files)
  Exports:   45 total

  Results:
    Integrated:     40 (89%)
    Test-Only:       2 (4%)  [WARNING]
    Unintegrated:    3 (7%)  [FAIL]

  Criticality Breakdown:
    CRITICAL:            1 (blocks PR - must fix)
    HIGH:                2 (should fix before PR)
    REQUIRES_DECISION:   1 (BLOCKED - needs user input)
    FALSE_POSITIVE:      1 (resolved)

  Status: BLOCKED (1 requires user decision)

  CRITICAL (must fix):
    - src/tui/renderers/ink-renderer.ts: InkRenderer
      Epic: EP17 | Linear: T045 (marked Done but not wired)
      → Fix: Wire to createRenderer() with TTY detection

  HIGH (should fix):
    - src/tui/permissions/tui-permission-handler.ts: TuiPermissionHandler
      Epic: EP17 | Linear: not found
      → Fix: Wire to orchestrator canUseTool

  REQUIRES USER DECISION:
    - src/tui/utils/someHelper.ts: helperFunction
      Status: Built but not used in any code path
      Not mentioned in epic spec - cannot determine intent

      Please choose:
        1. FIX NOW - Wire this in current PR
        2. DEFER - Create tracking issue for future epic
        3. REMOVE - Delete as dead code

Cannot proceed to PR until user decisions are made.
```

---

## Key Principle: Assume Issues Are Real, Require User Decisions

**DEFAULT ASSUMPTION**: If code appears unintegrated, it IS unintegrated and MUST be fixed.

**FORBIDDEN ASSUMPTIONS** (you CANNOT make these on your own):
- "This will be used later" → ASK USER
- "It's just a hook/utility" → ASK USER
- "The component tree will use it" → VERIFY THE PATH
- "This is scaffolding for future work" → ASK USER
- "This looks like it's meant for a different feature" → ASK USER

**The only valid reasons to NOT fix an unintegrated export:**
1. User explicitly says "defer this to future epic X"
2. Spec explicitly documents it as "for future implementation"
3. Subagent verification proves it's a false positive (actually wired)

The subagent validation exists to CONFIRM issues, not to find excuses to ignore them.

**If in doubt, ASK THE USER. Never silently defer.**

---

## Constitution Alignment

This skill supports:
- **III. Causal-First**: Traces integration failures to missing wiring
- **V. Debuggable**: Clear report of what's connected and what isn't
- **VII. Consistent**: Standardized wiring verification across all features
- **IX. Agent-Aware**: Catches the cognitive gap between "code exists" and "code runs"

---

## Handoff

After running this skill:
- If CRITICAL issues: Stop, fix them, re-run
- If HIGH issues: Fix before PR unless explicitly deferred by user
- If REQUIRES_USER_DECISION: STOP and ask user - cannot proceed without their input
- If WARNING (test-only): Document in PR, but still confirm with user if large
- If all PASS: Proceed to `/dev.pr`

**BLOCKING REQUIREMENT**: Any issue that requires user decision MUST be resolved before proceeding. Do not silently skip or defer.
