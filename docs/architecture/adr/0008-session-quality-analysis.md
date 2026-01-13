---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0008: Session Quality Analysis Methodology

## Context and Problem Statement

agentlint needs to analyze AI coding assistant session logs for effectiveness, quality, and improvement opportunities. ADR-0007 addresses causal tracing (finding the origin of specific issues), but holistic session quality analysis is a distinct concern that requires its own methodology.

Key questions this ADR addresses:
1. Is AI configuration being used effectively?
2. Are user prompts effective?
3. Are hooks, scripts, and automation triggering correctly?
4. How do we measure session health and identify improvement opportunities?

## Decision Drivers

- **Static-First principle**: Maximize static analysis; runs concurrently with LLM per ADR-0019
- **Progressive Value principle**: Provide useful metrics without requiring LLM configuration
- **Agent-Aware principle**: Measure agent cognitive health as a first-class concern
- **Improvement-Oriented principle**: Enable cross-session learning and trend analysis
- **Scalability**: Handle 100MB+ session logs efficiently (leverage ADR-0007 infrastructure)

## Considered Options

1. Statistical Analysis Only (Static)
2. LLM-First Deep Analysis
3. Layered Static + Optional LLM

## Decision Outcome

Chosen option: **"Layered Static + Optional LLM"** because it aligns with Static-First and Progressive Value principles while enabling deep semantic analysis when LLM is configured. The layered approach builds on ADR-0007's infrastructure (streaming parser, FTS5 indexing) and adds quality-focused analysis dimensions.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION ANALYSIS PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Streaming Parse + Index (ADR-0007)                    │
│  • Parse JSONL line-by-line without loading full log            │
│  • Extract metadata: timestamps, roles, tool_calls, tokens      │
│  • Index in SQLite with FTS5 for searchability                  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Statistical Analysis (Static, No LLM)                 │
│  • Compute outcome metrics (completion, efficiency)             │
│  • Compute cognitive health signals (backtracking, confusion)   │
│  • Compute automation health (hook triggers, test runs)         │
│  • Store aggregates in SQLite for trend analysis                │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: Cross-Reference Analysis (Static)                     │
│  • Load config rules → compare to session actions               │
│  • Detect compliance, violations, unused guidance               │
│  • Identify prompt patterns (effective vs. ineffective)         │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: Pattern Detection (Static + Optional LLM)             │
│  • Detect failure mode patterns (hallucination, scope creep)    │
│  • Identify cross-session trends                                │
│  • LLM: Semantic analysis of unclear cases                      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: Recommendations (LLM Synthesis)                       │
│  • Generate improvement suggestions for config                  │
│  • Suggest prompt improvements for users                        │
│  • Flag automation gaps                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Consequences

**Good:**
- Progressive Value: Layers 1-3 work without LLM (immediate value)
- Leverages ADR-0007 infrastructure (no duplication)
- Comprehensive coverage of quality dimensions
- Cross-session learning enables improvement tracking
- Static-First minimizes API costs

**Bad:**
- More complexity than statistical-only approach
- Cross-reference analysis requires parsing both config and sessions
- Pattern detection heuristics may have false positives

**Neutral:**
- LLM layers optional but recommended for deep insights
- Some metrics require session segmentation (heuristic-based)

## Analysis Dimensions

Session quality analysis covers six distinct dimensions:

### A. Outcome Metrics (Did it work?)

| Metric | Source | Computation |
|--------|--------|-------------|
| Task completion rate | Session end state | % sessions with success indicators |
| Iteration efficiency | Turn counts | Turns per successful task |
| Token efficiency | Token counts | Output tokens / input tokens ratio |
| Time to completion | Timestamps | Duration from task start to success |

### B. Agent Cognitive Health (Is the agent struggling?)

| Metric | Source | Computation |
|--------|--------|-------------|
| Context window pressure | Token counts | Peak usage / model limit |
| Tool success ratio | Tool results | Successes / (successes + failures) |
| Backtracking rate | Content analysis | Undo/redo patterns detected |
| Repeated exploration | File read patterns | Same file read >N times per session |
| Confusion signals | Content patterns | "I'm not sure", "Could you clarify" frequency |

