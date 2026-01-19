# Research Findings: Temporal Analysis

> Research conducted during /dev.plan Phase 1
> Date: 2026-01-18

---

## Decision Log

### 1. Delta Calculation Library: jsondiffpatch

**Decision**: Use [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) for baseline comparison.

**Rationale**:
- Well-maintained, 1.5k+ GitHub stars
- Produces reversible deltas (can unpatch)
- Handles nested objects and arrays with move detection
- Provides multiple output formatters (annotated, jsonpatch RFC 6902)
- Used successfully in EP03 comparison placeholder

**Alternatives Considered**:
- **deep-diff**: Less maintained, no array move detection
- **rfc6902**: Only produces patch, not reversible
- **Custom diff**: Over-engineering for MVP

**Implementation Pattern**:
```typescript
import * as jsondiffpatch from 'jsondiffpatch';

// Configure for baseline objects with ID matching
const diffpatcher = jsondiffpatch.create({
  objectHash: (obj: unknown) => {
    const typedObj = obj as { id?: string };
    return typedObj.id ?? JSON.stringify(obj);
  },
  arrays: {
    detectMove: true,
    includeValueOnMove: false,
  },
});

// Calculate delta
const delta = diffpatcher.diff(baseline1, baseline2);

// Get annotated output for agent consumption
const annotated = jsondiffpatch.formatters.annotated.format(delta, baseline1);
```

