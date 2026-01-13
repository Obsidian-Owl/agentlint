---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0026: Hindsight Capture and Knowledge Surfacing Strategy

## Context and Problem Statement

The Confucius Code Agent (CCA) research introduces "hindsight notes"—a mechanism where a note-taking agent distills session trajectories into structured Markdown capturing failures, compilation errors, and runtime exceptions. This creates "a steadily growing, human-readable body of durable knowledge" enabling cross-session learning.

agentlint's causal analysis model (ADR-0007) currently follows: `DETECT → TRACE → UNDERSTAND → PREVENT`. This ADR extends the model to include explicit knowledge capture: `DETECT → TRACE → UNDERSTAND → CAPTURE → PREVENT`.

Key questions this ADR addresses:
1. Should agentlint actively capture hindsight from traced issues?
2. What format should hindsight take?
3. How should hindsight be surfaced to AI agents?
4. How do we measure hindsight effectiveness?

### Prior ADR Influences

| ADR | Influence |
|-----|-----------|
| ADR-0003 | SQLite storage with FTS5 - hindsight stored in same DB |
| ADR-0007 | Causal analysis model - hindsight extends PREVENT phase |
| ADR-0008 | Cross-session learning metrics - effectiveness measurement |
| ADR-0012 | Recommendation lifecycle - hindsight integrates with CLOSED state |
| ADR-0018 | AI tool adapters - hindsight format must be tool-agnostic |

## Decision Drivers

- **Improvement-Oriented principle**: Hindsight enables compound learning across sessions
- **Causal-First principle**: Every hindsight note traces back to a specific issue origin
- **Local-First principle**: All hindsight data stays on user's machine
- **Progressive Value principle**: Must work without LLM (static extraction)
- **Agent-Aware principle**: Hindsight format must be usable by both humans AND agents
- **CCA research findings**: Cumulative note-taking reduces iteration turns (64→61) and token cost (104k→93k)
- **Claude Code best practices**: CLAUDE.md should be lean; external docs for detailed knowledge

## Considered Options

### Scope Options
1. **Passive analysis only**: Detect and analyze existing hindsight documentation
2. **Recommendation mode**: Recommend users implement hindsight in configs/docs
3. **Active capture + Auto-extract**: Extend causal model with CAPTURE phase
4. **Full Zettelkasten memory**: A-MEM style linked knowledge graph

### Storage Options
1. **SQLite + Markdown export**: DB storage with export command
2. **Markdown files only**: Direct storage in project docs
3. **CLAUDE.md sections**: Append directly to AI config files
4. **Separate knowledge base**: Dedicated .agentlint/knowledge/ directory

### Surfacing Options
1. **Export + Recommend**: Generate exportable Markdown, recommend additions
2. **Auto-append to config**: Automatically update CLAUDE.md
3. **MCP server**: Expose as MCP tool for dynamic retrieval
4. **Separate context file**: Generate .agentlint/hindsight.md

## Decision Outcome

Chosen options:
- **Scope**: Active Capture + Auto-Extract
- **Storage**: SQLite + Markdown export
- **Surfacing**: Export + Recommend

### Rationale

**Active Capture + Auto-Extract** because:
- Extends the causal model naturally (CAPTURE comes from UNDERSTAND)
- CCA research shows measurable benefits (10% token reduction, 2.6% resolve rate improvement)
- Auto-extraction from traced issues reduces manual effort
- User confirmation maintains quality control

**SQLite + Markdown export** because:
- Leverages existing ADR-0003 infrastructure
- FTS5 enables semantic search across hindsight
- Markdown export is human-readable and git-trackable
- Separation allows sophisticated queries without bloating config files

**Export + Recommend** because:
- Aligns with Claude Code best practices (lean CLAUDE.md, external docs for detail)
- User controls what agents see (explicit opt-in)
- Integrates with existing `agentlint recommend` workflow
- Avoids surprising users with auto-modifications

---

## Detailed Design

### Extended Causal Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXTENDED CAUSAL ANALYSIS MODEL                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌─────────┐   ┌─────────┐│
│   │  DETECT  │ → │  TRACE   │ → │ UNDERSTAND │ → │ CAPTURE │ → │ PREVENT ││
│   └──────────┘   └──────────┘   └────────────┘   └─────────┘   └─────────┘│
│        │              │               │               │              │     │
│        ▼              ▼               ▼               ▼              ▼     │
│   Find issue     Link to         Synthesize      Extract        Generate  │
│   in codebase    origin          causal          hindsight      config    │
│                  (session,       narrative       note           recommend │
│                  prompt,                                        -ation    │
│                  config gap)                                              │
│                                                                             │
│   ADR-0007 ──────────────────────────────────┐                             │
│                                              │                             │
│   ADR-0026 ─────────────────────────────────────────────────────┐          │
│                                              │                  │          │
│                                              ▼                  ▼          │
│                                    ┌───────────────────────────────────┐   │
│                                    │ HINDSIGHT NOTE                    │   │
│                                    │ • Pattern: What went wrong        │   │
│                                    │ • Context: When/where it happens  │   │
│                                    │ • Solution: What fixes it         │   │
│                                    │ • Prevention: How to avoid        │   │
│                                    └───────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hindsight Note Structure

