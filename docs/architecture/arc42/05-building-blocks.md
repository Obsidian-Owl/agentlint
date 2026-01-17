# Section 5: Building Block View

> Static structure decomposition of agentlint's 6-layer architecture.

**Last Updated**: January 2026
**Related Sections**: [Runtime View](06-runtime-view.md), [Crosscutting Concepts](08-crosscutting-concepts.md)

---

## Level 1: System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              agentlint                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ CLI INTERFACE LAYER                                             │    │
│  │ Commands: scan, analyse, baseline, compare, recommend, trace    │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ ORCHESTRATION LAYER                                             │    │
│  │ Master Agent Loop • Context Management • Tool Selection         │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ TOOL LAYER                                                      │    │
│  │ Discovery • Extraction • Search • Persistence                   │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ ADAPTER LAYER                                                   │    │
│  │ Claude Code │ Generalized │ Future ACTs                         │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ PERSISTENCE LAYER                                               │    │
│  │ Baselines • Learnings • Session State • Configuration           │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ INTEGRATION LAYER                                               │    │
│  │ Filesystem • Git • SQLite • Anthropic API                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

| Layer | Responsibility |
|-------|----------------|
| **CLI Interface** | Parse commands, format output, progress reporting |
| **Orchestration** | Agent reasoning, tool selection, finding synthesis |
| **Tool** | Deterministic data gathering, scoped writing |
| **Adapter** | ACT-specific abstraction (config locations, log formats) |
| **Persistence** | Local storage (baselines, learnings, state) |
| **Integration** | External interfaces (filesystem, git, LLM API) |

---

## Level 2: CLI Interface Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI INTERFACE LAYER                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   cli.ts    │  │  version.ts │  │  commands/  │              │
│  │  Entry point│  │ Version info│  │  update.ts  │              │
│  │  Arg parsing│  │ Runtime info│  │  (future)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐           │
│  │              SHARED MODULES                       │           │
│  │  errors/         │  types/                        │           │
│  │  • ExitCodes     │  • Platform, Architecture     │           │
│  │  • Error classes │  • Binary, Release            │           │
│  │  • formatError() │  • InstallPaths               │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

| Component | Purpose |
|-----------|---------|
| `cli.ts` | Entry point, argument parsing, command routing |
| `version.ts` | Version info, runtime detection (Bun/Node) |
| `commands/` | Command implementations (update, future commands) |
| `errors/` | Typed error classes, exit codes, error formatting |
| `types/` | Shared type definitions (Platform, Binary, Release) |

---

## Level 3: CLI Module Structure (EP04)

```
src/cli/
├── index.ts           Public exports
├── program.ts         Commander.js setup, command definitions
├── types.ts           CLI-specific types, re-exports from EP02/EP03
│
├── commands/          Command implementations
│   ├── scan.ts        Discover AI configurations
│   ├── analyse.ts     Run full analysis
│   ├── baseline.ts    Capture baseline state
│   ├── compare.ts     Compare against baseline
│   └── trace.ts       Trace finding to origin
│
├── components/        Ink React components (ADR-0004)
│   ├── App.tsx        Main application wrapper
│   ├── Progress.tsx   Spinner + phase indicator
│   ├── FindingsList.tsx  Findings table display
│   ├── Summary.tsx    Analysis summary
│   ├── CausalTree.tsx Custom tree visualization
│   └── CompareView.tsx Baseline comparison view
│
├── formatters/        Output format handlers
│   ├── json.ts        JSON/JSON Lines streaming
│   ├── markdown.ts    Markdown report generation
│   └── plain.ts       Plain text (no colors)
│
└── utils/             Shared utilities
    ├── terminal.ts    Width detection, text wrapping
    ├── colors.ts      ANSI colors, NO_COLOR support
    └── output.ts      Output mode detection
```

| Module | Responsibility |
|--------|----------------|
| `program.ts` | Commander.js configuration, global options, command routing |
| `commands/` | Individual command logic, calls orchestration layer |
| `components/` | Ink-based React components for terminal UI |
| `formatters/` | Output serialization (JSON, Markdown, plain text) |
| `utils/` | Terminal detection, color support, text formatting |

**Key Design Decisions**:
- Commander.js for argument parsing ([ADR-0003](../adr/0003-cli-framework-and-command-structure.md))
- Ink for terminal UI with React components ([ADR-0004](../adr/0004-output-format-and-rendering.md))
- Custom CausalTree component for trace visualization
- ANSI 4-bit colors for accessibility (NFR-005)

---

