---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0015: Reproducibility and Determinism

## Context and Problem Statement

agentlint combines deterministic static analysis with non-deterministic LLM-powered agentic analysis. Research shows that even with `temperature=0` and fixed seeds, LLM outputs are **not fully deterministic** due to floating-point non-associativity, batch size variations, and hardware differences ([Thinking Machines Lab](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)). This ADR establishes how agentlint handles reproducibility, baseline comparisons, and user expectations around determinism.

The key challenges are:
1. LLM APIs provide "best effort" determinism, not guarantees
2. Model updates (GPT-4 snapshots, Claude versions) cause behavioral drift
3. Baseline comparisons may be misleading across different model versions
4. Users expect consistent results for the same codebase
5. Static analysis is fully deterministic; hybrid results are mixed

## Decision Drivers

- **Static-First principle**: Static analysis provides deterministic baseline
- **Honesty with users**: Don't hide non-determinism—document it
- **Baseline comparison validity**: Warn when comparisons may be misleading
- **Research findings**: Industry consensus that perfect LLM determinism is impractical
- **Progressive Value**: Static-only mode should always be reproducible
- **Drift detection**: Model behavioral drift is measurable (23% GPT-4 variance documented)

## Considered Options

1. Documented Non-Determinism with Version Tracking
2. Static-Only Deterministic Mode
3. Semantic Reproducibility (findings-level consistency)
4. Best-Effort Determinism (temp=0, seed, hope)

## Decision Outcome

Chosen option: **"Documented Non-Determinism with Version Tracking"** because it honestly acknowledges LLM limitations, provides actionable warnings for users, and enables meaningful baseline comparisons with drift awareness. Static analysis remains fully deterministic, and the hybrid approach is well-documented.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REPRODUCIBILITY STRATEGY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ANALYSIS DETERMINISM BY LAYER                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STATIC ANALYSIS                         ✓ FULLY DETERMINISTIC     │   │
│  │ • Config parsing, validation                                        │   │
│  │ • Session log metrics                                               │   │
│  │ • File system scanning                                              │   │
│  │                                                                     │   │
│  │ Same input → Same output (guaranteed)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ AGENTIC ANALYSIS                        ⚠ NON-DETERMINISTIC        │   │
│  │ • Causal trace generation                                           │   │
│  │ • Recommendation synthesis                                          │   │
│  │ • Quality assessments                                               │   │
│  │                                                                     │   │
│  │ Same input → Similar output (within variance)                       │   │
│  │ temp=0 reduces but doesn't eliminate variation                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REPRODUCIBILITY METADATA (Recorded with Every Analysis)                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  {                                                                         │
│    "agentlint_version": "1.2.3",                                           │
│    "analysis_timestamp": "2026-01-13T10:30:00Z",                           │
│    "model": {                                                              │
│      "id": "claude-sonnet-4-20250514",                                     │
│      "provider": "anthropic",                                              │
│      "temperatures": {                  // Task-specific temperatures     │
│        "extraction": 0.1,                                                  │
│        "reasoning": 0.3,                                                   │
│        "synthesis": 0.4                                                    │
│      },                                                                    │
│      "max_tokens": 4096                                                    │
│    },                                                                      │
│    "static_hash": "sha256:abc123...",   // Hash of static results         │
│    "agentic_hash": "sha256:def456...",  // Hash of agentic results        │
│    "mode": "full"                       // "full" | "static-only"         │
│  }                                                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BASELINE COMPARISON WITH VERSION WARNINGS                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  $ agentlint analyse                                                       │
│                                                                             │
│  ⚠ Version Mismatch Detected:                                             │
│    Baseline: claude-sonnet-4-20250514 (2026-01-01)                         │
│    Current:  claude-sonnet-4-20250601 (2026-01-13)                         │
│                                                                             │
│    Agentic results may differ due to model updates.                        │
│    Static analysis comparison remains valid.                               │
│                                                                             │
│  Comparison Results:                                                       │
│    Static issues:  12 → 8 (✓ 4 resolved, deterministic)                   │
│    Agentic recommendations: 5 → 7 (⚠ may reflect model changes)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reproducibility Guarantees

