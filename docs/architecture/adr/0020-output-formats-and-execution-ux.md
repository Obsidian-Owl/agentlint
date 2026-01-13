---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0020: Output Formats and Execution UX

## Context and Problem Statement

agentlint needs a comprehensive output and execution UX strategy that addresses multiple contexts:

1. **Interactive Terminal**: Users running analysis directly, expecting rich feedback
2. **Scriptable Automation**: CI/CD pipelines and scripts needing machine-readable output
3. **MCP Integration**: AI assistants (Claude Code, etc.) invoking agentlint as a tool
4. **Background Execution**: Long-running analysis that can be backgrounded

The challenge: Analysis runs concurrently (static + agentic per ADR-0011, ADR-0019), takes variable time (deep research pattern), and produces both structured metrics and conversational insights. The UX must handle all these gracefully.

The CTO specified: "Think about patterns for how the AI agent's internal response stream varies from the detailed output to users. The terminal streaming response and the final report can be different UX approaches."

## Decision Drivers

- **Compounding Value principle**: Results improve with historical context from previous analyses
- **Agent-Aware principle**: AX/UX separation—agent sees compressed context, users see rich reports
- **Graceful degradation**: Results stream as available; resilient to component failures
- **Mixed-Methods principle**: Combine structured metrics with conversational insights
- **Claude Code UX patterns**: Research shows Claude Code's streaming, progress indicators, and Ctrl+B backgrounding are well-received
- **CI/CD integration**: SARIF and JUnit XML are industry standards for analysis tools
- **MCP compatibility**: agentlint as MCP server enables Claude Code integration

## Considered Options

1. Context-Aware Multi-Mode Architecture (Terminal Dashboard)
2. Claude Code Minimal Pattern (text/json/stream-json only)
3. JSON-First with Rendering Layers

## Decision Outcome

Chosen option: **"Context-Aware Multi-Mode Architecture"** with a **Terminal Dashboard** interactive mode that combines structured progress indicators, conversational agent narration, and a final complete report.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OUTPUT & EXECUTION UX ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ CONTEXT DETECTION                                                    │   │
│  │                                                                      │   │
│  │ Input signals:                                                       │   │
│  │ • process.stdout.isTTY → Interactive vs Piped                       │   │
│  │ • --output-format flag → Explicit format selection                  │   │
│  │ • CI environment vars  → CI/CD mode (CI=true, GITHUB_ACTIONS, etc.) │   │
│  │ • MCP transport        → MCP server mode                            │   │
│  │                                                                      │   │
│  │ Determines: OutputMode = interactive | scriptable | cicd | mcp      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ OUTPUT RENDERERS                                                     │   │
│  │                                                                      │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │ │ INTERACTIVE │ │ SCRIPTABLE  │ │   CI/CD     │ │    MCP      │    │   │
│  │ │             │ │             │ │             │ │             │    │   │
│  │ │ • Dashboard │ │ • JSON      │ │ • SARIF     │ │ • JSON-RPC  │    │   │
│  │ │ • Streaming │ │ • NDJSON    │ │ • JUnit XML │ │ • Tool resp │    │   │
│  │ │ • Colors    │ │ • Quiet     │ │ • Exit codes│ │ • Content[] │    │   │
│  │ │ • Spinners  │ │             │ │ • Markdown  │ │             │    │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Execution Contexts

### 1. Interactive Mode (Terminal Dashboard)

**Detection**: `process.stdout.isTTY === true` AND no `--output-format` flag