## Level 2: Orchestration Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                    MASTER AGENT LOOP                            │
│  while (analysis_active):                                       │
│    1. Assess context and task state                             │
│    2. Decide: tool invocation OR direct reasoning               │
│    3. If tool: invoke → observe result                          │
│    4. If user input needed: pause for human-in-the-loop         │
│    5. Update working memory                                     │
│    6. Check termination                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               AGENT COGNITIVE WORKSPACE                         │
│  ├─ Task Goal                                                   │
│  ├─ Project Context (compressed)                                │
│  ├─ Analysis Progress                                           │
│  ├─ Accumulated Findings                                        │
│  ├─ Baseline Awareness                                          │
│  └─ Global Learnings                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Level 2: Tool Layer

| Category | Tools |
|----------|-------|
| **Config Analysis (EP05)** | `discover_configs`, `parse_config`, `analyze_hierarchy` |
| **Session Analysis (EP06)** | `search_sessions`, `get_session_stats` |
| **Causal Analysis (EP07)** | `trace_issue_origin`, `get_issue_patterns` |
| **Git Analysis** | `query_git` |
| **Baseline** | `store_baseline`, `query_baseline`, `list_baselines` |
| **Recommendation** | `store_recommendation`, `list_recommendations`, `update_recommendation` |
| **Learning** | `store_learning`, `list_learnings`, `promote_learning` |
| **Utility** | `retrieve_result`, `agentlint_write` |

**Design Principles**: Atomic operations, structured output, error transparency, poka-yoke.

---

## Level 3: Config Analysis Tools (EP05)

```
src/tools/config/
├── index.ts                    Public exports + registration helpers
├── types.ts                    Entity interfaces (ParsedConfig, Skill, etc.)
│
├── discovery.ts                Config file discovery (fast-glob)
├── discover-configs-tool.ts    SDK tool definition: discover_configs
│
├── parse-config.ts             Markdown/JSON parsing to structured data
├── parse-config-tool.ts        SDK tool definition: parse_config
│
├── hierarchy.ts                Hierarchy analysis + conflict detection
├── analyze-hierarchy-tool.ts   SDK tool definition: analyze_hierarchy
│
├── quality.ts                  Quality assessment (scoring, grading)
├── metrics.ts                  Quantitative signal extraction
└── skills.ts                   SKILL.md discovery and parsing
```

| Module | Responsibility |
|--------|----------------|
| `discovery.ts` | Discovers CLAUDE.md, AGENTS.md, settings.json, SKILL.md files using fast-glob with configurable exclusions |
| `parse-config.ts` | Parses config files into structured `ParsedConfig` with AST, sections, code blocks, metrics |
| `hierarchy.ts` | Builds global→project→local hierarchy, detects conflicts (contradicting/overlapping) |
| `quality.ts` | Assesses config quality using ADR-0007 criteria: structure, size, completeness, specificity |
| `metrics.ts` | Extracts quantitative signals: token estimates, emphasis markers, section counts |
| `skills.ts` | Parses SKILL.md files with frontmatter validation and bundled file cataloging |

### EP05 Tool Definitions

| Tool | Description |
|------|-------------|
| `discover_configs` | Searches project for AI config files with hierarchy detection |
| `parse_config` | Parses config file into structured data with quality assessment |
| `analyze_hierarchy` | Analyzes full config hierarchy with conflict detection |

### Tool Registration Pattern

```typescript
import { createToolRegistry } from './orchestration';
import { registerAllTools, registerEP05Tools } from './tools';

// Register all available tools
const registry = createToolRegistry();
registerAllTools(registry);

// Or register EP05 tools only
registerEP05Tools(registry);

// Get MCP server for SDK integration
const mcpServer = registry.toMcpServer();
```

### Key Entity Types

```typescript
interface ParsedConfig {
  file: ConfigFile;           // Path, type, hierarchy level
  ast: Root;                  // mdast AST
  frontmatter?: Record;       // YAML frontmatter
  metrics: ConfigMetrics;     // Line count, tokens, emphasis
  sections: Section[];        // Hierarchical sections
  codeBlocks: CodeBlock[];    // Fenced code blocks
  warnings: ParseWarning[];   // Parse issues
  raw: string;                // Original content
}

interface ConfigHierarchy {
  global?: ParsedConfig;      // ~/.claude/CLAUDE.md
  project?: ParsedConfig;     // Project root CLAUDE.md
  local: ParsedConfig[];      // Nested configs
  skills: Skill[];            // Discovered skills
  effectiveConfig: EffectiveConfig;
  conflicts: Conflict[];      // Detected conflicts
}

interface Skill {
  path: string;
  name: string;               // From frontmatter
  description: string;
  allowedTools?: string[];    // Permitted MCP tools
  model?: string;             // Specific model
  userInvocable: boolean;
  bundledFiles: BundledFile[];
}
```