| Component | Guarantee | Caveat |
|-----------|-----------|--------|
| **Static Analysis** | Fully deterministic | Same input = same output |
| **Agentic Analysis** | Best-effort consistent | Variance expected; tracked via metadata |
| **Baseline Comparison** | Valid with warnings | Version mismatch triggers warning |
| **Static-Only Mode** | Fully reproducible | No LLM calls, no variance |

### Temperature Strategy (NOT temp=0)

**Important**: We do NOT recommend `temperature=0` as a default. Research shows:
1. temp=0 doesn't guarantee determinism anyway (floating-point, batching issues)
2. temp=0 can reduce quality for reasoning/synthesis tasks (repetitive, misses nuance)
3. The right temperature depends on the task type

**Task-Appropriate Temperatures**:

| Task Type | Recommended Temp | Rationale |
|-----------|------------------|-----------|
| Structured extraction (issue types) | 0.0-0.2 | Precision needed |
| Causal analysis (reasoning) | 0.2-0.4 | Needs to connect dots, explore alternatives |
| Recommendation synthesis | 0.3-0.5 | Benefits from varied expression |
| Quality assessment | 0.1-0.3 | Analytical but needs nuance |

**Configuration**:
```toml
# .agentlint/config.toml
[model]
# Task-specific temperatures (defaults shown)
temperature_extraction = 0.1    # Structured outputs
temperature_reasoning = 0.3     # Causal analysis
temperature_synthesis = 0.4     # Recommendations
```

**Key Insight**: Reproducibility comes from **metadata tracking and version warnings**, not from temperature=0. Accept that agentic outputs will vary, and design for robustness to that variance.

### Metadata Schema

Every analysis records reproducibility metadata:

```typescript
interface ReproducibilityMetadata {
  // Tool version
  agentlintVersion: string;          // SemVer, e.g., "1.2.3"

  // Timestamp
  analysisTimestamp: Date;

  // Model information (for agentic analysis)
  model?: {
    id: string;                       // e.g., "claude-sonnet-4-20250514"
    provider: string;                 // "anthropic" | "openai" | etc.
    temperatures: {                   // Task-specific temperatures
      extraction: number;             // Structured outputs (default: 0.1)
      reasoning: number;              // Causal analysis (default: 0.3)
      synthesis: number;              // Recommendations (default: 0.4)
    };
    maxTokens?: number;
    seed?: number;                    // If supported by provider
  };

  // Result hashes for drift detection
  staticHash: string;                 // SHA-256 of static results
  agenticHash?: string;               // SHA-256 of agentic results

  // Analysis mode
  mode: 'full' | 'static-only';

  // Input fingerprint (for cache validation)
  inputFingerprint: {
    configHash: string;               // Hash of CLAUDE.md + .agentlint/config.toml
    sessionCount: number;             // Number of session logs analyzed
    codebaseHash: string;             // Lightweight hash of tracked files
  };
}
```

### Version Comparison Behavior

When comparing current analysis to baseline:

