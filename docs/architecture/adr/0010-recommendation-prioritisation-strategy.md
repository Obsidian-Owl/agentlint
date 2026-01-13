---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0010: Recommendation Prioritisation Strategy

## Context and Problem Statement

agentlint generates recommendations for improving AI coding assistant effectiveness. These recommendations vary in:
- **Type**: Symptomatic (fix immediate issue), Preventive (stop recurrence), Systemic (address root patterns)
- **Confidence**: HIGH/MEDIUM/LOW based on causal evidence (ADR-0007)
- **Effort**: Estimated implementation complexity
- **Frequency**: How often the underlying issue occurs
- **Dependencies**: Whether one recommendation enables others

Users need a prioritisation strategy that helps them:
1. Quickly identify actionable improvements (quick wins)
2. Understand the optimal order for maximum cumulative impact
3. Handle conflicting or overlapping recommendations

The Architecture Vision states: "agentlint prioritises preventive and systemic recommendations because they compound value over time." This ADR defines how that prioritisation is implemented.

## Decision Drivers

- **Architecture Vision guidance**: Systemic > Preventive > Symptomatic type hierarchy
- **User preference**: Both quick-win view AND optimal-impact view needed
- **Causal confidence**: Should be visible but advisory, not forced into priority
- **Effort estimation**: Heuristic-based without requiring user input
- **Conflict resolution**: Merge compatible recommendations, flag only true conflicts
- **Intelligent Tooling**: Agent can apply contextual reasoning to prioritization when needed
- **Compounding Value principle**: Prioritisation improves with historical context

## Considered Options

1. Layered Views (Quick Wins + Optimal Impact)
2. Multi-Factor Weighted Score (RICE-Inspired)
3. Dependency-Aware Topological Sort
4. Type-First Hierarchical (SQALE-Inspired)

## Decision Outcome

