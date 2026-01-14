---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0011: Testing Strategy for Agentic Components

## Context and Problem Statement

agentlint contains agentic components that interact with LLMs non-deterministically. Traditional unit testing approaches don't adequately address:

1. **Non-deterministic LLM responses**: Same prompt can yield different outputs
2. **Tool interaction chains**: Agent behavior emerges from sequences of tool calls
3. **Behavioral correctness**: Testing that the agent "does the right thing" vs. produces exact output
4. **Cost and speed**: Live LLM calls are expensive and slow for CI

The testing strategy must provide confidence in agent behavior while maintaining practical CI workflows.

## Decision Drivers

- **Agent behavior confidence**: Primary goal is confidence that the agent behaves correctly
- **Separate test suites**: Fast tests for CI, expensive tests for release gates
- **Long session support**: Sessions can run 30+ minutes; tests must handle this
- **Deterministic CI**: Fast tests must be reproducible without live LLM calls
- **Behavioral evaluation**: Assess reasoning quality, not just output format

## Considered Options

1. VCR-style recorded responses + TruLens evals
2. Handcrafted mocks + custom eval harness
3. Property-based testing + LLM-as-judge
4. Contract testing only

## Decision Outcome

**Chosen option: "VCR-style recorded responses + TruLens evals"** with **separate test suites**. Unit tests run on every commit with mocks. Integration tests use recorded API responses and run on pull requests. End-to-end tests and behavioral evaluations use TruLens with live LLM calls, running only on release tags.

### Test Suite Structure

| Suite | Runs On | LLM Interaction | Purpose |
|-------|---------|-----------------|---------|
| Unit | Every commit | Mocked | Component logic, tool implementations |
| Integration | Pull requests | Recorded (VCR) | Tool chains, session management |
| E2E | Release tags | Live | Full analysis workflows |
| Evals | Release tags | Live + TruLens | Behavioral quality assessment |

### Consequences

**Good:**
- Fast, deterministic CI on every commit
- Behavioral confidence via TruLens evals on releases
- VCR recordings capture real API behavior for high-fidelity integration tests
- TruLens provides explainable evaluation metrics with tracing
- Clear separation prevents expensive tests from blocking development

**Bad:**
- VCR recordings need maintenance when prompts change significantly
- TruLens adds Python dependency (runs as separate process)
- Eval tests are slower and more expensive (but only run on releases)

**Neutral:**
- Two testing paradigms (Bun + TruLens) require learning both
- Recording infrastructure adds some complexity

## Pros and Cons of Options

### Option 1: VCR-style recorded responses + TruLens evals

Record real LLM API responses for deterministic replay in CI. Use TruLens for behavioral evaluation on releases.

- Good: High fidelity—recordings capture real API behavior
- Good: Deterministic CI—same input yields same output
- Good: TruLens provides explainable metrics and tracing
- Good: Clear cost boundary—expensive tests only on releases
- Good: TruLens is open-source and self-hostable (Local-First compatible)
- Neutral: Recordings need refresh when prompts change significantly
- Bad: TruLens is Python-based; requires polyglot tooling
- Bad: Recording infrastructure adds maintenance burden

### Option 2: Handcrafted mocks + custom eval harness

Manually craft expected LLM responses. Build custom evaluation framework in TypeScript.

- Good: Full control over test data
- Good: Single language (TypeScript) for all testing
- Good: Tests document expected behavior explicitly
- Neutral: More upfront work to build eval harness
- Bad: Mocks may drift from real API behavior
- Bad: Custom eval framework lacks TruLens maturity
- Bad: Harder to test edge cases without real responses

### Option 3: Property-based testing + LLM-as-judge

Use property-based testing for invariants. Use LLM to judge output quality.

- Good: Explores edge cases automatically
- Good: LLM-as-judge scales evaluation
- Good: Tests properties rather than exact outputs
- Neutral: Property definitions require careful design
- Bad: Meta-circularity: using LLM to test LLM behavior
- Bad: LLM-as-judge adds cost to every test run
- Bad: Judge consistency varies across runs