```typescript
interface VersionComparisonResult {
  isVersionMatch: boolean;
  warnings: VersionWarning[];
  staticComparison: StaticDelta;      // Always valid
  agenticComparison: AgenticDelta;    // May be affected by version drift
}

interface VersionWarning {
  type: 'model_version' | 'agentlint_version' | 'provider_change';
  baseline: string;
  current: string;
  message: string;
  severity: 'info' | 'warning';
}

function compareWithVersionAwareness(
  baseline: AnalysisResult,
  current: AnalysisResult
): VersionComparisonResult {
  const warnings: VersionWarning[] = [];

  // Check model version
  if (baseline.metadata.model?.id !== current.metadata.model?.id) {
    warnings.push({
      type: 'model_version',
      baseline: baseline.metadata.model?.id ?? 'unknown',
      current: current.metadata.model?.id ?? 'unknown',
      message: 'Agentic results may differ due to model updates',
      severity: 'warning',
    });
  }

  // Check agentlint version (major/minor)
  if (!semverCompatible(baseline.metadata.agentlintVersion,
                        current.metadata.agentlintVersion)) {
    warnings.push({
      type: 'agentlint_version',
      baseline: baseline.metadata.agentlintVersion,
      current: current.metadata.agentlintVersion,
      message: 'Analysis methodology may have changed between versions',
      severity: 'info',
    });
  }

  return {
    isVersionMatch: warnings.length === 0,
    warnings,
    staticComparison: compareStaticResults(baseline.static, current.static),
    agenticComparison: compareAgenticResults(baseline.agentic, current.agentic),
  };
}
```

### Static-Only Mode

For guaranteed determinism, users can run static-only analysis:

```bash
# Fully deterministic analysis (no LLM calls)
agentlint analyse --static-only

# Or via configuration
# .agentlint/config.toml
[analysis]
mode = "static-only"  # Guarantees reproducibility
```

**Use cases for static-only mode:**
- CI/CD pipelines requiring deterministic pass/fail
- Baseline establishment for regression testing
- Environments without LLM API access
- Privacy-sensitive contexts

### Drift Detection

agentlint can detect behavioral drift across runs:

```typescript
interface DriftMetrics {
  // Output-level drift
  staticDrift: number;      // 0.0 = identical, should always be 0
  agenticDrift: number;     // 0.0-1.0 scale, higher = more variance

  // Finding-level drift
  findingsAdded: number;
  findingsRemoved: number;
  findingsChanged: number;

  // Model-level drift (if multiple runs recorded)
  consistencyScore: number; // % of runs producing same findings
}

// Track drift over time in SQLite (ADR-0003)
interface DriftHistory {
  runId: string;
  timestamp: Date;
  modelVersion: string;
  metrics: DriftMetrics;
}
```

### Consequences

**Good:**
- Honest acknowledgment of LLM limitations
- Version tracking enables meaningful baseline comparisons
- Static analysis provides deterministic anchor
- Drift detection surfaces model behavioral changes
- Static-only mode guarantees reproducibility when needed
- Full metadata enables debugging reproducibility issues

**Bad:**
- Users may be confused by non-deterministic agentic results
- Version warnings may cause alert fatigue
- Metadata storage increases baseline size
- Cannot guarantee identical agentic results across runs

**Neutral:**
- Requires user education on determinism expectations
- May need documentation on "expected variance"
- Drift metrics require baseline population to be meaningful

## Pros and Cons of Options

### Option 1: Documented Non-Determinism with Version Tracking

Accept and document LLM non-determinism, record full metadata, warn on version mismatches.

- Good: Honest about limitations
- Good: Version tracking enables valid comparisons
- Good: Drift detection surfaces issues
- Good: Static analysis remains deterministic anchor
- Neutral: Requires user education
- Bad: Agentic results may vary between runs
- Bad: Version warnings may cause noise

### Option 2: Static-Only Deterministic Mode

Default to static-only analysis, opt-in for agentic analysis.

- Good: Fully deterministic by default
- Good: Simple mental model
- Good: No version tracking complexity
- Neutral: Aligns with Static-First principle
- Bad: Loses value from agentic analysis
- Bad: Contradicts Mixed-Methods principle
- Bad: Users expect LLM-powered features

### Option 3: Semantic Reproducibility

Accept wording variation but require consistent findings/recommendations.

- Good: Focuses on what matters (findings, not wording)
- Good: More realistic expectation
- Neutral: Requires defining "semantic equivalence"
- Bad: Hard to measure "semantic consistency"
- Bad: Edge cases where different wording = different meaning
- Bad: Complex implementation

### Option 4: Best-Effort Determinism