Chosen option: **"Layered Views"** because it provides both immediate actionability (quick wins) and strategic guidance (optimal impact) while preserving the strong type hierarchy from the Architecture Vision.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDATION PRIORITISATION PIPELINE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 1: RECOMMENDATION COLLECTION                                   │   │
│  │                                                                      │   │
│  │ From Analysis Pipeline:                                              │   │
│  │ • Config issues → recommendations (ADR-0007 causal traces)          │   │
│  │ • Session quality findings → recommendations (ADR-0008)             │   │
│  │ • Static analysis issues → recommendations                          │   │
│  │                                                                      │   │
│  │ Each recommendation has:                                             │   │
│  │ { id, type, description, causal_trace?, confidence?, frequency }    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 2: DEDUPLICATION & CONFLICT RESOLUTION                        │   │
│  │                                                                      │   │
│  │ Deduplication:                                                       │   │
│  │ • Hash recommendation targets (file + line + type)                  │   │
│  │ • Merge duplicates, keeping highest confidence source               │   │
│  │ • Aggregate frequency across merged recommendations                 │   │
│  │                                                                      │   │
│  │ Conflict Detection:                                                  │   │
│  │ • Same target, contradictory actions → flag conflict                │   │
│  │ • Compatible overlaps → merge into single recommendation            │   │
│  │ • Superseding patterns → prefer more general recommendation         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 3: EFFORT ESTIMATION (Heuristic)                              │   │
│  │                                                                      │   │
│  │ Effort Heuristics:                                                   │   │
│  │ • Config change (add line to CLAUDE.md) → LOW                       │   │
│  │ • Config restructure (reorganise sections) → MEDIUM                 │   │
│  │ • New file creation (add type definitions) → MEDIUM                 │   │
│  │ • Workflow change (add pre-commit hook) → MEDIUM                    │   │
│  │ • Architecture change (refactor structure) → HIGH                   │   │
│  │ • Tooling integration (add type checker) → HIGH                     │   │
│  │                                                                      │   │
│  │ Heuristic sources:                                                   │   │
│  │ • Recommendation type → base effort                                 │   │
│  │ • Scope (files affected) → effort multiplier                        │   │
│  │ • Existing tooling → effort reduction if already present            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 4: DEPENDENCY DETECTION (Static Analysis)                     │   │
│  │                                                                      │   │
│  │ Known dependency patterns:                                           │   │
│  │ • "Add type checker" enables "Use strict mode"                      │   │
│  │ • "Create CLAUDE.md" enables all config recommendations             │   │
│  │ • "Add pre-commit hooks" enables "Enforce lint checks"              │   │
│  │                                                                      │   │
│  │ Detection:                                                           │   │
│  │ • Pattern matching on recommendation types                          │   │
│  │ • Build directed acyclic graph (DAG) of dependencies                │   │
│  │ • Mark "unlocking" recommendations that enable others               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PHASE 5: DUAL VIEW GENERATION                                       │   │
│  │                                                                      │   │
│  │ ┌─────────────────────────┐   ┌─────────────────────────────────┐   │   │
│  │ │ QUICK WINS VIEW         │   │ OPTIMAL IMPACT VIEW             │   │   │
│  │ │                         │   │                                 │   │   │
│  │ │ Filter:                 │   │ Sort criteria (in order):       │   │   │
│  │ │ • Effort = LOW          │   │ 1. Dependency order (unlocking  │   │   │
│  │ │ • Confidence >= MEDIUM  │   │    recommendations first)       │   │   │
│  │ │                         │   │ 2. Type weight (Systemic=3,     │   │   │
│  │ │ Sort:                   │   │    Preventive=2, Symptomatic=1) │   │   │
│  │ │ 1. Type weight (desc)   │   │ 3. Frequency (desc)             │   │   │
│  │ │ 2. Frequency (desc)     │   │ 4. Confidence (desc)            │   │   │
│  │ │                         │   │                                 │   │   │
│  │ │ Purpose: "What can I    │   │ Purpose: "What order gives      │   │   │
│  │ │ do right now?"          │   │ best cumulative improvement?"   │   │   │
│  │ └─────────────────────────┘   └─────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Prioritization Flexibility

The prioritization pipeline produces default orderings that work well for most cases. However, the agent can apply contextual reasoning to adjust priorities when appropriate:

| Default Behavior | Agent Override Scenario |
|-----------------|-------------------------|
| Type weight determines order | User explicitly states urgency for a symptomatic fix |
| Frequency influences ranking | Learning opportunity outweighs frequency |
| Effort estimation is heuristic | Agent recognizes specific recommendation is easier in this codebase |
| Dependencies create ordering | User wants parallel implementation path |

The agent receives all prioritization data (type, frequency, effort, confidence, dependencies) and can:
- Use default views when they fit the task
- Apply contextual reasoning to reorder based on user goals
- Consider factors the algorithm cannot (urgency, learning value, risk tolerance)

### Type Weighting Model

Per Architecture Vision, systemic recommendations compound value most:

| Type | Weight | Definition | Example |
|------|--------|------------|---------|
| **Systemic** | 3 | Addresses root patterns affecting multiple issues | "Add type checking to enable AI self-correction" |
| **Preventive** | 2 | Stops specific issue from recurring | "Add credential handling guidance to CLAUDE.md" |
| **Symptomatic** | 1 | Fixes immediate issue only | "Remove hardcoded API key from config" |

### Confidence Handling (Advisory, Not Forced)

Per user preference, confidence is **displayed but not forced** into priority:

```typescript
interface PrioritisedRecommendation {
  recommendation: Recommendation;
  priority_rank: number;        // Position in sorted list
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  type_weight: 1 | 2 | 3;
  frequency: number;

  // Advisory fields (displayed, not used in sort)
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence_note?: string;     // "Based on circumstantial evidence"
  causal_trace?: CausalTrace;   // Full trace from ADR-0007

  // Dependency info
  unlocks?: string[];           // IDs of recommendations this enables
  blocked_by?: string[];        // IDs this depends on
}
```

