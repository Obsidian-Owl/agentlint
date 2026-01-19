---
status: accepted
date: 2026-01-18
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0019: Tool/Agent Boundary for Temporal Analysis

## Context and Problem Statement

EP09 Temporal Analysis implements tools that cross the boundary between data extraction (tool responsibility) and quality judgment (agent responsibility). Analysis reveals 25+ judgment functions encoded in tools that should be agent reasoning:

- `isImprovement()` - determines if a metric change is "good"
- `classifyTrend()` - labels trends as "improving" or "degrading"
- `getSuggestedStatus()` - determines recommendation implementation status
- `determineOverallTrend()` - aggregates to single "improved"/"regressed" judgment
- `getSentimentLabel()` / `getSentimentEmoji()` - converts scores to interpretations
- `analyzeSentimentIndicators()` - performs semantic analysis in tool code

This violates Constitution Principles IV (Mixed-Methods) and VII (Intelligent Tooling), which establish that tools provide data and the agent provides judgment.

## Decision Drivers

- **Constitution Compliance**: Principle IV requires agent decides which methods apply; Principle VII requires tools provide data, agent provides understanding
- **Arc42 Two-Layer Architecture**: Static layer extracts; Agentic layer reasons
- **Context Awareness**: Agent can reason about context tools cannot access
- **ADR-0005 Pattern**: Tools return structured data with rich descriptions
- **Semantic Understanding**: Quality judgment requires semantic understanding tools lack

## Considered Options

1. Keep current design (tools include judgment)
2. Refactor tools to return data + evidence, agent applies judgment
3. Move all logic to agent prompts (no tools)

## Decision Outcome

**Chosen option: "Refactor tools to return data + evidence, agent applies judgment"**

Tools will return statistical facts and evidence; the agent will interpret meaning and make quality judgments. This aligns with the Constitution's separation of concerns.

### Tool Responsibility: Data Extraction

Tools provide:
- Raw metric values and changes (from → to)
- Statistical calculations (slope, R², standard deviation)
- Pattern matches and evidence (with weights)
- Time series data points
- Counts and aggregations

### Agent Responsibility: Quality Judgment

Agent reasons about:
- "Is this an improvement?" (context-dependent)
- "What caused this change?" (causal analysis)
- "Is this trend significant?" (semantic understanding)
- "Should this recommendation be marked as implemented?" (confirmation)
- "What does this sentiment trend mean?" (interpretation)

### Specific Changes

| Module | Remove | Keep/Add |
|--------|--------|----------|
| `config.ts` | `isImprovement()` | `INVERTED_METRICS` as optional context |
| `detector.ts` | `getSuggestedStatus()`, `generateExplanation()` | `extractMatchEvidence()` returning raw evidence |
| `summarizer.ts` | `determineOverallTrend()` | `changeCounts: {increased, decreased, unchanged}` |
| `regression.ts` | `classifyTrend()` | Statistical calculation only |
| `metric-trend.ts` | `direction` field, `LOWER_IS_BETTER_METRICS` | `rSquared`, `volatility` |
| `sentiment.ts` | `getSentimentLabel()`, `getSentimentEmoji()`, `analyzeSentimentIndicators()` | Slope and value returns |
| `dimensions.ts` | `positiveIndicators`, `negativeIndicators` | Keep dimension prompts |

### Example: Before and After

**Before** (tool encodes judgment):
```typescript
function detectImplementation(rec, diff): DetectionResult {
  // ... calculate evidence ...
  return {
    detected: confidence >= MIN_CONFIDENCE_THRESHOLD,
    confidence,
    suggestedStatus: getSuggestedStatus(confidence),  // JUDGMENT
    evidence,
    explanation: generateExplanation(rec, evidence)   // JUDGMENT
  };
}
```

**After** (tool returns evidence):
```typescript
function extractMatchEvidence(rec, diff): MatchEvidence {
  // ... calculate evidence ...
  return {
    evidence,           // Raw evidence array
    totalWeight,        // Numeric score
    keywordMatches,     // What matched
    fileMatches,
    patternMatches
  };
}
// Agent decides: "Based on evidence weight of 85 and 3 keyword matches,
// I recommend marking this as 'detected_pending_confirm'"
```

### Consequences

**Good:**
- Agent can reason with full context (project state, user preferences, recent changes)
- Consistent with Constitution Principles IV and VII
- Tools become simpler and more focused
- Agent can explain its reasoning in natural language
- Quality judgments can evolve without tool changes

**Bad:**
- Slightly more agent tokens used for judgment
- Agent prompt must include guidance for interpretation
- Breaking changes to tool return types

**Neutral:**
- `INVERTED_METRICS` kept as optional context the agent can use
- `isSignificantChange()` kept (threshold check, not judgment)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | ✅ | No change - all local |
| II. Improvement-Oriented | ✅ | Better improvement tracking via agent reasoning |
| III. Causal-First | ✅ | Agent can trace causes tools cannot see |
| IV. Mixed-Methods | ✅ | **Fixed**: Agent now decides which methods apply |
| V. Language-Agnostic | ✅ | No change |
| VI. Agent-Agnostic | ✅ | No change |
| VII. Intelligent Tooling | ✅ | **Fixed**: Tools provide data, agent provides judgment |
| VIII. Compounding Value | ✅ | Agent reasoning improves with context |
| IX. Agent-Aware | ✅ | Tools designed for agent consumption |

## More Information

### Governance Compliance

Per Constitution §Governance "ADR Implementation Notes":

> ADRs describe tool capabilities and data structures, not agent orchestration.
> - **Good**: Tool schemas, data structures, SQL queries, API surfaces
> - **Anti-pattern**: Functions that dictate session workflows, code that orchestrates agent behavior

The functions being removed (`getSuggestedStatus()`, `generateExplanation()`, etc.) are anti-patterns—they dictate what the agent should conclude rather than providing data for agent reasoning.

### Related Documents

- Constitution: [.specify/memory/constitution.md](../../../.specify/memory/constitution.md) - Principles IV, VII
- Arc42 §4: [docs/architecture/arc42/04-solution-strategy.md](../arc42/04-solution-strategy.md) - Two-Layer Architecture
- ADR-0005: [0005-tool-definition-and-invocation-pattern.md](./0005-tool-definition-and-invocation-pattern.md)
- EP09 Spec: [specs/ep09-temporal-analysis/spec.md](../../../specs/ep09-temporal-analysis/spec.md)
