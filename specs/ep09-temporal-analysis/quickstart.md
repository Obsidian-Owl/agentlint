# Quickstart: Temporal Analysis

> Get started with agentlint's temporal analysis features

---

## Prerequisites

- agentlint installed and configured
- At least one analysis session completed (for baseline data)
- (Optional) Git repository for change correlation

---

## Core Workflow

Temporal analysis follows the continuous improvement cycle:

```
BASELINE → CHANGE → OBSERVE → UNDERSTAND → REFINE → (repeat)
```

### Step 1: Establish Your First Baseline

After running an analysis, capture a baseline snapshot:

```bash
# Via CLI
agentlint baseline --label "Initial baseline"

# The agent will also capture baselines automatically during analysis
```

**What's captured:**
- Finding counts by severity
- Configuration metrics (tokens, lines, warnings)
- Session statistics (if EP06 data available)
- Git commit for correlation

### Step 2: Make Changes

Improve your workflow based on analysis findings:
- Update CLAUDE.md configuration
- Add missing guidance sections
- Address high-priority recommendations

### Step 3: Capture a New Baseline

After making changes:

```bash
agentlint baseline --label "Post-CLAUDE.md update"
```

### Step 4: Compare Baselines

See what improved or regressed:

```bash
# Compare latest to previous
agentlint compare

# Compare specific baselines
agentlint compare --from <baseline-id> --to <baseline-id>
```

**Output includes:**
- Trend indicators: ↑ improved, ↓ regressed, → stable
- Metric changes with percentages
- Warnings added/resolved
- Git commits in the date range

### Step 5: Track Trends Over Time

Once you have 3+ baselines:

```bash
agentlint trends
```

**Output includes:**
- Trend direction for each metric
- Inflection points (when trends changed)
- Correlation with git commits
- Qualitative trend comparison (if reviews exist)

---

## Qualitative Reviews

Capture context that metrics can't reveal:

```bash
# Start a qualitative review
agentlint review
```

The agent guides you through 6 dimensions:
1. **Perceived Friction** - Where do you experience friction?
2. **Trust Calibration** - How often do you verify AI suggestions?
3. **Task Fit** - What tasks work well/poorly?
4. **Configuration Confidence** - How confident in your CLAUDE.md?
5. **Improvement Attribution** - What changes made the biggest difference?
6. **Workflow Satisfaction** - Overall satisfaction

Each dimension uses a Likert scale (-2 to +2):
- `-2`: Very negative
- `-1`: Negative
- `0`: Neutral
- `+1`: Positive
- `+2`: Very positive

---

## Common Patterns

### Pattern 1: Weekly Improvement Check

```bash
# Monday: capture baseline after changes
agentlint baseline --label "Week $(date +%W) start"

# Friday: compare to see progress
agentlint compare
agentlint review  # Capture qualitative feedback
```

### Pattern 2: Before/After Change

```bash
# Before making changes
agentlint baseline --label "Pre-refactor"

# Make changes to CLAUDE.md or workflow

# After changes
agentlint baseline --label "Post-refactor"
agentlint compare
```

### Pattern 3: Monthly Trend Review

```bash
# After accumulating baselines
agentlint trends --after 2026-01-01

# See if qualitative matches quantitative
agentlint trends --include-qualitative
```

---

## Tool Reference

### store_baseline

Capture a point-in-time snapshot.

```typescript
// Agent tool call
store_baseline({
  label: "Post-config update",
  notes: "Added credential guidance section",
  includeSessionMetrics: true
})
```

### query_baseline

Retrieve a baseline by ID or get latest.

```typescript
// Get latest
query_baseline({ includeFindings: false })

// Get specific
query_baseline({ id: "550e8400-...", includeFindings: true })
```

### list_baselines

List available baselines with filtering.

```typescript
list_baselines({
  limit: 10,
  after: "2026-01-01",
  orderBy: "createdAt",
  order: "desc"
})
```

### calculate_delta

Compare two baselines.

```typescript
calculate_delta({
  fromId: "baseline-1-id",
  toId: "baseline-2-id",
  includeGitCommits: true
})
```

### query_trends

Analyze trends across baselines.

```typescript
query_trends({
  minBaselines: 3,
  includeQualitative: true,
  includeCorrelations: true
})
```

### conduct_review

Start a qualitative review session.

```typescript
conduct_review({
  baselineId: "latest",
  dimensions: ["perceivedFriction", "workflowSatisfaction"]
})
```

### get_review_history

Retrieve qualitative review history.

```typescript
get_review_history({
  afterDate: "2026-01-01",
  limit: 10
})
```

---

## Configuration

### Significance Thresholds

Configure in `~/.agentlint/config.json`:

```json
{
  "temporal": {
    "thresholds": {
      "default": 0.05,
      "warningCount": 1,
      "tokenUsage": 0.10
    }
  }
}
```

- `default`: 5% change = significant (↑ or ↓)
- `warningCount`: 1 warning difference = significant
- `tokenUsage`: 10% change = significant for tokens

### Review Reminders

Configure reminder frequency:

```json
{
  "temporal": {
    "reviewReminder": {
      "enabled": true,
      "frequency": "monthly",
      "triggerOnMajorChanges": true
    }
  }
}
```

---

## Storage Locations

| Data | Location |
|------|----------|
| Baselines | `.agentlint/baselines/*.json` |
| Baseline index | `.agentlint/baselines.db` |
| Reviews | `.agentlint/reviews/*.json` |
| Tracking | `.agentlint/tracking/*.json` |

All data is local-first. No data is transmitted without consent.

---

## Troubleshooting

### "No baselines found"

Run an analysis and capture a baseline:
```bash
agentlint analyze
agentlint baseline
```

### "Insufficient data for trends"

Need at least 3 baselines for trend analysis. Capture more baselines over time.

### "No git repository"

Git correlation features degrade gracefully. Baselines still work without git.

### "SQLite index corrupt"

The index is rebuilt automatically from JSON files:
```bash
rm .agentlint/baselines.db
agentlint list baselines  # Triggers rebuild
```

---

## Next Steps

- Explore [data-model.md](./data-model.md) for entity details
- Review [contracts/temporal-tools.ts](./contracts/temporal-tools.ts) for full API
- See [spec.md](./spec.md) for complete requirements
