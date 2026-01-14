---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0004: Output Format and Rendering

## Context and Problem Statement

agentlint analysis sessions can run 30+ minutes and produce complex outputs including findings, causal chains (tracing issues to origins), progress updates, and recommendations. Building on ADR-0003's decision to use Ink + Commander, we need to define how these outputs are rendered across different modes (terminal, JSON, Markdown) while supporting rich terminal UX, accessibility, and machine-readable formats for CI/automation.

## Decision Drivers

- **Rich Terminal UX**: User prioritized terminal experience with tree/graph visualization for causal chains
- **Streaming Support**: Long-running analysis needs real-time progress feedback
- **Causal Chain Visualization**: Must render issue → origin traces as navigable tree structures
- **Multiple Output Formats**: Support terminal (default), JSON, and Markdown
- **Accessibility**: Respect NO_COLOR, support screen readers, use ANSI 4-bit colors
- **CI/Automation**: Machine-readable output for scripting and pipelines
- **Ink Integration**: Must build on ADR-0003's Ink + Commander foundation

## Considered Options

1. Ink UI Components + Custom Causal Tree
2. Ink + ascii-tree Libraries
3. Full Custom Ink Components
4. Hybrid: Ink Interactive + Plain Static

## Decision Outcome

Chosen option: **"Ink UI Components + Custom Causal Tree"** because it balances reusing proven components (@inkjs/ui for Spinner, ProgressBar, Table, StatusMessage) with building a custom tree component specifically designed for agentlint's causal chain visualization needs. This approach maximizes development velocity while ensuring the causal trace UX—a core differentiator—is purpose-built.

**Output Formats**:
- **Terminal** (default): Rich Ink rendering with colors, progress, tree visualization
- **JSON** (`--json`): Structured output following JSON Lines for streaming, jq-compatible
- **Markdown** (`--markdown`): Formatted reports suitable for GitHub issues, documentation

### Consequences

**Good:**
- @inkjs/ui provides battle-tested Spinner, ProgressBar, Table, Badge, StatusMessage components
- Custom causal tree component can be optimized for agentlint's specific visualization needs
- React component model enables declarative composition and easy testing
- Theming support via Ink UI's ThemeProvider enables customization
- Clear separation: Ink for TTY, direct output for JSON/Markdown

**Bad:**
- Must build and maintain custom causal tree component
- Two codepaths: Ink rendering vs. JSON/Markdown formatters
- Ink UI adds dependency (~@inkjs/ui package)

**Neutral:**
- Tree component can use box-drawing characters (├──, └──, │) which are widely supported
- JSON schema will need documentation and versioning
- May need to evaluate oo-ascii-tree for tree rendering primitives

## Pros and Cons of Options

### Option 1: Ink UI Components + Custom Causal Tree

Use @inkjs/ui library for standard terminal components (Spinner, ProgressBar, Table, Badge, StatusMessage) and build a custom React component for causal chain tree visualization.

- Good: Reuses proven Ink UI components—same used by many production CLIs
- Good: Custom tree component can be purpose-built for causal chain visualization
- Good: Ink UI theming enables consistent styling and user customization
- Good: StatusMessage component perfect for findings (success, error, warning variants)
- Good: Table component handles findings lists with proper column alignment
- Neutral: Requires building one custom component (tree renderer)
- Bad: @inkjs/ui dependency adds to bundle size
- Bad: Two rendering paths to maintain (Ink vs. JSON/Markdown)

### Option 2: Ink + ascii-tree Libraries

Use Ink for layout and structure, integrate existing npm tree libraries (oo-ascii-tree, ascii-tree) for tree visualization.

- Good: Faster initial implementation—tree rendering already solved
- Good: oo-ascii-tree uses standard box-drawing characters
- Good: Lower development effort for MVP
- Neutral: May need wrapper to integrate with Ink's React model
- Bad: Less control over tree rendering appearance
- Bad: External library may not match agentlint's specific needs
- Bad: ascii-tree package is 10+ years old with minimal maintenance

### Option 3: Full Custom Ink Components

Build all output components from scratch using Ink primitives (Box, Text, etc.).

- Good: Maximum control over every aspect of rendering
- Good: No external dependencies beyond Ink core
- Good: Can optimize specifically for agentlint's use cases
- Neutral: Full ownership of all code
- Bad: Highest development effort—rebuilding solved problems
- Bad: Spinner, progress bar, table implementations are non-trivial
- Bad: Slower time to MVP

### Option 4: Hybrid: Ink Interactive + Plain Static

Use Ink only for streaming/interactive output, plain ANSI text (via chalk) for static reports.

- Good: Simpler architecture—Ink only when truly needed
- Good: Plain text is easier to test and debug
- Good: Lower Ink surface area reduces Bun compatibility risk
- Neutral: Two distinct rendering approaches
- Bad: Inconsistent UX between streaming and static modes
- Bad: Lose React component composition benefits for static output
- Bad: Manual ANSI handling for rich formatting

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All rendering happens locally; no external services |
| II. Improvement-Oriented | Yes | Baseline comparison output supports improvement cycle |
| III. Causal-First | Yes | Tree visualization directly serves causal tracing |
| IV. Mixed-Methods | Yes | Terminal (qualitative) + JSON (quantitative) outputs |
| V. Language-Agnostic | Yes | Output formats independent of analyzed project language |
| VI. Agent-Agnostic | Yes | Output structure works for any ACT analysis |
| VII. Intelligent Tooling | Yes | Rich output helps users understand agent reasoning |
| VIII. Compounding Value | Yes | Markdown export enables historical documentation |
| IX. Agent-Aware | Yes | Streaming output communicates agent progress in real-time |

