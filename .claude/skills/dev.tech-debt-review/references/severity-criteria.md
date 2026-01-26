# Severity Criteria

This reference defines the scoring system for tech debt review.

---

## Scoring Formula

```
score = max(0, 100 - sum(deductions))
```

Each finding deducts points from a starting score of 100.

---

## Deduction Table by Category

### Tool/Agent Boundary

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| JUDGMENT_IN_TOOL | -8 | VII | Tool returns quality labels ('good', 'bad', 'low') |
| ORCHESTRATION_IN_TOOL | -10 | VII | Tool decides workflow or next steps |
| THRESHOLD_ENCODING | -6 | VII | Hardcoded thresholds that encode decisions |
| DECISION_RETURN | -7 | VII | Returns 'should', 'suggested', 'recommended' |

### Prompt Debt

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| HARDCODED_PROMPT | -3 | - | Prompt embedded directly in code |
| NO_VERSIONING | -3 | - | Prompts without version tracking |
| INJECTION_RISK | -15 | I | Unsanitized user input in prompts |
| PROMPT_SPRAWL | -4 | - | Same prompt duplicated across files |

### Context Window

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| UNBOUNDED_DATA | -7 | IX | Data passed without size limits |
| NO_SUMMARIZATION | -5 | IX | Large data without truncation |
| RAW_DUMP | -5 | IX | Unstructured data dump |
| CONTEXT_BLOAT | -4 | IX | Unnecessarily verbose output |

### Testing

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| LIVE_LLM_IN_UNIT | -10 | ADR-0011 | Unit test makes real API calls |
| MISSING_VCR | -6 | ADR-0011 | Integration test without recording |
| MISSING_EVAL | -8 | ADR-0011 | Behavioral scenario without eval |
| FLAKY_ASSERTION | -6 | ADR-0011 | Assert on non-deterministic output |
| NO_MOCK | -5 | ADR-0011 | Test calls real external services |

### Error Handling

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| NO_RETRY_LOGIC | -6 | - | LLM API calls without retry |
| MISSING_TIMEOUT | -5 | - | API calls without timeout |
| SILENT_FAILURE | -8 | - | Errors caught but not handled |
| UNHANDLED_REJECTION | -7 | - | Async without error handling |
| GENERIC_CATCH | -4 | - | catch(e) without specific handling |

### State Management

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| UNBOUNDED_HISTORY | -10 | VIII | Conversation history without max |
| MEMORY_LEAK | -8 | - | Growing state without cleanup |
| NO_CHECKPOINT | -5 | VIII | Long ops without checkpointing |
| STALE_STATE | -4 | - | Cache without invalidation |

### Observability

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| NO_TRACING | -5 | III | LLM calls without trace context |
| MISSING_METRICS | -4 | - | No token/latency tracking |
| NO_DEBUG_LOG | -3 | - | Complex ops without debug logs |
| OPAQUE_ERROR | -5 | III | Errors without debugging context |

### Subagent Architecture

| Pattern | Base Deduction | Constitution | Description |
|---------|----------------|--------------|-------------|
| DEPTH_VIOLATION | -12 | C8 | Subagent spawns sub-subagent |
| UNCLEAR_BOUNDARY | -6 | IX | Multiple unrelated responsibilities |
| MISSING_ISOLATION | -7 | - | Shared mutable state |
| RECURSIVE_SPAWN | -15 | C8 | Agent can spawn itself |

---

## Score Interpretation

| Score | Grade | Color | Action Required |
|-------|-------|-------|-----------------|
| 90-100 | A | Green | Ship it - minor issues only |
| 80-89 | B | Blue | Minor cleanup recommended before merge |
| 70-79 | C | Yellow | Plan remediation sprint; merge with caution |
| 60-69 | D | Orange | Urgent fixes needed; consider blocking |
| < 60 | F | Red | Block release; critical issues present |

---

## Automatic Grade Modifiers

### Auto-Fail Conditions (Force Grade F)

These patterns automatically set the grade to F regardless of score:

| Pattern | Reason |
|---------|--------|
| INJECTION_RISK | Security vulnerability |
| DEPTH_VIOLATION | Architecture violation |
| RECURSIVE_SPAWN | Unbounded recursion risk |
| 3+ ORCHESTRATION_IN_TOOL | Fundamental design issue |

### Grade Cap Conditions

| Condition | Maximum Grade |
|-----------|---------------|
| Any P0 finding | B |
| 5+ P1 findings | B |
| 10+ P2 findings | B |

---

## Priority Classification

### P0 - Block Release

Findings that MUST be fixed before merge:

| Criteria | Examples |
|----------|----------|
| Security issue | INJECTION_RISK |
| Architecture violation | DEPTH_VIOLATION, RECURSIVE_SPAWN |
| Constitution critical | Multiple ORCHESTRATION_IN_TOOL |

### P1 - This Sprint

Findings that SHOULD be fixed before merge:

| Criteria | Examples |
|----------|----------|
| Constitution violation | JUDGMENT_IN_TOOL |
| Testing anti-pattern | LIVE_LLM_IN_UNIT, MISSING_EVAL |
| Reliability issue | NO_RETRY_LOGIC, UNBOUNDED_HISTORY |

### P2 - Backlog

Findings to track for future cleanup:

| Criteria | Examples |
|----------|----------|
| Quality improvement | HARDCODED_PROMPT, NO_DEBUG_LOG |
| Observability gap | MISSING_METRICS |
| Minor maintenance | PROMPT_SPRAWL |

---

## Severity Modifier by Constitution Principle

When a pattern violates a Constitution principle, apply the modifier:

| Principle | Modifier | Rationale |
|-----------|----------|-----------|
| I. Local-First | +5 | Security critical |
| III. Causal-First | +2 | Debugging impact |
| VII. Intelligent Tooling | +2 | Core architecture |
| VIII. Compounding Value | +1 | Long-term impact |
| IX. Agent-Aware | +1 | Agent effectiveness |
| C8 Subagent | +4 | Architecture constraint |
| ADR-0011 | +2 | Testing strategy |

Example calculation:
```
JUDGMENT_IN_TOOL
  Base: -8
  + Principle VII modifier: -2
  = Total: -10
```

---

## Trend Scoring

Historical trend affects interpretation but not score:

| Trend | Interpretation |
|-------|----------------|
| Improving (+5 or more) | Positive momentum; consider relaxing gate |
| Stable (-4 to +4) | Neutral; apply standard gates |
| Degrading (-5 or worse) | Concerning; consider stricter gates |

---

## Example Calculation

Given findings:
- 1x JUDGMENT_IN_TOOL (-8)
- 2x MISSING_VCR (-6 each = -12)
- 1x HARDCODED_PROMPT (-3)
- 1x NO_DEBUG_LOG (-3)

Calculation:
```
Score = 100 - 8 - 12 - 3 - 3 = 74
Grade = C (70-79 range)
```

Priority assignment:
- P1: JUDGMENT_IN_TOOL (Constitution VII)
- P1: MISSING_VCR x2 (ADR-0011)
- P2: HARDCODED_PROMPT (quality)
- P2: NO_DEBUG_LOG (observability)

Recommendation: Plan remediation sprint. Safe to merge if time-boxed.

---

## Calibration Notes

These deduction values are calibrated based on:

1. **Impact on reliability**: Higher deductions for patterns that cause failures
2. **Constitution alignment**: Higher deductions for principle violations
3. **Fix complexity**: Lower deductions for easy-to-fix patterns
4. **Prevalence**: Balanced to produce meaningful score distribution

Expect typical codebase scores in the 60-85 range. Scores below 50 indicate significant technical debt requiring immediate attention.
