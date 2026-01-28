# Quickstart: CLI Interface & Commands

> **Epic**: EP04
> **Created**: 2026-01-16
> **Author**: Claude

---

## Installation

agentlint is a CLI tool that runs locally. After building:

```bash
# Install globally via npm/bun
bun link

# Or run directly
bun run dist/cli.js
```

---

## Basic Usage

### Discover AI Configurations

```bash
# Scan current directory for AI configuration files
agentlint scan

# Scan a specific directory
agentlint scan --directory /path/to/project
```

**Output**:

```
Found 2 AI configuration files:

  📄 CLAUDE.md
     Type: claude-code
     Path: ./CLAUDE.md

  📄 .cursorrules
     Type: cursor
     Path: ./.cursorrules
```

### Run Analysis

```bash
# Run full analysis (config + sessions)
agentlint analyse

# Analyze configuration only
agentlint analyse --config-only

# Analyze sessions only
agentlint analyse --sessions-only
```

**Output** (streaming):

```
⠋ Initializing analysis...
⠋ Analyzing configuration...
  ✓ CLAUDE.md parsed (1,247 lines)
⠋ Analyzing sessions...
  🔴 Critical: API key exposed in session log
  🟡 Medium: Missing error handling guidance
⠋ Generating recommendations...

Analysis Complete

  Findings: 5 (1 critical, 0 high, 2 medium, 1 low, 1 info)
  Duration: 12.3s

  Run `agentlint trace <finding-id>` to investigate a finding
```

### Create Baseline

```bash
# Capture current state as baseline
agentlint baseline

# With label for easy reference
agentlint baseline --label "before-refactor"

# With notes
agentlint baseline --label "v1.0" --notes "Initial baseline for v1.0 release"
```

### Compare Against Baseline

```bash
# Compare against latest baseline
agentlint compare

# Compare against specific baseline
agentlint compare --baseline "before-refactor"
```

**Output**:

```
Comparing against baseline: before-refactor (2026-01-15)

  Status: ✅ Improved

  Findings:
    Total:    5 → 3  (↓ 2)
    Critical: 1 → 0  (↓ 1)
    High:     0 → 0  (—)
    Medium:   2 → 1  (↓ 1)
    Low:      1 → 1  (—)
    Info:     1 → 1  (—)

  Resolved (2):
    - F001: API key exposed in session log
    - F003: Missing error handling guidance

  New (0):
    (none)
```

### Trace Issue to Origin

```bash
# Trace a specific finding
agentlint trace F001
```

**Output**:

```
Issue: API key exposed in session log
├── Detected: sessions/2026-01-14.jsonl:1247
├── Origin Trace
│   ├── Session: User pasted credentials directly
│   ├── Config Gap: No credential guidance in CLAUDE.md
│   └── Root Cause: Missing security instructions
└── Recommendation: Add credential handling section to CLAUDE.md

Recommendation Details:
  Type: Preventive
  Action: Add a "Handling Credentials" section to CLAUDE.md
  Priority: High
  Effort: Small
```

### Manage Learnings

```bash
# List stored learnings
agentlint learn list

# Filter by category
agentlint learn list --category patterns

# Add a new learning
agentlint learn add \
  --title "Use streaming for long operations" \
  --content "Always use streaming output for operations > 5s" \
  --category patterns

# Promote learning to global scope
agentlint learn promote L001
```

---

## Output Formats

### Terminal (Default)

Rich terminal output with colors, progress indicators, and tree visualization.

```bash
agentlint analyse
```

### JSON

Machine-readable JSON output for CI/CD integration.

```bash
# Single JSON object
agentlint analyse --json

# Pipe to jq
agentlint analyse --json | jq '.findings[]'
```

**JSON Output**:

```json
{
  "format_version": "1.0",
  "command": "analyse",
  "timestamp": "2026-01-16T10:30:00Z",
  "success": true,
  "findings": [...],
  "metrics": {
    "findingsCount": 5,
    "criticalCount": 1,
    "highCount": 0,
    "mediumCount": 2,
    "lowCount": 1,
    "infoCount": 1
  }
}
```

### Markdown

Formatted reports for documentation or GitHub issues.

```bash
# Output as Markdown
agentlint analyse --markdown > report.md
```

### Plain

Minimal text output without colors (for logging or accessibility).

```bash
# Plain text output
agentlint analyse --plain

# Also triggered by NO_COLOR environment variable
NO_COLOR=1 agentlint analyse
```

---

## Common Patterns

### CI/CD Integration

```bash
# Fail build if findings present
agentlint analyse --json --fail-on-findings

# Capture report as artifact
agentlint analyse --markdown > analysis-report.md
```

**GitHub Actions Example**:

```yaml
- name: Run agentlint
  run: |
    agentlint analyse --json --fail-on-findings
  continue-on-error: false
```

### Piped Output

When stdout is not a TTY (piped), JSON format is used automatically:

```bash
# Automatically outputs JSON when piped
agentlint analyse | jq '.findings | length'
```

### Verbose Mode

See detailed tool invocations and timing:

```bash
agentlint analyse --verbose
```

**Verbose Output**:

```
Starting analysis: Analyze my CLAUDE.md
> Calling: readFile(CLAUDE.md)
  readFile completed (23ms)
> Calling: parseConfig(...)
  parseConfig completed (156ms)
  Finding detected: F001 (critical)
...
```

---

## Help & Version

```bash
# Show all commands
agentlint --help

# Show help for specific command
agentlint analyse --help

# Show version
agentlint --version
```

---

## Exit Codes

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| 0    | Success (even if findings present)         |
| 1    | Error occurred                             |
| 1    | Findings present (with --fail-on-findings) |

---

## Environment Variables

| Variable           | Effect                                       |
| ------------------ | -------------------------------------------- |
| `NO_COLOR`         | Disable colors (accessibility)               |
| `OPENCODE_API_KEY` | API key for analysis (delegated to Opencode) |

---

## Configuration

Global configuration is stored at `~/.agentlint/config.json`:

```json
{
  "model": "claude-sonnet-4-20250514",
  "checkpoint": {
    "intervalMs": 60000
  },
  "verbosity": "normal"
}
```
