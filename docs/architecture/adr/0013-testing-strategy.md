---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0013: Testing Strategy

## Context and Problem Statement

agentlint combines static analysis with LLM-powered agentic analysis (ADR-0006), requiring a testing strategy that handles both deterministic and non-deterministic components. Traditional testing approaches don't adequately address agent behavior evaluation, tool/function correctness, or hallucination detection. This ADR establishes how agentlint tests its agentic aspects while maintaining fast, reliable CI/CD pipelines.

The key challenges are:
1. LLM outputs are non-deterministic and can vary between runs
2. Real API calls are slow and have cost implications
3. Agent-specific concerns (tool selection, argument correctness, hallucination) require specialized metrics
4. Causal analysis accuracy (ADR-0007) is critical but hard to evaluate programmatically

## Decision Drivers

- **Static-First principle**: Maximize deterministic testing; run deterministic tests before LLM-dependent tests in CI (test ordering, distinct from concurrent analysis execution per ADR-0019)
- **Real API testing preference**: User prefers real LLM calls in CI for accuracy
- **TypeScript-native tooling**: Must integrate with Bun runtime (ADR-0001)
- **Agent-specific metrics**: Need tool correctness, hallucination detection, task completion
- **Cost visibility**: Testing costs should be trackable and manageable
- **Causal analysis validation**: ADR-0007's evidence-first pattern must be testable
- **Subagent pattern testing**: ADR-0011's parallel subagents need orchestration tests

## Considered Options

1. Bun Test + EvalKit (TypeScript-native agent evaluation)
2. Bun Test + Custom Eval Layer (build agentlint-specific metrics)
3. Hybrid Bun + Python DeepEval (subprocess for agent evals)
4. Vitest + LangSmith (cloud-based evaluation platform)

## Decision Outcome

Chosen option: **"Bun Test + EvalKit"** because it provides TypeScript-native agent evaluation metrics (hallucination, faithfulness, tool correctness) while maintaining full compatibility with Bun's test runner. EvalKit's focus on bias detection and coherence aligns with causal analysis quality requirements.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TESTING PYRAMID                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 4: AGENT EVALUATION (Real LLM - Every CI Run)                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  Framework: EvalKit (@evalkit/core)                                        │
│  Metrics:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • ToolCorrectness    - Subagent selects right analysis type        │   │
│  │ • ArgumentCorrectness - FTS5 queries well-formed                   │   │
│  │ • Hallucination      - Causal traces cite real evidence            │   │
│  │ • Faithfulness       - Recommendations grounded in findings        │   │
│  │ • Coherence          - Multi-pass analysis logically consistent    │   │
│  │ • TaskCompletion     - Analysis produces valid output schema       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Budget: ~$5-10 per CI run (tracked via OTel - ADR-0009)                   │
│  Timeout: 180s per eval test (LLM calls are slow)                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 3: INTEGRATION TESTS (Golden Dataset + Mocked LLM)                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  Framework: Bun test + Vercel AI SDK mock providers                        │
│  Coverage:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Golden Dataset: 100+ scenarios across all analysis domains       │   │
│  │ • Recorded Fixtures: LLM responses for regression testing          │   │
│  │ • Snapshot Tests: Output format stability                          │   │
│  │ • Streaming Tests: simulateReadableStream for AI SDK              │   │
│  │ • Subagent Orchestration: Parallel execution, result merging      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Speed: <30s for full suite                                                │
│  Deterministic: Yes (mocked responses)                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 2: COMPONENT TESTS (No LLM)                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  Framework: Bun test                                                       │
│  Coverage:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Static Analysers: Config parsing, session indexing, metrics     │   │
│  │ • FTS5 Indexing: Session log parsing (ADR-0007)                   │   │
│  │ • Recommendation Engine: Priority scoring (ADR-0010)              │   │
│  │ • Change Detection: Git + session hybrid (ADR-0012)               │   │
│  │ • CLI Commands: Argument parsing, output formatting               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Speed: <5s for full suite                                                 │
│  LLM Dependency: None                                                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: UNIT TESTS (Pure Functions)                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  Framework: Bun test                                                       │
│  Coverage Target: 80%+ for core logic                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Data transformations                                             │   │
│  │ • Schema validation (Zod)                                          │   │
│  │ • Utility functions                                                │   │
│  │ • Type-level tests (expectTypeOf)                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Speed: <1s for full suite                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent-Specific Evaluation Metrics