**UX Model**: Three-panel terminal dashboard with streaming updates:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ $ agentlint analyse                                                         │
│                                                                             │
│ ┌─ STATIC ANALYSIS ──────────────────────────────────────────────────────┐ │
│ │ ✓ Config detection        0.3s   Claude Code, CLAUDE.md found          │ │
│ │ ✓ Session log indexing    1.2s   23 sessions, 45,230 tokens            │ │
│ │ ✓ Repository structure    0.5s   TypeScript, 847 files                 │ │
│ │ ● Language metrics        [▓▓▓▓▓▓░░░░] 62%                             │ │
│ │ ○ Code patterns           pending                                       │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ AGENTIC ANALYSIS ─────────────────────────────────────────────────────┐ │
│ │ 🤖 Analyzing your CLAUDE.md configuration...                           │ │
│ │                                                                         │ │
│ │    I see you've structured your CLAUDE.md with clear sections. The     │ │
│ │    project context is well-defined, but I notice the error handling    │ │
│ │    instructions could be more specific—currently they just say "log    │ │
│ │    errors" without specifying the format or severity levels...         │ │
│ │                                                                         │ │
│ │    Looking at your recent sessions, I can see the AI struggled with    │ │
│ │    understanding your testing conventions. There were 3 instances of   │ │
│ │    incorrect test file placement in the last week.                     │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ STATUS BAR ───────────────────────────────────────────────────────────┐ │
│ │ ⏱ 12.3s elapsed │ Static: 4/5 │ Agentic: analyzing │ [Ctrl+B: background] │
│ └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key UX Principles**:

1. **Immediate Feedback** (<100ms): Show spinner/status before any operation
2. **Concurrent Progress**: Static and agentic panels update independently (per ADR-0011)
3. **Conversational Narration**: Agent explains findings as it discovers them
4. **Backgroundable**: Ctrl+B pushes to background (Claude Code pattern)
5. **Final Report**: After streaming completes, render complete structured report

**Final Report** (rendered after streaming completes):

```
═══════════════════════════════════════════════════════════════════════════════
                           AGENTLINT ANALYSIS REPORT
                           myproject • 2026-01-13 14:32
═══════════════════════════════════════════════════════════════════════════════

SUMMARY
───────
Overall Score: 72/100 (↑ 8 from baseline)
Issues: 3 critical, 5 warnings
Recommendations: 8 actionable items

FINDINGS
────────
[CRITICAL] Missing error handling guidance in CLAUDE.md
  → Traced to session 2026-01-10 where AI incorrectly caught exceptions
  → Recommendation: Add error handling section with specific patterns
  → See: docs/recommendations/error-handling.md

[WARNING] Inconsistent test file naming
  → 3 occurrences in last 7 days
  → Recommendation: Add test conventions to CLAUDE.md
  ...

METRICS
───────
┌────────────────────────┬─────────┬──────────┬─────────┐
│ Metric                 │ Current │ Baseline │ Trend   │
├────────────────────────┼─────────┼──────────┼─────────┤
│ Config quality score   │ 78%     │ 70%      │ ↑ +8%   │
│ Session success rate   │ 85%     │ 82%      │ ↑ +3%   │
│ Avg iterations/task    │ 2.3     │ 2.8      │ ↓ -0.5  │
│ Type coverage          │ 94%     │ 94%      │ →       │
└────────────────────────┴─────────┴──────────┴─────────┘

Run `agentlint recommend` for detailed improvement suggestions.
═══════════════════════════════════════════════════════════════════════════════
```

---

### 2. Scriptable Mode

**Detection**: `--output-format json` or `--output-format stream-json` or `!isTTY`

**Output Formats**:

| Format | Flag | Use Case |
|--------|------|----------|
| JSON | `--output-format json` | Single result, scripting |
| NDJSON | `--output-format stream-json` | Streaming, real-time processing |
| Text | `--output-format text` | Clean text, no colors/spinners |

**JSON Schema** (simplified):

```typescript
interface AgentlintOutput {
  version: string;           // agentlint version
  timestamp: string;         // ISO 8601
  project: string;           // project path
  duration_ms: number;       // total execution time

  summary: {
    score: number;           // 0-100
    baseline_score?: number; // if baseline exists
    issues: { critical: number; warning: number; info: number };
    recommendations: number;
  };

  findings: Finding[];       // structured findings
  metrics: Metric[];         // quantitative metrics
  recommendations: Recommendation[];

  execution: {
    static_completed: boolean;
    agentic_completed: boolean;
    errors?: ExecutionError[];
  };
}
```

**NDJSON Streaming** (each line is a JSON object):

```jsonl
{"type":"status","phase":"static","task":"config_detection","status":"started"}
{"type":"status","phase":"static","task":"config_detection","status":"completed","duration_ms":320}
{"type":"finding","severity":"warning","domain":"config","message":"..."}
{"type":"narration","phase":"agentic","content":"Analyzing your CLAUDE.md..."}
{"type":"result","summary":{...},"findings":[...],"metrics":[...]}
```

