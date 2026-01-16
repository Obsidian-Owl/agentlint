# Data Model: CLI Interface & Commands

> **Epic**: EP04
> **Created**: 2026-01-16
> **Author**: Claude

---

## Overview

The CLI layer primarily consumes types from EP02 (Orchestration) and EP03 (Persistence). This document defines CLI-specific entities for command parsing, output formatting, and UI state management.

---

## Entities

### Command

Represents a CLI command registered with Commander.js.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Command name (e.g., "analyse") |
| description | string | Yes | Help text description |
| options | CommandOption[] | No | Available flags/options |
| arguments | CommandArgument[] | No | Positional arguments |
| action | Function | Yes | Handler function |
| subcommands | Command[] | No | Nested subcommands (e.g., learn list) |

**Relationships**:
- `Command` --1:N--> `CommandOption`
- `Command` --1:N--> `CommandArgument`
- `Command` --1:N--> `Command` (subcommands)

### CommandOption

A flag or option for a command.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| flags | string | Yes | Option flags (e.g., "-j, --json") |
| description | string | Yes | Help text |
| defaultValue | unknown | No | Default value if not provided |
| required | boolean | No | Whether option is required |
| choices | string[] | No | Valid values for option |

### CommandArgument

A positional argument for a command.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Argument name |
| description | string | Yes | Help text |
| required | boolean | Yes | Whether argument is required |
| defaultValue | unknown | No | Default value |

---

### OutputFormat

Rendering mode for results.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| mode | "terminal" \| "json" \| "markdown" \| "plain" | Yes | Output mode |
| isTTY | boolean | Yes | Whether stdout is a TTY |
| supportsColor | boolean | Yes | Whether colors are supported |
| terminalWidth | number | Yes | Terminal width in columns |

**Detection Logic**:
```
terminal: isTTY && !options.json && !options.markdown && !options.plain
json: options.json || !isTTY
markdown: options.markdown
plain: options.plain || process.env.NO_COLOR
```

---

### ProgressState

Current analysis progress for UI display.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phase | string | Yes | Current analysis phase |
| phaseIndex | number | Yes | Index of current phase (0-based) |
| totalPhases | number | Yes | Total number of phases |
| percent | number | No | Progress percentage (0-100) |
| message | string | Yes | Current status message |
| startedAt | string | Yes | ISO-8601 start timestamp |
| elapsedMs | number | Yes | Elapsed time in milliseconds |

**Phases** (typical analysis):
1. `init` - Initializing session
2. `config` - Analyzing configuration
3. `sessions` - Analyzing session logs
4. `synthesis` - Synthesizing findings
5. `recommendations` - Generating recommendations
6. `complete` - Analysis complete

---

### CausalTree

Tree structure for trace visualization.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issue | CausalNode | Yes | Root issue node |
| originChain | CausalNode[] | Yes | Chain of origin nodes |
| recommendation | CausalNode | Yes | Final recommendation node |

### CausalNode

A node in the causal chain tree.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | Yes | Node type label (e.g., "Detected", "Origin") |
| content | string | Yes | Node content/description |
| children | CausalNode[] | No | Child nodes |
| metadata | Record<string, unknown> | No | Additional data |

**Example Structure**:
```
CausalTree {
  issue: { label: "Issue", content: "API key exposed" }
  originChain: [
    { label: "Detected", content: "sessions/2026-01-14.jsonl:1247" },
    { label: "Session", content: "User pasted credentials" },
    { label: "Config Gap", content: "No credential guidance" },
    { label: "Root Cause", content: "Missing security instructions" }
  ]
  recommendation: { label: "Recommendation", content: "Add credential handling section" }
}
```

---

### FindingDisplay

Formatted finding for terminal display (extends Finding from EP02).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Finding UUID |
| severity | Severity | Yes | Severity level |
| severityIcon | string | Yes | Emoji/icon for severity (🔴, 🟡, 🟢) |
| severityColor | string | Yes | ANSI color name |
| title | string | Yes | Short description |
| description | string | Yes | Full description |
| locationString | string | No | Formatted location (file:line) |
| truncatedDescription | string | No | Truncated for narrow terminals |