### Performance Characteristics (NFR)

| Metric | Target | Implementation |
|--------|--------|----------------|
| Discovery time | <5s typical projects | fast-glob with early exclusion |
| Parse memory | <50MB for 1000-line configs | Streaming parser, no caching |
| Quality scoring | <100ms per file | In-memory analysis |

---

## Level 3: Session Analysis Tools (EP06)

```
src/tools/sessions/
├── index.ts                    Public exports + SDK tool registration
├── types.ts                    Entity interfaces (SessionEntry, SearchResult, etc.)
├── schemas.ts                  Zod validation schemas with input limits
│
├── discovery.ts                Session file discovery in ~/.claude/projects/
├── parser.ts                   JSONL parsing with streaming support
├── utils.ts                    Path encoding, tool categorization, timestamps
│
├── indexer.ts                  FTS5 indexing with incremental updates
├── search.ts                   Full-text search with BM25 ranking
├── stats.ts                    Metrics aggregation with filtering
├── metrics.ts                  Token usage and tool distribution extraction
│
├── search-sessions-tool.ts     SDK tool definition: search_sessions
└── get-session-stats-tool.ts   SDK tool definition: get_session_stats
```

| Module | Responsibility |
|--------|----------------|
| `discovery.ts` | Discovers session JSONL files, decodes project paths from directory names |
| `parser.ts` | Parses JSONL session logs with streaming, handles malformed lines gracefully |
| `utils.ts` | Path encoding/decoding, tool categorization (read/write/bash/search), timestamp validation |
| `indexer.ts` | Indexes session entries into FTS5 table, tracks file metadata for incremental updates |
| `search.ts` | Full-text search with BM25 ranking, date range filtering, project filtering |
| `stats.ts` | Aggregates session statistics: token usage, tool distribution, model usage |
| `metrics.ts` | Extracts per-session metrics: turns, tokens, compressions, errors |

### EP06 Tool Definitions

| Tool | Description |
|------|-------------|
| `search_sessions` | Searches session logs with FTS5 query syntax, returns ranked results with snippets |
| `get_session_stats` | Returns aggregated statistics across sessions with project/date/model filtering |

### Persistence Layer Integration

Session analysis uses SQLite FTS5 via the persistence layer:

```
src/persistence/sessions/
└── fts.ts                      FTS5 database initialization and schema management
```

Database stored at `.agentlint/sessions.db` per [ADR-0006](../adr/0006-session-log-processing-architecture.md).

### Key Entity Types

```typescript
interface SessionEntry {
  type: EntryType;              // 'user' | 'assistant' | 'summary' | 'system'
  sessionId: string;
  timestamp: string;
  message?: Message;            // Role, content blocks, token usage
  toolUseResult?: ToolResult;   // Tool execution result
  filePath: string;             // Source file (for causal tracing)
  lineNumber: number;           // Line number (for causal tracing)
}

interface SearchResult {
  sessionId: string;
  timestamp: string;
  contentSnippet: string;       // Highlighted match context
  relevanceScore: number;       // BM25 score (lower = more relevant)
  filePath: string;             // Source location for tracing
  lineNumber: number;
  projectPath: string;
}

interface SessionStats {
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTurnsPerSession: number;
  toolDistribution: ToolDistribution;
  modelDistribution: ModelDistribution;
  topCliVersion?: string;
}
```

### Performance Characteristics (NFR)

| Metric | Target | Implementation |
|--------|--------|----------------|
| Search query time | <2s on 500MB corpus | FTS5 with BM25 ranking |
| Indexing throughput | <60s for 500MB | Incremental indexing, mtime checks |
| Memory during indexing | <100MB peak | Streaming parser |
| Index storage overhead | <20% of log size | FTS5 compression |

---

## Level 3: Causal Analysis Tools (EP07)

```
src/tools/causal/
├── index.ts                    Public exports + SDK tool registration
├── types.ts                    Zod schemas (CausalChain, EvidenceItem, Gap, etc.)
│
├── evidence-collector.ts       Session-based evidence collection
├── gap-analyzer.ts             Configuration gap detection
├── chain-builder.ts            Causal chain construction
├── confidence.ts               Confidence scoring with validation checklist
├── counterfactual.ts           "If X, then Y" analysis generation
├── pattern-detector.ts         Recurring pattern detection
├── pattern-tracking.ts         Frequency and severity tracking
│
├── git-evidence.ts             Git blame/pickaxe evidence collection
├── config-snapshot.ts          Configuration state capture
│
├── trace-issue-tool.ts         SDK tool definition: trace_issue_origin
└── get-patterns-tool.ts        SDK tool definition: get_issue_patterns
```