---

### 3. CI/CD Mode

**Detection**: `--output-format sarif`, `--output-format junit`, or `CI=true` env var

**Output Formats**:

| Format | Flag | Integration |
|--------|------|-------------|
| SARIF | `--output-format sarif` | GitHub Code Scanning, VS Code |
| JUnit XML | `--output-format junit` | Jenkins, GitLab, Azure DevOps |
| Markdown | `--output-format markdown` | PR comments, artifacts |

**Exit Codes** (per [clig.dev](https://clig.dev/) guidelines):

| Code | Meaning | CI Behavior |
|------|---------|-------------|
| 0 | Success, no issues | Pipeline passes |
| 1 | Analysis found critical issues | Pipeline fails (configurable) |
| 2 | Analysis found warnings only | Pipeline warns (configurable) |
| 3 | Analysis error (LLM failure, etc.) | Pipeline fails |
| 4 | Invalid arguments / configuration | Pipeline fails |

**SARIF Output** (per [SARIF 2.1.0 specification](https://sarifweb.azurewebsites.net/)):

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "agentlint",
        "version": "1.0.0",
        "rules": [...]
      }
    },
    "results": [...]
  }]
}
```

---

### 4. MCP Server Mode

**Detection**: Launched via MCP transport (STDIO or Streamable HTTP)

**Protocol**: JSON-RPC 2.0 per [MCP Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)

**Exposed Tools**:

```typescript
const tools = [
  {
    name: "agentlint_analyse",
    description: "Run agentlint analysis on the current project",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Project path (default: cwd)" },
        domains: { type: "array", items: { type: "string" }, description: "Analysis domains to include" },
        format: { type: "string", enum: ["summary", "full"], default: "summary" }
      }
    }
  },
  {
    name: "agentlint_recommend",
    description: "Get recommendations for improving AI assistant effectiveness",
    inputSchema: { ... }
  },
  {
    name: "agentlint_trace",
    description: "Trace an issue to its origin in session logs or git history",
    inputSchema: { ... }
  }
];
```

**Response Format** (MCP tool response):

```typescript
interface MCPToolResponse {
  content: Array<{
    type: "text" | "resource";
    text?: string;           // For type: "text"
    resource?: {             // For type: "resource"
      uri: string;
      mimeType: string;
      text: string;
    };
  }>;
  isError?: boolean;
}
```

**Example Response**:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Analysis complete. Found 3 issues and 5 recommendations.\n\nKey finding: Your CLAUDE.md is missing error handling guidance, which caused 3 incorrect exception handling patterns in the last week.\n\nRun `agentlint recommend` for detailed suggestions."
    }
  ]
}
```

---

## Error Handling UX

Per user requirement: Errors should be **conversational**, not raw codes.

### Interactive Mode Errors

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠️  Partial Analysis Complete                                               │
│                                                                             │
│ I ran into a problem with the LLM API (rate limit exceeded), but I was     │
│ able to complete all static analysis successfully.                         │
│                                                                             │
│ What I found:                                                               │
│ • Config detection: ✓ Claude Code configured                               │
│ • Session stats: ✓ 23 sessions indexed                                     │
│ • Repository analysis: ✓ TypeScript project, 847 files                     │
│ • Language metrics: ✓ 94% type coverage                                    │
│                                                                             │
│ What I couldn't do:                                                         │
│ • Semantic config quality assessment                                        │
│ • Recommendation generation                                                 │
│                                                                             │
│ 💡 Try again in a few minutes. The rate limit should reset shortly.         │
│                                                                             │
│ Partial results saved. Run `agentlint analyse` again to retry.              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### JSON Mode Errors

```json
{
  "execution": {
    "static_completed": true,
    "agentic_completed": false,
    "errors": [{
      "phase": "agentic",
      "code": "LLM_RATE_LIMIT",
      "message": "LLM API rate limit exceeded",
      "recoverable": true,
      "suggestion": "Retry in 60 seconds"
    }]
  },
  "summary": { ... },  // Static results still included
  "findings": [ ... ]  // Static findings included
}
```

---

## Implementation Structure

