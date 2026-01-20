# Research Findings: Recommendation Advisor

> **Epic**: EP10
> **Created**: 2026-01-20

---

## Decision Log

### 1. Subagent Architecture Pattern

**Decision**: Follow the EP08/EP09 Temporal Analyzer subagent pattern

**Rationale**:
- Proven pattern already validated in codebase (`src/temporal/subagent/temporal-subagent.ts`)
- SDK-compatible via `toAgentDefinition()` factory function
- Clean separation: system prompt + tool list + AgentDefinition
- Per Constitution C8: Single subagent depth (no Task tool access)

**Alternatives Considered**:
- Tool-only approach (rejected: doesn't leverage agent reasoning)
- Direct orchestrator integration (rejected: harder to test, less modular)

**References**:
- `src/temporal/subagent/temporal-subagent.ts` - Pattern reference
- `src/temporal/subagent/types.ts` - Type definitions
- ADR-0005: Tool Definition and Invocation Pattern

**Implementation Pattern**:
```typescript
// Follow 4-layer prompt structure: Role → Domain → Task → Output
const RECOMMENDATION_ADVISOR_PROMPT = `## ROLE IDENTITY
You are the **Recommendation Advisor**...

## DOMAIN KNOWLEDGE
...

## YOUR TASK
...

## OUTPUT FORMAT
...`;

export const recommendationAdvisorInstructions: RecommendationSubagentInstructions = {
  name: 'recommendation-advisor',
  displayName: 'Recommendation Advisor',
  description: 'Synthesizes actionable recommendations from analysis findings...',
  prompt: RECOMMENDATION_ADVISOR_PROMPT,
  tools: [...RECOMMENDATION_SUBAGENT_TOOLS],
  priority: 80,
};
```

---

### 2. Storage Architecture

**Decision**: JSON files in `.agentlint/recommendations/{id}.json` with atomic writes

**Rationale**:
- Consistent with existing patterns (baselines, tracking, reviews)
- Atomic writes via `atomicWriteJson()` ensure crash safety
- File-per-recommendation enables easy inspection and debugging
- No SQLite needed for MVP (per assumption A2)

**Alternatives Considered**:
- SQLite storage (rejected: overkill for MVP, can add later for querying)
- Single JSON file (rejected: concurrency issues, large file risk)

**References**:
- `src/persistence/common/atomic-write.ts` - Atomic write utilities
- `src/persistence/tracking/storage.ts` - Similar storage pattern
- EP03 Persistence Layer patterns

**Implementation Pattern**:
```typescript
// Storage location
const RECOMMENDATIONS_SUBDIR = 'recommendations';

// File format
interface RecommendationFile {
  version: string;
  recommendation: Recommendation;
}

// Atomic write
await atomicWriteJson(
  join(recommendationsDir, `${id}.json`),
  { version: '1.0.0', recommendation }
);
```

---

### 3. Context Budget Management

**Decision**: 8K token rolling budget, load newest-first until exhausted

**Rationale**:
- Per clarification Q2 and Anthropic's context engineering guidance
- "Treat context as a precious, finite resource"
- Newest recommendations are most relevant for current analysis
- Compress older recommendations on-the-fly when loading

**Alternatives Considered**:
- Fixed count (20) (rejected: doesn't account for varying recommendation sizes)
- Configurable limit (rejected: adds complexity, risks overflow)
- Tiered compression (rejected: more complex, similar outcome)

**References**:
- [Effective Context Engineering for AI Agents (Anthropic)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [The Context Window Problem (Factory.ai)](https://factory.ai/news/context-window-problem)
- [Context Engineering Compaction (Jason Liu)](https://jxnl.co/writing/2025/08/30/context-engineering-compaction/)

**Implementation Pattern**:
```typescript
const TOKEN_BUDGET = 8000;
const CHARS_PER_TOKEN = 4; // Approximate

function loadRecommendationsForContext(projectPath: string): RecommendationSummary[] {
  const all = listRecommendationIds(projectPath);
  const summaries: RecommendationSummary[] = [];
  let usedTokens = 0;

  // Load newest-first
  for (const id of all.reverse()) {
    const rec = loadRecommendation(id);
    const summary = compressRecommendation(rec);
    const tokens = estimateTokens(summary);

    if (usedTokens + tokens > TOKEN_BUDGET) break;

    summaries.push(summary);
    usedTokens += tokens;
  }

  return summaries;
}
```

---

### 4. EP09 RecommendationTracking Replacement

**Decision**: EP10 `Recommendation` type replaces EP09 `RecommendationTracking`

**Rationale**:
- Case-based model is richer and subsumes tracking functionality
- Events capture all tracking state transitions with audit trail
- Single source of truth for recommendations

**Migration Mapping**:

| EP09 RecommendationTracking | EP10 Recommendation |
|----------------------------|---------------------|
| `id` | `id` |
| `recommendationId` | (self-reference) |
| `recommendationText` | `action` + `rationale` |
| `status` (6 states) | `status` (4 states) + `completionReason` |
| `detectedAt` | Event with `type: 'created'` |
| `confirmedAt` | Event with `type: 'status_change'` |
| `preBaselineId` | Event with `baselineId` context |
| `postBaselineId` | Event with `baselineId` context |
| `effectivenessScore` | Event with `type: 'evidence'` |
| `notes` | Event with `type: 'user_feedback'` |

**Migration Path**:
1. Create adapter function `migrateTrackingToRecommendation()`
2. Run migration on first EP10 tool invocation
3. Archive old tracking files after successful migration

**References**:
- `src/temporal/types.ts:331` - EP09 RecommendationTracking
- Clarification Q4 resolution

---

### 5. Collaborative Question Handling

**Decision**: Subagent returns structured questions; orchestrator presents to user

**Rationale**:
- Follows existing SDK patterns (no nested user interaction)
- Simpler implementation
- Per clarification Q1 resolution

**Alternatives Considered**:
- Direct `ask_user_question` tool access (rejected: SDK doesn't support nested interaction)

**Implementation Pattern**:
```typescript
// Subagent returns structured output
interface AdvisorOutput {
  recommendations: Recommendation[];
  clarifyingQuestions?: ClarifyingQuestion[];
  assumptions?: string[];
}

interface ClarifyingQuestion {
  question: string;
  options?: { label: string; description: string }[];
  context: string;
}

// Orchestrator checks for questions and presents to user
if (output.clarifyingQuestions?.length > 0) {
  // Present to user, then re-invoke subagent with answers
}
```

---

### 6. Event Compaction Strategy

**Decision**: Synchronous compaction when events exceed threshold (10)

**Rationale**:
- P3 feature, acceptable latency
- Avoids job queue infrastructure for MVP
- Per clarification Q3 resolution

**Implementation Pattern**:
```typescript
const EVENT_COMPACTION_THRESHOLD = 10;
const MAX_VERBATIM_EVENTS = 3;

function compressRecommendation(rec: Recommendation): RecommendationSummary {
  const { events } = rec;

  if (events.length <= MAX_VERBATIM_EVENTS) {
    // Few events - include verbatim
    return { ...summary, recentActivity: formatEventsVerbatim(events) };
  }

  if (events.length <= EVENT_COMPACTION_THRESHOLD) {
    // Moderate - last N verbatim, count others
    const recent = events.slice(-MAX_VERBATIM_EVENTS);
    const olderCount = events.length - MAX_VERBATIM_EVENTS;
    return {
      ...summary,
      recentActivity: `[+${olderCount} earlier events]\n${formatEventsVerbatim(recent)}`
    };
  }

  // Many events - summarize
  return {
    ...summary,
    recentActivity: '[Events summarized - use get_recommendation for full history]'
  };
}
```

---

### 7. Tool Inventory

**Decision**: 9 tools for CRUD + subagent spawn

**Tool List**:

| Tool | Purpose | Priority |
|------|---------|----------|
| `spawn_recommendation_advisor` | Invoke subagent with context | P1 |
| `create_recommendation` | Create new case | P1 |
| `get_recommendation` | Get full case with events | P1 |
| `get_recommendation_summary` | Get compressed view | P1 |
| `list_recommendations` | Query with filters | P1 |
| `add_recommendation_event` | Append event | P1 |
| `update_recommendation_status` | Status transitions | P1 |
| `refine_recommendation` | Update fields with audit | P2 |
| `complete_recommendation` | Soft close | P2 |

**Subagent-Only Tools** (not available to subagent, prevents recursion):
- `spawn_recommendation_advisor` (per Constitution C8)

---

## Outstanding Items

None. All research questions resolved.

---

## Next Steps

1. Create `data-model.md` with full type definitions
2. Create `contracts/types.ts` with TypeScript interfaces
3. Create `quickstart.md` with usage examples
4. Proceed to `/dev.tasks` for task generation
