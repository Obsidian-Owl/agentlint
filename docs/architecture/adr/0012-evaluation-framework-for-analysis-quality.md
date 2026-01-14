---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0012: Evaluation Framework for Analysis Quality

## Context and Problem Statement

agentlint's core value proposition is providing high-quality analysis and recommendations for AI coding agent configurations. But how do we measure "quality"? Analysis quality is subjective and context-dependent, encompassing:

1. **Recommendation actionability**: Are suggestions specific, implementable, and valuable?
2. **Causal accuracy**: Does the traced origin actually explain the issue?
3. **User outcomes**: Did users implement recommendations? Did they help?

ADR-0011 establishes TruLens for release-gate behavioral testing. This decision addresses **ongoing quality measurement**—tracking whether agentlint actually helps users improve over time (Constitution Principle II: Improvement-Oriented).

## Decision Drivers

- **Quality measurement**: Need metrics that capture "good analysis" across multiple dimensions
- **Balanced evaluation**: All dimensions (actionability, accuracy, outcomes) equally important
- **Real-world validation**: Golden datasets must reflect actual user scenarios
- **Compounding value**: Evaluation system should improve over time (Principle VIII)
- **Dogfooding**: agentlint should analyze its own patterns (Principle IX: Agent-Aware)
- **Practicality**: Need concrete golden dataset sources before agentlint is built

## Considered Options

1. Golden dataset + outcome tracking (phased)
2. LLM-as-judge only
3. Human review rubrics only
4. Benchmark suite only

## Decision Outcome

**Chosen option: "Golden dataset + outcome tracking"** with a **phased approach** to dataset sourcing. MVP uses curated public GitHub repos. Post-launch adds dogfooding (agentlint analyzing itself). Ongoing outcome tracking captures whether recommendations were implemented and helped.

### Evaluation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVALUATION FRAMEWORK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   GOLDEN     │    │   GRADERS    │    │   OUTCOME    │      │
│  │   DATASET    │    │              │    │   TRACKING   │      │
│  │              │    │  Code-based  │    │              │      │
│  │  Public repos│───▶│  LLM-judge   │───▶│  Implemented?│      │
│  │  Dogfooding  │    │  Human spot  │    │  Helped?     │      │
│  │  Prod failures│   │              │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         └───────────────────┴───────────────────┘               │
│                             │                                    │
│                     ┌───────▼───────┐                           │
│                     │   METRICS     │                           │
│                     │               │                           │
│                     │ Actionability │                           │
│                     │ Causal Acc.   │                           │
│                     │ Outcome Rate  │                           │
│                     └───────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phased Dataset Strategy

**Critical Finding**: No public session log dataset exists. Session logs contain proprietary code and are privacy-sensitive. CLAUDE.md files from real production projects are available, but session logs must be generated through dogfooding.

| Phase | CLAUDE.md Source | Session Log Source |
|-------|-----------------|-------------------|
| MVP | Real production repos (Metabase, LangGraph) | Dogfooding only |
| Post-launch | Above + agentlint's own CLAUDE.md | Dogfooding (accumulated) |
| Ongoing | Above + community submissions | Above + opt-in user contributions |

**Why Dogfooding Session Logs Is Mandatory**:
1. No external source exists—we must generate our own
2. Proves the tool works—if we can't analyze our own sessions, something's wrong
3. Creates reference dataset—our sessions become the initial golden dataset
4. Higher quality than synthetic—captures real failure patterns

### Consequences

**Good:**
- Real production CLAUDE.md files available (Metabase, LangGraph, etc.)
- Dogfooding creates high-quality reference session logs
- Three grader types (code, LLM, human) balance speed vs. accuracy
- Outcome tracking captures what static datasets miss
- Feeds into TruLens infrastructure from ADR-0011

**Bad:**
- Session log dataset requires dogfooding effort—no shortcuts
- Outcome tracking requires user opt-in (low response rates expected)
- Human review is expensive; limited to spot-checks
- Evaluation capabilities grow with dogfooding accumulation

**Neutral:**
- Evaluation evolves with agentlint maturity
- Meta-circularity concern (LLM judging LLM) mitigated by hybrid grading
- Dogfooding is mandatory, not optional—it's the only session log source

## Pros and Cons of Options

### Option 1: Golden dataset + outcome tracking (phased)

Build golden dataset from curated public repos initially, add dogfooding post-launch, track user outcomes ongoing.