```typescript
// src/output/index.ts
export interface OutputRenderer {
  /** Render progress update (streaming) */
  progress(update: ProgressUpdate): void;

  /** Render agent narration (streaming) */
  narration(content: string): void;

  /** Render finding as discovered */
  finding(finding: Finding): void;

  /** Render final report */
  report(result: AnalysisResult): void;

  /** Render error (conversational) */
  error(error: ExecutionError): void;
}

// Implementations
export class InteractiveRenderer implements OutputRenderer { ... }
export class JsonRenderer implements OutputRenderer { ... }
export class StreamJsonRenderer implements OutputRenderer { ... }
export class SarifRenderer implements OutputRenderer { ... }
export class JUnitRenderer implements OutputRenderer { ... }
export class McpRenderer implements OutputRenderer { ... }

// Factory
export function createRenderer(mode: OutputMode): OutputRenderer {
  switch (mode) {
    case 'interactive': return new InteractiveRenderer();
    case 'json': return new JsonRenderer();
    case 'stream-json': return new StreamJsonRenderer();
    case 'sarif': return new SarifRenderer();
    case 'junit': return new JUnitRenderer();
    case 'mcp': return new McpRenderer();
  }
}
```

---

## CLI Flags Summary

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--output-format` / `-f` | `text`, `json`, `stream-json`, `sarif`, `junit`, `markdown` | Auto (TTY→text, pipe→json) |
| `--quiet` / `-q` | - | false | Suppress progress, show only results |
| `--verbose` / `-v` | - | false | Show detailed progress and debug info |
| `--no-color` | - | false | Disable colors (also auto-disabled if !TTY) |
| `--model` / `-m` | model name | default | Model selection for cost control |

---

## Consequences

### Positive

- **Progressive disclosure**: Static results visible immediately; agentic streams as available
- **Claude Code familiarity**: Users of Claude Code will recognize the streaming UX
- **CI/CD native**: SARIF enables GitHub code scanning; JUnit enables test result display
- **MCP integration**: agentlint usable as a tool from Claude Code itself
- **Graceful degradation**: LLM failures don't hide static results

### Negative

- **Implementation complexity**: Multiple renderers to implement and maintain
- **Testing surface**: Each output format needs comprehensive tests
- **Terminal compatibility**: Dashboard UX may need fallbacks for limited terminals

### Neutral

- **No HTML output in MVP**: Deferred to future work (Phase 4+ reporting)
- **MCP feature subset**: Not all CLI features exposed via MCP initially

---

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All rendering happens locally |
| II. Improvement-Oriented | Yes | Reports include baseline comparison, trends |
| III. Causal-First | Yes | Findings include traced origins |
| IV. Mixed-Methods | Yes | Structured metrics + conversational insights |
| V. Language-Agnostic | N/A | Output formatting is language-independent |
| VI. Tool-Agnostic | Yes | MCP enables multi-tool integration |
| VII. Intelligent Tooling | Yes | Output includes all analysis results; resilient to component failures |
| VIII. Compounding Value | Yes | Baselines enable compound improvement tracking |
| IX. Agent-Aware | Yes | MCP responses are agent-optimized; terminal is user-optimized |

---

## More Information

### Related Documents

- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Concurrent static + agentic execution
- [ADR-0019: Language Ecosystem Support](./0019-language-ecosystem-support.md) - Deep research pattern
- [ADR-0014: Error Handling and Recovery](./0014-error-handling-and-recovery.md) - Error recovery strategy
- Design Questions: [Section 6.1 - Output Formats](../../design-questions.md#61-output-formats)
- Design Questions: [Section 7.1 - CLI Design](../../design-questions.md#71-cli-design--help-system)

### Research Sources

- [Command Line Interface Guidelines (clig.dev)](https://clig.dev/) - CLI UX best practices
- [Evil Martians CLI Progress Patterns](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - Progress indicator patterns
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) - Claude Code output patterns
- [Claude Code --output-format FAQ](https://claudelog.com/faqs/what-is-output-format-in-claude-code/) - Output format flags
- [SARIF Complete Guide (Sonar)](https://www.sonarsource.com/resources/library/sarif/) - SARIF format standard
- [GitHub SARIF Upload Docs](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github) - GitHub integration
- [MCP Transports Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) - MCP protocol
