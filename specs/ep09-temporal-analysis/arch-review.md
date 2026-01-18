# Architecture Review Report

> **Feature**: EP09 - Temporal Analysis
> **Branch**: main (post-T040 implementation)
> **Reviewed**: 2026-01-18
> **Status**: **ARCHITECTURAL DRIFT DETECTED**

---

## Executive Summary

**Your concern is valid.** The EP09 implementation has drifted from the documented architecture in a significant way.

We are building **deterministic heuristics that replace agent reasoning** rather than **tools that provide data for agent reasoning**. This violates Constitution Principles IV (Mixed-Methods) and VII (Intelligent Tooling), and contradicts the Two-Layer Analysis strategy documented in Arc42 §4.

| Category | Count | Status |
|----------|-------|--------|
| Violations | 3 | ❌ |
| Drift | 2 | ⚠️ |
| Aligned | 4 | ✓ |

**Overall**: FAIL - Requires architectural correction before proceeding.

---

## The Core Issue

### Your Vision (Correct)

From Arc42 §4 Solution Strategy - Two-Layer Analysis:

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTIC REASONING LAYER                      │
│  • Semantic understanding • Quality judgments                   │
│  • Causal analysis • Context-aware recommendations              │
├─────────────────────────────────────────────────────────────────┤
│                    STATIC ANALYSIS LAYER                        │
│  • Fast, deterministic extraction • Config parsing              │
│  • Session metrics • Git queries • Doc structure                │
└─────────────────────────────────────────────────────────────────┘
```

From Constitution Principle VII (Intelligent Tooling):
> "**Tools provide**: What is configured, how content is structured, what happened in sessions, how things evolved"
>
> "**Agent reasoning provides**: WHY things happened, quality judgments, causal analysis, semantic understanding"

### What We Built (Incorrect)

We built **deterministic functions that encode quality judgments** rather than **tools that provide data for agent judgment**:

| Function | What It Does | Problem |
|----------|--------------|---------|
| `detectImplementation()` | Pattern-matches keywords to "detect" recommendation implementation, returns confidence score | **Encodes quality judgment** - agent should reason about whether a config change implements a recommendation |
| `generateExplanation()` | Templates human-readable explanations | **Replaces agent reasoning** - agent should generate explanations via natural language |
| `determineOverallTrend()` | Returns "improved" / "regressed" / "unchanged" | **Quality judgment** - agent should interpret metric deltas in context |
| `isImprovement()` | Hardcodes which direction is "better" per metric | **Context-free judgment** - agent should reason about context |
| `positiveIndicators[]` / `negativeIndicators[]` | Keyword lists for automated sentiment | **Replaces agent semantic understanding** |

---

## Detailed Findings

### VIOLATION V1: `detectImplementation()` Replaces Agent Reasoning

**Location**: `src/temporal/tracking/detector.ts:138-225`

**Issue**: This function attempts to "detect" whether a recommendation was implemented using pattern matching:
- Keyword matching (weighted at 20)
- File pattern matching (weighted at 30)
- Regex pattern matching (weighted at 40)
- Returns a "confidence score" and "suggested status"

**Why This Is Wrong**:

Per Constitution Principle VII:
> "Agent reasoning provides: WHY things happened, **quality judgments**, causal analysis, **semantic understanding**"

Detecting whether a config change implements a specific recommendation requires **semantic understanding** - not pattern matching. The agent should:
1. See the config diff (tool provides this)
2. See the recommendation (tool provides this)
3. **Reason** about whether the change addresses the recommendation
4. **Explain** its reasoning in natural language

**Impact**: High - this is a core architectural pattern that will propagate

**Recommendation**: Rename to `extractConfigChanges()` - provide the DIFF, not the JUDGMENT

---

### VIOLATION V2: `determineOverallTrend()` Encodes Quality Judgment

**Location**: `src/temporal/delta/summarizer.ts:274-302`

**Issue**: This function makes a quality judgment about whether changes are "improved", "regressed", or "unchanged" using simple counting:

```typescript
if (improvements > regressions) {
  return 'improved';
} else if (regressions > improvements) {
  return 'regressed';
}
return 'unchanged';
```

**Why This Is Wrong**:

From Arc42 §4:
> "**Agentic Reasoning Layer**: Semantic understanding, **Quality judgments**"

Whether a workflow improved is a **quality judgment** that depends on:
- User's priorities (maybe they care more about one metric)
- Context of the changes (was a regression expected during refactoring?)
- Semantic understanding of what metrics mean together

**Recommendation**: Remove `overallTrend` from `DeltaSummary`. Tools provide metric deltas; agent interprets meaning.

---

### VIOLATION V3: `isImprovement()` Hardcodes Context-Free Judgments

**Location**: `src/temporal/config.ts`

**Issue**: Hardcodes "inverted metrics" (where lower is better) without context:

```typescript
export const INVERTED_METRICS = [
  'findingsCount',
  'criticalCount',
  'warningCount',
  // ...
];
```

**Why This Is Wrong**:

Whether a metric change is an "improvement" depends on context:
- During active development, more findings might be expected
- Token usage increase might be acceptable if accuracy improved
- Warning count going up might be good if you enabled new checks

**Recommendation**: Remove `isImprovement()`. Provide raw deltas; agent reasons about improvement in context.

---

### DRIFT D1: Sentiment Indicators in Dimension Definitions

**Location**: `src/temporal/qualitative/dimensions.ts:60-68, 81-89, etc.`

**Issue**: Each dimension has `positiveIndicators[]` and `negativeIndicators[]` - keyword lists for automated sentiment detection:

```typescript
positiveIndicators: ['smooth', 'seamless', 'easy', 'quick', 'natural', 'intuitive'],
negativeIndicators: ['frustrating', 'slow', 'awkward', 'confusing', 'repetitive'],
```

**Why This Is Problematic**:

This enables deterministic sentiment analysis via keyword matching. Per Constitution Principle IV:
> "The agent **reasons** about which methods to apply... Agent reasoning about relevance, context-aware selection"

Sentiment analysis of qualitative responses requires **semantic understanding**, not keyword matching.

**Impact**: Medium - these aren't actively used yet, but signal wrong direction

**Recommendation**: Remove indicator arrays. Agent performs semantic sentiment analysis.

---

### DRIFT D2: Template-Based Explanations

**Location**: `src/temporal/tracking/detector.ts:343-376` (`generateExplanation()`)

**Issue**: Generates explanations via string templates rather than agent reasoning:

```typescript
return `Detected potential implementation of "${recommendation.summary}"
  with ${confidenceLevel} confidence (${confidence}%): ${parts.join('; ')}`;
