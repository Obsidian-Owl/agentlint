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
│  │ Baselines • Reviews • Tracking • Learnings • Session State      │    │
│  └────────────────────────────────┬────────────────────────────────┘    │
│  ┌────────────────────────────────▼────────────────────────────────┐    │
│  │ INTEGRATION LAYER                                               │    │
│  │ Filesystem • Git • SQLite • Anthropic API                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

| Layer             | Responsibility                                                 |
| ----------------- | -------------------------------------------------------------- |
| **CLI Interface** | Parse commands, format output, progress reporting              |
| **Orchestration** | Agent reasoning, tool selection, finding synthesis             |
| **Tool**          | Deterministic data gathering, scoped writing                   |
| **Adapter**       | ACT-specific abstraction (config locations, log formats)       |
| **Persistence**   | Local storage (baselines, reviews, tracking, learnings, state) |
| **Integration**   | External interfaces (filesystem, git, LLM API)                 |

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

| Component    | Purpose                                             |
| ------------ | --------------------------------------------------- |
| `cli.ts`     | Entry point, argument parsing, command routing      |
| `version.ts` | Version info, runtime detection (Bun/Node)          |
| `commands/`  | Command implementations (update, future commands)   |
| `errors/`    | Typed error classes, exit codes, error formatting   |
| `types/`     | Shared type definitions (Platform, Binary, Release) |

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
│   ├── analyse.ts     Run full analysis (--session for EP15)
│   ├── baseline.ts    Capture baseline state
│   ├── compare.ts     Compare against baseline
│   ├── trace.ts       Trace finding to origin
│   ├── session.ts     Session recording management (EP11)
│   └── skills.ts      Skills inventory and statistics (EP14)
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

| Module        | Responsibility                                              |
| ------------- | ----------------------------------------------------------- |
| `program.ts`  | Commander.js configuration, global options, command routing |
| `commands/`   | Individual command logic, calls orchestration layer         |
| `components/` | Ink-based React components for terminal UI                  |
| `formatters/` | Output serialization (JSON, Markdown, plain text)           |
| `utils/`      | Terminal detection, color support, text formatting          |

**Key Design Decisions**:

- Commander.js for argument parsing ([ADR-0003](../adr/0003-cli-framework-and-command-structure.md))
- Ink for terminal UI with React components ([ADR-0004](../adr/0004-output-format-and-rendering.md))
- Custom CausalTree component for trace visualization
- ANSI 4-bit colors for accessibility (NFR-005)

---

## Level 2: Orchestration Layer

The orchestration layer wraps the **Opencode SDK's session/prompt API**, which implements the master agent loop internally. The `OpencodeOrchestrator` class provides:

1. **Configuration** - Model selection, verbosity, timeouts
2. **Streaming Transformation** - SDK messages → `StreamChunk` objects
3. **Checkpointing Hooks** - Crash recovery via session state persistence
4. **Tool Registration** - MCP server integration via `ToolRegistry`
5. **Subagent Management** - ACT subagent spawning with depth=1 limit
6. **Human-in-the-Loop** - `canUseTool` callback for user interaction ([ADR-0021](../adr/0021-conversational-interaction-model.md))

```
┌─────────────────────────────────────────────────────────────────┐
│                  ORCHESTRATOR (SDK Wrapper)                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Opencode SDK session/prompt API              │  │
│  │  • Master loop implemented by SDK                         │  │
│  │  • Tool execution via MCP protocol                        │  │
│  │  • Subagent spawning via agents option                    │  │
│  │  • canUseTool callback for human-in-the-loop (ADR-0021)   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           ▲                                     │
│                           │                                     │
│  ┌────────────┬───────────┴─────────────┬────────────────────┐  │
│  │ToolRegistry│    OrchestratorConfig    │  CheckpointHandler│  │
│  │ (MCP tools)│  (model, verbosity, etc) │  (session state)  │  │
│  └────────────┴─────────────────────────┴────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               AGENT COGNITIVE WORKSPACE                         │
│  (Managed by SDK, populated by agentlint tools)                 │
│  ├─ Task Goal                                                   │
│  ├─ Project Context (compressed)                                │
│  ├─ Analysis Progress                                           │
│  ├─ Accumulated Findings                                        │
│  ├─ Baseline Awareness                                          │
│  └─ Global Learnings                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Orchestrator Module Structure (EP02)

```
src/orchestration/
├── index.ts                    Public exports
├── orchestrator.ts             Legacy orchestrator class wrapping SDK query()
├── tool-registry.ts            ToolRegistry with MCP server creation
├── streaming.ts                SDK message → StreamChunk transformation
├── checkpoint.ts               Session state persistence + recovery
├── session-state.ts            SessionState management
├── cognitive-workspace.ts      Context compression for large results
├── context.ts                  Context utilities
├── config.ts                   Configuration loading + defaults
├── can-use-tool.ts             Human-in-the-loop callback (ADR-0021)
├── telemetry-utils.ts          Shared truncation + error extraction for telemetry
└── types.ts                    Type definitions
```

| Component                | Responsibility                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `orchestrator.ts`        | Legacy orchestrator wrapping SDK `query()`, session lifecycle                                |
| `tool-registry.ts`       | Registers tools, creates MCP server for SDK integration                                      |
| `streaming.ts`           | Transforms `SDKMessage` events to `StreamChunk` with verbosity                               |
| `checkpoint.ts`          | Emits checkpoints on tool completion, findings, phase changes                                |
| `session-state.ts`       | Persists/loads session state to JSON for crash recovery                                      |
| `cognitive-workspace.ts` | Compresses large tool results to fit context window                                          |
| `can-use-tool.ts`        | Human-in-the-loop: tool approval prompts, AskUserQuestion routing                            |
| `telemetry-utils.ts`     | Shared telemetry utilities: `truncateToolOutput`, `truncateToolInput`, `extractErrorMessage` |

### Key Integration Point

```typescript
import { OpencodeOrchestrator } from '../opencode';

// Opencode SDK provides self-managed server lifecycle
const orchestrator = new OpencodeOrchestrator(config);

// Run analysis task
for await (const chunk of orchestrator.run(task)) {
  // Process StreamChunk events (text, tool_start, tool_result, etc.)
  handleChunk(chunk);
}
```

> **Note**: See ADR-0024 for the migration from Claude Agent SDK to Opencode SDK.

### Opencode Module Structure (ADR-0024)

```
src/opencode/
├── index.ts                    Public exports
├── orchestrator.ts             OpencodeOrchestrator (active implementation)
├── server.ts                   Server lifecycle management (start/stop/health)
├── client.ts                   SDK client wrapper
├── mcp-server.ts               MCP server exposing 40+ tools
├── tool-adapter.ts             Tool format conversion (adaptTool)
├── streaming.ts                SSE → StreamChunk conversion with telemetry metadata
├── sessions.ts                 Hybrid session management (Claude + agentlint)
└── telemetry-tracker.ts        Encapsulated tool/LLM telemetry tracking (FIFO correlation)
```

| Component              | Responsibility                                                                    |
| ---------------------- | --------------------------------------------------------------------------------- |
| `orchestrator.ts`      | Active orchestrator: server lifecycle, streaming, telemetry wiring                |
| `server.ts`            | Server start/stop with health monitoring                                          |
| `client.ts`            | SDK client wrapper for prompt and subscribe operations                            |
| `mcp-server.ts`        | MCP server exposing agentlint tools to the agent                                  |
| `tool-adapter.ts`      | Converts agentlint tool definitions to Opencode format                            |
| `streaming.ts`         | Transforms SSE events to `StreamChunk` with telemetry metadata extraction         |
| `sessions.ts`          | Manages session lifecycle across Claude and agentlint metadata                    |
| `telemetry-tracker.ts` | Tracks tool executions (FIFO queue) and LLM usage, dispatches to telemetry client |

#### Observability Integration (EP22)

The orchestration layer integrates with the observability module for session span export:

| Component | Location | Purpose |
|-----------|----------|---------|
| SpanExporter | `src/observability/trace-context.ts` | Interface for span export |
| LocalSpanExporter | `src/observability/exporters/local-exporter.ts` | NDJSON file export |
| OtlpExporter | `src/observability/exporters/otlp-exporter.ts` | OTLP/HTTP remote export |

**Configuration:**

```typescript
import { LocalSpanExporter } from './observability/exporters/local-exporter';

