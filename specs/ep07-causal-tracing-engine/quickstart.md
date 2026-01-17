# Quickstart: Causal Tracing Engine

> **Epic**: EP07
> **Created**: 2026-01-17

---

## Overview

The Causal Tracing Engine traces detected issues to their origin (session prompts, configuration gaps, git commits) and generates evidence chains for preventive recommendations.

**Key Capabilities**:
- Trace issues to session origins
- Identify configuration gaps
- Detect recurring patterns across sessions
- Generate counterfactual analysis

---

## Prerequisites

Before using causal tracing:

1. **Sessions indexed** (EP06): `agentlint sessions --index`
2. **Issue detected**: Have an issue to trace (from EP05 config analysis or manual identification)

---

## Basic Usage

### Tracing a Single Issue

The agent can trace an issue using the `trace_issue_origin` tool:

```typescript
// Agent invokes trace_issue_origin
{
  issueDescription: "Secret API key found in CLAUDE.md",
  issueLocation: {
    filePath: "CLAUDE.md",
    line: 42
  },
  searchContext: {
    keywords: ["API key", "add config", "credentials"],
    since: "2026-01-01T00:00:00Z"
  }
}
```

**Returns**: A `TracedIssue` with:
- `chain`: Full causal chain with evidence
- `counterfactual`: What would have prevented this
- `traceCompleteness`: Whether trace is complete or partial
- `limitations`: What couldn't be traced

### Finding Recurring Patterns

The agent can query patterns using the `get_issue_patterns` tool:

```typescript
// Agent invokes get_issue_patterns
{
  projectPath: "/path/to/project",
  minFrequency: 3,
  category: "missing_guidance"
}
```

**Returns**: An array of `IssuePattern` with:
- `category`: Root cause category
- `frequency`: How many times it occurred
- `isSystemic`: True if recurring pattern
- `summary`: Human-readable description

---

## Understanding Evidence Chains

A causal chain has this structure:

```
TRIGGER → GAP → MECHANISM → EFFECT

Example:
  Trigger: User prompt "add my API config to CLAUDE.md"
  Gap: No credential handling guidance in CLAUDE.md
  Mechanism: AI included raw API key instead of env var reference
  Effect: Secret detected in configuration file
```

### Evidence Types

| Type | What It Provides |
|------|------------------|
| `SessionMatch` | Prompt/response from session logs |
| `GitCorrelation` | Commit that introduced the issue |
| `ConfigGap` | Missing configuration analysis |
| `TemporalMarker` | When the issue first appeared |
| `ToolTrace` | Tool call patterns indicating confusion |

### Confidence Levels

Each chain includes a confidence score based on 6 factors:

| Factor | Question |
|--------|----------|
| Specificity | Does issue link to specific trigger? |
| Temporal | Does timing support causation? |
| Mechanistic | Is there a plausible mechanism? |
| Evidence Quality | Is evidence direct? |
| Reproducibility | Seen multiple times? |
| Alternatives | Were other causes ruled out? |

**Interpretation**:
- **High** (5-6/6): Strong causal evidence
- **Medium** (3-4/6): Reasonable but not definitive
- **Low** (0-2/6): Weak evidence, investigate further

---

## Common Patterns

### Pattern 1: Tracing a Config Issue

```typescript
// Issue: Missing domain terminology causing confusion
const result = await traceIssueOrigin({
  issueDescription: "Agent repeatedly confused about term 'deployment'",
  searchContext: {
    keywords: ["deployment", "clarify", "what do you mean"]
  }
});

// Result shows:
// - Trigger: Session where user first used "deployment" without context
// - Gap: No glossary in CLAUDE.md
// - Mechanism: AI interpreted differently than user intended
// - Counterfactual: "If CLAUDE.md defined 'deployment' as X, confusion would not have occurred"
```

### Pattern 2: Finding Systemic Issues

```typescript
// Find all recurring issues in a project
const patterns = await getIssuePatterns({
  projectPath: "/my/project",
  minFrequency: 3  // Only systemic patterns
});

// Returns patterns like:
// - "Missing examples" (5 occurrences, systemic)
// - "Context loss after compaction" (3 occurrences, systemic)
```

### Pattern 3: Partial Traces

When evidence is incomplete:

```typescript
const result = await traceIssueOrigin({
  issueDescription: "Style inconsistency in generated code",
  issueLocation: { filePath: "src/app.ts", line: 100 }
});

// result.traceCompleteness === 'partial'
// result.limitations === [
//   "No matching session found - issue may predate session logging",
//   "Git history unavailable for this file"
// ]
```

---

## Gap Categories

When a gap is identified, it's categorized for pattern detection:

| Category | Example |
|----------|---------|
| `missing_config` | No .claude/settings.json |
| `missing_example` | CLAUDE.md lacks code examples |
| `missing_guidance` | No guidance on error handling |
| `terminology_gap` | Domain terms undefined |
| `context_loss` | Important context lost in compaction |
| `other` | Unclassified |

---

## Integration with Agent Workflow

The causal tracing tools are designed for agent consumption:

1. **Agent detects issue** (via config analysis or session patterns)
2. **Agent invokes `trace_issue_origin`** to understand root cause
3. **Agent receives structured chain** (no need to re-derive causality)
4. **Agent reasons about** counterfactual and recommendations
5. **Agent presents findings** to user with traced origin

**Key Benefit**: Pre-computed chains save tokens and provide consistent structure for agent reasoning.

---

## Error Handling

### No Sessions Indexed

```
Error: FTS5 index not initialized
Solution: Run 'agentlint sessions --index' first
```

### Stale Index

```
Warning: Session files modified after last index
Results may be incomplete. Run 'agentlint sessions --index' to refresh.
```

### No Matching Evidence

```
TracedIssue {
  traceCompleteness: 'partial',
  chain: { ... },  // Best-effort chain
  limitations: ['No session evidence found']
}
```

---

## Next Steps

After tracing:

1. **Review chain confidence** - High confidence traces are actionable
2. **Apply counterfactual** - Add the suggested configuration
3. **Monitor patterns** - Check if systemic issues decrease over time
4. **Track recommendations** - EP10 will track implementation status
