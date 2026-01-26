# Constitution Mapping

This reference maps tech debt patterns to Constitution principles and ADRs.

---

## Principle I: Local-First

> All analysis MUST run on the user's machine. No data leaves without explicit user consent.

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| INJECTION_RISK | Prompt injection can exfiltrate data | +5 (security critical) |

**Detection Focus:**
- Unsanitized user input in prompts
- API keys or secrets in logs
- Prompts containing sensitive project data

---

## Principle III: Causal-First

> The system MUST trace issues to their origin and recommend changes that enable prevention.

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| OPAQUE_ERROR | Can't trace error to origin | +2 |
| NO_TRACING | Can't trace request flow | +2 |

**Detection Focus:**
- Errors without context
- Findings without evidence
- Recommendations without traced rationale

---

## Principle IV: Mixed-Methods

> The agent reasons about which methods to apply based on task context.

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| JUDGMENT_IN_TOOL | Tool decides method applicability | +2 |
| ORCHESTRATION_IN_TOOL | Tool dictates workflow | +3 |

**Detection Focus:**
- Tools returning "when to use" guidance
- Hardcoded method selection logic
- Pipelines that bypass agent reasoning

---

## Principle VII: Intelligent Tooling

> Tools exist to serve the agent's cognitive needs. Tools provide data; agent provides judgment.

**This is the primary principle for tool/agent boundary violations.**

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| JUDGMENT_IN_TOOL | Tool returns quality labels | +2 (direct violation) |
| ORCHESTRATION_IN_TOOL | Tool decides next steps | +3 (critical violation) |
| THRESHOLD_ENCODING | Tool encodes decision thresholds | +1 |
| DECISION_RETURN | Tool returns "should" or "suggested" | +2 |

**Detection Focus:**
- Return values containing: 'good', 'bad', 'high', 'low', 'should', 'suggested'
- Functions named: `isGood`, `shouldDo`, `getSuggested`, `determineAction`
- Threshold comparisons that return boolean decisions

**Correct Pattern:**
```typescript
// Tool returns data
function getMetrics(): Metrics { return { score: 0.73, factors: [...] }; }

// Agent reasons
"The score of 0.73 is close to the threshold. Given the strong keyword match
factor (0.9), I recommend proceeding despite the slightly low overall score."
```

---

## Principle VIII: Compounding Value

> Value MUST compound over time through baselines, trend analysis, and cross-project learnings.

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| NO_CHECKPOINT | Progress lost on restart | +1 |
| UNBOUNDED_HISTORY | History not summarized for learning | +1 |

**Detection Focus:**
- Long operations without persistence
- Session data without summarization
- Learnings not extracted from sessions

---

## Principle IX: Agent-Aware

> Design MUST serve the agent's cognitive needs.

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| UNBOUNDED_DATA | Overwhelms context window | +2 |
| RAW_DUMP | Unstructured data flood | +1 |
| NO_SUMMARIZATION | Verbose output | +1 |
| CONTEXT_BLOAT | Unnecessary tokens | +1 |
| UNCLEAR_BOUNDARY | Confusing agent architecture | +2 |

**Detection Focus:**
- Tool returns without size limits
- Arrays passed without truncation
- Verbose error messages
- Unclear subagent responsibilities

---

## Constitution Subagent Constraint (C8)

> Subagent depth limited to 1.

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| DEPTH_VIOLATION | Subagent spawns subagent | +4 (architecture violation) |
| RECURSIVE_SPAWN | Agent can spawn itself | +5 (critical) |

**Detection Focus:**
- Nested `Task()` or `agents()` calls
- Subagent definitions that invoke other subagents
- Recursive agent patterns

**Reference:** Constitution §VII, §IX; Arc42 §4.2

---

## ADR-0011: Testing Strategy

> Unit=mocked, Integration=VCR, E2E/Evals=live

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| LIVE_LLM_IN_UNIT | Unit test makes real API calls | +3 |
| MISSING_VCR | Integration test without recording | +2 |
| MISSING_EVAL | Behavioral scenario without eval | +3 |
| FLAKY_ASSERTION | Asserting on non-deterministic output | +2 |

**Detection Focus:**
- `describe()`/`it()` blocks with real LLM calls
- Integration tests missing `vcr.load()`
- Complex agent behavior without `tests/evals/` coverage

**Reference:** [ADR-0011](../../../docs/architecture/adr/0011-testing-strategy-for-agentic-components.md)

---

## ADR-0019: Tool/Agent Boundary

> Tools provide data extraction; agent provides quality judgment.

This ADR is the implementation guidance for Principle VII.

| Pattern | Violation | Severity Modifier |
|---------|-----------|-------------------|
| All JUDGMENT_IN_TOOL variants | Direct violation | per VII |

**Functions explicitly flagged in ADR-0019:**
- `isImprovement()` - judgment
- `classifyTrend()` - judgment
- `getSuggestedStatus()` - judgment
- `determineOverallTrend()` - judgment
- `getSentimentLabel()` - judgment
- `analyzeSentimentIndicators()` - semantic analysis in tool

**Reference:** [ADR-0019](../../../docs/architecture/adr/0019-tool-agent-boundary-temporal.md)

---

## Summary Matrix

| Principle/ADR | Primary Patterns | Severity Range |
|---------------|------------------|----------------|
| I. Local-First | INJECTION_RISK | +5 |
| III. Causal-First | OPAQUE_ERROR, NO_TRACING | +2 |
| IV. Mixed-Methods | JUDGMENT_IN_TOOL, ORCHESTRATION_IN_TOOL | +2 to +3 |
| VII. Intelligent Tooling | All boundary violations | +1 to +3 |
| VIII. Compounding Value | NO_CHECKPOINT, UNBOUNDED_HISTORY | +1 |
| IX. Agent-Aware | Context/state issues | +1 to +2 |
| C8 Subagent | DEPTH_VIOLATION, RECURSIVE_SPAWN | +4 to +5 |
| ADR-0011 | Testing anti-patterns | +2 to +3 |
| ADR-0019 | Boundary violations (specific) | per VII |

---

## Using This Mapping

When reviewing findings:

1. **Identify the pattern** (e.g., JUDGMENT_IN_TOOL)
2. **Find the principle** (e.g., VII. Intelligent Tooling)
3. **Apply severity modifier** (e.g., +2)
4. **Calculate final severity**: base deduction + modifier

Example:
```
Pattern: JUDGMENT_IN_TOOL
Base deduction: -8
Principle: VII (modifier: +2)
Final severity: -10
```

This mapping ensures findings are grounded in documented principles, not arbitrary judgments.