const exporter = new LocalSpanExporter();
const orchestrator = new OpencodeOrchestrator({
  ...config,
  spanExporter: exporter, // Optional: enables session span export
}, toolRegistry);
```

When `spanExporter` is provided, the orchestrator exports session spans capturing:
- Session lifecycle (start, complete, error)
- Streaming statistics (chunk count, duration)
- Task metadata (truncated for privacy)

---

## Level 2: Tool Layer

| Category                          | Tools                                                                                                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Config Analysis (EP05)**        | `discover_configs`, `parse_config`, `analyze_hierarchy`                                                                                                                                                                                             |
| **Session Analysis (EP06)**       | `search_sessions`, `get_session_stats`                                                                                                                                                                                                              |
| **Causal Analysis (EP07)**        | `trace_issue_origin`, `get_issue_patterns`                                                                                                                                                                                                          |
| **Temporal Analysis (EP09)**      | `store_baseline`, `query_baseline`, `list_baselines`, `calculate_delta`, `query_trends`, `conduct_review`, `get_review_history`                                                                                                                     |
| **Recommendation Advisor (EP10)** | `spawn_recommendation_advisor`, `create_recommendation`, `get_recommendation`, `list_recommendations`, `get_recommendation_summary`, `add_recommendation_event`, `update_recommendation_status`, `refine_recommendation`, `complete_recommendation` |
| **Skills Effectiveness (EP14)**   | `get_skill_inventory`, `index_skill_invocations`, `get_session_summaries`, `get_skill_invocations`                                                                                                                                                  |
| **Session Intelligence (EP15)**   | `get_session_timeline`, `get_tool_sequences`, `get_file_accesses`, `get_delegation_events`, `get_quality_signals`, `get_mcp_usage`, `get_permission_events`, `spawn_session_analyst`                                                                |
| **MCP Config Validation (EP19)**  | `get_mcp_configs`, `validate_mcp_config`                                                                                                                                                                                                            |
| **Git Analysis**                  | `query_git`                                                                                                                                                                                                                                         |
| **Learning**                      | `store_learning`, `list_learnings`, `promote_learning`                                                                                                                                                                                              |
| **Utility**                       | `retrieve_result`, `agentlint_write`                                                                                                                                                                                                                |

**Design Principles**: Atomic operations, structured output, error transparency, poka-yoke.

**Tool/Agent Boundary**: Per [ADR-0019](../adr/0019-tool-agent-boundary-temporal.md), tools provide DATA (metrics, diffs, statistics) while the agent provides JUDGMENT (improvement assessment, trend interpretation, semantic understanding).

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

| Module            | Responsibility                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `discovery.ts`    | Discovers CLAUDE.md, AGENTS.md, settings.json, SKILL.md files using fast-glob with configurable exclusions |
| `parse-config.ts` | Parses config files into structured `ParsedConfig` with AST, sections, code blocks, metrics                |
| `hierarchy.ts`    | Builds global→project→local hierarchy, detects conflicts (contradicting/overlapping)                       |
| `quality.ts`      | Assesses config quality using ADR-0007 criteria: structure, size, completeness, specificity                |
| `metrics.ts`      | Extracts quantitative signals: token estimates, emphasis markers, section counts                           |
| `skills.ts`       | Parses SKILL.md files with frontmatter validation and bundled file cataloging                              |

### EP05 Tool Definitions

| Tool                | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `discover_configs`  | Searches project for AI config files with hierarchy detection   |
| `parse_config`      | Parses config file into structured data with quality assessment |
| `analyze_hierarchy` | Analyzes full config hierarchy with conflict detection          |

### Tool Registration Pattern

```typescript
import { createToolRegistry } from './orchestration';
import { registerAllTools, registerConfigTools } from './tools';

// Register all available tools
const registry = createToolRegistry();
registerAllTools(registry);

// Or register config tools only
registerConfigTools(registry);

// Get MCP server for SDK integration
const mcpServer = registry.toMcpServer();
```

### Key Entity Types

```typescript
interface ParsedConfig {
  file: ConfigFile; // Path, type, hierarchy level
  ast: Root; // mdast AST
  frontmatter?: Record; // YAML frontmatter
  metrics: ConfigMetrics; // Line count, tokens, emphasis
  sections: Section[]; // Hierarchical sections
  codeBlocks: CodeBlock[]; // Fenced code blocks
  warnings: ParseWarning[]; // Parse issues
  raw: string; // Original content
}

interface ConfigHierarchy {
  global?: ParsedConfig; // ~/.claude/CLAUDE.md
  project?: ParsedConfig; // Project root CLAUDE.md
  local: ParsedConfig[]; // Nested configs
  skills: Skill[]; // Discovered skills
  effectiveConfig: EffectiveConfig;
  conflicts: Conflict[]; // Detected conflicts
}

interface Skill {
  path: string;
  name: string; // From frontmatter
  description: string;
  allowedTools?: string[]; // Permitted MCP tools
  model?: string; // Specific model
  userInvocable: boolean;
  bundledFiles: BundledFile[];
}
```

### Performance Characteristics (NFR)

| Metric          | Target                      | Implementation                 |
| --------------- | --------------------------- | ------------------------------ |
| Discovery time  | <5s typical projects        | fast-glob with early exclusion |
| Parse memory    | <50MB for 1000-line configs | Streaming parser, no caching   |
| Quality scoring | <100ms per file             | In-memory analysis             |

---

## Level 3: MCP Config Validation Tools (EP19)

The MCP config validation module provides static analysis tools for validating Model Context Protocol (MCP) server configurations across multiple AI Coding Tools (ACTs).

```
src/tools/config/mcp/
├── index.ts                    Public exports + registration helpers
├── types.ts                    Entity interfaces (McpValidationIssue, McpServerConfig, etc.)
├── schemas.ts                  Zod schemas for config formats (standard, opencode, vscode-copilot)
│
├── discovery.ts                Multi-ACT config file discovery
├── get-mcp-configs-tool.ts     SDK tool definition: get_mcp_configs
│
├── parser.ts                   JSONC parsing with position tracking
├── validate-mcp-config-tool.ts SDK tool definition: validate_mcp_config
│
└── validators/                 Validation modules
    ├── index.ts                Validator exports
    ├── schema.ts               JSON schema validation per format
    ├── path.ts                 Executable path validation
    ├── env.ts                  Environment variable validation
    ├── transport.ts            Transport-specific validation (stdio, HTTP, SSE)
    └── patterns.ts             Anti-pattern detection (deprecated packages, etc.)
```

| Module                    | Responsibility                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `discovery.ts`            | Discovers MCP config files across ACT-specific locations (Claude Code, OpenCode, VS Code Copilot, Cursor, Windsurf, Amazon Q) |
| `parser.ts`               | Parses JSON/JSONC with position tracking for accurate line:column references                                                  |
| `schemas.ts`              | Zod schemas for different config formats, format detection                                                                    |
| `validators/schema.ts`    | Validates required fields per transport type, field types                                                                     |
| `validators/path.ts`      | Checks executable existence, PATH availability, relative path warnings                                                        |
| `validators/env.ts`       | Detects sensitive variable names, variable reference patterns                                                                 |
| `validators/transport.ts` | Validates URL format, Docker flags, SSE deprecation                                                                           |
| `validators/patterns.ts`  | Detects deprecated npm packages, timeout issues                                                                               |

### EP19 Tool Definitions

| Tool                  | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `get_mcp_configs`     | Discovers MCP configuration files across ACT locations with format detection |
| `validate_mcp_config` | Validates MCP config with schema, path, env, transport, and pattern checks   |

### ACT Support Matrix

| ACT             | Config Locations                                    | Format         |
| --------------- | --------------------------------------------------- | -------------- |
| Claude Code     | `.mcp.json`, `~/.claude.json`                       | standard       |
| OpenCode        | `opencode.json`, `~/.config/opencode/opencode.json` | opencode       |
| VS Code Copilot | `.vscode/mcp.json`                                  | vscode-copilot |
| Cursor          | `mcp.json`, `.cursor/mcp.json`                      | standard       |
| Windsurf        | `~/.codeium/windsurf/mcp_config.json`               | standard       |
| Amazon Q        | `.amazonq/mcp.json`, `~/.aws/amazonq/mcp.json`      | standard       |

### Key Entity Types

```typescript
interface McpValidationIssue {
  code: McpIssueCode; // Structured issue identifier
  severity: IssueSeverity; // 'error' | 'warning' | 'info'
  message: string; // Human-readable description
  file: string; // Absolute file path
  position: Position; // Line and column range
  serverName?: string; // Which server has the issue
  suggestion?: string; // Fix recommendation
}

interface McpServerConfig {
  command?: string; // Executable for stdio transport
  args?: string[]; // Command arguments
  env?: Record<string, string>; // Environment variables
  url?: string; // URL for HTTP transport
  timeout?: number; // Server timeout in seconds
}