### C. Configuration Effectiveness (Is config working?)

| Metric | Source | Computation |
|--------|--------|-------------|
| Instruction compliance | Cross-reference config + actions | % actions aligned with documented rules |
| Context utilization | Session patterns | Is known context being used vs. re-discovered? |
| Rule violation rate | Cross-reference | Violations / total relevant actions |
| Terminology alignment | Content analysis | Project-specific terms used correctly |

### D. Prompt Quality (Are users prompting well?)

| Metric | Source | Computation |
|--------|--------|-------------|
| First-try success rate | Iteration counts | % tasks completed in 1-2 turns |
| Clarification frequency | Content patterns | Clarification requests / tasks |
| Correction frequency | Content patterns | "No, I meant..." / tasks |
| Prompt specificity | Content analysis | Vague vs. specific language indicators |

### E. Automation Health (Is tooling working?)

| Metric | Source | Computation |
|--------|--------|-------------|
| Hook trigger rate | Tool results | Hooks run / expected triggers |
| Hook success rate | Tool results | Hook successes / hook runs |
| Test execution rate | Tool calls | Test runs / code changes |
| Lint feedback rate | Tool results | Lint output present / code changes |

### F. Cross-Session Learning (Is it improving?)

| Metric | Source | Computation |
|--------|--------|-------------|
| Repeated pattern resolution | Session comparison | Same issues recurring across sessions? |
| Efficiency trend | Historical metrics | Iterations decreasing over time? |
| Error recurrence | Issue tracking | Same errors returning? |

## Signal Extraction Approach

### Session Log Format (Claude Code Primary)

```jsonl
{"timestamp": "2026-01-12T10:30:00Z", "role": "user", "content": "...", "token_count": 150}
{"timestamp": "2026-01-12T10:30:05Z", "role": "assistant", "content": "...", "tool_calls": [...], "token_count": 2400}
```

**Key Fields Extracted**:
- `timestamp` - Interaction timing
- `role` - user/assistant/system
- `content` - Message text (indexed for FTS5 search, not fully loaded)
- `tool_calls` - Tools invoked (Read, Write, Bash, Edit, Glob, Grep, etc.)
- `tool_results` - Outcomes of tool calls (success/failure/error)
- Token counts (input/output)
- Model identifier
- Session metadata (project, duration)

### Static Extraction (No LLM Required)

```typescript
interface SessionMetrics {
  // Outcome
  turnCount: number;
  tokenInput: number;
  tokenOutput: number;
  durationSeconds: number;

  // Cognitive Health
  toolCalls: Record<string, number>;  // {"Read": 12, "Write": 5, ...}
  toolSuccesses: number;
  toolFailures: number;
  fileReadsPerFile: Record<string, number>;  // Repeated exploration detection

  // Automation
  hookTriggersDetected: number;
  hookSuccesses: number;
  hookFailures: number;
  testRunsDetected: number;
  lintOutputDetected: boolean;
}
```

## Cross-Reference Analysis

### Configuration Effectiveness Detection

**Approach**:
1. Parse AI configuration files (CLAUDE.md, .cursorrules, etc.) → extract rules/instructions
2. Parse session logs → extract agent actions and tool usage
3. Cross-reference: Does observed behavior align with documented expectations?
4. Flag: Misalignments, violations, unused guidance

**Detection Signals**:

| Signal | Detection Method | Interpretation |
|--------|------------------|----------------|
| Config reference | Agent content contains quotes from config | Config is being read |
| Instruction compliance | Actions match documented patterns | Config is effective |
| Repeated exploration | Same files read multiple times across sessions | Config may be missing guidance |
| Terminology alignment | Agent uses project-specific terms from config | Context is understood |
| Constraint violations | Actions violate documented constraints | Config not followed or unclear |

### Prompt Effectiveness Detection

