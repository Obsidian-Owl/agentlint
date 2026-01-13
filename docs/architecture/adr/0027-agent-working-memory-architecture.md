---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0027: Agent Working Memory Architecture

## Context and Problem Statement

agentlint's analysis agents (ADR-0006, ADR-0011) process large inputs—session logs up to 100MB, codebases with thousands of files, and multi-domain analysis. These agents need a structured "cognitive workspace" to:

1. Track task goals and progress during analysis
2. Preserve critical information when context approaches limits
3. Enable reproducible analysis while supporting per-project learning
4. Separate what agents need (AX) from what users see (UX)

The Constitution's Agent-Aware principle (IX) states: "Large inputs are compressed before LLM analysis. Agent context is hierarchically structured. Working memory preserves critical info."

This ADR formalizes the working memory architecture for agentlint's analysis agents.

### Prior ADR Influences

| ADR | Influence |
|-----|-----------|
| ADR-0003 | SQLite storage - per-project memory persists here |
| ADR-0006 | Basic `AgentContext` interface defined; this ADR extends it |
| ADR-0011 | Subagent pattern - each subagent needs isolated working memory |
| ADR-0021 | Caching strategy - cache can serve as external memory |
| ADR-0026 | Hindsight - learning integrates with working memory |

## Decision Drivers

- **Agent-Aware principle**: Working memory must preserve goals, decisions, errors
- **Intelligent Tooling**: Memory structure serves agent's cognitive needs
- **Performance target**: 30-second analysis (North Star) - memory overhead must be minimal
- **Reproducibility**: Same analysis inputs should produce consistent outputs
- **CCA research findings**: Hierarchical working memory with adaptive compression improves resolve rate by +6.6%
- **Vercel AI SDK**: ADR-0006 selected this; memory must integrate with it
- **Context limits**: Claude's 200K context can be exhausted by large codebases

## Considered Options

### Working Memory Structure
1. **Hierarchical + Scratchpad** - CCA-style structured memory tree
2. **Flat context buffer** - Simple rolling window with summarization
3. **Full CoALA architecture** - Working/procedural/episodic/semantic memory
4. **Subagent-isolated contexts** - Each subagent fully isolated

### Compression Strategy
1. **Threshold-based adaptive** - Compress at 80% capacity
2. **Per-task compression** - Compress after each subtask
3. **Manual only** - Developer explicitly triggers

### Cross-Analysis Memory
1. **Per-project memory** - Remember previous analyses of this project
2. **Stateless** - Each analysis independent
3. **Cross-project learning** - Patterns transfer across projects

## Decision Outcome

Chosen options:
- **Working Memory Structure**: Hierarchical + Scratchpad
- **Compression Strategy**: Threshold-based adaptive (80%)
- **Cross-Analysis Memory**: Per-project memory only

### Rationale

**Hierarchical + Scratchpad** because:
- Proven in CCA research (+6.6% resolve rate improvement)
- Matches Claude Code's actual implementation
- Structured preservation beats flat summarization for critical state
- Implementable on Vercel AI SDK without framework change
- Maps cleanly to ADR-0011 subagent architecture

**Threshold-based adaptive** because:
- Automatic - no developer intervention needed
- 80% threshold leaves buffer for response generation
- Preserves structured components (goals, decisions, errors)
- Aligns with Claude Code's auto-compact pattern

**Per-project memory** because:
- Enables learning without reproducibility concerns (learning is project-scoped)
- Integrates with hindsight (ADR-0026) naturally
- Stored in existing SQLite (ADR-0003)
- No cross-project data transfer (privacy-safe)

---

## Detailed Design