```typescript
interface HindsightNote {
  id: string;                      // UUID
  createdAt: Date;
  updatedAt: Date;

  // Origin (from ADR-0007 causal trace)
  causalTraceId: string;           // Link to originating trace
  issueType: IssueType;            // e.g., 'hallucination', 'scope_creep', 'config_gap'
  issueSeverity: 'low' | 'medium' | 'high' | 'critical';

  // Pattern description (LLM-synthesized or user-provided)
  pattern: {
    title: string;                 // Short description: "API key exposed in CLAUDE.md"
    description: string;           // Detailed explanation
    triggerConditions: string[];   // When this pattern appears
    affectedFiles: string[];       // File patterns (e.g., "CLAUDE.md", "*.env")
  };

  // Solution
  solution: {
    immediate: string;             // What fixes the current issue
    preventive: string;            // What prevents recurrence
    configChange?: string;         // Suggested config snippet (if applicable)
  };

  // Metadata
  status: 'candidate' | 'confirmed' | 'exported' | 'archived';
  userConfirmed: boolean;          // User explicitly validated
  effectivenessScore?: number;     // -1 to 1, measured over time
  occurrenceCount: number;         // How many times this pattern was seen
  lastOccurrence: Date;

  // Export tracking
  exportedTo?: string[];           // Paths where this was exported
  exportedAt?: Date;
}

// Issue types aligned with ADR-0008 failure modes
type IssueType =
  | 'hallucination'        // Agent invented non-existent APIs/files
  | 'scope_creep'          // Task expanded beyond original request
  | 'config_gap'           // Missing guidance in AI config
  | 'context_overflow'     // Agent lost track due to context limits
  | 'tool_misuse'          // Incorrect tool usage pattern
  | 'iteration_spiral'     // Repeated unsuccessful attempts
  | 'secret_exposure'      // Sensitive data in outputs
  | 'style_violation'      // Inconsistent with project conventions
  | 'dependency_conflict'  // Incompatible package choices
  | 'test_failure'         // Broken or missing tests
  | 'other';
```

### Extraction Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HINDSIGHT EXTRACTION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 1: STATIC EXTRACTION (No LLM)                                   │ │
│  │                                                                       │ │
│  │ From Causal Traces (ADR-0007):                                        │ │
│  │ • Extract issue location, type, severity                             │ │
│  │ • Extract session context (timestamps, tool calls)                   │ │
│  │ • Extract config state at time of issue                              │ │
│  │                                                                       │ │
│  │ Pattern Detection:                                                    │ │
│  │ • Match against known issue patterns (regex/heuristic)               │ │
│  │ • Count occurrences of similar traces (FTS5 similarity)              │ │
│  │ • Identify temporal clustering (issues appearing together)           │ │
│  │                                                                       │ │
│  │ Output: HindsightCandidate[]                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 2: LLM SYNTHESIS (Optional, Agentic)                            │ │
│  │                                                                       │ │
│  │ For each candidate with severity >= medium:                           │ │
│  │ • Synthesize human-readable pattern description                      │ │
│  │ • Generate preventive recommendation                                 │ │
│  │ • Suggest config snippet (if config_gap type)                        │ │
│  │                                                                       │ │
│  │ Input: Compressed evidence bundle (NOT full logs)                    │ │
│  │ Output: EnrichedHindsightNote                                        │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 3: USER CONFIRMATION                                            │ │
│  │                                                                       │ │
│  │ Present candidates to user:                                           │ │
│  │ • `agentlint hindsight review` - Interactive review                  │ │
│  │ • `agentlint hindsight confirm <id>` - Confirm specific note         │ │
│  │ • `agentlint hindsight dismiss <id>` - Mark as not useful            │ │
│  │                                                                       │ │
│  │ Confirmed notes become part of the knowledge base                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Storage Schema

Extends ADR-0003 SQLite schema:

```sql
-- Hindsight notes table
CREATE TABLE hindsight_notes (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Origin
  causal_trace_id TEXT REFERENCES causal_traces(id),
  issue_type TEXT NOT NULL,
  issue_severity TEXT NOT NULL CHECK (issue_severity IN ('low', 'medium', 'high', 'critical')),

  -- Pattern (JSON for flexibility)
  pattern JSON NOT NULL,
  -- {title, description, triggerConditions[], affectedFiles[]}

  -- Solution (JSON)
  solution JSON NOT NULL,
  -- {immediate, preventive, configChange?}

  -- Status
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'confirmed', 'exported', 'archived')),
  user_confirmed INTEGER DEFAULT 0,
  effectiveness_score REAL,
  occurrence_count INTEGER DEFAULT 1,
  last_occurrence TEXT,

  -- Export tracking
  exported_to JSON,  -- Array of paths
  exported_at TEXT
);

-- FTS5 index for semantic search
CREATE VIRTUAL TABLE hindsight_fts USING fts5(
  title,
  description,
  trigger_conditions,
  solution_text,
  content=hindsight_notes,
  content_rowid=rowid
);

-- Pattern occurrence tracking (for recurrence detection)
CREATE TABLE hindsight_occurrences (
  id INTEGER PRIMARY KEY,
  hindsight_id TEXT REFERENCES hindsight_notes(id),
  causal_trace_id TEXT REFERENCES causal_traces(id),
  occurred_at TEXT NOT NULL,
  session_id TEXT
);

-- Index for efficient queries
CREATE INDEX idx_hindsight_status ON hindsight_notes(status);
CREATE INDEX idx_hindsight_type ON hindsight_notes(issue_type);
CREATE INDEX idx_hindsight_severity ON hindsight_notes(issue_severity);
CREATE INDEX idx_occurrences_hindsight ON hindsight_occurrences(hindsight_id);
```

### Markdown Export Format

When users run `agentlint hindsight export`, confirmed notes are exported to Markdown:

```markdown
<!-- Generated by agentlint hindsight export -->
<!-- Last updated: 2026-01-13T14:30:00Z -->

# Project Learnings

## API Key Exposure Prevention

**Pattern**: Claude occasionally includes API keys when documenting environment setup.

**When it happens**:
- Documenting deployment procedures
- Writing .env.example files
- Creating setup guides

**Solution**:
- Use `${API_KEY}` placeholder syntax in all documentation
- Add pre-commit hook to scan for key patterns

**Prevention** (add to CLAUDE.md):
```
## Security Rules
- NEVER include actual API keys in any file
- Use placeholder syntax: ${VARIABLE_NAME}
- Scan outputs for patterns matching sk-*, ANTHROPIC_*, etc.
```

---

## Test File Placement

**Pattern**: New test files placed in wrong directory structure.

**When it happens**:
- Creating new feature tests
- Adding integration tests

**Solution**:
- Tests go in `tests/` mirroring `src/` structure
- Integration tests in `tests/integration/`

**Prevention** (add to CLAUDE.md):
```
## Test Structure
- Unit tests: tests/unit/<module>.test.ts
- Integration tests: tests/integration/<feature>.test.ts
- Always check existing test structure before creating new files
```

---

<!-- agentlint:hindsight-export:v1 -->
```

### CLI Commands

```bash
# View hindsight candidates (pending user review)
agentlint hindsight                    # List all candidates
agentlint hindsight --status confirmed # List confirmed notes

# Review and confirm
agentlint hindsight review             # Interactive review session
agentlint hindsight confirm <id>       # Confirm specific note
agentlint hindsight dismiss <id>       # Dismiss (not useful)
agentlint hindsight edit <id>          # Edit note content

# Export for agent consumption
agentlint hindsight export             # Export to docs/agentlint-learnings.md
agentlint hindsight export --to CLAUDE.md  # Append to CLAUDE.md
agentlint hindsight export --format json   # JSON for programmatic use

# Integration with recommendations
agentlint recommend --include-hindsight    # Include hindsight in recommendations

# Effectiveness tracking
agentlint hindsight stats              # Show effectiveness metrics
```

### Integration with Recommendation Lifecycle (ADR-0012)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDATION + HINDSIGHT LIFECYCLE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RECOMMENDATION FLOW (ADR-0012)          HINDSIGHT FLOW (ADR-0026)         │
│  ──────────────────────────────          ─────────────────────────         │
│                                                                             │
│  ┌──────────┐                                                               │
│  │ PROPOSED │  ← Issue detected, recommendation generated                  │
│  └────┬─────┘                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌──────────┐                                                               │
│  │ ADOPTED  │  ← User implemented the recommendation                       │
│  └────┬─────┘                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌──────────┐                            ┌─────────────┐                   │
│  │ MEASURED │  ──────────────────────────│ CANDIDATE   │                   │
│  └────┬─────┘  If effective,             │ HINDSIGHT   │                   │
│       │        extract hindsight         └──────┬──────┘                   │
│       │                                         │                          │
│       ▼                                         ▼                          │
│  ┌──────────┐                            ┌─────────────┐                   │
│  │  CLOSED  │                            │ CONFIRMED   │ ← User validates  │
│  └──────────┘                            │ HINDSIGHT   │                   │
│                                          └──────┬──────┘                   │
│                                                 │                          │
│                                                 ▼                          │
│                                          ┌─────────────┐                   │
│                                          │  EXPORTED   │ ← Added to        │
│                                          │  HINDSIGHT  │   CLAUDE.md/docs  │
│                                          └─────────────┘                   │
│                                                                             │
│  KEY INSIGHT: Effective recommendations become durable hindsight           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Effectiveness Measurement