interface McpConfigInventory {
  files: McpConfigFile[]; // Discovered config files
  summary: InventorySummary; // Aggregated statistics
}
```

### Issue Code Categories

| Category    | Codes                                  | Examples                                |
| ----------- | -------------------------------------- | --------------------------------------- |
| Schema      | `MISSING_COMMAND`, `INVALID_ARGS_TYPE` | Missing required field, wrong type      |
| Path        | `PATH_NOT_FOUND`, `NOT_EXECUTABLE`     | Executable doesn't exist                |
| Environment | `SENSITIVE_ENV_NAME`, `VARIABLE_REF`   | Secrets in config, unresolved variables |
| Transport   | `INVALID_URL`, `DOCKER_MISSING_FLAG`   | Bad URL format, missing `-i` flag       |
| Patterns    | `DEPRECATED_PACKAGE`, `HIGH_TIMEOUT`   | Old npm package, excessive timeout      |

### Tool/Agent Boundary (ADR-0019)

Per [ADR-0019](../adr/0019-tool-agent-boundary-temporal.md), MCP validation tools provide DATA while the agent provides JUDGMENT:

| Tool Provides                     | Agent Reasons About                            |
| --------------------------------- | ---------------------------------------------- |
| Issue with severity and code      | "Should this block the user?"                  |
| Path existence check result       | "Is this a critical missing executable?"       |
| Sensitive variable name detection | "Is this actually a secret or false positive?" |
| Deprecated package identification | "What's the migration path?"                   |

### Performance Characteristics (NFR)

| Metric                 | Target                      | Implementation                 |
| ---------------------- | --------------------------- | ------------------------------ |
| Config discovery       | <2s for project + user dirs | Parallel file existence checks |
| Single file validation | <500ms                      | In-memory validation           |
| Position tracking      | <50ms overhead              | JSONC AST with offset mapping  |

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

| Module         | Responsibility                                                                             |
| -------------- | ------------------------------------------------------------------------------------------ |
| `discovery.ts` | Discovers session JSONL files, decodes project paths from directory names                  |
| `parser.ts`    | Parses JSONL session logs with streaming, handles malformed lines gracefully               |
| `utils.ts`     | Path encoding/decoding, tool categorization (read/write/bash/search), timestamp validation |
| `indexer.ts`   | Indexes session entries into FTS5 table, tracks file metadata for incremental updates      |
| `search.ts`    | Full-text search with BM25 ranking, date range filtering, project filtering                |
| `stats.ts`     | Aggregates session statistics: token usage, tool distribution, model usage                 |
| `metrics.ts`   | Extracts per-session metrics: turns, tokens, compressions, errors                          |

### EP06 Tool Definitions

| Tool                | Description                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| `search_sessions`   | Searches session logs with FTS5 query syntax, returns ranked results with snippets |
| `get_session_stats` | Returns aggregated statistics across sessions with project/date/model filtering    |

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
  type: EntryType; // 'user' | 'assistant' | 'summary' | 'system'
  sessionId: string;
  timestamp: string;
  message?: Message; // Role, content blocks, token usage
  toolUseResult?: ToolResult; // Tool execution result
  filePath: string; // Source file (for causal tracing)
  lineNumber: number; // Line number (for causal tracing)
}

interface SearchResult {
  sessionId: string;
  timestamp: string;
  contentSnippet: string; // Highlighted match context
  relevanceScore: number; // BM25 score (lower = more relevant)
  filePath: string; // Source location for tracing
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

| Metric                 | Target              | Implementation                     |
| ---------------------- | ------------------- | ---------------------------------- |
| Search query time      | <2s on 500MB corpus | FTS5 with BM25 ranking             |
| Indexing throughput    | <60s for 500MB      | Incremental indexing, mtime checks |
| Memory during indexing | <100MB peak         | Streaming parser                   |
| Index storage overhead | <20% of log size    | FTS5 compression                   |

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

| Module                  | Responsibility                                                          |
| ----------------------- | ----------------------------------------------------------------------- |
| `evidence-collector.ts` | Collects evidence from session FTS5 index by keywords and file location |
| `gap-analyzer.ts`       | Analyzes evidence to identify missing configuration guidance            |
| `chain-builder.ts`      | Constructs causal chains from trigger → gap → mechanism → effect        |
| `confidence.ts`         | Assesses chain confidence using 6-factor validation checklist           |
| `counterfactual.ts`     | Generates preventive recommendations ("If X were present...")           |
| `pattern-detector.ts`   | Detects recurring patterns across multiple causal chains                |
| `pattern-tracking.ts`   | Tracks pattern frequency, severity, and trends over time                |
| `git-evidence.ts`       | Collects git blame and pickaxe search evidence                          |
| `config-snapshot.ts`    | Captures CLAUDE.md, settings.json state for gap analysis                |

### EP07 Tool Definitions

| Tool                 | Description                                                                     |
| -------------------- | ------------------------------------------------------------------------------- |
| `trace_issue_origin` | Traces detected issues to their origin in session logs, builds causal chain     |
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
  id: string; // UUID
  type: EvidenceType; // SessionMatch, GitCorrelation, ConfigGap, etc.
  source: string; // Session ID, commit hash, etc.
  timestamp?: string; // When evidence was created
  content?: string; // Relevant snippet
  position?: Position; // File location if applicable
  metadata?: Record<string, unknown>;
}

interface CausalChain {
  id: string; // UUID
  issueId: string; // Reference to detected issue
  trigger: EvidenceItem; // Origin action/prompt
  gap?: Gap; // Configuration gap that enabled issue
  mechanism: string; // How gap led to issue
  effect: string; // Detected issue description
  confidence: ConfidenceScore; // Validation assessment
  evidence: EvidenceItem[]; // All collected evidence
  depth: number; // Traversal steps (max 5)
  projectPath: string;
  createdAt: string;
  counterfactual?: string; // "If X, then Y wouldn't have occurred"
}

interface IssuePattern {
  id: string; // UUID
  category: GapType; // missing_config, context_loss, etc.
  chainIds: string[]; // Related causal chains
  frequency: number; // Occurrence count
  isSystemic: boolean; // true if frequency >= 3
  firstOccurrence: string;
  lastOccurrence: string;
  projectPath?: string; // null = global pattern
  summary: string; // Human-readable description
}
```

### Confidence Assessment

Causal chains are validated using a 6-factor checklist:

| Factor           | Description                             |
| ---------------- | --------------------------------------- |
| Specificity      | Issue clearly links to specific trigger |
| Temporal         | Timing supports causal relationship     |
| Mechanistic      | Plausible mechanism explains causation  |
| Evidence Quality | Evidence is direct, not inferred        |
| Reproducibility  | Pattern seen multiple times             |
| Alternatives     | Alternative causes were considered      |

Overall confidence: `high` (5-6 factors), `medium` (3-4), `low` (0-2)

### Performance Characteristics (NFR)

| Metric              | Target             | Implementation                         |
| ------------------- | ------------------ | -------------------------------------- |
| Trace query time    | <5s typical issues | FTS5 search + in-memory chain building |
| Pattern detection   | <2s for 100 chains | SQLite aggregation queries             |
| Evidence collection | <1s per source     | Parallel session/git queries           |

---

## Level 3: Temporal Analysis Tools (EP09)

The temporal analysis module provides longitudinal tracking of workflow effectiveness through mixed-methods measurement—combining quantitative metrics with structured qualitative reviews.

```
src/temporal/
├── index.ts                    Public exports + type re-exports
├── types.ts                    Core type definitions (Delta, Trend, Review, etc.)
├── config.ts                   Threshold configuration + metric metadata
├── errors.ts                   Domain-specific error classes
│
├── tools/                      SDK tool definitions
│   ├── index.ts                Tool exports
│   ├── descriptions.ts         Rich tool descriptions (poka-yoke)
│   ├── store-baseline.ts       store_baseline tool
│   ├── query-baseline.ts       query_baseline tool
│   ├── list-baselines.ts       list_baselines tool
│   ├── calculate-delta.ts      calculate_delta tool
│   ├── query-trends.ts         query_trends tool
│   ├── conduct-review.ts       conduct_review tool
│   ├── get-review-history.ts   get_review_history tool
│   └── spawn-analyst.ts        spawn_temporal_analyst tool
│
├── delta/                      Baseline comparison
│   ├── calculator.ts           jsondiffpatch-based delta computation
│   ├── summarizer.ts           Human-readable delta summaries
│   └── trends.ts               Change direction extraction
│
├── trends/                     Time-series analysis
│   ├── aggregator.ts           Metric aggregation across baselines
│   ├── regression.ts           Linear regression + slope calculation
│   ├── metric-trend.ts         Per-metric trend computation
│   ├── analysis.ts             TrendAnalysis builder
│   └── inflection.ts           Inflection point detection
│
├── qualitative/                Structured reviews
│   ├── dimensions.ts           6 review dimensions with prompts
│   ├── sentiment.ts            Likert scale calculations
│   ├── trend.ts                Sentiment trend over reviews
│   └── alignment.ts            Quant/qual alignment detection
│
├── tracking/                   Recommendation tracking
│   ├── detector.ts             Evidence extraction from config diffs
│   ├── effectiveness.ts        Pre/post baseline comparison
│   └── api.ts                  High-level tracking operations
│
├── correlation/                Git correlation
│   └── git-history.ts          Commit correlation for inflection points
│
├── reminders/                  Review triggers
│   └── triggers.ts             Time/change-based review prompts
│
├── subagent/                   Temporal analyzer subagent
│   ├── types.ts                Subagent type definitions
│   └── temporal-subagent.ts    Agent prompt + builder
│
└── utils/                      Shared utilities
    └── git.ts                  Git command helpers
```

| Module         | Responsibility                                                  |
| -------------- | --------------------------------------------------------------- |
| `tools/`       | SDK tool definitions following ADR-0005 patterns                |
| `delta/`       | Computes raw deltas between baselines (data, not judgment)      |
| `trends/`      | Statistical analysis: slope, R², volatility, inflection points  |
| `qualitative/` | Dimension definitions, sentiment calculations, alignment checks |
| `tracking/`    | Evidence extraction for recommendation implementation detection |
| `correlation/` | Git commit correlation for causal analysis                      |
| `reminders/`   | Heuristics for suggesting qualitative reviews                   |
| `subagent/`    | Temporal analyzer subagent for trend interpretation             |