### Option 4: Contract testing only

Test API contracts and response schemas without behavioral assessment.

- Good: Simple implementation
- Good: Fast execution
- Good: Catches format regressions
- Neutral: Standard testing approach
- Bad: Doesn't test reasoning quality
- Bad: Agent could produce wrong but valid responses
- Bad: Misses behavioral regressions

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | TruLens self-hostable; all tests run locally |
| II. Improvement-Oriented | Yes | Evals track quality metrics over time |
| III. Causal-First | Yes | TruLens tracing enables causal analysis of agent behavior |
| IV. Mixed-Methods | Yes | Combines quantitative metrics with qualitative eval |
| V. Language-Agnostic | Yes | Testing infrastructure independent of analyzed projects |
| VI. Agent-Agnostic | Yes | Tests agent behavior patterns, not specific LLM |
| VII. Intelligent Tooling | Yes | Tests validate tool behavior for agent comprehension |
| VIII. Compounding Value | Yes | Eval baselines enable regression detection |
| IX. Agent-Aware | Yes | VCR recordings optimized for agent interaction patterns |

## More Information

### Related Documents

- Design Decisions: [DD-012](../design-decisions.md#dd-012-testing-strategy-for-agentic-components)
- Prior Decisions: [ADR-0001 - Runtime Platform](./0001-runtime-platform-and-language.md), [ADR-0002 - Agentic Framework](./0002-agentic-framework-strategy.md)

### Research Sources

- [TruLens Documentation](https://www.trulens.org/)
- [ZenML - DeepEval Alternatives](https://www.zenml.io/blog/deepeval-alternatives)
- [Comet - LLM Evaluation Frameworks](https://www.comet.com/site/blog/llm-evaluation-frameworks/)
- [bun-bagel - Fetch Mocking for Bun](https://github.com/DRFR0ST/bun-bagel)
- [Bun Test Runner](https://bun.sh/docs/cli/test)

### Implementation Notes

#### 1. Test Directory Structure

```
tests/
├── unit/                    # Fast, mocked tests (every commit)
│   ├── tools/
│   ├── parsers/
│   └── utils/
├── integration/             # VCR-recorded tests (every commit)
│   ├── recordings/          # Recorded API responses
│   │   ├── analyse-flow.json
│   │   └── baseline-comparison.json
│   ├── agent/
│   └── sessions/
├── e2e/                     # Live tests (release tags only)
│   └── workflows/
└── evals/                   # TruLens evaluations (release tags only)
    ├── behavioral/
    ├── fixtures/
    └── trulens.config.py
```

#### 2. VCR Recording Infrastructure

```typescript
// tests/lib/vcr.ts
import { mock, clearMocks } from 'bun-bagel';

interface Recording {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

class VCR {
  private recordings: Map<string, Recording[]> = new Map();
  private mode: 'record' | 'playback' = 'playback';

  async load(cassettePath: string): Promise<void> {
    const file = Bun.file(cassettePath);
    if (await file.exists()) {
      const data = await file.json();
      this.recordings = new Map(Object.entries(data));
    }
  }

  async save(cassettePath: string): Promise<void> {
    const data = Object.fromEntries(this.recordings);
    await Bun.write(cassettePath, JSON.stringify(data, null, 2));
  }

  setupMocks(): void {
    for (const [url, recordings] of this.recordings) {
      let index = 0;
      mock(url, () => {
        const recording = recordings[index++];
        return {
          status: recording.response.status,
          headers: new Headers(recording.response.headers),
          data: recording.response.body,
        };
      });
    }
  }

  cleanup(): void {
    clearMocks();
  }
}

export const vcr = new VCR();

// Usage in tests
import { describe, it, beforeAll, afterAll } from 'bun:test';
import { vcr } from '../lib/vcr';

describe('Agent Analysis Flow', () => {
  beforeAll(async () => {
    await vcr.load('tests/integration/recordings/analyse-flow.json');
    vcr.setupMocks();
  });

  afterAll(() => {
    vcr.cleanup();
  });

  it('completes analysis with expected phases', async () => {
    // Test runs against recorded responses
  });
});
```

#### 3. VCR Enforcement Strategy

Recording correctness is enforced through two layers: a pre-push warning for developer feedback and strict CI enforcement as the hard gate.

**Layer 1: Pre-push Warning (Soft)**

```bash
#!/bin/bash
# .husky/pre-push

# Check if integration tests changed but recordings didn't
TESTS_CHANGED=$(git diff --cached --name-only -- 'tests/integration/**/*.test.ts' | head -1)
RECORDINGS_CHANGED=$(git diff --cached --name-only -- 'tests/integration/recordings/' | head -1)

if [[ -n "$TESTS_CHANGED" && -z "$RECORDINGS_CHANGED" ]]; then
  echo ""
  echo "⚠️  Warning: Integration tests changed but recordings weren't updated."
  echo "   If you modified prompts or API interactions, run:"
  echo ""
  echo "     bun run record"
  echo ""
  echo "   Then commit the updated recordings."
  echo ""
  # Don't block - just warn
fi
```

**Layer 2: CI Strict Mode (Hard)**

```typescript
// tests/lib/vcr.ts - strict mode for CI

class VCR {
  private strict: boolean = process.env.CI === 'true';

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const recording = this.findRecording(url, options);

    if (!recording) {
      if (this.strict) {
        throw new Error(
          `VCR: No recording found for ${options?.method || 'GET'} ${url}\n` +
          `Run 'bun run record' locally and commit the recordings.`
        );
      }
      // In non-strict mode, make real request and optionally record
      return this.recordAndFetch(url, options);
    }

    return this.playback(recording);
  }
}
```

**Layer 3: Explicit Recording Script**

```json
// package.json
{
  "scripts": {
    "record": "VCR_MODE=record bun test tests/integration",
    "test:integration": "bun test tests/integration"
  }
}
```

**Recording Workflow:**
1. Developer modifies prompts or adds new integration tests
2. Runs `bun run record` (explicit, intentional)
3. Reviews recording diffs for sanity (no secrets, reasonable responses)
4. Commits code + recordings together
5. Pre-push hook warns if recordings seem stale
6. CI fails PR if recordings are missing or don't match

**Why not auto-record in pre-push?**
- Recording costs money (live API calls)
- LLM responses are non-deterministic → noisy diffs on every push
- Recording should be intentional, not automatic
- Developers need to review recordings for secrets/sanity

#### 4. TruLens Evaluation Setup

```python
# tests/evals/trulens.config.py
from trulens.core import Feedback, TruSession
from trulens.providers.openai import OpenAI as TruLensOpenAI

# Initialize TruLens session (local SQLite storage)
session = TruSession(database_path=".agentlint/evals.db")

# Define feedback functions for agentlint evaluation
provider = TruLensOpenAI()

# Evaluation metrics
relevance = Feedback(provider.relevance).on_input_output()
groundedness = Feedback(provider.groundedness).on_input_output()
coherence = Feedback(provider.coherence).on_output()

# Custom agentlint-specific metrics
def recommendation_actionability(recommendation: str) -> float:
    """Evaluate if recommendation is actionable."""
    prompt = f"""
    Rate this recommendation's actionability from 0 to 1:
    - 1.0: Clear, specific action the user can take immediately
    - 0.5: Somewhat actionable but vague or context-dependent
    - 0.0: Not actionable, too abstract or unclear

    Recommendation: {recommendation}

    Score (0-1):
    """
    # Use provider to evaluate
    return provider.generate_score(prompt)

actionability = Feedback(recommendation_actionability).on_output()
```

```typescript
// tests/evals/run-evals.ts
// Orchestrates TruLens evaluation from Bun

import { $ } from 'bun';

async function runEvaluations(): Promise<EvalResults> {
  // Run TruLens evaluations via Python subprocess
  const result = await $`python tests/evals/run.py`.json();

  return {
    relevance: result.relevance,
    groundedness: result.groundedness,
    actionability: result.actionability,
    overallScore: result.overall,
    traces: result.traces,
  };
}

// CI integration
if (process.env.RELEASE_TAG) {
  const results = await runEvaluations();

  // Fail release if quality drops below threshold
  if (results.overallScore < 0.7) {
    console.error('Eval score below threshold:', results.overallScore);
    process.exit(1);
  }
}
```

#### 5. CI Configuration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run unit tests
        run: bun test tests/unit

  integration:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run integration tests (VCR)
        run: bun test tests/integration

  e2e-evals:
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          bun install
          pip install trulens-core trulens-providers-openai

      - name: Run E2E tests
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: bun test tests/e2e

      - name: Run behavioral evaluations
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}  # For TruLens judge
        run: bun run tests/evals/run-evals.ts

      - name: Upload eval results
        uses: actions/upload-artifact@v4
        with:
          name: eval-results
          path: .agentlint/evals.db
```

#### 6. Recording Maintenance

```typescript
// scripts/refresh-recordings.ts
// Run when prompts change significantly

import { vcr } from '../tests/lib/vcr';

const CASSETTES = [
  'tests/integration/recordings/analyse-flow.json',
  'tests/integration/recordings/baseline-comparison.json',
  'tests/integration/recordings/session-search.json',
];

async function refreshRecordings(): Promise<void> {
  for (const cassette of CASSETTES) {
    console.log(`Refreshing: ${cassette}`);

    // Set to record mode
    vcr.setMode('record');

    // Run the corresponding test scenario
    await runScenario(cassette);

    // Save new recording
    await vcr.save(cassette);
  }
}

// CLI: bun run scripts/refresh-recordings.ts
await refreshRecordings();
```

#### 7. Test Utilities

```typescript
// tests/lib/fixtures.ts
export const fixtures = {
  // Sample CLAUDE.md configurations
  claudeMd: {
    minimal: `# Project\nThis is a test project.`,
    complete: `# Project\n\n## Build\n\`\`\`bash\nbun run build\n\`\`\`\n\n## Test\n\`\`\`bash\nbun test\n\`\`\``,
    antiPatterns: `Always use TypeScript.\nNever use any.\nBe helpful.`,
  },

  // Sample session logs
  sessions: {
    successful: { /* ... */ },
    withErrors: { /* ... */ },
    longRunning: { /* ... */ },
  },

  // Expected analysis outputs (for assertions)
  expectedAnalysis: {
    minimal: {
      warningCount: 2,
      coverageScore: 30,
    },
    complete: {
      warningCount: 0,
      coverageScore: 85,
    },
  },
};
```

#### 8. Behavioral Test Examples

```typescript
// tests/evals/behavioral/recommendation-quality.test.ts
import { describe, it, expect } from 'bun:test';
import { runAnalysis } from '../../lib/test-agent';

describe('Recommendation Quality', () => {
  it('produces actionable recommendations for incomplete configs', async () => {
    const result = await runAnalysis({
      claudeMd: fixtures.claudeMd.minimal,
      sessions: [],
    });

    // Behavioral assertions
    expect(result.recommendations.length).toBeGreaterThan(0);

    for (const rec of result.recommendations) {
      // Each recommendation should have clear action
      expect(rec.action).toBeDefined();
      expect(rec.rationale).toBeDefined();

      // TruLens will evaluate actionability quality
      // These are structural checks only
    }
  });

  it('traces recommendations to causal evidence', async () => {
    const result = await runAnalysis({
      claudeMd: fixtures.claudeMd.antiPatterns,
      sessions: fixtures.sessions.withErrors,
    });

    for (const rec of result.recommendations) {
      // Causal-first: every recommendation has evidence
      expect(rec.evidence).toBeDefined();
      expect(rec.evidence.length).toBeGreaterThan(0);

      // Evidence should reference specific locations
      for (const evidence of rec.evidence) {
        expect(evidence.file).toBeDefined();
        expect(evidence.line).toBeDefined();
      }
    }
  });
});
```