**Approach**:
1. Segment sessions by task (heuristics: topic change, explicit markers, time gaps)
2. Count turns per task, correction patterns, clarification requests
3. Identify which prompt structures correlate with success vs. failure
4. Generate prompt improvement recommendations

**Detection Signals**:

| Signal | Pattern | Interpretation |
|--------|---------|----------------|
| High iteration count | >5 turns for simple task | Prompt was unclear |
| Clarification requests | "Could you clarify...", "Do you mean..." | Ambiguity in prompt |
| User corrections | "No, I meant...", "That's not what I wanted" | Misunderstanding |
| Backtracking | Agent undoes previous work | Initial direction was wrong |
| Scope creep | Files modified >> files mentioned | Prompt too broad |

### Automation Health Detection

**Approach**:
1. Detect expected automation from project config (package.json scripts, .pre-commit-config.yaml, etc.)
2. Scan sessions for automation trigger points (git commit, file save, npm commands)
3. Check: Was expected output present after trigger?
4. Flag: Missing automation, silent failures, misconfiguration

**Detection Signals**:

| Signal | Detection Method | Interpretation |
|--------|------------------|----------------|
| Hook output presence | Tool results contain hook patterns | Hooks are running |
| Hook failures | Error patterns in tool results | Hooks failing |
| Missing hook runs | Commit without expected output | Hooks not configured |
| Test execution | Test command in tool_calls | Tests running |
| Lint feedback | Lint warnings/errors in output | Linter active |

## Failure Mode Detection

Common AI coding agent failure modes to detect:

| Failure Mode | Detection Signal | Session Log Indicator |
|--------------|------------------|----------------------|
| **Hallucination** | References non-existent APIs/files | Tool failures after confident assertions |
| **Context loss** | Forgetting earlier conversation | Re-asking same questions within session |
| **Scope creep** | Modifying unrelated files | Files changed >> files explicitly requested |
| **Overconfidence** | Wrong with high certainty | Failures following confident language patterns |
| **Model mismatch** | Wrong model for task complexity | Complex task + simple model = many iterations |
| **Prompt ambiguity** | Multiple interpretations | Clarification requests, corrections |
| **Config ignorance** | Not following documented rules | Actions violate config constraints |

### Detection Implementation

```typescript
interface FailureModeDetection {
  mode: 'hallucination' | 'context_loss' | 'scope_creep' | 'overconfidence' |
        'model_mismatch' | 'prompt_ambiguity' | 'config_ignorance';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];  // Specific log excerpts
  sessionId: string;
  timestamp: Date;
}
```

## Output Schema

### Session Quality Report

```typescript
interface SessionQualityReport {
  sessionId: string;
  analyzedAt: Date;

  // Dimension Scores (0-100)
  scores: {
    outcome: number;
    cognitiveHealth: number;
    configEffectiveness: number;
    promptQuality: number;
    automationHealth: number;
  };

  // Raw Metrics
  metrics: SessionMetrics;

  // Detected Issues
  failureModes: FailureModeDetection[];
  configViolations: ConfigViolation[];
  promptIssues: PromptIssue[];
  automationGaps: AutomationGap[];

  // Recommendations
  recommendations: Recommendation[];
}
```

### Aggregate Quality Metrics (Cross-Session)

```typescript
interface QualityTrend {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;

  // Trend Direction
  trends: {
    outcome: 'improving' | 'stable' | 'declining';
    cognitiveHealth: 'improving' | 'stable' | 'declining';
    configEffectiveness: 'improving' | 'stable' | 'declining';
    promptQuality: 'improving' | 'stable' | 'declining';
    automationHealth: 'improving' | 'stable' | 'declining';
  };

  // Recurring Issues
  persistentFailures: FailureModeDetection[];
  resolvedIssues: string[];  // Issues that stopped recurring
}
```

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All analysis runs locally on session logs |
| II. Improvement-Oriented | Yes | Cross-session learning enables trend tracking |
| III. Causal-First | Partial | Builds on ADR-0007 for issue tracing |
| IV. Mixed-Methods | Yes | Quantitative metrics + qualitative pattern detection |
| V. Language-Agnostic | Yes | Session analysis independent of code language |
| VI. Tool-Agnostic | Yes | Adapter pattern supports multiple AI tools |
| VII. Static-First | Yes | Layers 1-3 are fully static |
| VIII. Progressive Value | Yes | Useful metrics without LLM configuration |
| IX. Agent-Aware | Yes | Cognitive health is a primary analysis dimension |