- Good: Diverse real-world examples from public GitHub
- Good: Outcome tracking captures actual user value
- Good: Three grader types balance speed vs. accuracy
- Good: Dogfooding proves the tool works on itself
- Good: Dataset evolves from production failures
- Neutral: Phased approach delays some capabilities
- Bad: Public repos may have selection bias
- Bad: Outcome tracking requires user participation

### Option 2: LLM-as-judge only

Use LLM to score every analysis output against rubrics.

- Good: Scalable to every analysis
- Good: Consistent evaluation criteria
- Good: No manual annotation needed
- Neutral: Can run on every session
- Bad: Meta-circularity (LLM judging LLM output)
- Bad: No ground truth validation
- Bad: May optimize for what LLM thinks is good vs. actual value

### Option 3: Human review rubrics only

Periodic expert review of sample analyses using structured rubrics.

- Good: Gold standard accuracy
- Good: Catches nuances automated methods miss
- Good: Builds intuition about quality patterns
- Neutral: Industry-proven approach
- Bad: Expensive—limits sample size
- Bad: Slow feedback loop
- Bad: Doesn't scale with usage growth

### Option 4: Benchmark suite only

Static test suite of CLAUDE.md scenarios with expected outputs.

- Good: Reproducible and deterministic
- Good: Fast CI integration
- Good: Clear pass/fail criteria
- Neutral: Aligned with ADR-0011 testing approach
- Bad: Doesn't reflect real-world diversity
- Bad: Expected outputs may not capture all valid analyses
- Bad: No outcome validation

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All evaluation runs locally; outcome tracking is opt-in |
| II. Improvement-Oriented | Yes | Core purpose: measure improvement over time |
| III. Causal-First | Yes | Causal accuracy is a primary metric |
| IV. Mixed-Methods | Yes | Quantitative metrics + qualitative human review |
| V. Language-Agnostic | Yes | Golden dataset includes diverse project types |
| VI. Agent-Agnostic | Yes | Evaluation applies to any ACT adapter |
| VII. Intelligent Tooling | Yes | Three grader types; agent chooses appropriate method |
| VIII. Compounding Value | Yes | Dataset evolves; baselines enable trend tracking |
| IX. Agent-Aware | Yes | Dogfooding proves agentlint works on itself |

## More Information

### Related Documents

