# Quickstart: Recommendation Advisor

> **Epic**: EP10
> **Created**: 2026-01-20

---

## Overview

The Recommendation Advisor is a subagent that synthesizes actionable recommendations from analysis findings. It maintains case-based state management where recommendations evolve over time through append-only event logs.

---

## Basic Flow

```
1. Run analysis (EP05/EP06/EP07)
2. Orchestrator spawns Recommendation Advisor
3. Advisor reasons about findings
4. Advisor creates recommendations with traced origins
5. Recommendations evolve through events
6. Cases complete when implemented/superseded
```

---

## Tool Usage Examples

### Creating a Recommendation

The `create_recommendation` tool creates a new case:

```typescript
// Tool: create_recommendation
{
  type: 'preventive',
  action: 'Add credential handling guidance to CLAUDE.md',
  target: 'CLAUDE.md:Security section',
  rationale: 'Session logs show repeated credential exposure. Adding guidance prevents recurrence.',
  priority: 'high',
  tracedOrigin: {
    findingId: 'abc123',
    sessionId: 'session-456',
    configGap: 'Missing credential handling instructions'
  }
}
```

**Output**: Recommendation with UUID, initial 'created' event

---

### Querying Recommendations

The `list_recommendations` tool queries with filters:

```typescript
// Tool: list_recommendations
{
  status: 'open',
  priority: 'high',
  limit: 10
}
```

**Output**: Array of RecommendationSummary (compressed for context budget)

---

### Adding Events

The `add_recommendation_event` tool appends to case history:

```typescript
// Tool: add_recommendation_event
{
  recommendationId: 'rec-uuid-here',
  type: 'observation',
  content: 'Config change detected in CLAUDE.md matching recommendation',
  commitHash: 'a1b2c3d'
}
```

**Note**: Content is limited to 200 characters (enforced).

---

### Getting Full Details

The `get_recommendation` tool returns complete case with all events:

```typescript
// Tool: get_recommendation
{
  recommendationId: 'rec-uuid-here'
}
```

**Output**: Full Recommendation including all events

---

### Completing a Case

The `complete_recommendation` tool soft-closes a case:

```typescript
// Tool: complete_recommendation
{
  recommendationId: 'rec-uuid-here',
  reason: 'implemented'
}
```

**Output**: Updated Recommendation with completedAt timestamp

---

## Spawning the Advisor

The main orchestrator uses `spawn_recommendation_advisor`:

```typescript
// Tool: spawn_recommendation_advisor
{
  findings: [...], // From EP05/EP06/EP07
  causalTraces: [...], // From EP07 (optional)
  includeHistoricRecs: true,
  interactionMode: 'propose'
}
```

The advisor then:
1. Loads context (findings, historic recommendations)
2. Reasons about what recommendations are needed
3. May ask clarifying questions (returned for orchestrator to present)
4. Creates recommendations with traced origins

---

## Recommendation Types

| Type | When to Use | Example |
|------|-------------|---------|
| **Symptomatic** | Fix immediate issue | "Remove API key from line 42" |
| **Preventive** | Prevent recurrence | "Add credential guidance to CLAUDE.md" |
| **Systemic** | Address root pattern | "Add pre-commit hook for secret scanning" |

Prioritize **preventive** and **systemic** for compounding value.

---

## Event Types

| Type | When to Use |
|------|-------------|
| `observation` | Agent notices something relevant |
| `refinement` | Action/target/priority changed |
| `user_feedback` | User provided input |
| `evidence` | Supporting evidence accumulated |
| `implementation_signal` | Detected possible implementation |
| `status_change` | Status transition |

The `created` and `completed` types are system-generated.

---

## Context Budget

Recommendations are loaded within an **8K token budget**:

- Load newest-first until budget exhausted
- Older recommendations get compressed summaries
- Full details available via `get_recommendation`

---

## Common Patterns

### Iterative Refinement

```
1. Create recommendation with initial understanding
2. User provides feedback → add_recommendation_event(user_feedback)
3. Agent refines → refine_recommendation
4. Implementation detected → add_recommendation_event(implementation_signal)
5. User confirms → complete_recommendation(implemented)
```

### Superseding a Recommendation

```
1. Original recommendation exists
2. Better approach discovered
3. Create new recommendation
4. Complete old with reason='superseded', link to new
```

### Tracking Effectiveness

```
1. Recommendation implemented
2. Run analysis again
3. Add evidence events with baseline comparisons
4. If effective → complete
5. If ineffective → may create new systemic recommendation
```

---

## File Storage

Recommendations are stored in:

```
.agentlint/recommendations/
├── {uuid1}.json
├── {uuid2}.json
└── ...
```

Each file contains:
```json
{
  "version": "1.0.0",
  "recommendation": { ... }
}
```

---

## Integration Points

| Component | Integration |
|-----------|-------------|
| **EP05 Config Analysis** | Findings feed into recommendations |
| **EP06 Session Analysis** | Session patterns inform recommendations |
| **EP07 Causal Tracing** | Traced origins link to causal chains |
| **EP09 Temporal** | Baselines correlate with recommendation effectiveness |
| **EP12 Global Learnings** | Completed recommendations may promote to learnings |

---

## Next Steps

After recommendations are created:

1. Present to user via CLI (EP04)
2. Track implementation via events
3. Correlate with baselines for effectiveness
4. Promote successful patterns to global learnings (EP12)