Use temp=0, seed, and accept occasional variation without tracking.

- Good: Simple implementation
- Good: No version tracking overhead
- Neutral: Works most of the time
- Bad: Hides non-determinism from users
- Bad: Baseline comparisons may be silently invalid
- Bad: No visibility into model drift

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All metadata stored locally |
| II. Improvement-Oriented | Yes | Drift tracking enables improvement measurement |
| III. Causal-First | Partial | Causal traces may vary; root cause remains same |
| IV. Mixed-Methods | Yes | Static (quantitative) + agentic (qualitative) both tracked |
| V. Language-Agnostic | Yes | Reproducibility strategy independent of target language |
| VI. Tool-Agnostic | Yes | Model version tracking works across providers |
| VII. Static-First | Yes | Static analysis provides deterministic baseline |
| VIII. Progressive Value | Yes | Static-only mode always available |
| IX. Agent-Aware | Yes | Documents agent behavior expectations |

## More Information

### Related Documents
- [ADR-0006: Agentic Analysis Implementation](./0006-agentic-analysis-implementation.md) - Vercel AI SDK
- [ADR-0013: Testing Strategy](./0013-testing-strategy.md) - Golden dataset for eval reproducibility
- [ADR-0014: Error Handling](./0014-error-handling-and-recovery.md) - Graceful degradation
- Design Questions: [Section 4.3 - Reproducibility & Determinism](../../design-questions.md#43-reproducibility--determinism)

### Research Sources

**LLM Non-Determinism:**
- [Thinking Machines Lab: Defeating Nondeterminism](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/) - Root causes (batch size, floating-point)
- [KeywordsAI: Consistent LLM Outputs 2025](https://www.keywordsai.co/blog/llm_consistency_2025) - Best practices
- [Unstract: Why Deterministic LLM Output is Impossible](https://unstract.com/blog/understanding-why-deterministic-output-from-llms-is-nearly-impossible/) - Technical analysis
- [arXiv: Non-Determinism of "Deterministic" LLM Settings](https://arxiv.org/html/2408.04667v5) - Academic research
- [Vincent Schmalbach: Does Temperature 0 Guarantee Determinism?](https://www.vincentschmalbach.com/does-temperature-0-guarantee-deterministic-llm-outputs/) - Practical analysis

**Temperature Best Practices:**
- [Anthropic: Claude Docs](https://docs.anthropic.com/) - "Use temperature closer to 0.0 for analytical, closer to 1.0 for creative"
- [Vellum: LLM Temperature Guide](https://www.vellum.ai/llm-parameters/temperature) - Task-specific recommendations
- [IBM: What is LLM Temperature](https://www.ibm.com/think/topics/llm-temperature) - No universal best temperature
- [Promptfoo: Evaluate LLM Temperature](https://www.promptfoo.dev/docs/guides/evaluate-llm-temperature/) - Data-driven temperature selection
- [Cognativ: Temperature Impact on Quality](https://www.cognativ.com/blogs/post/what-is-temperature-in-llms-and-its-impact-on-output-quality/315) - Coherence vs diversity tradeoff

**Model Drift Detection:**
- [Fiddler: LLMOps Drift Monitoring](https://www.fiddler.ai/blog/how-to-monitor-llmops-performance-with-drift) - Monitoring strategies
- [Medium: Drift Detection Practical Guide](https://medium.com/@tsiciliani/drift-detection-in-large-language-models-a-practical-guide-3f54d783792c) - Implementation guide
- [ORQ: Model vs Data Drift 2025](https://orq.ai/blog/model-vs-data-drift) - Drift taxonomy
- [Medium: Tracking Behavioral Drift](https://medium.com/@EvePaunova/tracking-behavioral-drift-in-large-language-models-a-comprehensive-framework-for-monitoring-86f1dc1cb34e) - GPT-4 23% variance finding

**Hybrid Analysis:**
- [arXiv: SAST-Genius Hybrid Framework](https://www.arxiv.org/pdf/2509.15433) - Static + LLM analysis
- [Capgemini: Hybrid AI Evolution](https://www.capgemini.com/be-en/insights/expert-perspectives/the-evolution-of-hybrid-aiwhere-deterministic-and-probabilistic-approaches-meet/) - Deterministic + probabilistic
- [Medium: Deterministic vs Non-Deterministic Testing](https://medium.com/@promptedmind28/deterministic-software-testing-vs-non-deterministic-llm-agent-testing-what-you-need-to-know-f3abd5f9009d) - Testing strategies

**Caching & Reproducibility:**
- [Agno: LLM Response Caching](https://www.agno.com/blog/llm-response-caching-in-agno) - Caching for development
- [arXiv: Cache Saver Framework](https://openreview.net/pdf?id=Ve2r5Bap1Q) - Statistical independence in caching
- [arXiv: Mnimi Statistical Independence](https://www.arxiv.org/pdf/2511.22118) - Cache design patterns

### Implementation Notes

#### 1. Recording Metadata

```typescript
// src/analysis/metadata.ts
import { createHash } from 'crypto';

function createReproducibilityMetadata(
  analysisResult: AnalysisResult,
  config: AnalysisConfig
): ReproducibilityMetadata {
  return {
    agentlintVersion: VERSION,
    analysisTimestamp: new Date(),
    model: config.model ? {
      id: config.model.id,
      provider: config.model.provider,
      temperature: config.model.temperature ?? 0,
      maxTokens: config.model.maxTokens,
      seed: config.model.seed,
    } : undefined,
    staticHash: hashResults(analysisResult.static),
    agenticHash: analysisResult.agentic
      ? hashResults(analysisResult.agentic)
      : undefined,
    mode: config.mode,
    inputFingerprint: {
      configHash: hashFiles(['.agentlint/config.toml', 'CLAUDE.md']),
      sessionCount: analysisResult.sessionCount,
      codebaseHash: hashCodebase(config.include, config.exclude),
    },
  };
}

function hashResults(results: unknown): string {
  const normalized = JSON.stringify(results, Object.keys(results).sort());
  return `sha256:${createHash('sha256').update(normalized).digest('hex').slice(0, 16)}`;
}
```

#### 2. Version Warning Display

```typescript
// src/cli/comparison.ts
import chalk from 'chalk';

function displayVersionWarnings(warnings: VersionWarning[]): void {
  if (warnings.length === 0) return;

  console.log('');
  console.log(chalk.yellow('⚠ Version Mismatch Detected:'));

  for (const warning of warnings) {
    console.log(`  Baseline: ${warning.baseline}`);
    console.log(`  Current:  ${warning.current}`);
    console.log(`  ${chalk.dim(warning.message)}`);
    console.log('');
  }

  console.log(chalk.dim('  Static analysis comparison remains valid.'));
  console.log('');
}
```

#### 3. Static-Only Mode

```typescript
// src/analysis/runner.ts
async function runAnalysis(config: AnalysisConfig): Promise<AnalysisResult> {
  // Static analysis always runs
  const staticResults = await runStaticAnalysis(config);

  // Skip agentic if static-only mode
  if (config.mode === 'static-only') {
    return {
      static: staticResults,
      agentic: null,
      metadata: createReproducibilityMetadata({ static: staticResults }, config),
    };
  }

  // Run agentic analysis with fallback (ADR-0014)
  const agenticResults = await runAgenticAnalysisWithFallback(config);

  return {
    static: staticResults,
    agentic: agenticResults,
    metadata: createReproducibilityMetadata(
      { static: staticResults, agentic: agenticResults },
      config
    ),
  };
}
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Drift Alerting**: Define thresholds for "significant drift" that warrant user attention
2. **Model Version Changelog**: Document behavioral changes across model versions
3. **Caching Strategy**: Whether to cache LLM responses for development reproducibility
