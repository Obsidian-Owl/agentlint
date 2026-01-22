# Data Model: Quality & Security

> **Epic**: EP11
> **Created**: 2026-01-20

---

## Entities

### DebugLogger

Structured logging with namespace-based filtering and secret redaction.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| level | `'trace' \| 'debug' \| 'info' \| 'warn' \| 'error'` | Yes | Log level |
| namespace | `string` | Yes | Namespace for filtering (e.g., `agentlint:tools`) |
| timestamp | `string` | Yes | ISO-8601 timestamp |
| message | `string` | Yes | Log message |
| data | `Record<string, unknown>` | No | Structured data (auto-redacted) |
| source | `{ file: string; line: number }` | No | Source location |

**Validation Rules**:
- Namespace must start with `agentlint:` or be `agentlint`
- All data values are passed through redaction before logging

---

### SecretCandidate

Potential secret detected by pattern matching.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Unique identifier (UUID) |
| ruleId | `string` | Yes | Gitleaks rule that matched |
| ruleDescription | `string` | Yes | Human-readable rule description |
| match | `string` | Yes | The actual matched value (INTERNAL ONLY, never exposed) |
| redactedContext | `string` | Yes | Surrounding context with secret redacted |
| entropy | `number` | Yes | Shannon entropy of the matched value |
| location | `FileLocation` | Yes | File path, line, and column |
| keywords | `string[]` | No | Keywords that triggered the match |
| detectedAt | `string` | Yes | ISO-8601 timestamp |

**Validation Rules**:
- `match` field is NEVER serialized, logged, or transmitted
- `entropy` must be >= 0
- `location.line` must be >= 1

---

### ClassifiedSecret

Secret candidate after LLM validation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Same as SecretCandidate.id |
| candidateId | `string` | Yes | Reference to SecretCandidate |
| classification | `SecretClassification` | Yes | Validation result |
| confidence | `number` | Yes | Confidence score (0-1) |
| reasoning | `string` | Yes | LLM's explanation |
| recommendation | `string` | Yes | Suggested action |
| validatedAt | `string` | Yes | ISO-8601 timestamp |

**SecretClassification enum**:
- `confirmed` - High confidence real secret
- `likely` - Probable secret, recommend review
- `unlikely` - Probably false positive
- `false_positive` - Definitely not a secret
- `needs_review` - Agent uncertain, human review needed

**Validation Rules**:
- `confidence` must be between 0 and 1
- `classification` must be valid enum value

---

### GoldenScenario

Test case for evaluation framework.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Unique identifier |
| version | `string` | Yes | Scenario version |
| source | `'public-repo' \| 'dogfood' \| 'production-failure'` | Yes | Where this scenario came from |
| input | `GoldenInput` | Yes | Input data for the scenario |
| expectedProperties | `ExpectedProperties` | Yes | What the analysis should detect |
| rubricWeights | `RubricWeights` | Yes | Weights for evaluation metrics |
| metadata | `ScenarioMetadata` | Yes | Additional context |

**GoldenInput**:
```typescript
{
  claudeMd: string;           // CLAUDE.md content
  projectType: string;        // e.g., "typescript", "python-ml"
  sessionLogs?: string;       // Optional session log excerpts
}
```

**ExpectedProperties**:
```typescript
{
  shouldDetect: string[];     // Issues that must be detected
  shouldNotDetect: string[];  // False positives to avoid
  recommendationTypes: ('symptomatic' | 'preventive' | 'systemic')[];
}
```

**RubricWeights**:
```typescript
{
  actionability: number;      // 0-1
  causalAccuracy: number;     // 0-1
  relevance: number;          // 0-1
}
```

**ScenarioMetadata**:
```typescript
{
  addedAt: string;            // ISO-8601
  sourceUrl?: string;         // Original source
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}
```

---

### EvaluationResult

Output of quality evaluation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Unique identifier |
| scenarioId | `string` | Yes | Reference to GoldenScenario |
| timestamp | `string` | Yes | ISO-8601 timestamp |
| grades | `EvaluationGrades` | Yes | Tier-by-tier grades |
| overallScore | `number` | Yes | Aggregated score (0-1) |
| passed | `boolean` | Yes | Whether evaluation passed threshold |

**EvaluationGrades**:
```typescript
{
  codeBased: {
    passed: boolean;
    checks: Record<string, boolean>;
  };
  llmJudge?: {
    actionability: number;
    causalAccuracy: number;
    relevance: number;
    reasoning: Record<string, string>;
  };
}
```

**Validation Rules**:
- `overallScore` must be between 0 and 1
- `llmJudge` only populated if `codeBased.passed` is true

---

### SessionCheckpoint

