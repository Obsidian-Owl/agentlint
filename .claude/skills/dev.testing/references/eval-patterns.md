# TruLens Eval Patterns

> Patterns for behavioral evaluation of agent quality. Based on ADR-0011 and ADR-0012.

## Overview

TruLens evals assess **behavioral quality** - whether the agent "did the right thing". These run on **release tags only** (expensive, live LLM calls).

## When to Use Evals

Use TruLens evals when testing:
- Recommendation actionability
- Causal accuracy (did we trace to the right origin?)
- Agent decision quality (did it pick the right tool/subagent?)
- Reasoning coherence
- Output relevance

**NOT unit tests** - evals use LLM-as-judge for semantic evaluation.

## Three-Tier Grading System

Per ADR-0012, evals use three grading tiers:

| Tier | Type | Speed | Purpose |
|------|------|-------|---------|
| 1 | Code-based | Fast | Format validation, required fields |
| 2 | LLM-as-judge | Medium | Actionability, causal accuracy |
| 3 | Human spot-check | Slow | Gold standard validation |

## TruLens Setup

### Configuration

```python
# tests/evals/trulens.config.py
from trulens.core import Feedback, TruSession
from trulens.providers.openai import OpenAI as TruLensOpenAI

# Local SQLite storage (Constitution: Local-First)
session = TruSession(database_path=".agentlint/evals.db")

# Feedback provider
provider = TruLensOpenAI()

# Standard metrics
relevance = Feedback(provider.relevance).on_input_output()
groundedness = Feedback(provider.groundedness).on_input_output()
coherence = Feedback(provider.coherence).on_output()
```

### Custom Metrics

```python
# tests/evals/metrics/actionability.py
def recommendation_actionability(recommendation: str) -> float:
    """Evaluate if recommendation is actionable (0-1)."""
    prompt = f"""
    Rate this recommendation's actionability from 0 to 1:
    - 1.0: Clear, specific action the user can take immediately
    - 0.5: Somewhat actionable but vague or context-dependent
    - 0.0: Not actionable, too abstract or unclear

    Recommendation: {recommendation}

    Score (0-1):
    """
    return provider.generate_score(prompt)

def causal_accuracy(finding: str, evidence: str) -> float:
    """Evaluate if the traced origin explains the issue (0-1)."""
    prompt = f"""
    Rate the causal accuracy from 0 to 1:
    - 1.0: Clear causal chain from config gap to observed problem
    - 0.5: Plausible connection but not proven
    - 0.0: No causal connection or wrong attribution

    Finding: {finding}
    Evidence: {evidence}

    Score (0-1):
    """
    return provider.generate_score(prompt)
```

## Golden Dataset

Per ADR-0012, evals run against a golden dataset:

```
.agentlint/
└── eval/
    └── golden/
        ├── high-quality/        # Good CLAUDE.md examples
        ├── low-quality/         # Anti-pattern examples
        ├── edge-cases/          # Challenging scenarios
        └── manifest.json        # Metadata, expected outcomes
```

### Golden Scenario Schema

```typescript
interface GoldenScenario {
  id: string;
  source: 'public-repo' | 'dogfood' | 'production-failure';

  input: {
    claudeMd: string;
    projectType: string;
    sessionLogs?: string;
  };

  expectedProperties: {
    shouldDetect: string[];      // Issues that must be found
    shouldNotDetect: string[];   // False positives to avoid
    recommendationTypes: ('symptomatic' | 'preventive' | 'systemic')[];
  };

  rubricWeights: {
    actionability: number;       // 0-1
    causalAccuracy: number;      // 0-1
    relevance: number;           // 0-1
  };
}
```

## Evaluation Pipeline

```typescript
// tests/evals/run-evals.ts
async function evaluateAnalysis(
  scenario: GoldenScenario,
  output: AnalysisOutput
): Promise<EvaluationResult> {
  const results: EvaluationResult = {
    scenarioId: scenario.id,
    grades: {},
  };

  // Tier 1: Code-based checks (always run)
  results.grades.codeBased = await runCodeBasedChecks(scenario, output);

  // Tier 2: LLM-as-judge (if code checks pass)
  if (results.grades.codeBased.passed) {
    results.grades.llmJudge = await runLLMJudge(scenario, output);
  }

  // Calculate weighted score
  results.overallScore = calculateScore(results.grades, scenario.rubricWeights);
  results.passed = results.overallScore >= 0.7;

  return results;
}
```

## CI Integration

Evals run on release tags only:

```yaml
# .github/workflows/test.yml
e2e-evals:
  if: startsWith(github.ref, 'refs/tags/')
  steps:
    - name: Run behavioral evaluations
      env:
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      run: bun run tests/evals/run-evals.ts
```

## Orchestration from Bun

```typescript
// tests/evals/run-evals.ts
import { $ } from 'bun';

async function runEvaluations(): Promise<EvalResults> {
  // Run TruLens via Python subprocess
  const result = await $`python tests/evals/run.py`.json();

  return {
    relevance: result.relevance,
    groundedness: result.groundedness,
    actionability: result.actionability,
    overallScore: result.overall,
  };
}

// Release gate
if (process.env.RELEASE_TAG) {
  const results = await runEvaluations();

  if (results.overallScore < 0.7) {
    console.error('Eval score below threshold:', results.overallScore);
    process.exit(1);
  }
}
```

## Directory Structure

```
tests/
└── evals/
    ├── trulens.config.py      # TruLens setup
    ├── run.py                 # Python eval runner
    ├── run-evals.ts           # Bun orchestrator
    ├── metrics/
    │   ├── actionability.py
    │   └── causal_accuracy.py
    └── behavioral/
        ├── recommendation-quality.test.ts
        └── subagent-selection.test.ts
```

## Best Practices

1. **Release-gate only** - Don't run evals on every commit (expensive)
2. **Threshold-based** - Fail release if score drops below 0.7
3. **Track trends** - Store results in `.agentlint/evals.db` for baselines
4. **Diverse scenarios** - Include high-quality, low-quality, edge cases
5. **Human calibration** - Periodically spot-check LLM-as-judge accuracy
