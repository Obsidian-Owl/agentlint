# Data Model: Temporal Analysis

> Entity definitions for EP09 Temporal Analysis
> Extends EP03 Persistence Layer types

---

## Entity Overview

| Entity | Description | Storage | New/Extended |
|--------|-------------|---------|--------------|
| `ExtendedBaselineMetrics` | Temporal-specific metrics | JSON (inline) | Extended |
| `BaselineDelta` | Difference between two baselines | Computed | New |
| `DeltaSummary` | Human-readable delta interpretation | Computed | New |
| `TrendAnalysis` | Multi-baseline pattern analysis | Computed | New |
| `MetricTrend` | Single metric over time | Computed | New |
| `QualitativeReview` | Structured qualitative assessment | JSON + SQLite | New |
| `ReviewDimension` | Single qualitative dimension | JSON (inline) | New |
| `RecommendationTracking` | Recommendation implementation status | JSON + SQLite | New |
| `ThresholdConfig` | Configurable significance thresholds | JSON (config) | New |

---

## Entities

### ExtendedBaselineMetrics

Extends `BaselineMetrics` from EP03 with temporal-specific metrics.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| findingsCount | number | Yes | Total number of findings (from EP03) |
| criticalCount | number | Yes | Critical severity findings (from EP03) |
| highCount | number | Yes | High severity findings (from EP03) |
| mediumCount | number | Yes | Medium severity findings (from EP03) |
| lowCount | number | Yes | Low severity findings (from EP03) |
| infoCount | number | Yes | Info severity findings (from EP03) |
| avgTokensPerSession | number | No | Average tokens per session (from EP06) |
| avgIterationsPerSession | number | No | Average iterations per session (from EP06) |
| sessionCount | number | No | Number of sessions analyzed |
| errorRate | number | No | Error rate across sessions (0-1) |
| configTokens | number | No | Token count in ACT config |
| configLines | number | No | Line count in ACT config |
| warningCount | number | No | Config analysis warnings |
| sectionCount | number | No | Distinct sections in config |
| coverageScore | number | No | Config coverage score (0-100) |

**Validation Rules**:
- All counts must be >= 0
- errorRate must be between 0 and 1
- coverageScore must be between 0 and 100

---

### BaselineDelta

Represents the structured difference between two baselines.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fromId | string | Yes | UUID of the older baseline |
| toId | string | Yes | UUID of the newer baseline |
| fromTimestamp | string | Yes | ISO-8601 timestamp of older baseline |
| toTimestamp | string | Yes | ISO-8601 timestamp of newer baseline |
| delta | unknown | Yes | jsondiffpatch delta object |
| summary | DeltaSummary | Yes | Human-readable summary |
| gitCommitsInRange | string[] | No | Commit hashes between baselines |

**Relationships**:
- `BaselineDelta` --N:1--> `Baseline` (from)
- `BaselineDelta` --N:1--> `Baseline` (to)

---

### DeltaSummary

Human-readable interpretation of a delta.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| metricsChanged | MetricChange[] | Yes | List of changed metrics |
| warningsAdded | string[] | Yes | New warnings in the newer baseline |
| warningsResolved | string[] | Yes | Warnings removed in the newer baseline |
| recommendationsAdded | string[] | Yes | New recommendations |
| recommendationsResolved | string[] | Yes | Addressed recommendations |
| trendIndicators | TrendIndicator[] | Yes | Visual trend indicators |
| overallTrend | 'improved' \| 'regressed' \| 'unchanged' | Yes | Aggregate trend direction |

**Nested Type - MetricChange**:
| Field | Type | Description |
|-------|------|-------------|
| name | string | Metric name |
| from | number | Previous value |
| to | number | New value |
| change | number | Absolute change (to - from) |
| percentChange | number | Percentage change |
| direction | '↑' \| '↓' \| '→' | Visual indicator |
| isImprovement | boolean | Whether change is positive |

**Nested Type - TrendIndicator**:
| Field | Type | Description |
|-------|------|-------------|
| metric | string | Metric name |
| indicator | '↑' \| '↓' \| '→' | Direction symbol |
| label | string | Human-readable label |

---

### TrendAnalysis

Multi-baseline pattern analysis over time.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| projectPath | string | Yes | Project being analyzed |
| dateRange | DateRange | Yes | Time range covered |
| baselineCount | number | Yes | Number of baselines analyzed |
| baselineIds | string[] | Yes | UUIDs of included baselines |
| metricTrends | MetricTrend[] | Yes | Trends for each metric |
| inflectionPoints | InflectionPoint[] | No | Points where trends changed |
| correlatedCommits | CorrelatedCommit[] | No | Git commits linked to changes |
| qualitativeTrends | QualitativeTrend[] | No | Sentiment trends from reviews |