**References**:
- [jsondiffpatch README](https://github.com/benjamine/jsondiffpatch/blob/master/README.md)
- [Delta Format Documentation](https://github.com/benjamine/jsondiffpatch/blob/master/docs/deltas.md)
- [npm Package](https://www.npmjs.com/package/jsondiffpatch)

---

### 2. Trend Calculation Algorithm

**Decision**: Use simple linear regression for trend direction with configurable significance thresholds.

**Rationale**:
- Linear regression provides clear slope direction (positive/negative/flat)
- Simple to implement without additional dependencies
- Sufficient for MVP temporal analysis needs
- More sophisticated algorithms (ARIMA, exponential smoothing) are over-engineering

**Implementation Pattern**:
```typescript
interface MetricTrend {
  metricName: string;
  direction: 'improving' | 'degrading' | 'volatile' | 'stable';
  values: Array<{ timestamp: string; value: number }>;
  slope: number;
  confidence: number;
}

function calculateSlope(values: number[]): number {
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function classifyTrend(
  slope: number,
  values: number[],
  threshold: number = 0.05
): 'improving' | 'degrading' | 'volatile' | 'stable' {
  const variance = calculateVariance(values);
  const meanAbsSlope = Math.abs(slope) / Math.max(...values);

  // High variance with no clear direction = volatile
  if (variance > threshold * 2 && meanAbsSlope < threshold) {
    return 'volatile';
  }

  // Clear direction above threshold
  if (meanAbsSlope > threshold) {
    // For metrics where lower is better (e.g., errors, warnings)
    return slope < 0 ? 'improving' : 'degrading';
  }

  return 'stable';
}
```

**Metric Polarity**:
| Metric | Lower is Better | Higher is Better |
|--------|-----------------|------------------|
| warningCount | ✓ | |
| errorRate | ✓ | |
| avgIterationsPerSession | ✓ | |
| configTokens | ✓ | |
| coverageScore | | ✓ |
| avgTokensPerSession | context-dependent | context-dependent |

---

### 3. Qualitative Review Dimensions

**Decision**: Implement 6 core dimensions based on developer experience research.

**Rationale**:
- Dimensions derived from established frameworks (DX, LinearB, Martin Fowler)
- Covers leading, lagging, qualitative, and causal signal types
- Balanced between depth and user friction
- Can be extended in future versions

**Dimensions**:

| Dimension | Prompt Focus | Signal Type | Sentinel Metric |
|-----------|--------------|-------------|-----------------|
| **Perceived Friction** | Where do you experience friction in AI-assisted work? | Leading | avgIterationsPerSession |
| **Trust Calibration** | How often do you verify AI suggestions before accepting? | Qualitative | None (subjective) |
| **Task Fit** | What types of tasks work well/poorly with AI assistance? | Causal | Task completion rate |
| **Configuration Confidence** | How confident are you in your current CLAUDE.md? | Leading | warningCount |
| **Improvement Attribution** | What changes made the biggest difference recently? | Causal | Delta between baselines |
| **Workflow Satisfaction** | Overall, how satisfied are you with your AI workflow? | Lagging | Composite score |

**Prompt Templates**:
```typescript
const DIMENSION_PROMPTS: Record<ReviewDimension, string> = {
  perceivedFriction: `
    Thinking about your recent AI-assisted coding sessions:
    - Where do you experience the most friction?
    - What tasks take more iterations than expected?
    - What do you find yourself repeatedly correcting?

    Rate your overall friction level:
    -2 (very high friction) to +2 (very low friction)
  `,
  trustCalibration: `
    How do you interact with AI suggestions?
    - How often do you accept suggestions without review?
    - How often do you verify before accepting?
    - Has your trust level changed recently?

    Rate your trust calibration:
    -2 (never trust) to +2 (always trust)
  `,
  // ... etc
};
```

**References**:
- [DX AI Measurement Framework](https://getdx.com/research/measuring-ai-code-assistants-and-agents/)
- [LinearB AI Measurement Framework](https://linearb.io/blog/ai-measurement-framework)
- [Martin Fowler: Measuring Developer Productivity via Humans](https://martinfowler.com/articles/measuring-developer-productivity-humans.html)

---

### 4. Existing EP03 Baseline Structure

**Finding**: EP03 already provides baseline storage infrastructure. EP09 extends rather than replaces.

**Current `Baseline` Type** (from `src/persistence/types.ts`):
```typescript
interface Baseline {
  id: string;
  version: string;
  createdAt: string;
  projectPath: string;
  actType: string;
  configPath: string | null;
  gitCommit: string | null;
  metrics: BaselineMetrics;
  findings: Finding[];
  label: string | null;
  notes: string | null;
}

interface BaselineMetrics {
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
}
```

**Extensions Needed for EP09**:
```typescript
// Extended metrics for temporal analysis
interface ExtendedBaselineMetrics extends BaselineMetrics {
  // From EP06 session analysis
  avgTokensPerSession?: number;
  avgIterationsPerSession?: number;
  sessionCount?: number;
  errorRate?: number;

  // Config metrics
  configTokens?: number;
  configLines?: number;
  warningCount?: number;
  sectionCount?: number;
  coverageScore?: number;
}

// New entity for qualitative reviews
interface QualitativeReview {
  id: string;
  baselineId: string;
  createdAt: string;
  dimensions: ReviewDimension[];
  overallSentiment: number; // -2 to +2
  themes: string[];
  freeformNotes?: string;
}
```

**Decision**: Create new types in `src/temporal/types.ts` that extend EP03 types. Don't modify EP03 directly.

---

### 5. Tool Registration Pattern

**Finding**: EP02 establishes tool pattern via `tool()` from SDK with Zod schemas.

**Reference Pattern** (from ADR-0005):
```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export const queryBaselineTool = tool(
  "query_baseline",
  `Query a baseline snapshot by ID or retrieve the latest.

   Use this tool when you need to:
   - Get the most recent baseline for comparison
   - Retrieve a specific historical baseline
   - Access baseline metrics for trend analysis

   Returns structured baseline data with metrics and optional full findings.`,
  {
    id: z.string()
      .optional()
      .describe("Baseline UUID, or omit for 'latest'"),
    includeFindings: z.boolean()
      .optional()
      .default(false)
      .describe("Include full findings array (increases response size)"),
  },
  async (args) => {
    const result = await queryBaseline(args);
    return handleToolResult(result);
  }
);
```

**Decision**: Follow this pattern exactly for all EP09 tools.

---

### 6. SQLite Index Extension

**Finding**: EP03 uses SQLite for baseline indexing. EP09 needs review indexing.

**Existing Schema** (from `src/persistence/baselines/indexer.ts`):
```sql
CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  project_path TEXT NOT NULL,
  act_type TEXT NOT NULL,
  git_commit TEXT,
  label TEXT,
  file_path TEXT NOT NULL,
  -- Metrics for fast querying
  findings_count INTEGER NOT NULL,
  critical_count INTEGER NOT NULL,
  high_count INTEGER NOT NULL,
  medium_count INTEGER NOT NULL,
  low_count INTEGER NOT NULL,
  info_count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_baselines_created_at ON baselines(created_at);
```

**New Schema for Reviews**:
```sql
CREATE TABLE IF NOT EXISTS qualitative_reviews (
  id TEXT PRIMARY KEY,
  baseline_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  overall_sentiment REAL NOT NULL,
  themes TEXT, -- JSON array
  file_path TEXT NOT NULL,
  FOREIGN KEY (baseline_id) REFERENCES baselines(id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_baseline_id ON qualitative_reviews(baseline_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON qualitative_reviews(created_at);
```

**Decision**: Add review tables to `baselines.db`. Create new indexer module `src/persistence/reviews/indexer.ts`.

---

### 7. Subagent Pattern Reference

**Finding**: EP08 establishes subagent pattern for context isolation.

**Reference** (from `src/act/instructions/claude-code.ts`):
```typescript
const temporalAnalyzerSubagent: AgentDefinition = {
  description: "Analyze workflow trends across baselines and qualitative reviews",
  prompt: `You are a temporal analysis specialist for agentlint.

Your role is to:
1. Query baselines and calculate deltas
2. Identify trends across multiple snapshots
3. Facilitate qualitative review sessions
4. Correlate changes with outcomes

Available tools: query_baseline, list_baselines, calculate_delta,
query_trends, conduct_review, get_review_history

Always structure findings for the main orchestrator.`,
  tools: [
    'query_baseline',
    'list_baselines',
    'calculate_delta',
    'query_trends',
    'conduct_review',
    'get_review_history'
  ],
  model: 'inherit',
};
```

**Decision**: Implement as P2 feature. Main orchestrator works without subagent in P1.

---

## Open Research Items

All research items are resolved. Ready for Phase 2 design artifacts.

---

## Sources

- [jsondiffpatch GitHub](https://github.com/benjamine/jsondiffpatch)
- [jsondiffpatch npm](https://www.npmjs.com/package/jsondiffpatch)
- [DX AI Measurement Framework](https://getdx.com/research/measuring-ai-code-assistants-and-agents/)
- [LinearB AI Measurement Framework](https://linearb.io/blog/ai-measurement-framework)
- [Martin Fowler: Measuring Developer Productivity via Humans](https://martinfowler.com/articles/measuring-developer-productivity-humans.html)
- [Claude Agent SDK Documentation](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [ADR-0005: Tool Definition Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
- [ADR-0008: Baseline Storage](../../docs/architecture/adr/0008-baseline-storage-format-and-strategy.md)
