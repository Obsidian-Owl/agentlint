# 5. Building Block View

This section describes the static decomposition of agentlint into building blocks (components, modules, packages).

## 5.1 Level 1: System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LEVEL 1: SYSTEM CONTEXT                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐                                      ┌──────────────┐   │
│   │  Developer   │                                      │ LLM Provider │   │
│   │  (Human)     │                                      │ (Anthropic/  │   │
│   └──────┬───────┘                                      │  OpenAI)     │   │
│          │                                              └──────┬───────┘   │
│          │ CLI commands                                        │ API       │
│          ▼                                                     ▼           │
│   ┌──────────────────────────────────────────────────────────────────┐    │
│   │                         agentlint                                 │    │
│   │                                                                   │    │
│   │  Analyzes AI-assisted development workflows and provides         │    │
│   │  actionable recommendations for improvement                       │    │
│   └──────────────────────────────────────────────────────────────────┘    │
│          │                                                     │           │
│          │ Reads                                               │ Reads     │
│          ▼                                                     ▼           │
│   ┌──────────────┐                                      ┌──────────────┐   │
│   │ Project      │                                      │ AI Session   │   │
│   │ Files        │                                      │ Logs         │   │
│   │ (configs,    │                                      │ (JSONL)      │   │
│   │  source)     │                                      │              │   │
│   └──────────────┘                                      └──────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.2 Level 2: Container View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LEVEL 2: CONTAINERS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────────────┐                        │
│                         │       CLI Layer         │                        │
│                         │      (src/cli/)         │                        │
│                         │                         │                        │
│                         │ • Command parsing       │                        │
│                         │ • Output rendering      │                        │
│                         │ • Interactive prompts   │                        │
│                         └───────────┬─────────────┘                        │
│                                     │                                       │
│                                     ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Agent Layer (src/agent/)                       │  │
│  │                                                                       │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │  │
│  │  │   Orchestrator   │  │    Subagents     │  │   Working Memory │   │  │
│  │  │                  │  │                  │  │                  │   │  │
│  │  │ • Task planning  │  │ • Config agent   │  │ • Context mgmt   │   │  │
│  │  │ • Tool dispatch  │  │ • Session agent  │  │ • Compression    │   │  │
│  │  │ • Result merge   │  │ • Docs agent     │  │ • Checkpoints    │   │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘   │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │                      Agent Tools (src/agent/tools/)              │ │  │
│  │  │                                                                  │ │  │
│  │  │  ConfigParser │ SessionStats │ GitQuery │ ReadFile │ FTS5Search │ │  │
│  │  │  BaselineQuery│ LanguageAnalyzer │ SaveFinding                  │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│           ┌─────────────────────────┼─────────────────────────┐            │
│           │                         │                         │            │
│           ▼                         ▼                         ▼            │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐       │
│  │   Adapters      │    │   Analyzers     │    │   Storage       │       │
│  │ (src/adapters/) │    │ (src/analyzers/)│    │ (src/storage/)  │       │
│  │                 │    │                 │    │                 │       │
│  │ • Claude Code   │    │ • TypeScript    │    │ • SQLite DB     │       │
│  │ • Cursor        │    │ • Python        │    │ • FTS5 Index    │       │
│  │ • Aider         │    │ • Go            │    │ • Cache         │       │
│  │ • Cline         │    │ • Generic       │    │ • Baselines     │       │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘       │
│                                     │                                       │
│                                     ▼                                       │
│                        ┌─────────────────┐                                 │
│                        │   Causal Engine │                                 │
│                        │ (src/causal/)   │                                 │
│                        │                 │                                 │
│                        │ • Detector      │                                 │
│                        │ • Tracer        │                                 │
│                        │ • Hindsight     │                                 │
│                        └─────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.3 Level 3: Component Details

### 5.3.1 CLI Layer

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| **Command Router** | Parse CLI args, dispatch to handlers | `src/cli/index.ts` |
| **Init Command** | Interactive setup wizard | `src/cli/commands/init.ts` |
| **Analyse Command** | Primary analysis entry point | `src/cli/commands/analyse.ts` |
| **Recommend Command** | Show recommendations | `src/cli/commands/recommend.ts` |
| **Trace Command** | Causal origin tracing | `src/cli/commands/trace.ts` |
| **Output Renderer** | Format results (text, JSON, SARIF) | `src/cli/render/*.ts` |