**Nested Type - DateRange**:
| Field | Type | Description |
|-------|------|-------------|
| start | string | ISO-8601 start date |
| end | string | ISO-8601 end date |

**Nested Type - InflectionPoint**:
| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | When the trend changed |
| metric | string | Which metric changed |
| beforeDirection | string | Previous trend direction |
| afterDirection | string | New trend direction |
| correlatedChanges | string[] | Possible causes |

**Nested Type - CorrelatedCommit**:
| Field | Type | Description |
|-------|------|-------------|
| hash | string | Git commit hash |
| message | string | Commit message |
| timestamp | string | Commit timestamp |
| filesChanged | string[] | Files modified |
| likelyImpact | 'high' \| 'medium' \| 'low' | Estimated relevance |

---

### MetricTrend

Single metric trend over time.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| metricName | string | Yes | Name of the metric |
| direction | 'improving' \| 'degrading' \| 'volatile' \| 'stable' | Yes | Trend classification |
| values | TimeSeriesPoint[] | Yes | Time series data |
| slope | number | Yes | Linear regression slope |
| meanValue | number | Yes | Average value |
| standardDeviation | number | Yes | Standard deviation |
| firstValue | number | Yes | Oldest value |
| lastValue | number | Yes | Most recent value |
| percentChange | number | Yes | Overall percent change |

**Nested Type - TimeSeriesPoint**:
| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | ISO-8601 timestamp |
| value | number | Metric value |
| baselineId | string | Source baseline UUID |

---

### QualitativeReview

Structured qualitative assessment linked to a baseline.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | UUID v4 identifier |
| baselineId | string | Yes | Linked baseline UUID |
| createdAt | string | Yes | ISO-8601 creation timestamp |
| dimensions | ReviewDimension[] | Yes | Individual dimension assessments |
| overallSentiment | number | Yes | Aggregate sentiment (-2 to +2) |
| themes | string[] | Yes | Extracted themes from responses |
| freeformNotes | string | No | Open-ended user notes |
| triggerReason | 'scheduled' \| 'triggered' \| 'manual' | No | Why this review was conducted |

**Validation Rules**:
- overallSentiment must be between -2 and +2
- dimensions must contain 1-6 entries
- themes array max length 20

**State Transitions**:
- N/A (reviews are immutable once created)

---

### ReviewDimension

Single dimension within a qualitative review.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | ReviewDimensionName | Yes | Dimension identifier |
| promptText | string | Yes | Question asked to user |
| response | string | Yes | User's response text |
| sentiment | number | Yes | Rating (-2 to +2) |
| confidence | 'high' \| 'medium' \| 'low' | No | User's confidence in assessment |

**Enum - ReviewDimensionName**:
- `perceivedFriction` - Friction in AI-assisted work
- `trustCalibration` - How user verifies AI suggestions
- `taskFit` - Task types that work well/poorly
- `configurationConfidence` - Confidence in CLAUDE.md
- `improvementAttribution` - What changes made difference
- `workflowSatisfaction` - Overall satisfaction

**Validation Rules**:
- sentiment must be integer in [-2, -1, 0, 1, 2]
- response must be non-empty

---

### RecommendationTracking

Tracks implementation status of recommendations.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | UUID v4 identifier |
| recommendationId | string | Yes | ID of the recommendation |
| recommendationText | string | Yes | Summary of recommendation |
| status | RecommendationStatus | Yes | Current implementation status |
| detectedAt | string | No | When implementation was detected |
| confirmedAt | string | No | When user confirmed implementation |
| preBaselineId | string | No | Baseline before implementation |
| postBaselineId | string | No | Baseline after implementation |
| effectivenessScore | number | No | Measured effectiveness (0-100) |
| notes | string | No | User notes about implementation |

**Enum - RecommendationStatus**:
- `pending` - Not yet implemented
- `detected_pending_confirm` - Detected but awaiting confirmation
- `implemented` - Confirmed implemented
- `partial` - Partially implemented
- `rejected` - Explicitly declined
- `ineffective` - Implemented but no effect

**State Transitions**:
```
pending → detected_pending_confirm → implemented
                                  → partial
                                  → rejected
pending → implemented (manual)
pending → rejected
implemented → ineffective (based on analysis)
```

---

### ThresholdConfig

User-configurable significance thresholds for trend indicators.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| default | number | Yes | Default threshold (e.g., 0.05 = 5%) |
| metricOverrides | Record<string, number \| MetricThreshold> | No | Per-metric thresholds |

**Nested Type - MetricThreshold**:
| Field | Type | Description |
|-------|------|-------------|
| absolute | number | Absolute value threshold |
| percentage | number | Percentage threshold |
| inverted | boolean | Lower is better (true) or higher is better (false) |