```

**Impact**: Medium - creates robotic, non-contextual explanations

**Recommendation**: Agent generates explanations via natural language reasoning.

---

## What's Correctly Aligned

### ✓ Delta Calculation (`calculator.ts`)

Correctly uses jsondiffpatch to compute raw deltas - pure data extraction.

### ✓ Statistical Aggregation (`aggregator.ts`, `regression.ts`)

Linear regression and metric aggregation are legitimate deterministic calculations.

### ✓ Storage Operations (`persistence/tracking/storage.ts`)

CRUD operations correctly provide data access without judgment.

### ✓ Config Diff Creation (`createConfigDiff()`)

Extracting what changed between configs is pure data extraction.

---

## The Correct Pattern

### Tools Should Provide

| Tool | Output | Purpose |
|------|--------|---------|
| `calculate_delta` | Raw metric deltas, jsondiffpatch output | WHAT changed |
| `get_config_diff` | Lines added/removed, files modified | WHAT changed in config |
| `query_trends` | Time series data, slopes, statistics | WHAT the numbers show |
| `get_recommendation` | Recommendation text and metadata | WHAT was recommended |
| `get_baseline_pair` | Pre/post baselines with metrics | WHAT the state was |

### Agent Should Reason

| Reasoning Task | Input | Agent Provides |
|----------------|-------|----------------|
| "Was this recommendation implemented?" | Config diff + recommendation | Semantic judgment + explanation |
| "Is this an improvement?" | Metric delta + context | Quality judgment considering priorities |
| "What caused this change?" | Trend inflection + git commits | Causal analysis |
| "How effective was this change?" | Pre/post baselines | Causal attribution with confidence |
| "What's the overall sentiment?" | User's qualitative response text | Semantic sentiment analysis |

---

## Recommendations

### Immediate (Before Proceeding)

1. **STOP T041** - Do not implement `calculateEffectiveness()` as a deterministic function
2. **Rename detector module** - From `detector.ts` to `diff-extractor.ts` or similar
3. **Remove judgment functions** - `detectImplementation()`, `determineOverallTrend()`, `isImprovement()`

### Short-Term (This Sprint)

1. **Create `temporal-reasoner` subagent** (per spec.md SDK Validation section)
   - Agent-based interpretation of temporal data
   - Tools provide data; subagent reasons about meaning

2. **Refactor existing tools** - Ensure they provide DATA not JUDGMENT

3. **Document the boundary** - Add ADR clarifying tool vs. agent responsibilities for temporal analysis

### Medium-Term

1. **Review EP07 (Causal Tracing)** for similar patterns
2. **Update spec/plan** to clarify agent-reasoning vs. tool-data boundary
3. **Add arch tests** to prevent judgment functions in tool layer

---

## Constitution Alignment Check

| Principle | Current | Required |
|-----------|---------|----------|
| IV. Mixed-Methods | ⚠️ Methods hardcoded in tools | Agent decides which analysis to apply |
| VII. Intelligent Tooling | ❌ Tools encode judgments | Tools provide data; agent reasons |
| IX. Agent-Aware | ⚠️ Bypassing agent reasoning | Design serves agent cognitive needs |

---

## Conclusion

**Your intuition was correct.** We've been building a "smart tools" architecture instead of an "intelligent agent" architecture. The difference is profound:

- **Smart Tools**: Encode heuristics, pattern matching, and pre-computed judgments
- **Intelligent Agent**: Uses tools for data; applies reasoning for understanding

The EP09 spec and plan are sound. The implementation drifted toward deterministic heuristics, likely because:
1. It's faster to implement pattern matching than agent reasoning
2. The tasks.md focused on implementation details, not architectural intent
3. The boundary between "tool" and "agent reasoning" wasn't explicit enough

**Recommended Next Step**: Pause EP09 implementation. Create an ADR clarifying the tool/agent boundary for temporal analysis. Then refactor the detector module and resume with correct architecture.

---

## References

- [Constitution v1.2.1](../../.specify/memory/constitution.md) - Principles IV, VII, IX
- [Arc42 §4 Solution Strategy](../../docs/architecture/arc42/04-solution-strategy.md) - Two-Layer Analysis
- [Arc42 §5 Building Blocks](../../docs/architecture/arc42/05-building-blocks.md) - Layer Responsibilities
- [EP09 Spec - SDK Design Validation](./spec.md#sdk-design-validation) - Subagent recommendation