Users can filter by confidence if desired, but it doesn't affect default sort order.

### Conflict Resolution Strategy

**Merge when possible** (per user preference):

| Conflict Type | Resolution |
|---------------|------------|
| Duplicate target, same action | Merge, aggregate frequency, keep highest confidence |
| Duplicate target, compatible actions | Merge into combined recommendation |
| Duplicate target, contradictory actions | Flag as conflict, show both with explanation |
| Superseding pattern | Keep more general recommendation, note it covers specific case |

```typescript
interface ConflictResolution {
  strategy: 'merged' | 'flagged';

  // If merged:
  merged_from?: string[];        // Original recommendation IDs
  aggregated_frequency?: number; // Combined frequency

  // If flagged:
  conflict_type?: 'contradictory' | 'incompatible';
  alternatives?: Recommendation[];
  user_decision_required?: boolean;
}
```

### Effort Estimation Heuristics

Effort is estimated automatically based on recommendation characteristics:

| Recommendation Pattern | Base Effort | Modifiers |
|------------------------|-------------|-----------|
| Add line to existing config | LOW | - |
| Create new config section | LOW | +1 if >10 lines |
| Create new config file | MEDIUM | - |
| Restructure existing config | MEDIUM | +1 if >50% of file |
| Add tooling (linter, type checker) | HIGH | -1 if similar tool exists |
| Workflow change (hooks, CI) | MEDIUM | +1 if no existing automation |
| Architecture refactor | HIGH | - |

```typescript
function estimateEffort(rec: Recommendation): Effort {
  const baseEffort = EFFORT_PATTERNS[rec.pattern] ?? 'MEDIUM';
  const modifiers = calculateModifiers(rec);
  return applyModifiers(baseEffort, modifiers);
}
```

### Consequences

**Good:**
- Dual views address both quick-win seekers and strategic planners
- Strong type weighting aligns with Architecture Vision
- Confidence is visible but not prescriptive (user maintains control)
- Automatic effort estimation reduces user burden
- Merge-first conflict resolution minimises decision fatigue
- Agent can leverage both algorithmic defaults and contextual reasoning
- Dependency detection surfaces "unlocking" recommendations

**Bad:**
- Two views may confuse some users (need clear UX)
- Effort heuristics may be inaccurate for edge cases
- Dependency detection requires maintained pattern library
- Merge logic adds complexity

**Neutral:**
- Users who want fine-grained control can filter/sort manually
- Dependency patterns will grow over time as usage reveals more

## Pros and Cons of Options

### Option 1: Layered Views (Quick Wins + Optimal Impact)

Two distinct priority orderings with explicit purposes.

- Good: Addresses both "what can I do now?" and "what order is best?"
- Good: Preserves type hierarchy strongly
- Good: User chooses view based on current goal
- Neutral: Two outputs to understand
- Bad: Slightly more complex UX

### Option 2: Multi-Factor Weighted Score (RICE-Inspired)

Single numeric score: `(Type × Frequency × Confidence) ÷ Effort`

- Good: Single number, easy to sort
- Good: Familiar RICE pattern
- Good: User-configurable weights possible
- Neutral: Weights need tuning
- Bad: Single number loses nuance
- Bad: Doesn't distinguish quick wins from strategic

### Option 3: Dependency-Aware Topological Sort

Build full dependency graph, topological sort with priority weighting.

- Good: Most sophisticated dependency handling
- Good: Optimal theoretical ordering
- Neutral: Complex to implement
- Bad: May be overkill for MVP
- Bad: Requires extensive domain knowledge

### Option 4: Type-First Hierarchical (SQALE-Inspired)

Strict hierarchy: all systemic → all preventive → all symptomatic.