### EP09 Tool Definitions

| Tool                 | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `store_baseline`     | Captures current workflow state as a baseline with metrics and findings |
| `query_baseline`     | Retrieves a specific baseline by ID with full metrics                   |
| `list_baselines`     | Lists available baselines with filtering by date range and labels       |
| `calculate_delta`    | Computes differences between two baselines with change summaries        |
| `query_trends`       | Analyzes metric trends over time with regression statistics             |
| `conduct_review`     | Facilitates structured qualitative review across 6 dimensions           |
| `get_review_history` | Retrieves qualitative reviews with sentiment trends                     |

### Tool/Agent Boundary (ADR-0019)

Per [ADR-0019](../adr/0019-tool-agent-boundary-temporal.md), temporal tools provide DATA while the agent provides JUDGMENT:

| Tool Provides         | Agent Reasons About                        |
| --------------------- | ------------------------------------------ |
| Raw metric deltas     | "Is this an improvement?"                  |
| Slope, R², volatility | "Is this trend significant?"               |
| Evidence with weights | "Was this recommendation implemented?"     |
| Change counts         | "What's the overall trajectory?"           |
| Sentiment values      | "What does this mean for workflow health?" |

**Removed functions** (per ADR-0019): `isImprovement()`, `determineOverallTrend()`, `detectImplementation()`, `getSuggestedStatus()`, `generateExplanation()`, `classifyTrend()`, `getSentimentLabel()`

### Key Entity Types

```typescript
interface BaselineDelta {
  fromId: string; // Source baseline
  toId: string; // Target baseline
  delta: DiffPatcher.Delta; // jsondiffpatch output
  summary: DeltaSummary; // Human-readable changes
}

interface DeltaSummary {
  metricsChanged: MetricChange[];
  warningsAdded: string[];
  warningsResolved: string[];
  recommendationsAdded: string[];
  recommendationsResolved: string[];
  trendIndicators: TrendIndicator[];
  changeCounts: { increased: number; decreased: number; unchanged: number };
}

interface TrendAnalysis {
  projectPath: string;
  dateRange: DateRange;
  baselines: BaselineSummary[];
  metricTrends: MetricTrend[]; // Per-metric: slope, R², direction
  inflectionPoints: InflectionPoint[];
  summary: TrendSummary;
}

interface QualitativeReview {
  id: string;
  baselineId: string;
  createdAt: string;
  dimensions: ReviewDimension[]; // 6 dimensions with sentiment + text
  overallSentiment: number; // -2 to +2 Likert scale
  themes: string[]; // Extracted themes
}

interface MatchEvidence {
  evidence: DetectionEvidence[]; // Raw evidence items
  totalWeight: number; // Aggregate weight for agent
  keywordMatches: string[];
  fileMatches: string[];
  patternMatches: string[];
}
```

### Review Dimensions

| Dimension                 | Signal Type | Purpose                      |
| ------------------------- | ----------- | ---------------------------- |
| `perceivedFriction`       | Leading     | Predict workflow issues      |
| `trustCalibration`        | Leading     | Agent reliability perception |
| `taskFit`                 | Lagging     | Tool-task alignment          |
| `configurationConfidence` | Qualitative | Setup effectiveness          |
| `improvementAttribution`  | Causal      | Change impact awareness      |
| `workflowSatisfaction`    | Lagging     | Overall experience           |

### Persistence Layer Integration

Temporal analysis extends the persistence layer with:

```
src/persistence/
├── reviews/                    Qualitative review storage
│   ├── storage.ts              JSON file operations (save, load, delete)
│   ├── indexer.ts              SQLite index for queries
│   └── schema.sql              Review index schema
│
└── tracking/                   Recommendation tracking storage
    ├── storage.ts              JSON file operations
    └── indexer.ts              SQLite index for queries
```

Storage locations:

- Baselines: `.agentlint/baselines/{id}.json`
- Reviews: `.agentlint/reviews/{id}.json`
- Tracking: `.agentlint/tracking/{id}.json`
- Index: `.agentlint/temporal.db`

### Performance Characteristics (NFR)

| Metric               | Target                | Implementation                         |
| -------------------- | --------------------- | -------------------------------------- |
| Delta calculation    | <500ms                | jsondiffpatch in-memory                |
| Trend analysis       | <2s for 100 baselines | SQLite aggregation + linear regression |
| Review storage       | <100ms                | Atomic JSON writes                     |
| Inflection detection | <1s                   | Statistical analysis on time series    |

---

## Level 3: Recommendation Advisor Tools (EP10)

The recommendation advisor module synthesizes actionable recommendations from analysis findings through a reasoning-heavy subagent with case-based state management.

```
src/recommendations/
├── index.ts                    Public exports + type re-exports
├── types.ts                    Core type definitions (Recommendation, Event, etc.)
├── schemas.ts                  Zod validation schemas
│
├── storage/                    Persistence operations
│   ├── index.ts                Storage exports
│   ├── storage.ts              Atomic JSON CRUD (save, load, delete, list)
│   └── compression.ts          Token budgeting + context compression
│
├── tools/                      SDK tool definitions
│   ├── index.ts                Tool exports
│   ├── spawn-advisor.ts        spawn_recommendation_advisor tool
│   ├── create-recommendation.ts create_recommendation tool
│   ├── get-recommendation.ts   get_recommendation tool
│   ├── list-recommendations.ts list_recommendations tool
│   ├── get-recommendation-summary.ts get_recommendation_summary tool
│   ├── add-event.ts            add_recommendation_event tool
│   ├── update-status.ts        update_recommendation_status tool
│   ├── refine-recommendation.ts refine_recommendation tool
│   └── complete-recommendation.ts complete_recommendation tool
│
└── subagent/                   Recommendation advisor subagent
    ├── index.ts                Subagent exports
    ├── types.ts                Subagent type definitions + tool list
    ├── recommendation-advisor.ts Agent prompt + builder
    └── questions.ts            Clarifying question utilities
```

| Module                   | Responsibility                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| `storage/storage.ts`     | Atomic JSON CRUD for recommendations in `.agentlint/recommendations/` |
| `storage/compression.ts` | Token estimation, summary compression within 8K budget                |
| `tools/`                 | SDK tool definitions following ADR-0005 patterns                      |
| `subagent/`              | Recommendation advisor subagent for synthesis and judgment            |

### EP10 Tool Definitions

| Tool                           | Description                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `spawn_recommendation_advisor` | Spawns the recommendation advisor subagent with configurable context                       |
| `create_recommendation`        | Creates a new recommendation case with traced origin                                       |
| `get_recommendation`           | Retrieves a full recommendation with all events                                            |
| `list_recommendations`         | Queries recommendations with filtering by status, type, priority                           |
| `get_recommendation_summary`   | Returns compressed summary for context loading                                             |
| `add_recommendation_event`     | Appends observation, evidence, or feedback to a recommendation                             |
| `update_recommendation_status` | Transitions recommendation status (open → pending_confirmation → implemented → monitoring) |
| `refine_recommendation`        | Updates action, target, or priority with audit trail                                       |
| `complete_recommendation`      | Closes case with reason (implemented, superseded, obsolete, rejected)                      |

### Tool/Agent Boundary (ADR-0019)

Per [ADR-0019](../adr/0019-tool-agent-boundary-temporal.md), recommendation tools provide DATA while the agent provides JUDGMENT:

| Tool Provides                    | Agent Reasons About                         |
| -------------------------------- | ------------------------------------------- |
| Recommendation CRUD operations   | "What type of recommendation is this?"      |
| Event history and summaries      | "Has this recommendation been implemented?" |
| Compressed context within budget | "Which recommendations are most relevant?"  |
| Traced origin data               | "What caused this issue?"                   |
| Status transitions               | "What is the appropriate next status?"      |

### Key Entity Types

```typescript
interface Recommendation {
  id: string; // UUID
  projectPath: string;
  createdAt: string; // ISO 8601
  type: RecommendationType; // 'symptomatic' | 'preventive' | 'systemic'
  action: string; // WHAT to do (max 1000 chars)
  target: string; // WHERE to do it (max 500 chars)
  rationale: string; // WHY this helps (max 2000 chars)
  priority: Priority; // 'high' | 'medium' | 'low'
  tracedOrigin: TracedOrigin; // Causal link to source
  status: RecommendationStatus; // Lifecycle state
  events: RecommendationEvent[]; // Append-only history
  completedAt?: string;
  completionReason?: CompletionReason;
}

interface RecommendationEvent {
  id: string; // UUID
  timestamp: string; // ISO 8601
  type: EventType; // created, observation, refinement, etc.
  content: string; // Max 200 chars per NFR-003
  baselineId?: string;
  sessionId?: string;
  commitHash?: string;
}

interface TracedOrigin {
  findingId?: string; // EP05/EP06/EP07 finding
  sessionId?: string; // Session where issue observed
  configGap?: string; // Missing configuration
  pattern?: string; // Recurring pattern
}

interface RecommendationSummary {
  id: string;
  type: RecommendationType;
  status: RecommendationStatus;
  actionSummary: string; // Max 100 chars
  target: string;
  priority: Priority;
  eventCount: number;
  lastEventAt: string;
  lastEventType: EventType;
  recentActivity: string; // Compressed event summary
  milestones: Milestones;
}
```