| Module | Responsibility |
|--------|----------------|
| `evidence-collector.ts` | Collects evidence from session FTS5 index by keywords and file location |
| `gap-analyzer.ts` | Analyzes evidence to identify missing configuration guidance |
| `chain-builder.ts` | Constructs causal chains from trigger → gap → mechanism → effect |
| `confidence.ts` | Assesses chain confidence using 6-factor validation checklist |
| `counterfactual.ts` | Generates preventive recommendations ("If X were present...") |
| `pattern-detector.ts` | Detects recurring patterns across multiple causal chains |
| `pattern-tracking.ts` | Tracks pattern frequency, severity, and trends over time |
| `git-evidence.ts` | Collects git blame and pickaxe search evidence |
| `config-snapshot.ts` | Captures CLAUDE.md, settings.json state for gap analysis |

### EP07 Tool Definitions

| Tool | Description |
|------|-------------|
| `trace_issue_origin` | Traces detected issues to their origin in session logs, builds causal chain |
| `get_issue_patterns` | Queries recurring issue patterns with filtering by project, category, frequency |

### Persistence Layer Integration

Causal analysis extends the sessions database with additional tables:

```
src/persistence/causal/
├── index.ts                    Public exports
├── schema.ts                   Table definitions and migrations
└── queries.ts                  CRUD operations for chains and patterns
```

Tables stored in `.agentlint/sessions.db`:
- `causal_chains` - Traced causal chains with confidence scores
- `evidence_items` - Individual evidence supporting chains
- `issue_patterns` - Aggregated recurring patterns
- `chain_patterns` - Many-to-many chain-pattern relationships

### Key Entity Types

```typescript
interface EvidenceItem {
  id: string;                   // UUID
  type: EvidenceType;           // SessionMatch, GitCorrelation, ConfigGap, etc.
  source: string;               // Session ID, commit hash, etc.
  timestamp?: string;           // When evidence was created
  content?: string;             // Relevant snippet
  position?: Position;          // File location if applicable
  metadata?: Record<string, unknown>;
}

interface CausalChain {
  id: string;                   // UUID
  issueId: string;              // Reference to detected issue
  trigger: EvidenceItem;        // Origin action/prompt
  gap?: Gap;                    // Configuration gap that enabled issue
  mechanism: string;            // How gap led to issue
  effect: string;               // Detected issue description
  confidence: ConfidenceScore;  // Validation assessment
  evidence: EvidenceItem[];     // All collected evidence
  depth: number;                // Traversal steps (max 5)
  projectPath: string;
  createdAt: string;
  counterfactual?: string;      // "If X, then Y wouldn't have occurred"
}

interface IssuePattern {
  id: string;                   // UUID
  category: GapType;            // missing_config, context_loss, etc.
  chainIds: string[];           // Related causal chains
  frequency: number;            // Occurrence count
  isSystemic: boolean;          // true if frequency >= 3
  firstOccurrence: string;
  lastOccurrence: string;
  projectPath?: string;         // null = global pattern
  summary: string;              // Human-readable description
}
```

### Confidence Assessment

Causal chains are validated using a 6-factor checklist:

| Factor | Description |
|--------|-------------|
| Specificity | Issue clearly links to specific trigger |
| Temporal | Timing supports causal relationship |
| Mechanistic | Plausible mechanism explains causation |
| Evidence Quality | Evidence is direct, not inferred |
| Reproducibility | Pattern seen multiple times |
| Alternatives | Alternative causes were considered |

Overall confidence: `high` (5-6 factors), `medium` (3-4), `low` (0-2)

### Performance Characteristics (NFR)

| Metric | Target | Implementation |
|--------|--------|----------------|
| Trace query time | <5s typical issues | FTS5 search + in-memory chain building |
| Pattern detection | <2s for 100 chains | SQLite aggregation queries |
| Evidence collection | <1s per source | Parallel session/git queries |

---

## Level 2: Adapter Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                 ADAPTER INTERFACE                               │
│  detect() → parseConfig() → locateLogs() → parseLogs()          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  CLAUDE CODE     │  │  GENERALIZED     │  │  FUTURE          │
│  Config: CLAUDE.md│  │  Common patterns │  │  Cursor, etc.    │
│  Logs: ~/.claude/ │  │  AGENTS.md       │  │  Plugin pattern  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

The generalized adapter ensures value even for unknown AI tools.