Extended from EP02 for session recording and replay.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| version | `'1.0'` | Yes | Schema version |
| sessionId | `string` | Yes | Session identifier |
| timestamp | `string` | Yes | ISO-8601 timestamp |
| sequence | `number` | Yes | Checkpoint sequence number |
| phase | `AnalysisPhase` | Yes | Current analysis phase |
| trigger | `CheckpointTrigger` | Yes | What triggered this checkpoint |
| toolHistory | `ToolHistoryEntry[]` | Yes | Tool call history (redacted) |
| findings | `FindingSummary[]` | Yes | Current findings |
| metrics | `SessionMetrics` | Yes | Performance metrics |

**AnalysisPhase enum**:
- `init` - Initialization
- `scan` - File scanning
- `analyze` - Analysis in progress
- `recommend` - Generating recommendations
- `complete` - Analysis complete

**ToolHistoryEntry**:
```typescript
{
  tool: string;
  arguments: Record<string, unknown>;  // Redacted
  resultSummary: string;               // Truncated/redacted
  timestamp: string;
  durationMs: number;
}
```

**SessionMetrics**:
```typescript
{
  toolCalls: number;
  llmCalls: number;
  tokensUsed: number;
  elapsedMs: number;
}
```

---

### RecommendationOutcome

Tracked implementation feedback.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | `string` | Yes | Unique identifier |
| sessionId | `string` | Yes | Analysis session reference |
| recommendationId | `string` | Yes | Recommendation reference |
| recommendationType | `'symptomatic' \| 'preventive' \| 'systemic'` | Yes | Type of recommendation |
| recommendationSummary | `string` | Yes | Brief description |
| implemented | `boolean \| null` | No | User-reported implementation |
| implementationDate | `string \| null` | No | When implemented (ISO-8601) |
| helped | `boolean \| null` | No | User-reported effectiveness |
| outcomeNotes | `string \| null` | No | User comments |
| configChangedAfter | `boolean \| null` | No | Implicit signal: config changed |
| similarIssueRecurred | `boolean \| null` | No | Implicit signal: same issue later |
| createdAt | `string` | Yes | ISO-8601 timestamp |
| updatedAt | `string \| null` | No | Last update timestamp |

**Validation Rules**:
- `recommendationType` must be valid enum value
- `helped` should only be set if `implemented` is true

---

## Shared Types

### FileLocation

```typescript
interface FileLocation {
  file: string;     // Absolute or relative path
  line: number;     // 1-indexed line number
  column?: number;  // 0-indexed column (optional)
}
```

### RedactionPattern

```typescript
interface RedactionPattern {
  pattern: RegExp;
  replacement: (match: string, ruleId?: string) => string;
}

// Default replacement: [REDACTED:type:len=N]
```

---

## Entity Relationships

```
SecretCandidate --1:1--> ClassifiedSecret
  (after LLM validation)

GoldenScenario --1:N--> EvaluationResult
  (one scenario, many evaluation runs)

SessionCheckpoint --N:1--> AnalysisSession
  (many checkpoints per session)

RecommendationOutcome --N:1--> Recommendation
  (many outcomes tracked per recommendation type)
```

---

## Storage Schemas

### Outcomes Database (SQLite)

```sql
CREATE TABLE recommendation_outcomes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  recommendation_summary TEXT NOT NULL,
  implemented INTEGER,  -- 0/1/NULL
  implementation_date TEXT,
  helped INTEGER,       -- 0/1/NULL
  outcome_notes TEXT,
  config_changed_after INTEGER,
  similar_issue_recurred INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX idx_outcomes_session ON recommendation_outcomes(session_id);
CREATE INDEX idx_outcomes_type ON recommendation_outcomes(recommendation_type);
```

### Evaluations Database (SQLite)

```sql
CREATE TABLE evaluation_results (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  overall_score REAL NOT NULL,
  passed INTEGER NOT NULL,
  grades_json TEXT NOT NULL,  -- JSON blob
  FOREIGN KEY (scenario_id) REFERENCES golden_scenarios(id)
);

CREATE TABLE golden_scenarios (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  source TEXT NOT NULL,
  input_json TEXT NOT NULL,
  expected_json TEXT NOT NULL,
  rubric_weights_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE INDEX idx_evals_scenario ON evaluation_results(scenario_id);
CREATE INDEX idx_evals_timestamp ON evaluation_results(timestamp);
```

---

## State Transitions

### SecretCandidate Lifecycle

```
[Detected] --> [Validated] --> [Classified]
    |              |               |
    v              v               v
  Created     LLM validates    Final state:
  by regex    context          confirmed/likely/
                               unlikely/false_positive/
                               needs_review
```

### SessionCheckpoint Phases

```
init --> scan --> analyze --> recommend --> complete
  |        |         |            |            |
  v        v         v            v            v
Setup   File      Analysis    Generate     Done
config  discovery  running    recs
```

### EvaluationResult Grading

```
[Code-based checks]
        |
        v
    Pass? --No--> [Grade: failed, skip LLM]
        |
       Yes
        |
        v
[LLM-as-judge evaluation]
        |
        v
[Calculate overall score]
        |
        v
    >= 70%? --No--> [Grade: failed]
        |
       Yes
        |
        v
    [Grade: passed]
```