- Good: Simplest to implement
- Good: Strong type alignment
- Neutral: Rigid ordering
- Bad: Ignores effort entirely
- Bad: May push easy wins too far down

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All prioritisation runs locally |
| II. Improvement-Oriented | Yes | Type hierarchy prioritises compounding value |
| III. Causal-First | Yes | Causal traces displayed, confidence shown |
| IV. Mixed-Methods | Yes | Quantitative (frequency, effort) + qualitative (type) |
| V. Language-Agnostic | Yes | Prioritisation independent of target language |
| VI. Tool-Agnostic | Yes | Works across AI tool adapters |
| VII. Intelligent Tooling | Yes | Agent can apply contextual reasoning to prioritization |
| VIII. Compounding Value | Yes | Recommendations improve with historical context |
| IX. Agent-Aware | Yes | Prioritised lists are compressed for agent context |

## More Information

### Related Documents
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md) - Source of causal traces and confidence
- [ADR-0008: Session Quality Analysis](./0008-session-quality-analysis.md) - Source of session-based recommendations
- Architecture Vision: [Recommendation Flow](../../agentlint-architecture-vision.md#recommendation-flow)
- Design Questions: [Section 2.5 - Recommendation Prioritisation](../../design-questions.md#25-recommendation-prioritisation)

### Research Sources
- [Product School: 9 Prioritization Frameworks](https://productschool.com/blog/product-fundamentals/ultimate-guide-product-prioritization) - RICE, Value/Effort matrices
- [Canny: Product Prioritization Guide 2025](https://canny.io/blog/product-prioritization-frameworks/) - Framework comparison
- [SQALE Method for Technical Debt](https://www.cutter.com/article/managing-technical-debt-sqale-method-490726) - Hierarchical prioritisation
- [Topological Sorting for Dependency Resolution](https://medium.com/@amit.anjani89/topological-sorting-explained-a-step-by-step-guide-for-dependency-resolution-1a6af382b065) - DAG-based ordering
- [Multi-Stakeholder Recommendation Conflict Resolution](https://www.sciencedirect.com/science/article/abs/pii/S0020025524017341) - Conflict handling strategies
- [Qodo: State of AI Code Quality 2025](https://www.qodo.ai/reports/state-of-ai-code-quality/) - AI coding assistant improvement priorities

### Implementation Notes

#### 1. Data Schema (Extends ADR-0003)

```sql
-- Recommendations table
CREATE TABLE recommendations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'systemic', 'preventive', 'symptomatic'
  description TEXT NOT NULL,
  target_file TEXT,
  target_line INTEGER,
  pattern TEXT,                 -- For effort estimation

  -- Computed fields
  effort TEXT,                  -- 'LOW', 'MEDIUM', 'HIGH'
  frequency INTEGER DEFAULT 1,

  -- Relations
  causal_trace_id TEXT,
  FOREIGN KEY (causal_trace_id) REFERENCES causal_traces(id)
);

-- Recommendation dependencies
CREATE TABLE recommendation_dependencies (
  recommendation_id TEXT NOT NULL,
  depends_on_id TEXT NOT NULL,
  PRIMARY KEY (recommendation_id, depends_on_id),
  FOREIGN KEY (recommendation_id) REFERENCES recommendations(id),
  FOREIGN KEY (depends_on_id) REFERENCES recommendations(id)
);

-- Conflict tracking
CREATE TABLE recommendation_conflicts (
  id TEXT PRIMARY KEY,
  recommendation_a_id TEXT NOT NULL,
  recommendation_b_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,  -- 'contradictory', 'merged'
  resolution TEXT,              -- JSON: merged result or null if flagged
  FOREIGN KEY (recommendation_a_id) REFERENCES recommendations(id),
  FOREIGN KEY (recommendation_b_id) REFERENCES recommendations(id)
);
```

#### 2. View Generation Algorithm

```typescript
function generateQuickWinsView(recommendations: Recommendation[]): PrioritisedRecommendation[] {
  return recommendations
    .filter(r => r.effort === 'LOW' && r.confidence !== 'LOW')
    .sort((a, b) => {
      // Primary: type weight descending
      const typeCompare = TYPE_WEIGHTS[b.type] - TYPE_WEIGHTS[a.type];
      if (typeCompare !== 0) return typeCompare;

      // Secondary: frequency descending
      return b.frequency - a.frequency;
    })
    .map((r, i) => ({ ...r, priority_rank: i + 1 }));
}

function generateOptimalImpactView(recommendations: Recommendation[]): PrioritisedRecommendation[] {
  // 1. Build dependency graph
  const graph = buildDependencyGraph(recommendations);

  // 2. Topological sort (unlocking recommendations first)
  const sorted = topologicalSort(graph);

  // 3. Within each dependency level, sort by type > frequency > confidence
  return sortWithinLevels(sorted, (a, b) => {
    const typeCompare = TYPE_WEIGHTS[b.type] - TYPE_WEIGHTS[a.type];
    if (typeCompare !== 0) return typeCompare;

    const freqCompare = b.frequency - a.frequency;
    if (freqCompare !== 0) return freqCompare;

    return CONFIDENCE_ORDER[b.confidence] - CONFIDENCE_ORDER[a.confidence];
  });
}

const TYPE_WEIGHTS = { systemic: 3, preventive: 2, symptomatic: 1 };
const CONFIDENCE_ORDER = { HIGH: 3, MEDIUM: 2, LOW: 1 };
```

#### 3. Conflict Merging Logic

```typescript
function resolveConflicts(recommendations: Recommendation[]): ResolvedRecommendations {
  const byTarget = groupBy(recommendations, r => `${r.target_file}:${r.target_line}`);
  const resolved: Recommendation[] = [];
  const conflicts: Conflict[] = [];

  for (const [target, recs] of Object.entries(byTarget)) {
    if (recs.length === 1) {
      resolved.push(recs[0]);
      continue;
    }

    // Check if actions are compatible
    if (areActionsCompatible(recs)) {
      // Merge: combine descriptions, aggregate frequency, keep highest confidence
      resolved.push(mergeRecommendations(recs));
    } else {
      // Flag conflict for user decision
      conflicts.push({
        target,
        recommendations: recs,
        type: 'contradictory',
        userDecisionRequired: true,
      });
    }
  }

  return { resolved, conflicts };
}
```

### CLI Output Example

```
$ agentlint recommend --view quick-wins

QUICK WINS (Low effort, high impact)
====================================

1. [SYSTEMIC] Add type checking configuration
   Effort: LOW | Confidence: HIGH | Frequency: 12 occurrences
   Traced to: Session abc123 - "add feature without types"
   → Enables 4 other recommendations

2. [PREVENTIVE] Add credential handling guidance to CLAUDE.md
   Effort: LOW | Confidence: HIGH | Frequency: 3 occurrences
   Traced to: Commit def456 - secret in config

3. [PREVENTIVE] Document test command in CLAUDE.md
   Effort: LOW | Confidence: MEDIUM | Frequency: 8 occurrences
   Traced to: Session ghi789 - tests not run

---

$ agentlint recommend --view optimal

OPTIMAL IMPACT ORDER
====================

Phase 1: Unlocking Improvements
-------------------------------
1. [SYSTEMIC] Add type checking configuration
   Unlocks: strict-mode, type-hints, better-ai-feedback

Phase 2: Systemic Improvements
------------------------------
2. [SYSTEMIC] Restructure CLAUDE.md for progressive disclosure
   Frequency: 15 | Effort: MEDIUM

Phase 3: Preventive Improvements
--------------------------------
3. [PREVENTIVE] Add credential handling guidance
   ...

⚠️  1 CONFLICT DETECTED (use --show-conflicts)
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Effort Heuristic Tuning**: Initial heuristics may need refinement based on user feedback
2. **Dependency Pattern Library**: Build out known dependency patterns as usage reveals more
3. **User Preference Storage**: Consider storing user's preferred view in config (ADR-0004)