### Memory Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HIERARCHICAL WORKING MEMORY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ LEVEL 1: SESSION CONTEXT (Root)                                       │ │
│  │                                                                       │ │
│  │ • Analysis ID and timestamp                                           │ │
│  │ • Project identity (path, git commit, config fingerprint)            │ │
│  │ • Analysis mode (full, incremental, domain-specific)                 │ │
│  │ • Previous analysis reference (for comparison)                       │ │
│  │ • Token budget and usage tracking                                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ LEVEL 2: TASK CONTEXT (Per Analysis Domain)                          │ │
│  │                                                                       │ │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │ │
│  │ │ CONFIG      │ │ SESSION     │ │ DOCS        │ │ CODE        │     │ │
│  │ │ ANALYSIS    │ │ ANALYSIS    │ │ ANALYSIS    │ │ ANALYSIS    │     │ │
│  │ ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤     │ │
│  │ │ • Goal      │ │ • Goal      │ │ • Goal      │ │ • Goal      │     │ │
│  │ │ • Progress  │ │ • Progress  │ │ • Progress  │ │ • Progress  │     │ │
│  │ │ • Findings  │ │ • Findings  │ │ • Findings  │ │ • Findings  │     │ │
│  │ │ • Errors    │ │ • Errors    │ │ • Errors    │ │ • Errors    │     │ │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ LEVEL 3: SCRATCHPAD (Transient Working Space)                        │ │
│  │                                                                       │ │
│  │ • Current tool invocation context                                    │ │
│  │ • Intermediate reasoning steps                                       │ │
│  │ • Sample code/config being analyzed                                  │ │
│  │ • Cross-references being built                                       │ │
│  │                                                                       │ │
│  │ ⚠️  VOLATILE: Cleared after each analysis step                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Data Structures

```typescript
/**
 * Root working memory for an analysis session
 */
interface WorkingMemory {
  // Level 1: Session Context
  session: SessionContext;

  // Level 2: Per-domain task contexts
  tasks: Map<AnalysisDomain, TaskContext>;

  // Level 3: Transient scratchpad
  scratchpad: Scratchpad;

  // Compression tracking
  compression: CompressionState;

  // Per-project memory reference
  projectMemory: ProjectMemoryRef;
}

/**
 * Level 1: Session-wide context
 */
interface SessionContext {
  analysisId: string;
  startedAt: Date;
  mode: 'full' | 'incremental' | 'domain-specific';

  // Project identity
  project: {
    path: string;
    gitCommit: string;
    configFingerprint: string;  // Hash of .agentlint.toml + CLAUDE.md
  };

  // Comparison reference
  previousAnalysis?: {
    id: string;
    timestamp: Date;
    baselineId?: string;
  };

  // Token management
  tokens: {
    budget: number;       // Max tokens for this analysis
    used: number;         // Current usage
    threshold: number;    // Compression trigger (default: 0.8)
  };

  // High-level progress
  progress: {
    domainsCompleted: AnalysisDomain[];
    domainsRemaining: AnalysisDomain[];
    overallStatus: 'starting' | 'analyzing' | 'synthesizing' | 'complete';
  };
}

/**
 * Level 2: Per-domain task context
 * Each subagent (ADR-0011) operates on one of these
 */
interface TaskContext {
  domain: AnalysisDomain;
  goal: string;           // Natural language description
  status: 'pending' | 'in_progress' | 'complete' | 'failed';

  // Progress tracking
  progress: {
    filesAnalyzed: number;
    filesTotal: number;
    currentFile?: string;
  };

  // Findings (structured, not raw)
  findings: {
    issues: CompressedIssue[];
    patterns: DetectedPattern[];
    metrics: DomainMetrics;
  };

  // Critical state to preserve during compression
  preserved: {
    decisions: Decision[];      // Key decisions made
    errors: ErrorTrace[];       // Errors encountered
    todos: string[];            // Outstanding work items
  };

  // Causal traces in progress
  traces: CausalTraceRef[];
}

/**
 * Level 3: Transient scratchpad
 * Cleared after each analysis step
 */
interface Scratchpad {
  // Current operation
  currentTool?: {
    name: string;
    input: unknown;
    startedAt: Date;
  };

  // Working data
  workingData: {
    samples: CodeSample[];      // Files being analyzed
    configs: ConfigSnippet[];   // Config sections being evaluated
    crossRefs: CrossReference[]; // Links being built
  };

  // Reasoning trace (for current step only)
  reasoning: string[];
}

/**
 * Compression state tracking
 */
interface CompressionState {
  lastCompressedAt?: Date;
  compressionCount: number;
  preservedTokens: number;      // Tokens in preserved state
  discardedTokens: number;      // Tokens removed by compression
}

// Analysis domains (from Constitution)
type AnalysisDomain =
  | 'ai_config'       // AI Assistant Configuration
  | 'session'         // AI Session Effectiveness
  | 'structure'       // Repository Structure
  | 'tooling'         // Developer Tooling
  | 'devsecops'       // DevSecOps Controls
  | 'docs'            // Documentation Quality
  | 'code_patterns'   // Code Patterns
  | 'cross_cutting';  // Cross-Cutting Concerns
```