Based on research into LLM agent evaluation ([IBM Research](https://research.ibm.com/publications/evaluating-llm-based-agents-foundations-best-practices-and-open-challenges), [DeepEval](https://deepeval.com/guides/guides-ai-agent-evaluation-metrics)), agentlint requires these metrics:

| Metric | What It Tests | agentlint Application |
|--------|---------------|----------------------|
| **Tool Correctness** | Agent selects right tool for task | Subagent routing (Config vs Session vs Docs analyser) |
| **Argument Correctness** | Tool called with correct parameters | FTS5 query construction, evidence bundle formation |
| **Hallucination** | Output fabricates non-existent facts | Causal traces must cite real session/config evidence |
| **Faithfulness** | Output grounded in provided context | Recommendations reference actual detected issues |
| **Coherence** | Logical flow of multi-step reasoning | Multi-pass verification produces consistent narrative |
| **Task Completion** | Goal achieved successfully | Analysis produces valid JSON schema output |

### Golden Dataset Design

The golden dataset enables deterministic testing of agent behavior:

```typescript
interface GoldenDatasetEntry {
  id: string;
  category: 'config' | 'session' | 'docs' | 'cross-reference' | 'causal';

  // Input
  input: {
    projectFixture: string;       // Reference to test fixture directory
    sessionLogs?: string[];       // Paths to session log fixtures
    configFiles?: string[];       // Paths to config fixtures
    analysisType: AnalysisType;
  };

  // Expected outputs (for deterministic checks)
  expectedOutputs: {
    issueCount: { min: number; max: number };
    issueTypes: IssueType[];
    recommendationCount: { min: number; max: number };
    mustContain: string[];        // Required terms/phrases
    mustNotContain: string[];     // Forbidden terms (hallucination markers)
  };

  // Evaluation criteria (for LLM-as-judge)
  evalCriteria: {
    toolCorrectness: string[];    // Expected tool sequence
    causalChainValid: boolean;    // Must trace to evidence
    evidenceRequired: string[];   // Must cite these sources
  };
}
```

**Dataset Structure**:
```
tests/
├── fixtures/                    # Test project fixtures
│   ├── minimal-project/        # Minimal valid project
│   ├── complex-project/        # Full-featured project
│   ├── problematic-project/    # Known issues for detection
│   └── session-logs/           # Sample session logs
├── golden/                      # Golden dataset
│   ├── config-analysis/        # 30+ config scenarios
│   ├── session-analysis/       # 30+ session scenarios
│   ├── causal-traces/          # 20+ causal chain scenarios
│   └── cross-reference/        # 20+ cross-domain scenarios
└── evals/                       # Evaluation tests
    ├── tool-correctness.test.ts
    ├── hallucination.test.ts
    ├── faithfulness.test.ts
    └── task-completion.test.ts
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-component:
    runs-on: ubuntu-latest
    steps:
      - uses: oven-sh/setup-bun@v1
      - run: bun test tests/unit tests/component
    # Fast, no API keys needed

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: oven-sh/setup-bun@v1
      - run: bun test tests/integration
    # Uses mocked LLM responses

  agent-eval:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      AGENTLINT_TEST_BUDGET: 10  # Max $10 per run
    steps:
      - uses: oven-sh/setup-bun@v1
      - run: bun test tests/evals --timeout 180000
      - name: Report costs
        run: bun run scripts/report-eval-costs.ts
    # Real LLM calls, every CI run (user preference)
```

### Cost Tracking

Testing costs are tracked via OpenTelemetry (ADR-0009):

```typescript
// tests/evals/helpers/cost-tracker.ts
import { trace } from '@opentelemetry/api';

export class EvalCostTracker {
  private totalTokens = 0;
  private estimatedCost = 0;

  private static readonly PRICING = {
    'claude-sonnet-4-20250514': { input: 3, output: 15 },  // $/1M tokens
  };

  trackUsage(model: string, inputTokens: number, outputTokens: number) {
    const pricing = EvalCostTracker.PRICING[model];
    this.estimatedCost +=
      (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

    // Record to OTel for observability
    trace.getActiveSpan()?.setAttributes({
      'eval.tokens.input': inputTokens,
      'eval.tokens.output': outputTokens,
      'eval.cost.estimated': this.estimatedCost,
    });
  }

  checkBudget(maxBudget: number) {
    if (this.estimatedCost > maxBudget) {
      throw new Error(`Eval budget exceeded: $${this.estimatedCost} > $${maxBudget}`);
    }
  }
}
```

### Consequences

**Good:**
- TypeScript-native evaluation with EvalKit - no cross-language complexity
- Agent-specific metrics (tool correctness, hallucination) validate agentic behavior
- Real API testing in every CI run catches model regressions early
- Golden dataset provides deterministic baseline for comparison
- Cost tracking via OTel enables budget management
- Layered pyramid keeps fast tests fast, slow tests isolated

**Bad:**
- EvalKit less mature than Python DeepEval (may hit edge cases)
- Real API tests on every CI run increases monthly testing costs (~$150-300/month at scale)
- Need to maintain golden dataset as agentlint evolves (curation overhead)
- 180s timeout per eval test makes feedback loop slower

**Neutral:**
- Vercel AI SDK mock providers used for integration layer
- May need to contribute to EvalKit if missing metrics
- Cost tracking adds observability overhead

## Pros and Cons of Options

### Option 1: Bun Test + EvalKit

TypeScript-native agent evaluation using EvalKit for LLM-as-judge metrics.

- Good: Native TypeScript - no cross-language complexity
- Good: EvalKit provides hallucination, faithfulness, coherence metrics
- Good: Integrates with Bun test runner seamlessly
- Good: Active development, good documentation
- Neutral: Smaller community than DeepEval
- Bad: Less mature than Python alternatives
- Bad: May need custom metric extensions for causal analysis

### Option 2: Bun Test + Custom Eval Layer

Build agentlint-specific evaluation metrics from scratch.

- Good: Full control over metric definitions
- Good: Tailored to causal analysis requirements
- Good: No external dependencies
- Neutral: Can evolve with agentlint needs
- Bad: Significant development effort
- Bad: No community validation of approaches
- Bad: Reinventing proven patterns

### Option 3: Hybrid Bun + Python DeepEval

Use Bun for unit/integration tests, subprocess Python DeepEval for agent evals.

- Good: DeepEval is most mature agent eval framework
- Good: 50+ proven metrics available
- Good: Large community and documentation
- Neutral: Established in production at scale
- Bad: Cross-language complexity (TypeScript ↔ Python)
- Bad: Slower due to subprocess overhead
- Bad: Requires Python runtime in CI

### Option 4: Vitest + LangSmith

Vitest for testing with LangSmith cloud platform for agent evals.

- Good: LangSmith provides excellent observability
- Good: Vitest has LangSmith integration
- Good: Proven at scale by LangChain users
- Neutral: SaaS model may suit some teams
- Bad: Violates Local-First principle (cloud dependency)
- Bad: Vendor lock-in risk
- Bad: Additional subscription cost

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All testing runs locally; EvalKit runs on user's machine |
| II. Improvement-Oriented | Yes | Golden dataset enables tracking test quality over time |
| III. Causal-First | Yes | Hallucination/faithfulness metrics validate causal traces |
| IV. Mixed-Methods | Yes | Quantitative metrics + qualitative LLM-as-judge |
| V. Language-Agnostic | Yes | Test fixtures can represent any language project |
| VI. Tool-Agnostic | Yes | Adapter pattern testable via mocked tool outputs |
| VII. Static-First | Yes | Layers 1-3 are deterministic; Layer 4 is LLM-dependent |
| VIII. Progressive Value | Yes | Layers 1-3 work without LLM; Layer 4 enhances |
| IX. Agent-Aware | Yes | Metrics designed for agent behavior (tool correctness, coherence) |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - Bun runtime
- [ADR-0006: Agentic Analysis Implementation](./0006-agentic-analysis-implementation.md) - Vercel AI SDK
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md) - Evidence-first pattern
- [ADR-0009: Observability Strategy](./0009-observability-strategy.md) - Cost tracking via OTel
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Subagent pattern
- Architecture Vision: [Section 5 - Analysis Strategy](../../agentlint-architecture-vision.md#5-analysis-strategy)
- Design Questions: [Section 4.1 - Testing Strategy](../../design-questions.md#41-testing-strategy)

### Research Sources

**Agent Evaluation:**
- [IBM Research: Evaluating LLM-based Agents](https://research.ibm.com/publications/evaluating-llm-based-agents-foundations-best-practices-and-open-challenges) - Evaluation taxonomy
- [Confident AI: Definitive AI Agent Evaluation Guide](https://www.confident-ai.com/blog/definitive-ai-agent-evaluation-guide) - Tool correctness metrics
- [DeepEval: Agent Evaluation Metrics](https://deepeval.com/guides/guides-ai-agent-evaluation-metrics) - Metric definitions
- [Scenario: Testing Tool Calls](https://scenario.langwatch.ai/testing-guides/tool-calling/) - Function call testing

**LLM Testing:**
- [Vercel AI SDK: Testing](https://ai-sdk.dev/docs/ai-sdk-core/testing) - Mock providers, simulateReadableStream
- [Vercel: Eval-Driven Development](https://vercel.com/blog/eval-driven-development-build-better-ai-faster) - Eval patterns
- [Xata: LLM Evals with Vitest](https://xata.io/blog/llm-evals-with-vercel-ai-and-vitest) - Vitest integration
- [Langfuse: Testing LLM Applications](https://langfuse.com/blog/2025-10-21-testing-llm-applications) - Practical guide

**Evaluation Frameworks:**
- [EvalKit GitHub](https://github.com/evalkit/evalkit) - TypeScript evaluation library
- [EvalKit Documentation](https://docs.evalkit.ai/introduction) - Getting started
- [Braintrust: LLM Evaluation Tools 2025](https://www.braintrust.dev/articles/best-llm-evaluation-tools-integrations-2025) - Tool comparison
- [Smashing Magazine: Notifications UX](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) - LLM-as-judge accuracy (85%)

**Golden Datasets:**
- [Maxim AI: Building Golden Datasets](https://www.getmaxim.ai/articles/building-a-golden-dataset-for-ai-evaluation-a-step-by-step-guide/) - Dataset design
- [Arize: Golden Dataset Role](https://arize.com/resource/golden-dataset/) - CI/CD integration
- [Gentrace: Building Datasets](https://gentrace.ai/blog/how-to-build-datasets) - Dataset curation

**Hallucination Detection:**
- [Confident AI: Hallucination Metrics](https://www.confident-ai.com/blog/how-i-built-deterministic-llm-evaluation-metrics-for-deepeval) - Deterministic detection
- [Vectara: Hallucination Leaderboard](https://www.vectara.com/blog/introducing-the-next-generation-of-vectaras-hallucination-leaderboard) - Benchmarks
- [arXiv: Agent Hallucination Survey](https://arxiv.org/html/2509.18970v1) - Detection methods

**Cost Management:**
- [Helicone: Monitor LLM Costs](https://www.helicone.ai/blog/monitor-and-optimize-llm-costs) - Cost tracking
- [LiteLLM: Spend Tracking](https://docs.litellm.ai/docs/proxy/cost_tracking) - Budget management

### Implementation Notes

#### 1. EvalKit Setup

```typescript
// tests/evals/setup.ts
import { EvalKit, HallucinationMetric, FaithfulnessMetric, CoherenceMetric } from '@evalkit/core';

export const evalKit = new EvalKit({
  apiKey: process.env.OPENAI_API_KEY,  // EvalKit uses OpenAI for judging
  metrics: [
    new HallucinationMetric({ threshold: 0.8 }),
    new FaithfulnessMetric({ threshold: 0.85 }),
    new CoherenceMetric({ threshold: 0.9 }),
  ],
});

// Custom metric for causal analysis
export const causalAccuracyMetric = evalKit.createCustomMetric({
  name: 'causal-accuracy',
  description: 'Validates causal traces cite real evidence',
  criteria: [
    'Each issue links to specific session/config location',
    'Evidence quotes match actual source content',
    'Causal chain is logically valid (cause → effect)',
  ],
  scoringRubric: {
    5: 'All traces verified with exact evidence',
    3: 'Most traces valid, minor citation gaps',
    1: 'Traces contain fabricated or misattributed evidence',
  },
});
```

#### 2. Tool Correctness Test

```typescript
// tests/evals/tool-correctness.test.ts
import { describe, test, expect } from 'bun:test';
import { evalKit } from './setup';
import { runAnalysis } from '@/core/analysis';

describe('Tool Correctness', () => {
  test('ConfigAnalyser selected for CLAUDE.md changes', async () => {
    const result = await runAnalysis({
      changeManifest: { configModified: true, sessionsAdded: [] },
    });

    const toolSequence = result.trace.toolCalls.map(t => t.name);

    expect(toolSequence).toContain('ConfigAnalyser');
    expect(toolSequence).not.toContain('SessionAnalyser'); // Not needed
  }, 180_000);

  test('SessionAnalyser selected for new session logs', async () => {
    const result = await runAnalysis({
      changeManifest: { configModified: false, sessionsAdded: ['session-1.jsonl'] },
    });

    const toolSequence = result.trace.toolCalls.map(t => t.name);

    expect(toolSequence).toContain('SessionAnalyser');
  }, 180_000);
});
```

#### 3. Hallucination Test

```typescript
// tests/evals/hallucination.test.ts
import { describe, test, expect } from 'bun:test';
import { evalKit, causalAccuracyMetric } from './setup';
import { runCausalAnalysis } from '@/core/causal';
import { loadFixture } from './helpers';

describe('Hallucination Detection', () => {
  test('causal traces cite real evidence', async () => {
    const fixture = await loadFixture('problematic-project');
    const result = await runCausalAnalysis(fixture);

    // Verify each causal trace
    for (const trace of result.causalTraces) {
      // Check evidence actually exists in source
      const sourceContent = await Bun.file(trace.evidenceSource).text();
      expect(sourceContent).toContain(trace.evidenceQuote);

      // LLM-as-judge for quality
      const score = await causalAccuracyMetric.evaluate({
        input: trace.issue,
        output: trace.causalChain,
        context: sourceContent,
      });

      expect(score).toBeGreaterThanOrEqual(0.8);
    }
  }, 180_000);
});
```

#### 4. Vercel AI SDK Mock Provider

```typescript
// tests/integration/helpers/mock-ai.ts
import { MockLanguageModelV1 } from 'ai/test';

export function createMockProvider(responses: Map<string, string>) {
  return new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async ({ prompt }) => {
      const key = hashPrompt(prompt);
      const response = responses.get(key);

      if (!response) {
        throw new Error(`No fixture for prompt: ${key}`);
      }

      return {
        text: response,
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200 },
      };
    },
  });
}

// Usage in tests
import { createMockProvider } from './helpers/mock-ai';
import { loadFixtures } from './helpers/fixtures';

const mockProvider = createMockProvider(await loadFixtures('config-analysis'));
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Golden Dataset Curation Process**: Define process for adding/updating test scenarios
2. **Eval Cost Budgeting**: Establish monthly testing budget and alerting thresholds
3. **EvalKit Contribution**: If missing causal accuracy metric, contribute upstream