## More Information

### Related Documents
- Architecture Vision: [Section 4 - High-Level Architecture](../../vision/agentlint-architecture-vision.md#4-high-level-architecture)
- Design Decisions: [DD-011](../design-decisions.md#dd-011-output-format-and-rendering)
- Prior Decisions: [ADR-0003 - CLI Framework](./0003-cli-framework-and-command-structure.md)

### Research Sources
- [CLI UX Best Practices: Progress Displays - Evil Martians](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)
- [Building a More Accessible GitHub CLI - GitHub Blog](https://github.blog/engineering/user-experience/building-a-more-accessible-github-cli/)
- [Tips on Adding JSON Output to Your CLI App - Kelly Brazil](https://blog.kellybrazil.com/2021/12/03/tips-on-adding-json-output-to-your-cli-app/)
- [Command Line Interface Guidelines](https://clig.dev/)
- [NO_COLOR Standard](https://no-color.org/)
- [Ink UI Component Library](https://github.com/vadimdemedes/ink-ui)
- [oo-ascii-tree - npm](https://www.npmjs.com/package/oo-ascii-tree)

### Implementation Notes

#### 1. Package Dependencies
```bash
bun add @inkjs/ui chalk
```

#### 2. Output Mode Detection
```typescript
// Detect output mode from flags and environment
function getOutputMode(options: CLIOptions): OutputMode {
  if (options.json) return 'json';
  if (options.markdown) return 'markdown';
  if (!process.stdout.isTTY) return 'json'; // Default to JSON for pipes
  return 'terminal';
}
```

#### 3. Terminal Output Components

**Progress Display (during analysis)**:
```tsx
import { Spinner, ProgressBar, StatusMessage } from '@inkjs/ui';

// Use Spinner for indeterminate progress
<Spinner label="Analyzing session logs..." />

// Use ProgressBar for known-length operations
<ProgressBar value={filesProcessed / totalFiles * 100} />

// Use StatusMessage for completed steps
<StatusMessage variant="success">Configuration parsed</StatusMessage>
```

**Causal Chain Tree** (custom component):
```
Issue: API key exposed in session log
├── Detected: sessions/2026-01-14.jsonl:1247
├── Origin Trace
│   ├── Session: User pasted credentials directly
│   ├── Config Gap: No credential guidance in CLAUDE.md
│   └── Root Cause: Missing security instructions
└── Recommendation: Add credential handling section to CLAUDE.md
```

**Findings Table**:
```tsx
import { Table } from '@inkjs/ui';

<Table
  data={findings}
  columns={[
    { title: 'Severity', key: 'severity' },
    { title: 'Issue', key: 'description' },
    { title: 'Origin', key: 'origin' },
  ]}
/>
```

#### 4. JSON Output Schema
```typescript
interface AgentlintOutput {
  format_version: "1.0";
  command: string;
  timestamp: string;
  findings: Finding[];
  recommendations: Recommendation[];
  metrics: Metrics;
  causal_traces: CausalTrace[];
}

interface CausalTrace {
  issue_id: string;
  issue_description: string;
  detected_at: Location;
  origin_trace: OriginNode[];
  recommendation_ids: string[];
}
```

For streaming, use JSON Lines (one object per line):
```
{"type":"progress","phase":"config","percent":25}
{"type":"finding","severity":"high","description":"..."}
{"type":"progress","phase":"sessions","percent":50}
```

#### 5. Markdown Output Structure
```markdown
# agentlint Analysis Report

**Generated**: 2026-01-14 10:30:00
**Project**: /path/to/project

## Summary
- **Findings**: 5 (2 high, 2 medium, 1 low)
- **Recommendations**: 3

## Findings

### 🔴 High: API Key Exposure
**Location**: sessions/2026-01-14.jsonl:1247

#### Causal Trace
1. **Detected**: User pasted credentials in session
2. **Config Gap**: No credential guidance in CLAUDE.md
3. **Root Cause**: Missing security instructions

#### Recommendation
Add credential handling section to CLAUDE.md
```

#### 6. Accessibility Requirements

**NO_COLOR Support**:
```typescript
const useColors = !process.env.NO_COLOR && process.stdout.isTTY;
```

**ANSI 4-bit Colors** (per GitHub CLI guidance):
- Use only the 16 ANSI colors for maximum terminal customization
- Provide sufficient contrast on both light and dark backgrounds

**Screen Reader Considerations**:
- Avoid animated spinners in non-TTY mode
- Provide text alternatives for all visual elements
- Use `--plain` flag for minimal formatting

#### 7. Flag Conventions
```
--json          Output as JSON (single object or JSON Lines for streaming)
--markdown      Output as Markdown report
--plain         Plain text output, no colors or formatting
--no-color      Disable ANSI colors (also respects NO_COLOR env)
--verbose       Include additional detail in output
```