### Recommendation Lifecycle

```
┌─────────┐     ┌─────────────────────┐     ┌─────────────┐     ┌────────────┐
│  open   │────►│ pending_confirmation│────►│ implemented │────►│ monitoring │
└─────────┘     └─────────────────────┘     └─────────────┘     └────────────┘
     │                    │                        │                   │
     │                    │                        │                   │
     ▼                    ▼                        ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            completed                                      │
│  Reasons: implemented | superseded | obsolete | rejected                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Persistence Layer Integration

Recommendations are stored as individual JSON files:

```
.agentlint/recommendations/
├── {uuid-1}.json           # Recommendation file with version + data
├── {uuid-2}.json
└── ...
```

Each file follows the `RecommendationFile` schema:

```typescript
interface RecommendationFile {
  version: string; // Schema version (e.g., "1.0.0")
  recommendation: Recommendation;
}
```

### Context Compression (NFR-001/NFR-002)

Per Constitution IX (Agent-Aware), recommendations are compressed for context loading:

| Event Count | Compression Strategy                                            |
| ----------- | --------------------------------------------------------------- |
| ≤3 events   | Include all events verbatim                                     |
| 4-10 events | `[+N earlier events]` prefix + last 3 verbatim                  |
| >10 events  | `[Events summarized - use get_recommendation for full history]` |

Token budget: 8K tokens for all recommendations (newest-first loading).

### Performance Characteristics (NFR)

| Metric              | Target | Implementation                   |
| ------------------- | ------ | -------------------------------- |
| Recommendation save | <100ms | Atomic JSON writes               |
| Context loading     | <500ms | Compression + budget enforcement |
| Summary generation  | <50ms  | In-memory compression            |
| List query          | <200ms | Filesystem directory scan        |

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

---

## Level 3: ACT Subagent Module (EP08)

The ACT (AI Coding Tool) subagent system provides specialized analysis agents that the orchestrator can delegate to via the SDK's native subagent pattern.

```
src/act/
├── index.ts                    Public exports + buildACTSubagents()
├── registry.ts                 ACTSubagentRegistry class
├── types.ts                    AgentDefinition, ACTInstructions, output types
│
└── instructions/               Subagent instruction sets
    ├── index.ts                Bundled instructions aggregator
    ├── claude-code.ts          Claude Code specialist (priority 100)
    └── generalized.ts          Fallback analyzer (priority 10)
```

| Module          | Responsibility                                                                         |
| --------------- | -------------------------------------------------------------------------------------- |
| `index.ts`      | Builds subagent configuration for SDK `agents` option via `buildACTSubagents()`        |
| `registry.ts`   | Manages registration, lookup by name/ACT type, priority-based routing                  |
| `types.ts`      | Zod-validated schemas (`ACTInstructionsSchema`), output types for findings             |
| `instructions/` | Context-engineered prompts following 4-layer structure (Role → Domain → Task → Output) |

### Subagent Definitions

| Subagent                     | ACT Types          | Priority | Tools                                                                                                                                                                                               |
| ---------------------------- | ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude-code-analyzer`       | claude-code        | 100      | discover_configs, parse_config, analyze_hierarchy, search_sessions, get_session_stats                                                                                                               |
| `session-analyst`            | session            | 80       | get_session_timeline, get_tool_sequences, get_file_accesses, get_delegation_events, get_quality_signals, get_mcp_usage                                                                              |
| `recommendation-advisor`     | recommendation     | 80       | create_recommendation, get_recommendation, list_recommendations, get_recommendation_summary, add_recommendation_event, update_recommendation_status, refine_recommendation, complete_recommendation |
| `temporal-analyzer`          | temporal           | 75       | store_baseline, query_baseline, list_baselines, calculate_delta, query_trends, conduct_review, get_review_history                                                                                   |
| `temporal-analyzer-readonly` | temporal           | 50       | query_baseline, list_baselines, calculate_delta, query_trends, get_review_history                                                                                                                   |
| `generalized-analyzer`       | agents-md, unknown | 10       | discover_configs, parse_config                                                                                                                                                                      |

### Key Entity Types

```typescript
interface AgentDefinition {
  description: string; // When to invoke (Claude uses for delegation)
  prompt: string; // Context-engineered system prompt
  tools?: string[]; // Allowed tools (must NOT include 'Task')
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}

interface ACTInstructions {
  name: string; // Unique identifier (e.g., "claude-code-analyzer")
  displayName: string; // Human-readable name
  description: string; // Delegation trigger description
  prompt: string; // Full system prompt (max 50KB)
  tools: string[]; // Allowed tools (validated: no 'Task')
  actTypes: ACTType[]; // Which ACT types this handles
  priority: number; // Selection priority (1-100, higher wins)
  model?: string; // Optional model override
}

interface ACTAnalysisFindings {
  projectPath: string;
  actType: string;
  filesAnalyzed: number;
  configIssues: ACTConfigIssue[];
  sessionIssues?: ACTSessionIssue[];
  recommendations: ACTRecommendation[];
  summary: string;
  limitations?: string[];
}
```

### Opencode SDK Integration

```typescript
import { OpencodeOrchestrator } from './opencode';
import { buildOpencodeAgents } from './act';

// Orchestrator uses Opencode SDK with programmatic agent config
const orchestrator = new OpencodeOrchestrator({
  model: 'claude-sonnet-4-20250514',
  agents: buildOpencodeAgents(), // EP08: ACT subagents
});

for await (const chunk of orchestrator.run(task)) {
  handleChunk(chunk);
}
```

> **Note**: See ADR-0024 for the migration from Claude Agent SDK to Opencode SDK.

### Single-Depth Constraint (C8)

Per Constitution Principle C8 and SDK design, subagents are limited to depth=1:

- **Orchestrator**: `MAX_SUBAGENT_DEPTH = 1` enforced in constructor
- **Schema Validation**: `ACTInstructionsSchema` rejects 'Task' in tools array
- **Error Handling**: `SubagentDepthError` thrown if depth exceeded

This prevents infinite delegation chains while enabling specialized analysis.

---

## Level 3: Debug Infrastructure (EP11)

The debug module provides structured logging with namespace-based filtering, automatic secret redaction, and log rotation for safe debugging output.

**Default Behavior** (following Claude Code / OpenCode pattern):

- Log level: `info` (log everything useful by default)
- Output: `both` (console stderr + file)
- Default log file: `~/.agentlint/logs/{YYYY-MM-DD}.ndjson`
- Log rotation: Keep last 10 files, 500MB max total size
- Use `--no-log` to disable file logging

```
src/debug/
├── index.ts                    Public exports
├── types.ts                    Type definitions (LogLevel, DebugConfig, etc.)
├── namespaces.ts               Standard namespace constants (DEBUG_NAMESPACES)
├── logger.ts                   DebugLogger class with namespace filtering
├── redaction.ts                Secret redaction (patterns, redact(), redactObject())
├── metrics.ts                  TokenTracker for LLM call metrics
└── rotation.ts                 Log rotation (file count + size limits)
```

| Module          | Responsibility                                                                   |
| --------------- | -------------------------------------------------------------------------------- |
| `logger.ts`     | Namespace-based debug logging with verbosity levels, default file output         |
| `namespaces.ts` | Standard namespace constants (TOOLS, LLM, ORCHESTRATION, etc.)                   |
| `redaction.ts`  | Pattern-based secret detection and replacement in strings/objects                |
| `metrics.ts`    | Token usage tracking, latency timers, LLM call metrics aggregation               |
| `rotation.ts`   | Log file rotation: keep last N files, enforce total size cap, cleanup on startup |

### Log Rotation

The rotation module follows the OpenCode pattern for managing log file growth:

| Configuration  | Default             | Description                         |
| -------------- | ------------------- | ----------------------------------- |
| `maxFiles`     | 10                  | Maximum number of log files to keep |
| `maxSizeBytes` | 500MB               | Maximum total size of all log files |
| `logDir`       | `~/.agentlint/logs` | Log directory location              |

```typescript
// Rotation runs automatically on startup
cleanupLogsOnStartup();

// Or manually with custom config
rotateLogFiles({ maxFiles: 5, maxSizeBytes: 100 * 1024 * 1024 });
```

### CLI Flags

| Flag                | Effect                                           |
| ------------------- | ------------------------------------------------ |
| `--no-log`          | Disable file logging for this run                |
| `--no-session`      | Disable session recording for this run           |
| `--log-file <path>` | Override default log file location               |
| `--verbose`         | Increase console verbosity to debug level        |
| `--quiet`           | Suppress console output (file logging continues) |

### Key Entity Types

```typescript
interface IDebugLogger {
  debug(namespace: string, message: string, data?: unknown): void;
  info(namespace: string, message: string, data?: unknown): void;
  warn(namespace: string, message: string, data?: unknown): void;
  error(namespace: string, message: string, data?: unknown): void;
  child(namespace: string): IDebugLogger;
  isEnabled(namespace: string): boolean;
}

interface ITokenTracker {
  recordLLMCall(call: LLMCallMetrics): void;
  getSummary(): MetricsSummary;
  reset(): void;
}

interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}
```