### Compression Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ADAPTIVE COMPRESSION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ TRIGGER: Token usage reaches 80% of budget                           │ │
│  │                                                                       │ │
│  │ if (session.tokens.used / session.tokens.budget >= 0.8) {            │ │
│  │   await compress(workingMemory);                                     │ │
│  │ }                                                                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 1: PRESERVE CRITICAL STATE                                       │ │
│  │                                                                       │ │
│  │ ALWAYS PRESERVE (never compress):                                    │ │
│  │ • Session context (Level 1)                                          │ │
│  │ • Task goals and status                                              │ │
│  │ • Decisions made                                                      │ │
│  │ • Error traces                                                        │ │
│  │ • Outstanding TODOs                                                   │ │
│  │ • Causal trace references                                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 2: COMPRESS VERBOSE CONTENT                                      │ │
│  │                                                                       │ │
│  │ COMPRESS (replace with summaries):                                   │ │
│  │ • Tool output logs → Summary + reference                             │ │
│  │ • Full file contents → Metrics + key excerpts                        │ │
│  │ • Reasoning traces → Conclusions only                                │ │
│  │ • Intermediate findings → Aggregated counts                          │ │
│  │                                                                       │ │
│  │ DISCARD (remove entirely):                                           │ │
│  │ • Scratchpad (always volatile)                                       │ │
│  │ • Redundant tool invocations                                         │ │
│  │ • Failed attempts (keep error, discard details)                      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STEP 3: STRUCTURED SUMMARY (LLM-assisted)                             │ │
│  │                                                                       │ │
│  │ Generate structured summary with explicit sections:                  │ │
│  │                                                                       │ │
│  │ ## Analysis Progress                                                 │ │
│  │ - Domains complete: [config, session]                                │ │
│  │ - Currently analyzing: docs                                          │ │
│  │                                                                       │ │
│  │ ## Key Findings                                                       │ │
│  │ - 3 config gaps detected (secrets, testing, hooks)                   │ │
│  │ - Session quality: 72% (below baseline)                              │ │
│  │                                                                       │ │
│  │ ## Decisions Made                                                     │ │
│  │ - Prioritized config analysis due to missing CLAUDE.md              │ │
│  │ - Skipped deep session analysis (no logs found)                      │ │
│  │                                                                       │ │
│  │ ## Errors Encountered                                                 │ │
│  │ - TOML parse error in line 42 of .agentlint.toml                    │ │
│  │                                                                       │ │
│  │ ## Next Steps                                                         │ │
│  │ - Complete docs analysis                                              │ │
│  │ - Generate recommendations                                            │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation with Vercel AI SDK

