# Data Model: Causal Tracing Engine

> **Epic**: EP07
> **Created**: 2026-01-17
> **Status**: Complete

---

## Entities

### CausalChain

The primary entity representing a traced causal path from issue to origin.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | Yes | Unique identifier for the chain |
| issueId | string | Yes | Reference to the detected issue (Finding.id) |
| trigger | EvidenceItem | Yes | The originating action/prompt |
| gap | Gap | No | Configuration gap that enabled the issue |
| mechanism | string | Yes | How the gap led to the issue |
| effect | string | Yes | The detected issue description |
| confidence | ConfidenceScore | Yes | Validation assessment |
| evidence | EvidenceItem[] | Yes | All collected evidence (min 1) |
| depth | number | Yes | Number of traversal steps |
| depthLimitReached | boolean | Yes | Whether max depth was hit |
| projectPath | string | Yes | Project where issue was detected |
| createdAt | string (ISO-8601) | Yes | When chain was created |
| counterfactual | string | No | "If X, then Y wouldn't have occurred" |
| patternId | string | No | Reference to associated IssuePattern |

**Validation Rules**:
- `depth` must be ≤ 5
- `evidence` must contain at least 1 item
- `mechanism` must be non-empty
- `createdAt` must be valid ISO-8601

**State Transitions**: N/A (immutable once created)

---

### EvidenceItem

A single piece of evidence supporting a causal chain.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | Yes | Unique identifier |
| type | EvidenceType | Yes | Category of evidence |
| source | string | Yes | Origin reference (session ID, commit hash, etc.) |
| timestamp | string (ISO-8601) | No | When the evidence was created |
| content | string | No | Relevant content snippet |
| position | Position | No | File location if applicable |
| metadata | Record<string, unknown> | No | Additional context |

**Evidence Types**:
- `SessionMatch` - FTS5 search result from session logs
- `GitCorrelation` - git blame/pickaxe result
- `ConfigGap` - Missing configuration analysis
- `TemporalMarker` - Timestamp correlation evidence
- `ToolTrace` - Tool call pattern evidence

---

### Position

File location for evidence or issue.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| filePath | string | Yes | Absolute or relative file path |
| line | number | No | Line number (1-indexed) |
| column | number | No | Column number (1-indexed) |
| snippet | string | No | Code/content snippet |

---

### Gap

A missing configuration element that enabled an issue.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | GapType | Yes | Category of gap |
| location | GapLocation | Yes | Where guidance should exist |
| expectedGuidance | string | Yes | What guidance was missing |
| counterfactual | string | Yes | "If X, Y wouldn't have occurred" |

**Gap Types**:
- `missing_config` - Configuration file or section missing
- `missing_example` - Example code/usage missing
- `missing_guidance` - Behavioral guidance missing
- `terminology_gap` - Domain terminology undefined
- `context_loss` - Context not preserved across sessions
- `other` - Unclassified gap

**Gap Locations**:
- `claude_md` - CLAUDE.md file
- `global_config` - ~/.claude/settings.json
- `project_config` - .claude/settings.json
- `mcp_config` - .mcp.json
- `skill` - .claude/skills/
- `other` - Other location

---

### ConfidenceScore

Validation checklist result for a causal chain.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| specificity | boolean | Yes | Issue clearly links to specific trigger |
| temporal | boolean | Yes | Timing supports causal relationship |
| mechanistic | boolean | Yes | Plausible mechanism explains causation |
| evidenceQuality | boolean | Yes | Evidence is direct, not inferred |
| reproducibility | boolean | Yes | Pattern seen multiple times |
| alternatives | boolean | Yes | Alternative causes considered |
| overall | ConfidenceLevel | Yes | Computed overall confidence |

**Overall Confidence Computation**:
- Count of `true` values = score (0-6)
- high: score ≥ 5
- medium: score ≥ 3
- low: score < 3

---

### IssuePattern

Recurring issue type detected across sessions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | Yes | Unique identifier |
| category | GapType | Yes | Root cause category |
| chainIds | string[] | Yes | References to related CausalChains |
| frequency | number | Yes | Number of occurrences |
| isSystemic | boolean | Yes | true if frequency ≥ 3 |
| firstOccurrence | string (ISO-8601) | Yes | Earliest chain timestamp |
| lastOccurrence | string (ISO-8601) | Yes | Latest chain timestamp |
| projectPath | string | No | Scoped to project (null = global) |
| summary | string | Yes | Human-readable pattern description |

**Classification Rules**:
- `isSystemic = true` when `frequency >= 3`
- Patterns with same category across projects may indicate global issue

---

### TracedIssue

An issue with its complete causal analysis (output structure).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| issueId | string | Yes | Reference to Finding.id |
| chain | CausalChain | Yes | The traced causal chain |
| counterfactual | string | No | Preventive analysis |
| patternId | string | No | Linked pattern if recurring |
| traceCompleteness | 'full' \| 'partial' | Yes | Whether all evidence found |
| limitations | string[] | No | What couldn't be traced |

---

## Entity Relationships

```
TracedIssue --1:1--> CausalChain
CausalChain --1:N--> EvidenceItem
CausalChain --1:1--> ConfidenceScore
CausalChain --0:1--> Gap
TracedIssue --N:1--> IssuePattern (optional)
IssuePattern --1:N--> CausalChain (via chainIds)
```

---

## Zod Schemas

See `contracts/types.ts` for full Zod schema definitions.

**Key schemas**:
- `CausalChainSchema` - Main chain entity
- `EvidenceItemSchema` - Evidence entity
- `ConfidenceScoreSchema` - Validation checklist
- `GapSchema` - Configuration gap
- `IssuePatternSchema` - Recurring pattern
- `TracedIssueSchema` - Complete trace output

---

## SQLite Schema

See `research.md` Section 2 for full SQL DDL.

**Tables**:
- `causal_chains` - Main chain storage
- `evidence_items` - Individual evidence pieces
- `confidence_scores` - Validation breakdown
- `issue_patterns` - Pattern aggregation
- `chain_patterns` - M:N chain-pattern links

**Indexes**:
- `idx_chains_project` ON causal_chains(project_path)
- `idx_chains_created` ON causal_chains(created_at)
- `idx_evidence_chain` ON evidence_items(chain_id)
- `idx_patterns_category` ON issue_patterns(category)

---

## Type Enums

### EvidenceType
```typescript
type EvidenceType =
  | 'SessionMatch'
  | 'GitCorrelation'
  | 'ConfigGap'
  | 'TemporalMarker'
  | 'ToolTrace';
```

### GapType
```typescript
type GapType =
  | 'missing_config'
  | 'missing_example'
  | 'missing_guidance'
  | 'terminology_gap'
  | 'context_loss'
  | 'other';
```

### GapLocation
```typescript
type GapLocation =
  | 'claude_md'
  | 'global_config'
  | 'project_config'
  | 'mcp_config'
  | 'skill'
  | 'other';
```

### ConfidenceLevel
```typescript
type ConfidenceLevel = 'high' | 'medium' | 'low';
```

### TraceCompleteness
```typescript
type TraceCompleteness = 'full' | 'partial';
```