## More Information

### Related Documents
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - SQLite + FTS5 foundation
- [ADR-0006: Agentic Analysis Implementation](./0006-agentic-analysis-implementation.md) - LLM integration patterns
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md) - Infrastructure reuse
- [ADR-0019: Language Ecosystem Support](./0019-language-ecosystem-support.md) - Language metrics complement session quality analysis
- Design Questions: [Section 2.3 - Session Log Analysis Strategy](../../design-questions.md#23-session-log-analysis-strategy)

### Research Sources
- [State of AI Code Quality 2025 - Qodo](https://www.qodo.ai/reports/state-of-ai-code-quality/) - Industry metrics
- [AI Copilot Code Quality Research - GitClear](https://www.gitclear.com/ai_assistant_code_quality_2025_research) - Quality signals
- [Measuring AI Code Assistants - GetDX](https://getdx.com/research/measuring-ai-code-assistants-and-agents/) - Measurement frameworks
- [AI Agent Observability - Logz.io](https://logz.io/glossary/ai-agent-observability/) - Observability patterns
- [Evaluation of LLM Agents Survey](https://arxiv.org/html/2507.21504v1) - Academic evaluation frameworks
- [DORA Report 2025](https://www.faros.ai/blog/key-takeaways-from-the-dora-report-2025) - DevOps metrics

### Implementation Notes

#### 1. Session Segmentation

Sessions need to be segmented into discrete tasks for per-task metrics:

```typescript
interface TaskSegment {
  startIndex: number;
  endIndex: number;
  turnCount: number;
  topic: string;  // Inferred or explicit
  outcome: 'success' | 'partial' | 'abandoned' | 'unknown';
}

// Segmentation heuristics:
// 1. Explicit markers: "Let's move on to...", "New task:"
// 2. Topic change: Significant shift in file/domain focus
// 3. Time gaps: >30 minute pause between messages
// 4. User-initiated: "Done with that, now..."
```

#### 2. Database Schema Additions

Extends ADR-0003 schema:

```sql
-- Session quality metrics
CREATE TABLE session_quality (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  analyzed_at TEXT NOT NULL,

  -- Dimension scores
  score_outcome REAL,
  score_cognitive_health REAL,
  score_config_effectiveness REAL,
  score_prompt_quality REAL,
  score_automation_health REAL,

  -- Raw metrics (JSON)
  metrics JSON,

  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Detected failure modes
CREATE TABLE failure_modes (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  confidence TEXT NOT NULL,
  evidence JSON,
  detected_at TEXT NOT NULL,

  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Config compliance tracking
CREATE TABLE config_compliance (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'compliant', 'violated', 'unused'
  evidence JSON,

  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

#### 3. Cross-Reference Analysis Flow

```typescript
async function analyzeConfigEffectiveness(
  sessionId: string,
  config: ParsedConfig
): Promise<ConfigEffectivenessReport> {
  // 1. Extract rules from config
  const rules = extractRules(config);

  // 2. Query session actions from index
  const actions = await querySessionActions(sessionId);

  // 3. Cross-reference
  const compliance = rules.map(rule => ({
    rule,
    status: checkCompliance(rule, actions),
    evidence: findEvidence(rule, actions),
  }));

  // 4. Compute metrics
  return {
    complianceRate: compliance.filter(c => c.status === 'compliant').length / rules.length,
    violations: compliance.filter(c => c.status === 'violated'),
    unusedRules: compliance.filter(c => c.status === 'unused'),
  };
}
```