```typescript
import { generateText, streamText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

/**
 * Working memory manager for agentlint analysis agents
 */
export class WorkingMemoryManager {
  private memory: WorkingMemory;
  private db: SQLiteDatabase;  // ADR-0003

  constructor(analysisId: string, project: ProjectInfo, db: SQLiteDatabase) {
    this.db = db;
    this.memory = this.initializeMemory(analysisId, project);
  }

  /**
   * Initialize fresh working memory for analysis
   */
  private initializeMemory(analysisId: string, project: ProjectInfo): WorkingMemory {
    return {
      session: {
        analysisId,
        startedAt: new Date(),
        mode: 'full',
        project: {
          path: project.path,
          gitCommit: project.headCommit,
          configFingerprint: hashConfig(project.config),
        },
        previousAnalysis: this.loadPreviousAnalysisRef(project.path),
        tokens: {
          budget: 180_000,  // Leave 20K buffer for response
          used: 0,
          threshold: 0.8,
        },
        progress: {
          domainsCompleted: [],
          domainsRemaining: ALL_DOMAINS,
          overallStatus: 'starting',
        },
      },
      tasks: new Map(),
      scratchpad: { workingData: { samples: [], configs: [], crossRefs: [] }, reasoning: [] },
      compression: { compressionCount: 0, preservedTokens: 0, discardedTokens: 0 },
      projectMemory: this.loadProjectMemory(project.path),
    };
  }

  /**
   * Load per-project memory from SQLite
   */
  private loadProjectMemory(projectPath: string): ProjectMemoryRef {
    const memory = this.db.query(`
      SELECT * FROM project_memory
      WHERE project_path = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(projectPath);

    return memory ? {
      lastAnalysis: memory.last_analysis_id,
      knownPatterns: JSON.parse(memory.patterns),
      hindsightNotes: JSON.parse(memory.hindsight_ids),
    } : { knownPatterns: [], hindsightNotes: [] };
  }

  /**
   * Build context for LLM call (AX-optimized)
   */
  buildAgentContext(): AgentContext {
    return {
      // From session
      taskGoal: this.describeCurrentGoal(),
      projectSummary: this.compressProjectInfo(),
      analysisProgress: this.summarizeProgress(),

      // From task contexts
      staticFindings: this.aggregateFindings(),
      codeSamples: this.selectRelevantSamples(),

      // From project memory
      priorKnowledge: this.loadRelevantHindsight(),

      // Metadata
      tokenBudgetRemaining: this.memory.session.tokens.budget - this.memory.session.tokens.used,
    };
  }

  /**
   * Check if compression is needed and execute
   */
  async maybeCompress(): Promise<void> {
    const usage = this.memory.session.tokens.used / this.memory.session.tokens.budget;

    if (usage >= this.memory.session.tokens.threshold) {
      await this.compress();
    }
  }

  /**
   * Execute compression pipeline
   */
  private async compress(): Promise<void> {
    // Step 1: Extract preserved state
    const preserved = this.extractPreservedState();

    // Step 2: Generate structured summary
    const summary = await this.generateStructuredSummary(preserved);

    // Step 3: Replace verbose content
    this.replaceWithSummary(summary);

    // Step 4: Clear scratchpad
    this.clearScratchpad();

    // Update compression tracking
    this.memory.compression.compressionCount++;
    this.memory.compression.lastCompressedAt = new Date();
  }

  /**
   * Generate structured summary preserving critical info
   */
  private async generateStructuredSummary(preserved: PreservedState): Promise<string> {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: `You are a context compression agent. Generate a structured summary
        that preserves all critical information for continuing analysis.
        Use the exact section format provided.`,
      prompt: `Compress this analysis state into a structured summary:

        Goals: ${preserved.goals.join(', ')}
        Decisions: ${JSON.stringify(preserved.decisions)}
        Errors: ${JSON.stringify(preserved.errors)}
        TODOs: ${preserved.todos.join(', ')}
        Findings so far: ${JSON.stringify(preserved.findings)}

        Format your response with these sections:
        ## Analysis Progress
        ## Key Findings
        ## Decisions Made
        ## Errors Encountered
        ## Next Steps`,
    });

    return text;
  }

  /**
   * Record a decision for preservation
   */
  recordDecision(domain: AnalysisDomain, decision: string, rationale: string): void {
    const task = this.memory.tasks.get(domain);
    if (task) {
      task.preserved.decisions.push({
        decision,
        rationale,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Record an error for preservation
   */
  recordError(domain: AnalysisDomain, error: Error, context: string): void {
    const task = this.memory.tasks.get(domain);
    if (task) {
      task.preserved.errors.push({
        message: error.message,
        context,
        timestamp: new Date(),
        // Don't preserve full stack trace - too verbose
      });
    }
  }

  /**
   * Save working memory state to SQLite (for crash recovery per ADR-0016)
   */
  async checkpoint(): Promise<void> {
    await this.db.run(`
      INSERT OR REPLACE INTO analysis_checkpoints (
        analysis_id, memory_state, created_at
      ) VALUES (?, ?, ?)
    `, [
      this.memory.session.analysisId,
      JSON.stringify(this.memory),
      new Date().toISOString(),
    ]);
  }

  /**
   * Save learnings to project memory after successful analysis
   */
  async persistToProjectMemory(): Promise<void> {
    const patterns = this.extractLearnedPatterns();
    const hindsightCandidates = this.extractHindsightCandidates();

    await this.db.run(`
      INSERT OR REPLACE INTO project_memory (
        project_path, last_analysis_id, patterns, hindsight_ids, updated_at
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      this.memory.session.project.path,
      this.memory.session.analysisId,
      JSON.stringify(patterns),
      JSON.stringify(hindsightCandidates),
      new Date().toISOString(),
    ]);
  }
}
```

### Subagent Memory Isolation (ADR-0011 Integration)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SUBAGENT MEMORY ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ ORCHESTRATOR AGENT                                                    │ │
│  │                                                                       │ │
│  │ Working Memory:                                                       │ │
│  │ • Full Session Context (Level 1)                                     │ │
│  │ • Summary views of all Task Contexts (Level 2)                       │ │
│  │ • Coordination state (which subagents active)                        │ │
│  │ • Aggregated findings from completed subagents                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                           │                                                 │
│          ┌────────────────┼────────────────┐                               │
│          │                │                │                               │
│          ▼                ▼                ▼                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                       │
│  │ CONFIG       │ │ SESSION      │ │ DOCS         │                       │
│  │ SUBAGENT     │ │ SUBAGENT     │ │ SUBAGENT     │                       │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤                       │
│  │ ISOLATED     │ │ ISOLATED     │ │ ISOLATED     │                       │
│  │ MEMORY:      │ │ MEMORY:      │ │ MEMORY:      │                       │
│  │              │ │              │ │              │                       │
│  │ • Own task   │ │ • Own task   │ │ • Own task   │                       │
│  │   context    │ │   context    │ │   context    │                       │
│  │ • Own        │ │ • Own        │ │ • Own        │                       │
│  │   scratchpad │ │   scratchpad │ │   scratchpad │                       │
│  │ • Read-only  │ │ • Read-only  │ │ • Read-only  │                       │
│  │   session    │ │   session    │ │   session    │                       │
│  │   context    │ │   context    │ │   context    │                       │
│  └──────────────┘ └──────────────┘ └──────────────┘                       │
│          │                │                │                               │
│          └────────────────┼────────────────┘                               │
│                           ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ RESULT AGGREGATION                                                    │ │
│  │                                                                       │ │
│  │ When subagent completes:                                              │ │
│  │ 1. Extract findings, decisions, errors from its TaskContext          │ │
│  │ 2. Compress verbose content to summary                               │ │
│  │ 3. Merge into orchestrator's working memory                          │ │
│  │ 4. Release subagent's isolated memory                                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Storage Schema

Extends ADR-0003 SQLite schema:

```sql
-- Per-project learning memory
CREATE TABLE project_memory (
  project_path TEXT PRIMARY KEY,
  last_analysis_id TEXT,
  patterns JSON,          -- Known patterns for this project
  hindsight_ids JSON,     -- References to hindsight notes (ADR-0026)
  updated_at TEXT NOT NULL
);

-- Analysis checkpoints for crash recovery (ADR-0016)
CREATE TABLE analysis_checkpoints (
  analysis_id TEXT PRIMARY KEY,
  memory_state JSON NOT NULL,  -- Serialized WorkingMemory
  created_at TEXT NOT NULL
);

-- Compression history for debugging
CREATE TABLE compression_log (
  id INTEGER PRIMARY KEY,
  analysis_id TEXT NOT NULL,
  compressed_at TEXT NOT NULL,
  tokens_before INTEGER,
  tokens_after INTEGER,
  preserved_components JSON,   -- What was kept
  FOREIGN KEY (analysis_id) REFERENCES analysis_checkpoints(analysis_id)
);

-- Indexes
CREATE INDEX idx_project_memory_updated ON project_memory(updated_at);
CREATE INDEX idx_checkpoints_analysis ON analysis_checkpoints(analysis_id);
```

---

## AX/UX Separation

This ADR formalizes the separation between agent-facing and user-facing contexts:

| Aspect | Agent Context (AX) | User Report (UX) |
|--------|-------------------|------------------|
| **File content** | Excerpts + metrics | Full paths, links to source |
| **Findings** | Compressed counts + patterns | Detailed issues with evidence |
| **Session data** | Statistics (tokens, turns) | Visualizations, trends |
| **Decisions** | Preserved in working memory | Explained with rationale |
| **Errors** | Error type + context | Full messages + suggestions |
| **History** | Compressed summary | Full causal traces |

---

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | ✅ | All memory stored in local SQLite |
| II. Improvement-Oriented | ✅ | Per-project memory enables learning |
| III. Causal-First | ✅ | Traces preserved during compression |
| IV. Mixed-Methods | ✅ | Both metrics and qualitative findings |
| V. Language-Agnostic | ✅ | Memory structure is language-independent |
| VI. Tool-Agnostic | ✅ | Works with any AI tool via adapters |
| VII. Intelligent Tooling | ✅ | Memory preserves both tool findings and agent reasoning |
| VIII. Compounding Value | ✅ | Working memory compounds agent effectiveness over session |
| IX. Agent-Aware | ✅ | Core purpose - serves agent cognitive needs |

---

## Implementation Notes

### Dependencies

Uses existing:
- Vercel AI SDK (ADR-0006)
- SQLite (ADR-0003)
- Subagent pattern (ADR-0011)

### Testing Strategy

Aligned with ADR-0013:
- Unit tests for memory operations
- Integration tests for compression
- Golden dataset for reproducibility
- Token tracking validation

### Performance Considerations

- Compression adds ~500ms LLM call
- Checkpoint writes are async (non-blocking)
- Memory serialization uses `JSON.stringify` (fast for typical sizes)
- Target: <5% overhead on 30-second analysis

---

## References

### Research Papers
- [Cognitive Architectures for Language Agents (CoALA)](https://arxiv.org/abs/2309.02427) - Theoretical framework
- [Confucius Code Agent](https://arxiv.org/html/2512.10398v4) - Hierarchical working memory
- [A-MEM: Agentic Memory](https://arxiv.org/abs/2502.12110) - Zettelkasten-style memory

### Industry Resources
- [Context Engineering for Agents (LangChain)](https://blog.langchain.com/context-engineering-for-agents/) - Best practices
- [Claude Code Context Management](https://www.ajeetraina.com/understanding-claudes-conversation-compacting-a-deep-dive-into-context-management/) - Auto-compact pattern
- [LangGraph Memory Architecture](https://dev.to/sreeni5018/the-architecture-of-agent-memory-how-langgraph-really-works-59ne) - Implementation patterns

### Related ADRs
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md)
- [ADR-0006: Agentic Analysis Implementation](./0006-agent-orchestrated-analysis.md)
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md)
- [ADR-0026: Hindsight Capture](./0026-hindsight-capture-and-knowledge-surfacing-strategy.md)

### Design Questions
- [Section 12: agentlint Agent Architecture](../../design-questions.md#12-agentlint-agent-architecture-self-application-of-axuxdx)