Hindsight effectiveness is measured by tracking whether the same pattern recurs after the hindsight was surfaced to agents:

```typescript
interface HindsightEffectiveness {
  hindsightId: string;

  // Before hindsight was exported
  occurrencesBefore: number;
  avgTokenCostBefore: number;
  avgIterationsBefore: number;

  // After hindsight was exported
  occurrencesAfter: number;
  avgTokenCostAfter: number;
  avgIterationsAfter: number;

  // Computed
  recurrenceReduction: number;    // % reduction in occurrences
  tokenCostReduction: number;     // % reduction in tokens
  iterationReduction: number;     // % reduction in iterations

  // Overall score (-1 to 1)
  effectivenessScore: number;
  confidence: 'low' | 'medium' | 'high';  // Based on sample size
}
```

Aligned with ADR-0008 (Session Quality Analysis) metrics:
- **Pattern resolution speed**: Same pattern appears but resolved faster
- **Token cost decrease**: Similar tasks cost fewer tokens
- **Error recurrence rate**: Pattern appears less frequently

---

## Future Considerations

### MCP Server (Post-MVP)

While export + recommend is the MVP approach, MCP integration could enable:

```typescript
// Future: agentlint as MCP memory server
interface HindsightMCPTools {
  // Query relevant hindsight for current task
  'agentlint/query-hindsight': {
    query: string;
    limit?: number;
  } => HindsightNote[];

  // Report new pattern discovered during session
  'agentlint/report-pattern': {
    pattern: string;
    context: string;
  } => { candidateId: string };
}
```

This would align with the [MCP memory service ecosystem](https://github.com/doobidoo/mcp-memory-service) while maintaining local-first principles.

### Zettelkasten-Style Linking (Post-MVP)

Research on [A-MEM (Agentic Memory)](https://arxiv.org/abs/2502.12110) suggests benefits from linked knowledge graphs. Future enhancements could include:

- Links between related hindsight notes
- Hub notes (highly connected concepts)
- Bridge notes (connecting different knowledge clusters)
- Multi-hop reasoning across linked memories

---

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | ✅ | All hindsight stored in local SQLite |
| II. Improvement-Oriented | ✅ | Core purpose is cross-session learning |
| III. Causal-First | ✅ | Every hindsight links to causal trace |
| IV. Mixed-Methods | ✅ | Static extraction + LLM synthesis |
| V. Language-Agnostic | ✅ | Pattern format is language-independent |
| VI. Tool-Agnostic | ✅ | Export works for any AI tool's config |
| VII. Static-First | ✅ | Layer 1 is pure static extraction |
| VIII. Progressive Value | ✅ | Works without LLM (static patterns only) |
| IX. Agent-Aware | ✅ | Markdown export optimized for agent consumption |

---

## Implementation Notes

### Package Dependencies

No new dependencies required. Uses existing:
- SQLite (ADR-0003)
- FTS5 for semantic search
- Existing markdown generation utilities

### Testing Strategy

Aligned with ADR-0013:
- Unit tests for extraction heuristics
- Integration tests with sample causal traces
- Golden dataset of known patterns
- Effectiveness measurement over time

### Migration Path

None required—new feature building on existing infrastructure.

---

## References

### Research Papers
- [Confucius Code Agent (CCA)](https://arxiv.org/pdf/2512.10398) - Hindsight notes concept
- [Hindsight is 20/20: Building Agent Memory](https://arxiv.org/html/2512.12818v1) - Memory architecture
- [A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110) - Zettelkasten-style memory

### Industry Resources
- [Claude Code Memory Best Practices](https://code.claude.com/docs/en/memory) - Official docs
- [MCP Memory Service](https://github.com/doobidoo/mcp-memory-service) - MCP pattern reference
- [ICLR 2026 MemAgents Workshop](https://openreview.net/forum?id=U51WxL382H) - Latest research

### Related ADRs
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md)
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md)
- [ADR-0008: Session Quality Analysis](./0008-session-quality-analysis.md)
- [ADR-0012: Incremental Analysis Strategy](./0012-incremental-analysis-strategy.md)

### Design Questions
- [Section 11: Hindsight Learning & Cross-Session Memory](../../design-questions.md#11-hindsight-learning--cross-session-memory)