- Design Decisions: [DD-013](../design-decisions.md#dd-013-evaluation-framework-for-analysis-quality)
- Prior Decisions: [ADR-0011 - Testing Strategy](./0011-testing-strategy-for-agentic-components.md)

### Research Sources

- [Anthropic - Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Maxim - Building a Golden Dataset](https://www.getmaxim.ai/articles/building-a-golden-dataset-for-ai-evaluation-a-step-by-step-guide/)
- [Langfuse - User Feedback for LLM Evaluation](https://langfuse.com/docs/scores/user-feedback)
- [Databricks - LLM Evaluation Best Practices](https://www.databricks.com/blog/best-practices-and-methods-llm-evaluation)
- [Confident AI - LLM Evaluation Metrics](https://www.confident-ai.com/blog/llm-evaluation-metrics-everything-you-need-for-llm-evaluation)
- [Simon Willison - Claude Code Logs](https://simonwillison.net/2025/Oct/22/claude-code-logs/) - Session log storage and retention

### Golden Dataset Sources

**CLAUDE.md - Real Production Projects:**
- [metabase/metabase](https://github.com/metabase/metabase/blob/master/CLAUDE.md) - ~1KB, skill registry pattern, references `.claude/skills/`
- [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs/blob/main/CLAUDE.md) - ~28 lines, build/test/style/architecture
- [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph/blob/main/CLAUDE.md) - Python equivalent

**CLAUDE.md - Curated Lists (for discovering more real projects):**
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) - Links to real projects with CLAUDE.md

**Session Logs - No Public Dataset Exists:**
- Session logs are stored locally at `~/.claude/projects/*.jsonl`
- Users accumulate 100s of MB (privacy-sensitive, proprietary code)
- 30-day auto-deletion by default
- **Must be generated through dogfooding**

**Reference (NOT golden dataset):**
- [Anthropic Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) - Official guidance for what good looks like

### Implementation Notes

#### 1. Golden Dataset Structure

```
.agentlint/
├── eval/
│   ├── golden/
│   │   ├── high-quality/           # Examples of good CLAUDE.md
│   │   │   ├── typescript-monorepo.md
│   │   │   ├── python-ml-project.md
│   │   │   └── rust-cli-tool.md
│   │   ├── low-quality/            # Anti-pattern examples
│   │   │   ├── bloated-instructions.md
│   │   │   ├── contains-secrets.md
│   │   │   └── generic-rules.md
│   │   ├── edge-cases/             # Challenging scenarios
│   │   │   ├── multi-language.md
│   │   │   └── minimal-config.md
│   │   └── manifest.json           # Metadata and expected outcomes
│   ├── outcomes/                   # User outcome tracking
│   │   └── outcomes.db             # SQLite: recommendations + results
│   └── rubrics/                    # Evaluation criteria
│       ├── actionability.md
│       ├── causal-accuracy.md
│       └── relevance.md
```

#### 2. Golden Dataset Schema

```typescript
interface GoldenScenario {
  id: string;
  version: string;
  source: 'public-repo' | 'dogfood' | 'production-failure';

  // Input
  input: {
    claudeMd: string;           // The CLAUDE.md content
    projectType: string;        // e.g., "typescript", "python-ml"
    sessionLogs?: string;       // Optional session log excerpts
  };

  // Expected analysis properties (not exact output)
  expectedProperties: {
    shouldDetect: string[];     // Issues that must be detected
    shouldNotDetect: string[];  // False positives to avoid
    recommendationTypes: ('symptomatic' | 'preventive' | 'systemic')[];
  };

  // Quality rubric weights
  rubricWeights: {
    actionability: number;      // 0-1
    causalAccuracy: number;     // 0-1
    relevance: number;          // 0-1
  };

  // Metadata
  metadata: {
    addedAt: string;
    sourceUrl?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
  };
}
```

#### 3. Three-Tier Grading System

```typescript
interface GraderConfig {
  // Tier 1: Code-based (fast, objective)
  codeBased: {
    enabled: true;
    checks: [
      'output_format_valid',      // JSON schema validation
      'required_fields_present',  // Has recommendations, findings
      'no_hallucinated_files',    // Referenced files exist
      'causal_chain_complete',    // Each finding has traced origin
    ];
  };

  // Tier 2: LLM-as-judge (flexible, nuanced)
  llmJudge: {
    enabled: true;
    model: 'claude-sonnet-4-5';  // Separate from analysis model
    rubrics: {
      actionability: `
        Rate 0-1: Is this recommendation specific enough to implement?
        1.0: Clear action, specific file/line, concrete change
        0.5: Actionable but vague about specifics
        0.0: Too abstract to implement
      `,
      causalAccuracy: `
        Rate 0-1: Does the traced origin actually explain the issue?
        1.0: Clear causal chain from config gap to observed problem
        0.5: Plausible connection but not proven
        0.0: No causal connection or wrong attribution
      `,
    };
  };

  // Tier 3: Human spot-check (gold standard, expensive)
  humanReview: {
    enabled: true;
    frequency: 'weekly';         // Review sample weekly
    sampleSize: 20;              // 20 analyses per review
    reviewers: ['maintainers'];  // Who reviews
  };
}
```

#### 4. Outcome Tracking Schema

```sql
-- Track whether recommendations were implemented and helped
CREATE TABLE recommendation_outcomes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,

  -- The recommendation
  recommendation_type TEXT NOT NULL,  -- 'symptomatic' | 'preventive' | 'systemic'
  recommendation_summary TEXT NOT NULL,

  -- User feedback (opt-in)
  implemented BOOLEAN,               -- Did user implement?
  implementation_date TEXT,

  -- Outcome tracking
  helped BOOLEAN,                    -- Did it help? (user-reported)
  outcome_notes TEXT,                -- Optional user comments

  -- Implicit signals
  config_changed_after BOOLEAN,      -- Did CLAUDE.md change after recommendation?
  similar_issue_recurred BOOLEAN,    -- Did we detect same issue later?

  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- Aggregate metrics
CREATE VIEW outcome_metrics AS
SELECT
  recommendation_type,
  COUNT(*) as total_recommendations,
  SUM(CASE WHEN implemented THEN 1 ELSE 0 END) as implemented_count,
  SUM(CASE WHEN helped THEN 1 ELSE 0 END) as helped_count,
  AVG(CASE WHEN implemented THEN 1.0 ELSE 0.0 END) as implementation_rate,
  AVG(CASE WHEN helped THEN 1.0 ELSE 0.0 END) as success_rate
FROM recommendation_outcomes
WHERE implemented IS NOT NULL
GROUP BY recommendation_type;
```

#### 5. Evaluation Pipeline

```typescript
async function evaluateAnalysis(
  scenario: GoldenScenario,
  analysisOutput: AnalysisOutput
): Promise<EvaluationResult> {
  const results: EvaluationResult = {
    scenarioId: scenario.id,
    timestamp: new Date().toISOString(),
    grades: {},
  };

  // Tier 1: Code-based checks (always run)
  results.grades.codeBased = await runCodeBasedChecks(scenario, analysisOutput);

  // Tier 2: LLM-as-judge (run if code checks pass)
  if (results.grades.codeBased.passed) {
    results.grades.llmJudge = await runLLMJudge(scenario, analysisOutput);
  }

  // Aggregate score
  results.overallScore = calculateOverallScore(results.grades, scenario.rubricWeights);

  // Check against thresholds
  results.passed = results.overallScore >= 0.7;

  return results;
}

function calculateOverallScore(
  grades: Grades,
  weights: RubricWeights
): number {
  // Code-based is pass/fail gate
  if (!grades.codeBased.passed) return 0;

  // LLM judge scores weighted by rubric
  const llm = grades.llmJudge;
  return (
    llm.actionability * weights.actionability +
    llm.causalAccuracy * weights.causalAccuracy +
    llm.relevance * weights.relevance
  );
}
```

#### 6. Feedback Collection (Opt-in)

```typescript
// CLI prompt after analysis
async function promptForFeedback(
  recommendations: Recommendation[]
): Promise<void> {
  const shouldAsk = await userConfig.get('eval.collectFeedback');
  if (!shouldAsk) return;

  console.log('\n📊 Help improve agentlint (optional):');
  console.log('   Which recommendations will you implement?\n');

  for (const rec of recommendations.slice(0, 3)) {
    const response = await prompt({
      type: 'select',
      message: `"${rec.summary}"`,
      choices: [
        { value: 'will-implement', label: 'Will implement' },
        { value: 'maybe', label: 'Maybe later' },
        { value: 'not-relevant', label: 'Not relevant' },
        { value: 'skip', label: 'Skip' },
      ],
    });

    if (response !== 'skip') {
      await trackOutcome(rec.id, response);
    }
  }
}

// Follow-up prompt (days later, if user opted in)
async function promptForOutcome(
  recommendationId: string
): Promise<void> {
  const rec = await getRecommendation(recommendationId);

  const response = await prompt({
    type: 'select',
    message: `Did implementing "${rec.summary}" help?`,
    choices: [
      { value: 'yes', label: 'Yes, it helped' },
      { value: 'somewhat', label: 'Somewhat' },
      { value: 'no', label: 'No improvement' },
      { value: 'skip', label: 'Skip' },
    ],
  });

  if (response !== 'skip') {
    await updateOutcome(recommendationId, { helped: response === 'yes' });
  }
}
```

#### 7. Session Log Dogfooding (Mandatory from MVP)

No public session log dataset exists. Session logs must be accumulated through dogfooding—using agentlint to develop agentlint.

```typescript
// Session log collection configuration
interface DogfoodConfig {
  // Where our own sessions are stored
  sessionLogPath: string;  // ~/.claude/projects/-Users-...-agentlint/

  // Retention settings (override 30-day default)
  retentionSettings: {
    cleanupPeriodDays: 99999;  // Never delete our dogfood data
  };

  // Golden dataset export
  exportConfig: {
    // Scenarios we've manually reviewed and annotated
    annotatedSessions: string[];  // Session IDs with ground truth

    // Automatic capture of interesting patterns
    capturePatterns: {
      errors: true;        // Sessions with errors
      longSessions: true;  // Sessions > 30 min
      multiTool: true;     // Sessions with 10+ tool calls
    };
  };
}

// Script to export session logs to golden dataset
async function exportSessionToGolden(sessionId: string): Promise<void> {
  const sessionPath = path.join(
    os.homedir(),
    '.claude/projects/-Users-...-agentlint/',
    `${sessionId}.jsonl`
  );

  // Parse session log
  const session = await parseSessionLog(sessionPath);

  // Anonymize if needed (remove paths, sanitize)
  const anonymized = anonymizeSession(session);

  // Export to golden dataset
  const goldenPath = path.join(
    '.agentlint/eval/golden/sessions/',
    `dogfood-${sessionId}.json`
  );

  await Bun.write(goldenPath, JSON.stringify({
    id: `dogfood-${sessionId}`,
    source: 'dogfood',
    capturedAt: new Date().toISOString(),
    session: anonymized,
    // Maintainer adds annotations later
    annotations: null,
  }, null, 2));
}
```

**Dogfooding Workflow:**
1. Develop agentlint using Claude Code (accumulates session logs)
2. Extend retention: `~/.claude/settings.json` → `cleanupPeriodDays: 99999`
3. Periodically review sessions for interesting patterns
4. Export selected sessions to golden dataset with annotations
5. Use golden dataset to evaluate agentlint's session analysis

#### 8. CLAUDE.md + Session Log Golden Scenario

```typescript
// agentlint's own CLAUDE.md + session logs become a golden scenario
const DOGFOOD_SCENARIO: GoldenScenario = {
  id: 'dogfood-agentlint',
  version: '1.0',
  source: 'dogfood',

  input: {
    claudeMd: fs.readFileSync('CLAUDE.md', 'utf-8'),
    projectType: 'typescript-cli',
    sessionLogs: getRecentSessions('.claude/projects/agentlint/'),
  },

  expectedProperties: {
    shouldDetect: [],  // We expect high quality - no issues
    shouldNotDetect: ['bloated-config', 'missing-build-commands'],
    recommendationTypes: ['systemic'],  // Only improvement suggestions
  },

  rubricWeights: {
    actionability: 0.4,
    causalAccuracy: 0.3,
    relevance: 0.3,
  },

  metadata: {
    addedAt: new Date().toISOString(),
    difficulty: 'hard',  // Should be perfect
    tags: ['dogfood', 'must-pass'],
  },
};
```

#### 9. Comprehensive Dogfooding (Best-in-Class AI Development)

agentlint's own development practices must be exemplary. If we can't configure our own AI development well, we can't credibly advise others. Everything we build becomes part of the golden dataset.

**What We Dogfood:**

| Artifact | Purpose | Golden Dataset Contribution |
|----------|---------|----------------------------|
| `CLAUDE.md` | Project configuration | Reference example of well-structured config |
| `.claude/commands/` | Custom workflows | Reference implementations of /adr, /commit, etc. |
| `.claude/skills/` | Skill definitions | Examples of focused, effective skills |
| Session logs | Development history | Real patterns, failures, and successes |
| CI/CD workflows | Automation | AI-aware testing, VCR enforcement |
| Documentation | Architecture decisions | ADR structure, design-decisions.md |

**Quality Bar:**
- agentlint's own CLAUDE.md must score 95%+ on our evaluation rubrics
- Zero anti-patterns detected in our configuration
- Session analysis should find no critical issues (only systemic improvements)
- Our CI/CD should exemplify ADR-0011 patterns (VCR, TruLens, enforcement)

**Dogfooding Feedback Loop:**
```
Develop agentlint → Analyze our own config → Find issues → Fix issues →
Improve agentlint → Repeat
```

This creates a virtuous cycle: improving agentlint improves our ability to detect issues, which improves agentlint further.

#### 10. Integration with ADR-0011 (TruLens)

```typescript
// Evaluation results feed into TruLens for release gates
import { TruSession, Feedback } from 'trulens';

async function runReleaseEvals(): Promise<boolean> {
  const session = new TruSession({ database_path: '.agentlint/evals.db' });

  // Load golden scenarios
  const scenarios = await loadGoldenDataset();

  // Run evaluation on each
  const results = await Promise.all(
    scenarios.map(s => evaluateScenario(s))
  );

  // Aggregate metrics
  const metrics = {
    passRate: results.filter(r => r.passed).length / results.length,
    avgActionability: mean(results.map(r => r.grades.llmJudge?.actionability ?? 0)),
    avgCausalAccuracy: mean(results.map(r => r.grades.llmJudge?.causalAccuracy ?? 0)),
  };

  // Log to TruLens
  session.log_record({
    metrics,
    results,
  });

  // Release gate: 80% pass rate required
  return metrics.passRate >= 0.8;
}
```