**Key Interfaces:**

```typescript
// Command interface (Clerc-based)
interface CommandHandler<T extends CommandOptions> {
  name: string;
  description: string;
  options: T;
  action: (options: T) => Promise<ExitCode>;
}

// Output renderer interface
interface OutputRenderer {
  renderAnalysis(result: AnalysisResult): string;
  renderError(error: AgentlintError): string;
  renderProgress(progress: ProgressEvent): void;
}
```

### 5.3.2 Agent Layer

| Component | Responsibility | ADR |
|-----------|----------------|-----|
| **Orchestrator** | Coordinate analysis, dispatch subagents | [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) |
| **Subagents** | Domain-specific analysis (config, session, docs) | [ADR-0011](../adr/0011-parallel-processing-architecture.md) |
| **Working Memory** | Context management, compression | [ADR-0027](../adr/0027-agent-working-memory-architecture.md) |
| **Tools** | Agent-callable functions | [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) |

**Key Interfaces:**

```typescript
// Agent context (AX-optimized)
interface AgentContext {
  taskGoal: string;
  projectSummary: ProjectSummary;
  analysisProgress: ProgressSummary;
  staticFindings: CompressedFindings;
  codeSamples: CodeSample[];
  priorKnowledge: HindsightNote[];
  tokenBudgetRemaining: number;
}

// Agent tool definition (Vercel AI SDK)
interface AgentTool<TInput, TOutput> {
  name: string;
  description: string;
  parameters: ZodSchema<TInput>;
  execute: (input: TInput) => Promise<TOutput>;
}
```

### 5.3.3 Adapters Layer

| Adapter | AI Tool | Config Files | Session Logs | ADR |
|---------|---------|--------------|--------------|-----|
| `ClaudeCodeAdapter` | Claude Code | `CLAUDE.md`, `.claude/` | `~/.claude/**/*.jsonl` | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| `CursorAdapter` | Cursor | `.cursorrules` | `.cursor/logs/` | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| `AiderAdapter` | Aider | `.aider.conf.yml` | `.aider/logs/` | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| `ClineAdapter` | Cline | `.clinerules` | `.cline/tasks/` | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |

**Key Interface:**

```typescript
interface AIToolAdapter {
  readonly id: AIToolId;
  readonly displayName: string;

  // Detection
  detect(projectPath: string): Promise<DetectionResult>;

  // Config parsing
  parseConfig(projectPath: string): Promise<AIToolConfig>;

  // Session log parsing
  parseSessionLogs(logPaths: string[]): Promise<SessionLog[]>;

  // Agent profile (for AX context)
  getAgentProfile(): AgentProfile;

  // Recommendation formatting
  formatRecommendation(rec: Recommendation): string;
}
```

### 5.3.4 Analyzers Layer

| Analyzer | Language | Tier | Capabilities | ADR |
|----------|----------|------|--------------|-----|
| `TypeScriptAnalyzer` | TS/JS | 1 | Types, modules, coverage | [ADR-0019](../adr/0019-language-ecosystem-support.md) |
| `PythonAnalyzer` | Python | 2 | Type hints, docstrings | [ADR-0019](../adr/0019-language-ecosystem-support.md) |
| `GoAnalyzer` | Go | 3 | Packages, interfaces | [ADR-0019](../adr/0019-language-ecosystem-support.md) |
| `GenericAnalyzer` | Any | 4 | File patterns, basic metrics | [ADR-0019](../adr/0019-language-ecosystem-support.md) |

**Key Interface:**

```typescript
interface LanguageAnalyzer {
  readonly language: LanguageId;
  readonly tier: 1 | 2 | 3 | 4;

  // Analysis
  analyze(files: SourceFile[]): Promise<LanguageAnalysis>;

  // Metrics extraction
  extractMetrics(file: SourceFile): Promise<FileMetrics>;

  // Pattern detection
  detectPatterns(files: SourceFile[]): Promise<CodePattern[]>;
}
```