### Secret Redaction

The redaction module provides defense-in-depth for debug output:

| Pattern Category   | Examples                                  |
| ------------------ | ----------------------------------------- |
| API Keys           | `sk-...`, `AKIA...`, `ghp_...`, `ghs_...` |
| Passwords          | `password=`, `secret=`, `token=`          |
| Connection Strings | `postgres://`, `mongodb://`, `redis://`   |
| JWT Tokens         | `eyJ...` (Base64 encoded)                 |
| Private Keys       | `-----BEGIN ... KEY-----`                 |

### Performance Characteristics (NFR)

| Metric                     | Target       | Implementation                |
| -------------------------- | ------------ | ----------------------------- |
| Logger overhead (disabled) | <0.01ms/call | Namespace check short-circuit |
| Redaction (1000 lines)     | <500ms       | Regex-based pattern matching  |
| Token tracking             | <1ms/call    | In-memory accumulation        |

---

## Level 3: Evaluation Framework (EP11)

The evaluation module provides LLM-as-judge evaluation with code-based checks for assessing analysis quality, following [ADR-0012](../adr/0012-evaluation-framework-for-analysis-quality.md).

```
src/eval/
├── index.ts                    Public exports
├── types.ts                    Type definitions (Scenario, EvalResult, etc.)
├── scoring.ts                  Numerical scoring utilities (0-100 scale)
├── feedback.ts                 FeedbackCollector for opt-in user feedback
├── runner.ts                   EvaluationRunner for batch evaluation
│
└── graders/                    Grading implementations
    ├── code-based.ts           Deterministic code-based checks
    └── llm-judge.ts            LLM-as-judge via TruLens
```

| Module                  | Responsibility                                                     |
| ----------------------- | ------------------------------------------------------------------ |
| `scoring.ts`            | Score normalization, weighted aggregation, grade computation       |
| `feedback.ts`           | Opt-in feedback collection with rate limiting (Constitution I)     |
| `runner.ts`             | Load scenarios, run graders, aggregate results, check release gate |
| `graders/code-based.ts` | Deterministic checks (structure, completeness, patterns)           |
| `graders/llm-judge.ts`  | TruLens subprocess integration for semantic evaluation             |

### Key Entity Types

```typescript
interface GoldenScenario {
  id: string;
  version: string;
  source: 'synthetic' | 'recorded' | 'curated';
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  // Scenario-specific data...
}

interface EvaluationResult {
  scenarioId: string;
  passed: boolean;
  scores: Record<string, number>;
  feedback?: string;
  error?: string;
}

interface IFeedbackCollector {
  shouldPrompt(sessionId: string): boolean;
  collectFeedback(outcome: RecommendationOutcome): Promise<void>;
  getPendingFollowUps(): Promise<RecommendationOutcome[]>;
}
```

### TruLens Integration

```typescript
// LLM-as-judge via subprocess
const proc = spawn('uv', ['run', 'python', 'trulens-runner.py', '-'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

// Input: scenario JSON via stdin
// Output: evaluation scores via stdout
```

### Performance Characteristics (NFR)

| Metric             | Target          | Implementation               |
| ------------------ | --------------- | ---------------------------- |
| Code-based grading | <100ms/scenario | In-memory checks             |
| LLM-judge grading  | <30s/scenario   | TruLens subprocess           |
| Release gate check | <5min total     | Parallel scenario evaluation |

---

## Level 3: Secret Detection Module (EP11)

The security module provides pattern-based secret detection with entropy analysis, following [ADR-0013](../adr/0013-secret-detection-strategy.md). Secrets are detected but never stored.

```
src/security/
├── index.ts                    Public exports
├── types.ts                    Type definitions (SecretCandidate, ClassifiedSecret, etc.)
├── entropy.ts                  Shannon entropy calculation for secret likelihood
├── detector.ts                 SecretDetector class with pattern matching
├── classifier.ts               SecretClassifier for LLM-assisted validation
│
└── patterns/                   Detection patterns
    ├── index.ts                Pattern exports
    ├── parser.ts               Gitleaks TOML parser
    └── gitleaks.toml           Bundled detection rules
```

| Module               | Responsibility                                                           |
| -------------------- | ------------------------------------------------------------------------ |
| `entropy.ts`         | Shannon entropy calculation, character set detection, threshold analysis |
| `detector.ts`        | Pattern-based secret detection using Gitleaks rules                      |
| `classifier.ts`      | LLM-assisted classification of detected candidates                       |
| `patterns/parser.ts` | Parse Gitleaks TOML format to internal rules                             |

### Key Entity Types

```typescript
interface SecretCandidate {
  id: string; // UUID
  ruleId: string;
  ruleDescription: string;
  match: string; // INTERNAL ONLY - never serialized
  redactedContext: string; // Context with secret replaced
  entropy: number;
  location: FileLocation;
  keywords?: string[];
  detectedAt: string;
}

// Zod schemas enforce runtime validation
const SafeSecretCandidateSchema = SecretCandidateSchema.omit({ match: true });
type SafeSecretCandidate = z.infer<typeof SafeSecretCandidateSchema>;

interface ClassifiedSecret {
  id: string;
  candidateId: string;
  ruleId: string;
  classification: SecretClassification;
  confidence: number;
  reasoning: string;
  recommendation: string;
  location: FileLocation;
  validatedAt: string;
}

interface ISecretDetector {
  loadPatterns(tomlPath?: string): Promise<PatternSet>;
  scanFile(filePath: string, content: string): Promise<FileScanResult>;
  scanFiles(files: Array<{ path: string; content: string }>): Promise<SecretScanResult>;
  getPatterns(): PatternSet | null;
}
```

### Detection Flow

```
Content → Pattern Matching → Entropy Analysis → Classification → Report
                │                  │                 │
                │                  │                 └─ LLM validates
                │                  └─ Filter low-entropy matches
                └─ Gitleaks rules (400+ patterns)
```

### Pattern Compatibility

Gitleaks patterns use Go regex syntax, which differs from JavaScript:

- **Go-specific features**: Some patterns use features not available in JS (e.g., `(?i)` inline case-insensitive)
- **Pattern loading**: Parser strips `(?i)` flags and applies JS equivalents
- **Validation**: `isValidRegex()` validates patterns for JS compatibility at runtime
- **Graceful degradation**: Invalid patterns are logged and skipped

### Security Considerations

| Aspect              | Implementation                                                          |
| ------------------- | ----------------------------------------------------------------------- |
| Never store secrets | `match` field stripped via Zod schema validation before serialization   |
| Runtime enforcement | `SafeSecretCandidateSchema` validates at runtime, not just compile time |
| Redact in logs      | Debug output uses redaction patterns                                    |
| Entropy threshold   | Default 3.5 bits/char filters false positives                           |
| Pattern source      | Gitleaks community rules (open source)                                  |

### Performance Characteristics (NFR)

| Metric              | Target      | Implementation                   |
| ------------------- | ----------- | -------------------------------- |
| File scan           | <1s/file    | Regex pattern matching           |
| Entropy calculation | <1ms/string | Shannon formula                  |
| Pattern loading     | <100ms      | TOML parsing + regex compilation |

---

## Level 3: Telemetry Infrastructure (EP11)

The telemetry module provides opt-in observability infrastructure for agentlint with HoneyHive integration for trace visualization. **Disabled by default** per Constitution Principle I (Local-First).

**Enable via:**

- Environment variable: `AGENTLINT_TELEMETRY=alpha`
- Debug mode: `AGENTLINT_TELEMETRY_DEBUG=1` (logs to stderr)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI (src/telemetry/)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AlphaTelemetryClient                                     │   │
│  │  • Buffers events (10s flush interval, 100 event max)    │   │
│  │  • NO secrets - only POSTs JSON to proxy                 │   │
│  │  • Secret redaction via redact() before transmission     │   │
│  └─────────────────────────────┬────────────────────────────┘   │
└────────────────────────────────┼────────────────────────────────┘
                                 │ HTTPS POST
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           Vercel Edge Function (apps/telemetry-api/)             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /api/events route.ts                                     │   │
│  │  • Rate limiting (100 req/min/IP)                        │   │
│  │  • Payload validation                                     │   │
│  │  • Event → HoneyHive schema transformation               │   │
│  │  • HONEYHIVE_API_KEY stored server-side only             │   │
│  └─────────────────────────────┬────────────────────────────┘   │
└────────────────────────────────┼────────────────────────────────┘
                                 │ HoneyHive API
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HoneyHive Dashboard                           │
│  • Session traces with parent-child hierarchy                    │
│  • Tool inputs/outputs for debugging                             │
│  • LLM metrics (tokens, latency, cache hits)                    │
│  • Error tracking and filtering                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/telemetry/
├── index.ts                    Public exports, interfaces, client factory
├── events.ts                   Event types, schemas, sanitization
└── alpha-client.ts             Alpha phase client with HoneyHive forwarding

apps/telemetry-api/
└── app/api/events/
    └── route.ts                Vercel Edge Function for HoneyHive forwarding
