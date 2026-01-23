---
name: dev-testing
description: Guides test type selection for agentic code. Use when writing tests for LLM interactions, tool implementations, or behavioral quality. Covers unit tests, VCR integration tests, and TruLens evals per ADR-0011/0012.
---

# dev.testing

> Choose the right test type for agentic code. Unit tests for deterministic logic, VCR for LLM calls, evals for behavioral quality.

## When to Use

Use this skill when:
- Writing tests for code that interacts with LLMs
- Unsure whether to use unit tests or evals
- Implementing EP08+ features with non-deterministic behavior
- A task mentions "test" and involves agent behavior

## Invocation

```
/dev.testing [context]
```

---

## CRITICAL: Test Execution Rules

**NEVER run `bun test` directly.** Use npm scripts:

| Command | Safe? | What it does |
|---------|-------|--------------|
| `bun run test` | ✓ Yes | Unit + integration (no API calls) |
| `bun run test:live` | Costs $ | E2E tests (requires API key) |
| `bun run test:evals` | Costs $ | Evaluations (requires API key) |
| `bun test` | ✗ BLOCKED | Triggers preload safety check |

A global preload in `bunfig.toml` blocks e2e/evals unless `RUN_LIVE_TESTS=1` is set.

---

## Decision Framework

**Ask: What am I testing?**

| What You're Testing | Test Type | Location |
|---------------------|-----------|----------|
| Pure functions, parsers, utils | Unit test | `tests/unit/` |
| Zod schemas, tool definitions | Contract test | `tests/unit/` |
| LLM API call responses | VCR integration | `tests/integration/` |
| "Did agent do the right thing?" | TruLens eval | `tests/evals/` |
| Component is wired to system | Wiring test | `tests/integration/wiring/` |

### Quick Decision Tree

```
Is the output deterministic (same input → same output)?
├─ YES → Unit test
└─ NO → Does it call an LLM API?
         ├─ YES → VCR integration test (recorded responses)
         └─ NO → Is it about reasoning/decision quality?
                  ├─ YES → TruLens eval
                  └─ NO → Unit test with mocks

Is this about component integration (reachable from entry point)?
├─ YES → Wiring test (tests/integration/wiring/)
└─ NO → Use above decision tree
```

---

## Red Flags: Use Evals NOT Unit Tests

**Stop and use evals if you're testing:**

- What an LLM **responds** (non-deterministic)
- If an agent **chose the right tool** (behavioral)
- **Recommendation quality** (subjective judgment)
- **Reasoning accuracy** (semantic evaluation)
- **Subagent selection** decisions

**Example anti-pattern:**
```typescript
// BAD: Testing LLM content with assertions
expect(response.recommendations[0].action).toBe("Add error handling");
```

**Why?** LLM responses vary. Use TruLens to evaluate if recommendations are *actionable*, not if they match exact strings.

---

## Test Types

### 1. Unit Tests (`tests/unit/`)

**Use for:** Deterministic, pure functions

```typescript
// tests/unit/parsers/claude-md.test.ts
describe('parseClaudeMd', () => {
  it('extracts build commands', () => {
    const result = parseClaudeMd('## Build\n```bash\nbun build\n```');
    expect(result.buildCommands).toEqual(['bun build']);
  });
});
```

**Run:** `bun test tests/unit/`

### 2. VCR Integration Tests (`tests/integration/`)

**Use for:** Code that calls LLM APIs

Records real API responses for deterministic replay. See [vcr-patterns.md](references/vcr-patterns.md).

```typescript
// tests/integration/agent/analysis.test.ts
describe('Agent Analysis Flow', () => {
  beforeAll(async () => {
    await vcr.load('tests/integration/recordings/analysis.json');
  });

  it('completes analysis phases', async () => {
    const result = await orchestrator.run(task);
    expect(result.phases).toContain('config-analysis');
  });
});
```

**Run:** `bun test tests/integration/`
**Record:** `bun run record` (when prompts change)

### 3. TruLens Evals (`tests/evals/`)

**Use for:** Behavioral quality assessment

Runs on **release tags only** (expensive). See [eval-patterns.md](references/eval-patterns.md).

```typescript
// tests/evals/behavioral/actionability.eval.ts
import { runAnalysis, evaluateActionability } from '../lib/eval-helpers';
import { goldenScenario } from '../fixtures/golden-scenarios';

test('recommendation actionability meets threshold', async () => {
  const result = await runAnalysis(goldenScenario);
  const score = await evaluateActionability(result.recommendations);
  expect(score).toBeGreaterThanOrEqual(0.7);
});
```

**Run:** `bun run tests/evals/run-evals.ts` (release only)

### 4. Wiring Tests (`tests/integration/wiring/`)

**Use for:** Verifying components are actually integrated into the system

These tests verify the "last mile" - that built components are reachable from user entry points.
A component that passes unit tests but is never wired to the system is dead code.

```typescript
// tests/integration/wiring/cli-components.test.ts
import { glob } from 'glob';
import { getExports, hasImportPath } from './wiring-utils';

describe('CLI Component Wiring', () => {
  it('all exported components have import paths to entry points', () => {
    const componentFiles = glob.sync('src/cli/components/*.tsx');
    for (const file of componentFiles) {
      const exports = getExports(file);
      for (const exp of exports) {
        expect(hasImportPath(exp, 'src/cli.ts')).toBe(true);
      }
    }
  });
});
```

**When to write wiring tests:**
- After building ANY user-facing component
- After creating tools that should be registered
- As part of Phase 6 (Integration) in every epic

**Run:** `bun test tests/integration/wiring/`

---

## Test Suite Structure

Per ADR-0011:

| Suite | Runs On | LLM Interaction | Purpose |
|-------|---------|-----------------|---------|
| Unit | Every commit | Mocked | Component logic |
| Integration | Pull requests | VCR recorded | Tool chains, sessions |
| Wiring | Pull requests | None | Entry point reachability |
| E2E | Release tags | Live | Full workflows |
| Evals | Release tags | Live + TruLens | Behavioral quality |

---

## EP08 Specific Guidance

For ACT Subagents (EP08):

| Component | Test Type |
|-----------|-----------|
| `ACTInstructionsSchema` validation | Unit test |
| `ACTSubagentRegistry.register()` | Unit test |
| `toAgentsOption()` output format | Contract test |
| Subagent tool invocation | VCR integration |
| Subagent registered in registry | Wiring test |
| "Does Claude pick the right subagent?" | TruLens eval |
| "Are subagent recommendations actionable?" | TruLens eval |

---

## References

- **VCR patterns**: [vcr-patterns.md](references/vcr-patterns.md)
- **Eval patterns**: [eval-patterns.md](references/eval-patterns.md)
- **ADR-0011**: `docs/architecture/adr/0011-testing-strategy-for-agentic-components.md`
- **ADR-0012**: `docs/architecture/adr/0012-evaluation-framework-for-analysis-quality.md`

---

## Constitution Alignment

- **III. Causal-First**: Evals trace recommendations to evidence
- **IV. Mixed-Methods**: Unit (quantitative) + evals (qualitative)
- **VIII. Compounding Value**: Eval baselines enable regression detection
- **IX. Agent-Aware**: Test types match agent cognitive patterns