**Severity Mapping**:
| Severity | Icon | Color |
|----------|------|-------|
| critical | 🔴 | red |
| high | 🟠 | yellow |
| medium | 🟡 | cyan |
| low | 🔵 | blue |
| info | ⚪ | default |

---

### ComparisonResult

Result of baseline comparison for display.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| baseline | BaselineSummary | Yes | Reference baseline |
| current | BaselineMetrics | Yes | Current metrics |
| delta | DeltaMetrics | Yes | Difference metrics |
| newFindings | Finding[] | Yes | Findings not in baseline |
| resolvedFindings | Finding[] | Yes | Findings in baseline but not current |
| status | "improved" \| "regressed" \| "unchanged" | Yes | Overall status |

### DeltaMetrics

Change in metrics between baseline and current.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| findingsCount | number | Yes | Change in total findings (+/-) |
| criticalCount | number | Yes | Change in critical findings |
| highCount | number | Yes | Change in high findings |
| mediumCount | number | Yes | Change in medium findings |
| lowCount | number | Yes | Change in low findings |
| infoCount | number | Yes | Change in info findings |

---

### JSONOutput

Schema for JSON output format.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| format_version | "1.0" | Yes | Output format version |
| command | string | Yes | Command that was run |
| timestamp | string | Yes | ISO-8601 execution timestamp |
| success | boolean | Yes | Whether command succeeded |
| error | string | No | Error message if failed |
| findings | Finding[] | No | Analysis findings |
| recommendations | Recommendation[] | No | Generated recommendations |
| metrics | BaselineMetrics | No | Aggregated metrics |
| causal_traces | CausalTrace[] | No | Causal chain traces |

### JSONStreamLine

Single line in JSON Lines streaming output.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | "progress" \| "finding" \| "error" \| "complete" | Yes | Line type |
| timestamp | string | Yes | ISO-8601 timestamp |
| data | unknown | Yes | Type-specific payload |

**Type-specific payloads**:
```typescript
// type: "progress"
{ phase: string; percent?: number; message: string }

// type: "finding"
Finding

// type: "error"
{ message: string; code?: string }

// type: "complete"
{ findingsCount: number; duration: number; metrics: BaselineMetrics }
```

---

### CLIConfig

Configuration for CLI behavior.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| outputFormat | OutputFormat | Yes | Current output format |
| verbosity | VerbosityLevel | Yes | Output verbosity |
| failOnFindings | boolean | Yes | Exit 1 if findings present |
| cwd | string | Yes | Working directory |
| colors | boolean | Yes | Whether to use colors |

---

## Entity Relationships

```
Command --1:N--> CommandOption
Command --1:N--> CommandArgument
Command --1:N--> Command (subcommands)

CLIConfig --1:1--> OutputFormat
CLIConfig --uses--> VerbosityLevel (from EP02)

ProgressState --reflects--> SessionState (from EP02)
FindingDisplay --extends--> Finding (from EP02)
ComparisonResult --uses--> BaselineSummary (from EP03)
ComparisonResult --uses--> BaselineMetrics (from EP03)

CausalTree --1:N--> CausalNode
CausalNode --1:N--> CausalNode (children)
```

---

## State Transitions

### ProgressState Phases

```
init ──► config ──► sessions ──► synthesis ──► recommendations ──► complete
  │         │          │            │              │
  └─────────┴──────────┴────────────┴──────────────┴─────► error (any phase)
```

### OutputFormat Detection

```
CLI Start
    │
    ▼
Check --json flag ──yes──► json
    │no
    ▼
Check --markdown flag ──yes──► markdown
    │no
    ▼
Check --plain flag ──yes──► plain
    │no
    ▼
Check isTTY ──no──► json (pipe detected)
    │yes
    ▼
Check NO_COLOR ──yes──► plain
    │no
    ▼
terminal (rich Ink rendering)
```

---

## Validation Rules

### Command Validation
- Command names must be lowercase alphanumeric with hyphens
- Options must have at least short or long flag
- Required arguments cannot have default values

### Output Validation
- JSON output must be valid JSON (parseable by jq)
- Markdown output must be valid CommonMark
- Terminal output must respect terminal width

### Finding Display
- Truncate descriptions at terminal width - 20 characters
- Always show full description in JSON/Markdown modes