```

| Module            | Responsibility                                                      |
| ----------------- | ------------------------------------------------------------------- |
| `index.ts`        | ITelemetryClient interface, TrackToolOptions/TrackLLMOptions types  |
| `events.ts`       | TelemetryEvent schema, sanitizeEventData(), secret redaction        |
| `alpha-client.ts` | AlphaTelemetryClient with buffering, flush, session tracking        |
| `route.ts`        | Edge function: validation, HoneyHive schema mapping, API forwarding |

### Event Types

| Event Type         | HoneyHive Type | Data Captured                                                  |
| ------------------ | -------------- | -------------------------------------------------------------- |
| `session.start`    | `chain`        | Command, directory, project type, config presence              |
| `session.end`      | `chain`        | Duration, tool/finding counts, total tokens, success           |
| `tool.call`        | `tool`         | Tool name, arguments (full), result (truncated), error message |
| `llm.usage`        | `model`        | Model, tokens (in/out/cache), latency, stop reason             |
| `finding.detected` | `chain`        | Finding type, severity                                         |
| `session.error`    | `chain`        | Error type, error code                                         |

### HoneyHive Schema Mapping

The edge function transforms agentlint events to HoneyHive's full schema:

| HoneyHive Field   | Source                             | Purpose                               |
| ----------------- | ---------------------------------- | ------------------------------------- |
| `session_name`    | `agentlint-{command}-{YYYY-MM-DD}` | Human-readable session identification |
| `event_name`      | `Tool: {name}`, `Claude: {model}`  | Descriptive event names in traces     |
| `config`          | Model params, tool provider        | Event-specific configuration          |
| `inputs`          | Tool arguments, LLM params         | Full debugging context                |
| `outputs`         | Tool results, completion tokens    | Operation outcomes                    |
| `metrics`         | Tokens, latency, cache hits        | KPI tracking and dashboards           |
| `user_properties` | Version, platform, node            | Filtering and segmentation            |
| `error`           | Error message                      | Failed operation tracking             |
| `parent_id`       | Session event ID                   | Trace hierarchy                       |

### Cache Token Tracking

Prompt caching metrics are captured for cost optimization insights:

```typescript
interface TrackLLMOptions {
  // ... standard fields ...
  cacheReadTokens?: number; // Tokens read from Anthropic cache
  cacheCreationTokens?: number; // Tokens added to cache
}
```

Displayed in HoneyHive metrics as `cache_read_tokens` and `cache_creation_tokens`.

### Key Entity Types

```typescript
interface ITelemetryClient {
  readonly mode: 'disabled' | 'alpha';
  isEnabled(): boolean;
  init(config: TelemetryConfig): Promise<void>;
  record(event: TelemetryEvent): void;
  sessionStart(sessionId: string, data?: SessionStartData): void;
  sessionEnd(sessionId: string, metrics: SessionMetrics): void;
  trackTool(sessionId: string, tool: string, durationMs: number, success: boolean): void;
  trackToolEx?(sessionId: string, options: TrackToolOptions): void;
  trackLLM(sessionId: string, model: string, inputTokens: number, outputTokens: number): void;
  trackLLMEx?(sessionId: string, options: TrackLLMOptions): void;
  trackFinding(sessionId: string, findingType: string, severity: string): void;
  trackError(sessionId: string, errorType: string, errorCode?: string): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string; // ISO-8601
  startTime: number; // UTC ms (HoneyHive requirement)
  endTime: number; // UTC ms (HoneyHive requirement)
  sessionId: string;
  eventId: string; // UUID for hierarchy
  parentEventId?: string; // Parent for trace tree
  sequence: number;
  data: Record<string, unknown>;
  meta: TelemetryEventMeta;
}
```

### Client Implementations

| Client                 | Mode       | Behavior                              |
| ---------------------- | ---------- | ------------------------------------- |
| `NoOpTelemetryClient`  | `disabled` | All methods are no-ops (default)      |
| `AlphaTelemetryClient` | `alpha`    | Buffers events, POSTs to Vercel proxy |

### Constitution Compliance

| Principle      | Implementation                                                     |
| -------------- | ------------------------------------------------------------------ |
| I. Local-First | Disabled by default, explicit `AGENTLINT_TELEMETRY=alpha` required |
| Privacy        | Secrets redacted via `redact()` patterns; API key server-side only |
| Agent-Aware    | Full tool I/O captured for debugging agent behavior                |

### Performance Characteristics (NFR)

| Metric             | Target       | Implementation           |
| ------------------ | ------------ | ------------------------ |
| Event buffering    | 10s interval | setInterval with unref() |
| Flush timeout      | 5s max       | AbortController          |
| Max buffer size    | 100 events   | Force flush at limit     |
| Redaction overhead | <1ms/event   | Regex pattern matching   |

---

## Level 3: Skills Effectiveness Data Tools (EP14)

The skills module provides data retrieval tools for analyzing skill usage effectiveness, enabling the agent to reason about skill invocation patterns and identify opportunities for better skill discoverability.

```
src/skills/
├── index.ts                    Public exports + type re-exports
├── types.ts                    Core type definitions (SkillInventoryItem, SkillInvocationRecord, etc.)
├── schemas.ts                  Zod validation schemas for tool inputs
│
├── discovery.ts                Skill file discovery wrapping src/tools/config/skills.ts
├── detection.ts                Skill tool_use detection in session logs
│
├── storage/                    Database operations
│   ├── index.ts                Storage exports
│   ├── schema.ts               skill_invocations table schema
│   └── queries.ts              Query functions for invocation data
│
└── tools/                      SDK tool definitions
    ├── index.ts                Tool exports + EP14_SKILLS_TOOLS array
    ├── get-skill-inventory-tool.ts       get_skill_inventory tool
    ├── index-skill-invocations-tool.ts   index_skill_invocations tool
    ├── get-session-summaries-tool.ts     get_session_summaries tool
    └── get-skill-invocations-tool.ts     get_skill_invocations tool
```

| Module               | Responsibility                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `discovery.ts`       | Discovers SKILL.md files in `.claude/skills/`, extracts names, descriptions, file patterns |
| `detection.ts`       | Detects Skill tool_use entries in session JSONL logs, extracts command and context         |
| `storage/schema.ts`  | Defines `skill_invocations` table in sessions.db                                           |
| `storage/queries.ts` | Query functions with filtering by skill, session, date range                               |
| `tools/`             | SDK tool definitions following ADR-0005 patterns                                           |

### EP14 Tool Definitions

| Tool                      | Description                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `get_skill_inventory`     | Returns skills defined in `.claude/skills/` with names, descriptions, and file patterns |
| `index_skill_invocations` | Indexes Skill tool_use entries from session logs into database                          |
| `get_session_summaries`   | Returns session summaries with first user prompt, files operated, and skills invoked    |
| `get_skill_invocations`   | Queries skill invocation records with filtering by skill, session, and date range       |

### Tool/Agent Boundary (Constitution VII)

Per Constitution Principle VII, skills tools provide DATA while the agent provides JUDGMENT:

| Tool Provides                         | Agent Reasons About                                     |
| ------------------------------------- | ------------------------------------------------------- |
| Raw invocation counts                 | "Is this usage rate low?"                               |
| Session summaries with skills invoked | "Should a skill have been used here?"                   |
| User prompts that triggered skills    | "Does the description match how users phrase requests?" |
| File patterns in skill definitions    | "Are the patterns effective hints?"                     |

**Critical Design Principle**: Tools return facts; the agent reasons about what they mean. No thresholds, no detection logic, no "missed opportunity" classification in tools.

### Key Entity Types

```typescript
interface SkillInventoryItem {
  name: string; // Skill name from frontmatter
  description: string; // Skill description
  path: string; // Relative path to SKILL.md
  filePath: string; // Absolute path
  userInvocable: boolean; // Can users invoke via /skill
  filePatterns?: string[]; // Optional hint patterns
}

interface SkillInvocationRecord {
  id: string; // UUID
  sessionId: string; // Session where invoked
  skillName: string; // Which skill
  timestamp: string; // ISO 8601
  userPromptContext?: string; // User prompt that triggered invocation
  filesOperated?: string[]; // Files touched during invocation
}

interface SessionSummary {
  sessionId: string;
  projectPath: string;
  firstUserPrompt?: string; // First user message (truncated)
  filesOperated: string[]; // Files read/written/edited
  skillsInvoked: string[]; // Skills used in session
  timestamp: string;
}

interface GetSkillInventoryResult {
  projectPath: string;
  skillCount: number;
  skills: SkillInventoryItem[];
  _rawData: {
    skills: SkillInventoryItem[];
    discoveredAt: string;
  };
}
```

### Database Schema

The `skill_invocations` table extends `sessions.db`:

```sql
CREATE TABLE IF NOT EXISTS skill_invocations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_prompt_context TEXT,
  files_operated TEXT,  -- JSON array
  indexed_at TEXT NOT NULL,

  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_skill_invocations_skill ON skill_invocations(skill_name);