### 5.3.5 Storage Layer

| Component | Responsibility | ADR |
|-----------|----------------|-----|
| **SQLite Database** | Persistent storage (WAL mode) | [ADR-0003](../adr/0003-local-storage-strategy.md) |
| **FTS5 Index** | Full-text search on session logs | [ADR-0003](../adr/0003-local-storage-strategy.md) |
| **Cache Manager** | Multi-layer caching | [ADR-0021](../adr/0021-caching-strategy.md) |
| **Baseline Repository** | Historical comparison data | [ADR-0003](../adr/0003-local-storage-strategy.md) |
| **Hindsight Repository** | Cross-session learnings | [ADR-0026](../adr/0026-hindsight-capture-and-knowledge-surfacing-strategy.md) |

**Database Schema Overview:**

```sql
-- Core tables
CREATE TABLE findings (id, analysis_id, type, severity, ...);
CREATE TABLE baselines (id, project_path, created_at, data);
CREATE TABLE hindsight_notes (id, pattern, solution, status, ...);
CREATE TABLE causal_traces (id, issue_id, origin_type, evidence);
CREATE TABLE project_memory (project_path, patterns, hindsight_ids);
CREATE TABLE analysis_checkpoints (analysis_id, memory_state);

-- FTS5 indexes
CREATE VIRTUAL TABLE sessions_fts USING fts5(content, ...);
CREATE VIRTUAL TABLE hindsight_fts USING fts5(title, description, ...);

-- Cache tables
CREATE TABLE cache_entries (key, value, expires_at, layer);
```

### 5.3.6 Causal Engine

| Component | Responsibility | ADR |
|-----------|----------------|-----|
| **Detector** | Identify issues in analysis results | [ADR-0007](../adr/0007-causal-analysis-architecture.md) |
| **Tracer** | Link issues to origins | [ADR-0007](../adr/0007-causal-analysis-architecture.md) |
| **Hindsight Manager** | Extract and manage learnings | [ADR-0026](../adr/0026-hindsight-capture-and-knowledge-surfacing-strategy.md) |

**Key Interface:**

```typescript
interface CausalTracer {
  // Detect issues
  detectIssues(findings: Finding[]): Promise<Issue[]>;

  // Trace to origin
  traceOrigin(issue: Issue): Promise<CausalTrace>;

  // Build causal chain
  buildCausalChain(trace: CausalTrace): Promise<CausalChain>;
}
```

## 5.4 Component Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       COMPONENT DEPENDENCIES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLI Layer                                                                  │
│      │                                                                      │
│      └──depends on──► Agent Layer                                          │
│                            │                                                │
│                            ├──depends on──► Adapters                        │
│                            ├──depends on──► Analyzers                       │
│                            ├──depends on──► Storage                         │
│                            └──depends on──► Causal Engine                   │
│                                                                             │
│  Adapters ──depends on──► Storage (for caching)                            │
│  Analyzers ──depends on──► Storage (for caching)                           │
│  Causal Engine ──depends on──► Storage (for hindsight)                     │
│                                                                             │
│  All layers ──depend on──► Config (configuration management)               │
│                                                                             │
│  Direction: Dependencies flow DOWN (CLI → Agent → Services → Storage)      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.5 External Dependencies

| Dependency | Purpose | Layer |
|------------|---------|-------|
| Vercel AI SDK | LLM provider abstraction | Agent |
| Clerc | CLI parsing | CLI |
| @clack/prompts | Interactive prompts | CLI |
| Consola | Logging | All |
| Zod | Schema validation | All |
| SQLite (Bun built-in) | Database | Storage |

## Related ADRs

- [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) - Agent architecture
- [ADR-0011](../adr/0011-parallel-processing-architecture.md) - Subagent pattern
- [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) - Adapter pattern
- [ADR-0019](../adr/0019-language-ecosystem-support.md) - Analyzer tiers
- [ADR-0027](../adr/0027-agent-working-memory-architecture.md) - Working memory
- [ADR-0028](../adr/0028-agent-modularity-and-extension-pattern.md) - Component modularity