**Example Configuration**:
```json
{
  "default": 0.05,
  "metricOverrides": {
    "warningCount": { "absolute": 1, "inverted": true },
    "tokenUsage": { "percentage": 0.10, "inverted": true },
    "coverageScore": { "percentage": 0.05, "inverted": false }
  }
}
```

---

### QualitativeTrend

Sentiment trend from qualitative reviews over time.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| dimension | ReviewDimensionName | Yes | Which dimension |
| direction | 'improving' \| 'degrading' \| 'stable' | Yes | Trend direction |
| values | SentimentPoint[] | Yes | Time series of sentiment |
| slope | number | Yes | Linear regression slope |
| alignedWithQuantitative | boolean | No | Whether aligned with metrics |
| divergenceNote | string | No | Explanation if diverging |

**Nested Type - SentimentPoint**:
| Field | Type | Description |
|-------|------|-------------|
| timestamp | string | ISO-8601 timestamp |
| sentiment | number | Sentiment value (-2 to +2) |
| reviewId | string | Source review UUID |

---

## Entity Relationships

```
Baseline (EP03) --1:1--> ExtendedBaselineMetrics
Baseline --0:N--> QualitativeReview
Baseline --0:N--> RecommendationTracking
BaselineDelta --N:1--> Baseline (from)
BaselineDelta --N:1--> Baseline (to)
TrendAnalysis --N:N--> Baseline
TrendAnalysis --1:N--> MetricTrend
TrendAnalysis --0:N--> QualitativeTrend
QualitativeReview --1:N--> ReviewDimension
```

---

## Storage Schema

### JSON File Formats

**QualitativeReview** stored at `.agentlint/reviews/{id}.json`:
```json
{
  "version": "1.0.0",
  "review": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "baselineId": "...",
    "createdAt": "2026-01-18T10:30:00Z",
    "dimensions": [
      {
        "name": "perceivedFriction",
        "promptText": "Where do you experience friction?",
        "response": "Context switching between files",
        "sentiment": -1,
        "confidence": "high"
      }
    ],
    "overallSentiment": 0.5,
    "themes": ["context-switching", "file-navigation"],
    "triggerReason": "scheduled"
  }
}
```

**RecommendationTracking** stored at `.agentlint/tracking/{id}.json`:
```json
{
  "version": "1.0.0",
  "tracking": {
    "id": "...",
    "recommendationId": "...",
    "recommendationText": "Add credential guidance to CLAUDE.md",
    "status": "implemented",
    "detectedAt": "2026-01-15T14:00:00Z",
    "confirmedAt": "2026-01-15T14:05:00Z",
    "preBaselineId": "...",
    "postBaselineId": "...",
    "effectivenessScore": 85
  }
}
```

### SQLite Index Schema

Added to `.agentlint/baselines.db`:

```sql
-- Qualitative reviews index
CREATE TABLE IF NOT EXISTS qualitative_reviews (
  id TEXT PRIMARY KEY,
  baseline_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  overall_sentiment REAL NOT NULL,
  themes TEXT, -- JSON array
  trigger_reason TEXT,
  file_path TEXT NOT NULL,
  FOREIGN KEY (baseline_id) REFERENCES baselines(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reviews_baseline_id
  ON qualitative_reviews(baseline_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at
  ON qualitative_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment
  ON qualitative_reviews(overall_sentiment);

-- Recommendation tracking index
CREATE TABLE IF NOT EXISTS recommendation_tracking (
  id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  status TEXT NOT NULL,
  detected_at TEXT,
  confirmed_at TEXT,
  pre_baseline_id TEXT,
  post_baseline_id TEXT,
  effectiveness_score REAL,
  file_path TEXT NOT NULL,
  FOREIGN KEY (pre_baseline_id) REFERENCES baselines(id),
  FOREIGN KEY (post_baseline_id) REFERENCES baselines(id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_recommendation_id
  ON recommendation_tracking(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_tracking_status
  ON recommendation_tracking(status);
```

---

## Migration Notes

### Extending EP03 Baselines

EP03 baselines already exist. EP09 extends without breaking changes:

1. **New metrics are optional**: `ExtendedBaselineMetrics` adds optional fields
2. **No schema version bump needed**: New fields have defaults
3. **Backward compatible reads**: Missing fields treated as undefined
4. **Forward compatible writes**: New baselines include extended metrics

### Version 1.0.0 Schema

- `QualitativeReview` version: 1.0.0
- `RecommendationTracking` version: 1.0.0
- SQLite table versions tracked via `PRAGMA user_version`

---

## References

- [EP03 Persistence Types](../../src/persistence/types.ts)
- [ADR-0008: Baseline Storage](../../docs/architecture/adr/0008-baseline-storage-format-and-strategy.md)
- [spec.md Section 4](./spec.md#4-key-entities)
