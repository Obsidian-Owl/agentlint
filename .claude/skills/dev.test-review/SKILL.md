---
name: dev-test-review
description: Review test quality before PR - semantic analysis of test design for agentic code. Checks test type appropriateness (unit vs VCR vs evals), ADR-0011/0012 compliance, and Constitution alignment. Run as Level 2 review after epic implementation.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Usage Modes

| Mode | Command | Scope | When to Use |
|------|---------|-------|-------------|
| **Changed Files** | `/dev.test-review` | Tests changed vs main | Before PR (default) |
| **Full Audit** | `/dev.test-review --all` | ALL test files | Quality gate, epic completion |
| **Specific Files** | `/dev.test-review path/to/test.ts` | Named files | Targeted review |

**Important**: Use `--all` at epic completion to catch all issues, not just changes.

## Goal

Perform a comprehensive test quality review that answers: **Are these tests actually good tests for agentic code?**

This is NOT linting. This is semantic analysis of test design:
- Do tests actually test what they claim?
- Is this the **right type of test** (unit vs VCR vs eval)?
- Could tests pass while the agent misbehaves?
- Are tests maintainable?

Plus agentlint-specific checks:
- **Test Type Appropriateness** (per ADR-0011)
- **VCR Recording Coverage** (per ADR-0011)
- **Eval Scenario Coverage** (per ADR-0012)
- **Constitution Compliance**

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output analysis and recommendations.

**SEMANTIC ANALYSIS**: Read and understand tests, don't just grep for patterns.

**TIERED OUTPUT**: Full analysis for problems, brief summary for clean tests.

## Constitution Alignment

This skill validates test adherence to project principles:
- **III. Causal-First**: Tests should trace to requirements
- **IV. Mixed-Methods**: Quantitative (unit) + qualitative (evals)
- **VIII. Compounding Value**: Eval baselines enable regression detection
- **IX. Agent-Aware**: Test types match agent cognitive patterns

## Execution Steps

### Phase 0: Identify Test Files

**You handle this phase directly.**

**Parse user input to determine mode:**

1. **If `--all` flag present**: Full codebase audit
   ```bash
   find src -name "*.test.ts" -type f 2>/dev/null
   find tests -name "*.test.ts" -type f 2>/dev/null
   ls tests/evals/**/*.py 2>/dev/null
   ```

2. **If specific file path provided**: Review that file
   ```bash
   ls -la <provided-path>
   ```

3. **Default (no args)**: Changed files only
   ```bash
   git rev-parse --abbrev-ref HEAD
   git diff --name-only main...HEAD | grep -E '\.(test\.ts|\.py)$'
   ```

**Report mode to user:**
- `--all` mode: "Running FULL CODEBASE audit on N test files"
- Specific file: "Reviewing specified file: <path>"
- Default: "Reviewing N test files changed vs main"

If no test files to review in default mode, suggest using `--all` for full audit.

**Output**: List of test files to analyze, classified by type:
- Unit: `src/**/__tests__/*.test.ts` or `tests/unit/**/*.test.ts`
- Integration (VCR): `tests/integration/**/*.test.ts`
- E2E: `tests/e2e/**/*.test.ts`
- Evals: `tests/evals/**/*.py`

### Phase 1: Semantic Test Analysis

**Invoke `test-reviewer` agent for each test file (or batch by type).**

```
Task(test-reviewer, "Review the following test file for quality, correctness, and maintainability.

File: [path]

Apply your full analysis framework:
1. For each test, evaluate Purpose, Correctness, Isolation, Maintainability
2. Apply type-specific checks based on test classification
3. Full analysis for tests with issues, brief summary for clean tests

Return your structured analysis.")
```

**Wait for test-reviewer to return.**

### Phase 2: Agentic Testing Analysis (Parallel)

**Invoke agentlint-specific agents IN PARALLEL (single message, multiple Task calls):**

```
Task(test-type-reviewer, "Analyze test type appropriateness per ADR-0011.

For each test file, determine:
1. What is being tested? (deterministic logic, LLM API call, behavioral quality)
2. What test type is used? (unit, VCR integration, TruLens eval)
3. Is this the RIGHT type per ADR-0011 decision framework?

Flag these RED FLAGS:
- Unit tests asserting on LLM response content
- Unit tests checking agent decision quality
- Missing VCR recordings for LLM API calls
- Missing evals for behavioral quality scenarios

Changed files: [list]
Return your Test Type Appropriateness Report.")

Task(vcr-coverage-reviewer, "Analyze VCR recording coverage per ADR-0011.

For integration tests, check:
1. Does each test that calls LLM APIs have a corresponding recording?
2. Are recordings in tests/integration/recordings/?
3. Do recordings look fresh (not stale prompts)?
4. Is strict mode enforced in CI?

Changed files: [list]
Return your VCR Coverage Report.")

Task(eval-coverage-reviewer, "Analyze eval scenario coverage per ADR-0012.

For code that involves agent behavior, check:
1. Are there corresponding eval scenarios in tests/evals/?
2. Do evals test actionability, causal accuracy, relevance?
3. Are golden dataset scenarios defined?
4. Are thresholds reasonable (≥0.7)?

Focus on:
- Subagent selection decisions
- Recommendation quality
- Reasoning accuracy

Changed files: [list]
Return your Eval Coverage Report.")
```