CREATE INDEX idx_skill_invocations_session ON skill_invocations(session_id);
CREATE INDEX idx_skill_invocations_timestamp ON skill_invocations(timestamp);
```

### CLI Integration

The `agentlint skills` command provides standalone skill inventory access:

```bash
agentlint skills                  # List all skills
agentlint skills --detail commit  # Show single skill details
agentlint skills --stats          # Include invocation statistics
agentlint skills --json           # JSON output
agentlint skills --markdown       # Markdown output
```

### Baseline Integration

Skills metrics are optionally captured in baselines via `store_baseline --include-skills-metrics`:

| Metric                   | Description                             |
| ------------------------ | --------------------------------------- |
| `skillInvocationCount`   | Total skill invocations across sessions |
| `uniqueSkillsUsed`       | Number of distinct skills invoked       |
| `sessionsWithSkillUsage` | Sessions that used at least one skill   |
| `skillsDefinedCount`     | Total skills in `.claude/skills/`       |

### Performance Characteristics (NFR)

| Metric              | Target                 | Implementation                               |
| ------------------- | ---------------------- | -------------------------------------------- |
| Skill discovery     | <100ms                 | fast-glob with early exclusion               |
| Invocation indexing | <2s for 100 sessions   | Streaming JSONL parse + batch SQLite inserts |
| Query by skill      | <50ms                  | SQLite indexed queries                       |
| Session summaries   | <500ms for 50 sessions | Aggregate query with limits                  |

---

## Level 3: Session Intelligence Tools (EP15)

The session intelligence module provides tools for understanding what happened in Claude Code sessions and why. It enables narrative understanding rather than raw metrics, supporting post-session analysis and pattern detection.

```
src/sessions/
├── index.ts                    Public exports + module version
├── types.ts                    Core type definitions (SessionTimeline, Intent, Outcome, etc.)
├── schemas.ts                  Zod validation schemas for all types
│
├── extraction/                 Static extraction functions
│   ├── index.ts                Extraction exports
│   ├── timeline.ts             Intent and outcome extraction
│   ├── compressions.ts         Context compression event detection
│   ├── tool-sequences.ts       Tool call sequence extraction
│   ├── file-accesses.ts        File operation tracking
│   ├── delegations.ts          Task tool delegation detection
│   ├── quality-signals.ts      Test/build/lint outcome detection
│   ├── mcp-calls.ts            MCP tool usage extraction
│   ├── permissions.ts          Permission request tracking
│   └── timeline-viz.ts         Timeline visualization data structures
│
├── storage/                    Database operations
│   ├── index.ts                Storage exports
│   ├── schema.ts               6 new tables extending sessions.db
│   └── queries.ts              Query functions for all tables
│
├── tools/                      SDK tool definitions
│   ├── index.ts                Tool exports + EP15_SESSION_INTELLIGENCE_TOOLS
│   ├── get-session-timeline-tool.ts     Timeline extraction
│   ├── get-tool-sequences-tool.ts       Tool flow analysis
│   ├── get-file-accesses-tool.ts        File operation queries
│   ├── get-delegation-events-tool.ts    Task tool usage
│   ├── get-quality-signals-tool.ts      Test/build/lint outcomes
│   ├── get-mcp-usage-tool.ts            MCP server health
│   └── spawn-session-analyst.ts         Subagent spawning
│
└── subagent/                   Session Analyst subagent
    ├── index.ts                Subagent exports
    ├── types.ts                Subagent type definitions
    └── session-analyst.ts      Agent prompt + builder
```

| Module        | Responsibility                                                     |
| ------------- | ------------------------------------------------------------------ |
| `extraction/` | Static functions for extracting structured data from session JSONL |
| `storage/`    | SQLite schema and queries for session intelligence data            |
| `tools/`      | SDK tool definitions following ADR-0005 patterns                   |
| `subagent/`   | Session Analyst subagent for narrative analysis                    |

### EP15 Tool Definitions

| Tool                    | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `get_session_timeline`  | Extracts session intent, outcome signals, and token metrics |
| `get_tool_sequences`    | Extracts tool call sequences with repeat pattern detection  |
| `get_file_accesses`     | Tracks file read/write/edit operations per session          |
| `get_delegation_events` | Identifies Task tool usage and subagent patterns            |
| `get_quality_signals`   | Detects test/build/lint outcomes from Bash outputs          |
| `get_mcp_usage`         | Analyzes MCP server usage and error rates                   |
| `get_permission_events` | Queries permission request patterns and approval rates      |
| `spawn_session_analyst` | Spawns Session Analyst subagent for deep analysis           |

### Tool/Agent Boundary (ADR-0019)

Per [ADR-0019](../adr/0019-tool-agent-boundary-temporal.md), session tools provide DATA while the agent provides JUDGMENT:

| Tool Provides                          | Agent Reasons About                      |
| -------------------------------------- | ---------------------------------------- |
| Raw timeline (intent, outcome signals) | "Was this session successful?"           |
| Tool sequences with repeat counts      | "Is the agent stuck in a loop?"          |
| File access patterns                   | "What was the focus area?"               |
| Quality signal outcomes                | "Did the tests pass? Is the code ready?" |
| MCP error rates                        | "Is this integration healthy?"           |

**Critical Design Principle**: Tools return signals (containsThanks, endsWithError, repeatCount); the agent interprets what they mean in context.

### Session Analyst Subagent

The Session Analyst is a specialized subagent for narrative understanding:

```typescript
// 4-layer prompt structure (~7KB)
const SESSION_ANALYST_PROMPT = `
## ROLE IDENTITY
You are the Session Analyst, a specialist for understanding Claude Code sessions...

## DOMAIN KNOWLEDGE
Session structure, tool categories, phase detection guidance...

## YOUR TASK
Analyze session data to provide actionable insights...

## TOOLS AVAILABLE
get_session_timeline, get_tool_sequences, get_file_accesses,
get_delegation_events, get_quality_signals, get_mcp_usage
`;

// Per Constitution C8: No Task tool (depth=1)
const SESSION_ANALYST_TOOLS = [
  'get_session_timeline',
  'get_tool_sequences',
  'get_file_accesses',
  'get_delegation_events',
  'get_quality_signals',
  'get_mcp_usage',
];
```

Focus options for `spawn_session_analyst`:

- `narrative`: Session story and key decisions
- `flow`: Tool patterns and phase detection
- `quality`: Test/build outcomes and reliability
- `comprehensive`: All of the above combined

### Key Entity Types

```typescript
interface SessionTimeline {
  sessionId: string;
  projectPath: string;
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
  turnCount: number;
  intent: Intent;
  outcome: SessionOutcome;
  metrics: SessionMetrics;
}

interface Intent {
  firstUserPrompt?: string;
  timestamp?: string;
  promptLength: number;
}

interface SessionOutcome {
  lastUserPrompt?: string;
  lastToolCall?: { name: string; success: boolean };
  hasCommitActivity: boolean;
  turnCount: number;
  signals: OutcomeSignals;
}

interface OutcomeSignals {
  containsThanks: boolean; // User expressed gratitude
  containsDone: boolean; // User indicated completion
  endsWithError: boolean; // Last message was error
  hasUnresolvedError: boolean; // Error without recovery
}

interface ToolCallRecord {
  sessionId: string;
  sequenceNumber: number;
  toolName: string;
  timestamp: string;
  inputHash: string; // For repeat detection
  isError: boolean;
  filePath: string; // Source for causal tracing
  lineNumber: number;
}

interface QualitySignalRecord {
  sessionId: string;
  signalType: 'test' | 'build' | 'lint';
  outcome: 'pass' | 'fail' | 'indeterminate';
  rawOutput: string; // For agent interpretation
  timestamp: string;
}
```

### Database Schema

EP15 adds 6 tables to `sessions.db`:

```sql
-- Tool call sequences for flow analysis
CREATE TABLE tool_call_sequences (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  input_hash TEXT,
  is_error INTEGER DEFAULT 0,
  file_path TEXT,
  line_number INTEGER
);

-- File access tracking
CREATE TABLE file_accesses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL,        -- 'read' | 'write' | 'edit'
  timestamp TEXT NOT NULL,
  source_tool TEXT
);

-- Compression events for context loss detection
CREATE TABLE compression_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  compression_type TEXT NOT NULL, -- 'compact' | 'microcompact'
  timestamp TEXT NOT NULL,
  summary_length INTEGER
);

-- Delegation events for Task tool analysis
CREATE TABLE delegation_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  subagent_type TEXT NOT NULL,
  prompt_summary TEXT,
  success INTEGER,
  timestamp TEXT NOT NULL
);

-- MCP tool calls for integration health
CREATE TABLE mcp_tool_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_error INTEGER DEFAULT 0
);

-- Quality signals for test/build/lint outcomes
CREATE TABLE quality_signals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,      -- 'test' | 'build' | 'lint'
  outcome TEXT NOT NULL,          -- 'pass' | 'fail' | 'indeterminate'
  raw_output TEXT,
  timestamp TEXT NOT NULL
);
```

### CLI Integration

The `agentlint analyse --session` command enables session analysis:

```bash
agentlint analyse --session <id>    # Analyze specific session
agentlint analyse --session <path>  # Analyze from file path
```

### Performance Characteristics (NFR)

| Metric                   | Target | Implementation                 |
| ------------------------ | ------ | ------------------------------ |
| Timeline extraction      | <500ms | Streaming JSONL parse          |
| Tool sequence query      | <100ms | SQLite indexed queries         |
| Quality signal detection | <200ms | Regex pattern matching         |
| Full session analysis    | <5s    | Parallel extraction + subagent |
