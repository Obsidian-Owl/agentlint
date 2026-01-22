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

For each export, trace the import chain back to an entry point.
A valid path means the export is reachable from user-facing code.

### Phase 4: Identify Patterns

| Pattern | Detection | Severity |
|---------|-----------|----------|
| Orphaned Export | Export with no imports in src/ | FAIL |
| Disconnected Subgraph | Group imports each other but nothing imports any | FAIL |
| Test-Only Usage | Export only imported by tests/ | WARNING |
| Wiring Task Incomplete | "Wire X to Y" but no import exists | FAIL |

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

**Test-Only Usage:**
```
export function helperFn() { ... }
// Only imported by tests/unit/helper.test.ts
```

### Phase 5: Generate Report

```markdown
## Wiring Verification Report

| Category | Count | Status |
|----------|-------|--------|
| Exports Analyzed | 50 | - |
| Fully Integrated | 35 | PASS |
| Test-Only | 12 | WARNING |
| NOT INTEGRATED | 3 | FAIL |

### Critical: Unintegrated Exports (MUST FIX)

#### src/cli/components/App.tsx
- **Export**: `App` (React Component)
- **Imported By**: NONE
- **Fix**: Wire to analyse command or remove

#### src/cli/components/Progress.tsx
- **Export**: `Progress` (React Component)
- **Imported By**: App.tsx (which is itself unintegrated)
- **Fix**: Wire App.tsx first, then Progress will be integrated

#### src/cli/components/FindingsList.tsx
- **Export**: `FindingsList` (React Component)
- **Imported By**: App.tsx (which is itself unintegrated)
- **Fix**: Wire App.tsx first

### Warnings: Test-Only Exports

These exports are only used by tests. Consider if they should be:
1. Exposed as public API (add to index.ts)
2. Made private (remove export)
3. Left as-is (test utilities)

- `src/utils/test-helpers.ts`: `createMockConfig()` - Test utility, OK
- `src/parsers/internal.ts`: `parseRaw()` - Consider making private
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

### Disconnected Subgraph Detection

1. Build directed graph: file → files it imports
2. Find strongly connected components (SCCs)
3. Check if any SCC has no incoming edges from outside the SCC
4. Report disconnected SCCs as failures

### Entry Point Path Tracing

```
Entry points:
  - src/cli.ts
  - src/orchestration/tool-registry.ts
  - src/orchestration/orchestrator.ts

For each export:
  1. Find all files that import it
  2. For each importing file, recursively find its importers
  3. Stop when reaching an entry point (PASS) or exhausting graph (FAIL)
```

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
    Integrated:     42 (93%)
    Test-Only:       2 (4%) [WARNING]
    Unintegrated:    1 (2%) [FAIL]

  Status: FAIL (1 unintegrated export)

  Unintegrated:
    - src/cli/components/NewFeature.tsx: NewFeature
      → Fix: Import in src/cli/commands/analyse.ts

Run with --strict to fail on test-only warnings.
```

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
- If PASS: Proceed to `/dev.pr`
- If FAIL: Fix unintegrated exports, then re-run
- If WARNINGS: Review test-only exports, decide if intentional