**Wait for all agents to return.**

### Phase 3: Strategic Synthesis

**You handle this phase directly.**

Synthesize all reports into a unified strategic assessment.

## Output Format

```markdown
## Test Quality Review

**Branch**: [branch]
**Files Reviewed**: [N]
**Tests Analyzed**: [N]

---

### Executive Summary

| Aspect | Status | Key Finding |
|--------|--------|-------------|
| Test Design Quality | ✅/⚠️/❌ | [summary from test-reviewer] |
| Test Type Appropriateness | ✅/⚠️/❌ | [summary from test-type-reviewer] |
| VCR Coverage | ✅/⚠️/❌ | [summary from vcr-coverage-reviewer] |
| Eval Coverage | ✅/⚠️/❌ | [summary from eval-coverage-reviewer] |

**Overall**: [One sentence assessment]

---

### Test Design Analysis

[Include test-reviewer findings]

#### Tests Needing Attention

[Full analysis for each problematic test]

#### Clean Tests

[Summary table of tests that passed review]

---

### Agentic Testing Findings

#### Test Type Appropriateness (ADR-0011)

[Key findings from test-type-reviewer]

**Red Flags Found:**
- [ ] Unit tests on LLM content
- [ ] Missing VCR for API calls
- [ ] Missing evals for behavior

#### VCR Recording Coverage

[Key findings from vcr-coverage-reviewer]

| Test File | Recording | Status |
|-----------|-----------|--------|
| ... | ... | ✅/❌ |

#### Eval Scenario Coverage

[Key findings from eval-coverage-reviewer]

| Behavioral Scenario | Eval Exists | Threshold |
|---------------------|-------------|-----------|
| ... | ... | ... |

---

### Priority Actions

| Priority | Issue | Impact | ADR Reference |
|----------|-------|--------|---------------|
| P0 | [Must fix] | High | ADR-0011/0012 |
| P1 | [Should fix] | Medium | ... |
| P2 | [Consider] | Low | ... |

---

### Recommendations

1. **Immediate** (this PR):
   - [Specific action with file:line]

2. **Follow-up** (next PR):
   - [Action item]

---

### Next Steps

- [ ] Address P0 issues
- [ ] Re-run `/dev.test-review` to verify
- [ ] Proceed to PR when clean
```

## What This Review Checks

### From test-reviewer (Semantic Analysis)
- **Purpose**: Is it clear what's being tested?
- **Correctness**: Could test pass while code is broken?
- **Isolation**: Deterministic? Independent?
- **Maintainability**: Brittle to implementation changes?

### From agentlint-specific agents
- **Test Type Appropriateness**: Right type per ADR-0011?
- **VCR Coverage**: LLM calls have recordings?
- **Eval Coverage**: Behavioral scenarios have evals?

## What This Review Does NOT Check

- **Linting/style**: ESLint handles this
- **Type safety**: TypeScript handles this
- **Coverage %**: Vitest coverage handles this
- **Format**: Prettier handles this

## Red Flags (Auto-Fail)

These issues MUST be fixed before PR:

| Red Flag | Why It's Bad | Fix |
|----------|--------------|-----|
| Unit test asserts on LLM content | Non-deterministic, will flake | Use VCR or eval |
| Unit test checks agent decisions | Behavioral, not deterministic | Use eval |
| Integration test without VCR | Expensive, slow, flaky in CI | Add recording |
| Subagent behavior without eval | Can't catch quality regression | Add eval scenario |

## Test Type Quick Reference

| Testing This | Use This | Location |
|--------------|----------|----------|
| Zod schema, parser, util | Unit test | `src/**/__tests__/` |
| Tool schema validation | Unit test | `src/**/__tests__/` |
| LLM API response handling | VCR integration | `tests/integration/` |
| Agent tool selection | TruLens eval | `tests/evals/` |
| Recommendation quality | TruLens eval | `tests/evals/` |
| Subagent invocation | VCR integration | `tests/integration/` |
| "Did agent do the right thing?" | TruLens eval | `tests/evals/` |

## When to Use

| Situation | Recommended Mode |
|-----------|------------------|
| Before creating a PR | `/dev.test-review` (changed files) |
| After writing new tests | `/dev.test-review` (changed files) |
| **After completing an epic** | `/dev.test-review --all` |
| When investigating test failures | `/dev.test-review path/to/test.ts` |
| **Level 2 quality gate** | `/dev.test-review --all` |

**Key Insight**: Default mode only reviews changed files. Use `--all` at epic completion to ensure comprehensive coverage.

## Handoff

After completing this skill:
- **Fix issues**: Address P0/P1 issues identified
- **Check integration**: Run `/dev.integration-check` before PR
- **Create PR**: Run `/dev.pr` when tests pass

## References

- **ADR-0011**: Testing Strategy for Agentic Components
- **ADR-0012**: Evaluation Framework for Analysis Quality
- **dev.testing**: Test type selection guidance
- **Constitution**: Project principles (especially III, IV, VIII, IX)
