---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0022: CI/CD Integration Patterns

## Context and Problem Statement

How should agentlint integrate with CI/CD pipelines? More fundamentally: **WHY would anyone add agentlint to their CI?**

agentlint is not a traditional linter or quality gate. It's an **improvement-oriented tool** for tracking and optimizing AI-assisted development workflows over time. The question isn't "should we block PRs with low scores" but rather:

> How can CI/CD integration provide visibility into AI workflow effectiveness and track improvement trends at the team level?

### The Motivation Gap

Traditional CI integration (like ESLint, SonarQube) uses a quality gate model: fail builds that don't meet thresholds. This makes sense for code quality tools because code quality has clear right/wrong answers.

But agentlint measures **process effectiveness**, not code correctness. A "low" AI configuration score doesn't mean the code is bad—it means there's opportunity to improve. Blocking merges for improvement opportunities contradicts our core philosophy.

### What Personas Actually Need from CI

| Persona | Need | CI Can Provide |
|---------|------|----------------|
| **The Optimizer** | Track improvement over time | Auto-capture baselines on merge, trend reports |
| **Multi-Tool User** | Unified view across configs | Detect config drift across team PRs |
| **Vibe Coder** | Cost awareness | Surface iteration/token cost trends |
| **Context Engineer** | Compliance validation | Check CLAUDE.md against best practices |

### The AI Productivity Paradox

Research shows [60% of organizations cite lack of clear metrics as their biggest AI challenge](https://www.faros.ai/blog/ai-software-engineering). Teams with heavy AI use show 21% more tasks completed but these gains don't scale organizationally—downstream bottlenecks absorb the value. CI integration can provide the **visibility** needed to identify and address these bottlenecks.

## Decision Drivers

- **Improvement-Oriented principle**: CI must support continuous improvement, not gatekeeping
- **Progressive Value principle**: Static analysis should run without LLM; agentic analysis is opt-in
- **Local-First principle**: CI runs in cloud—how does this square with local-first?
- **Cost control**: LLM analysis on every PR could be expensive; must be configurable
- **Team visibility**: Organizations need aggregate metrics, not just individual insights
- **Non-blocking philosophy**: Never block merges by default for improvement metrics
- **DORA research**: Teams with solid CI practices succeed better with AI tooling

## Considered Options

1. Observability-First Integration (Non-Blocking Default)
2. Scheduled/Batch Analysis (Not Per-PR)
3. No CI Integration (Local-Only)
4. Configurable Gates (ESLint-like)

## Decision Outcome

Chosen option: **"Observability-First Integration"** with configurable analysis levels, because it provides team-level visibility while preserving our improvement-oriented philosophy. CI integration becomes an **observability feature** that surfaces trends and insights, never a quality gate that blocks developer flow.

### Core Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CI/CD INTEGRATION PHILOSOPHY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ❌ NOT THIS (Quality Gate Model)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PR opened → Run analysis → Score below threshold → BLOCK MERGE      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ✅ THIS (Observability-First Model)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PR opened → Run analysis → Generate insights → INFORM (non-blocking) │   │
│  │ PR merged → Capture baseline → Track trends → SURFACE IMPROVEMENTS   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Key Differences:                                                          │
│  • Exit code 0 always (unless internal error)                             │
│  • PR comments are informational, not blocking                            │
│  • Value is in trends over time, not per-PR scores                        │
│  • Blocking is explicit opt-in (and discouraged)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CI/CD INTEGRATION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ANALYSIS LEVELS (User Configurable)                                  │   │
│  │                                                                      │   │
│  │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │   │
│  │ │ STATIC ONLY     │  │ STATIC + LIGHT  │  │ FULL ANALYSIS       │   │   │
│  │ │                 │  │ LLM             │  │                     │   │   │
│  │ │ • Config detect │  │ • Static +      │  │ • Static +          │   │   │
│  │ │ • Structure     │  │ • Config quality│  │ • All agentic       │   │   │
│  │ │   validation    │  │   assessment    │  │   analysis          │   │   │
│  │ │ • Metrics       │  │ • Basic recos   │  │ • Deep recos        │   │   │
│  │ │                 │  │                 │  │ • Session analysis  │   │   │
│  │ │ Cost: $0        │  │ Cost: ~$0.05/PR │  │ Cost: ~$0.50/PR     │   │   │
│  │ │ Speed: <10s     │  │ Speed: <30s     │  │ Speed: <2min        │   │   │
│  │ └─────────────────┘  └─────────────────┘  └─────────────────────┘   │   │
│  │         ▲                   ▲                      ▲                │   │
│  │         │                   │                      │                │   │
│  │     Default            Recommended            Power Users           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ OUTPUT MODES                                                         │   │
│  │                                                                      │   │
│  │ ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────┐   │   │
│  │ │ PR COMMENT        │  │ ARTIFACT REPORT   │  │ BASELINE UPDATE │   │   │
│  │ │                   │  │                   │  │                 │   │   │
│  │ │ • Summary card    │  │ • Full JSON/MD    │  │ • On merge only │   │   │
│  │ │ • Key insights    │  │ • Trend data      │  │ • Stored as     │   │   │
│  │ │ • Diff from       │  │ • Historical      │  │   artifact      │   │   │
│  │ │   baseline        │  │   comparison      │  │ • Or external   │   │   │
│  │ │ • Non-blocking    │  │                   │  │   storage       │   │   │
│  │ └───────────────────┘  └───────────────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ EXIT CODE SEMANTICS (Observability-First)                           │   │
│  │                                                                      │   │
│  │ │ Code │ Meaning                    │ CI Effect    │ Philosophy    │ │   │
│  │ │──────│────────────────────────────│──────────────│───────────────│ │   │
│  │ │  0   │ Analysis completed         │ Pass always  │ Success       │ │   │
│  │ │  1   │ Internal error (tool bug)  │ Fail         │ Our fault     │ │   │
│  │ │  2   │ Invalid configuration      │ Fail         │ User config   │ │   │
│  │ │      │                            │              │ error         │ │   │
│  │ │──────│────────────────────────────│──────────────│───────────────│ │   │
│  │ │  -   │ "Low score" findings       │ Pass (0)     │ NOT a failure │ │   │
│  │ │  -   │ "Critical" issues found    │ Pass (0)*    │ Inform, don't │ │   │
│  │ │      │                            │              │ block         │ │   │
│  │                                                                      │   │
│  │ * Unless explicit --strict mode enabled (discouraged)               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configurable Analysis Levels

Users control the cost/depth tradeoff in their CI configuration:

```yaml
# .github/workflows/agentlint.yml
name: agentlint Analysis

on:
  pull_request:
  push:
    branches: [main]

jobs:
  analyse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install agentlint
        run: npm install -g agentlint

      - name: Run Analysis
        env:
          # Optional: Only needed for LLM analysis levels
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          agentlint analyse \
            --level ${{ vars.AGENTLINT_LEVEL || 'static' }} \
            --output ci \
            --report-artifact analysis-report.json

      - name: Upload Report
        uses: actions/upload-artifact@v4
        with:
          name: agentlint-report
          path: analysis-report.json

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const report = require('./analysis-report.json');
            // Post non-blocking comment with insights
```

**Analysis Level Configuration:**

```toml
# .agentlint/config.toml

[ci]
# Analysis level: "static" | "light" | "full"
# Default: "static" (no LLM, no cost)
level = "light"

# Output behavior
comment_on_pr = true       # Post PR comment with insights
upload_artifact = true     # Save full report as artifact
update_baseline = "merge"  # "merge" | "always" | "never"

# Blocking behavior (discouraged for agentlint's philosophy)
# strict_mode = false      # If true, exit 3 on critical findings
# fail_threshold = null    # Score threshold for exit code (null = disabled)
```

**CLI Flags:**

```bash
# Static-only analysis (no LLM, free)
agentlint analyse --level static --output ci

# Light LLM analysis (config quality assessment)
agentlint analyse --level light --output ci

# Full analysis (all agentic capabilities)
agentlint analyse --level full --output ci

# Strict mode (exit non-zero on findings) - DISCOURAGED
agentlint analyse --level light --output ci --strict
```

### PR Comment Design

Comments are **informational**, never blocking:

```markdown
## 📊 agentlint Analysis

### Summary
| Metric | Value | Change |
|--------|-------|--------|
| Config Quality | 72/100 | +5 ↑ |
| Type Coverage | 89% | - |
| Session Efficiency | Good | New |

### Key Insights
- ✅ CLAUDE.md follows hierarchical structure
- 💡 Consider adding path-specific rules for `/tests`
- 📈 Config quality improved 5 points since last baseline

### Trend (last 10 PRs)
```
Config Quality: ▁▂▃▄▄▅▅▆▆▇ (+12 overall)
```

<details>
<summary>Full Report</summary>

[View artifact](link-to-artifact)

</details>

---
*agentlint provides visibility into AI workflow effectiveness. These are insights, not requirements.*
```

### Baseline Management in CI

Baselines track improvement over time:

```typescript
interface CIBaselineStrategy {
  // When to capture new baseline
  captureOn: 'merge' | 'always' | 'never';

  // Where to store baselines
  storage: BaselineStorage;

  // How to compare
  comparison: 'latest' | 'branch-base' | 'time-window';
}

type BaselineStorage =
  | { type: 'artifact'; retention_days: number }
  | { type: 'branch'; ref: string }
  | { type: 'external'; url: string };
```

**Storage Options:**

| Storage | Pros | Cons | Best For |
|---------|------|------|----------|
| **GitHub Artifacts** | Simple, built-in | 90-day retention limit | Small teams, MVP |
| **Dedicated Branch** | Unlimited retention, versioned | Branch clutter | Medium teams |
| **External Storage** | Full control, long retention | Extra infrastructure | Enterprise |

**Default (MVP):**

```yaml
# Baseline stored in GitHub Actions artifacts
- name: Download Previous Baseline
  uses: dawidd6/action-download-artifact@v3
  with:
    workflow: agentlint.yml
    branch: main
    name: agentlint-baseline
    if_no_artifact_found: warn

- name: Run Analysis with Baseline
  run: |
    agentlint analyse \
      --baseline ./agentlint-baseline.json \
      --output ci \
      --report-artifact analysis-report.json

- name: Upload New Baseline (on merge only)
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  uses: actions/upload-artifact@v4
  with:
    name: agentlint-baseline
    path: analysis-report.json
```

### Local-First Principle Reconciliation

**Tension**: CI runs in the cloud, but agentlint is local-first.

**Resolution**: CI integration is an **opt-in enhancement**, not a requirement:

| Aspect | Local-First Compliance | Notes |
|--------|------------------------|-------|
| **Data storage** | User's CI account | GitHub/GitLab artifacts belong to user |
| **LLM credentials** | User provides in CI secrets | User controls API key |
| **Analysis results** | Stored in user's repo/artifacts | Not centralized by agentlint |
| **Telemetry** | None | No data sent to agentlint servers |
| **Opt-in** | CI workflow must be added by user | Not automatic |

The key insight: **CI integration extends local-first to team-first**, where the "team" is still in control of their own infrastructure. agentlint doesn't run a SaaS—users run agentlint in their own CI.

### Integration Matrix

**MVP Supported Platforms:**

| Platform | Support Level | Notes |
|----------|--------------|-------|
| **GitHub Actions** | Full | Official workflow template |
| **GitLab CI** | Basic | `.gitlab-ci.yml` example |
| **Generic** | Basic | Script-based, any CI |

**Future Platforms:**

| Platform | Priority | Notes |
|----------|----------|-------|
| Azure DevOps | Medium | Enterprise demand |
| Jenkins | Low | Legacy, manual setup |
| CircleCI | Medium | Popular for OSS |

### Cost Model for CI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CI COST ESTIMATION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Example: Team with 50 PRs/week                                            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐         │
│  │ STATIC ONLY     │  │ LIGHT LLM       │  │ FULL ANALYSIS       │         │
│  │                 │  │                 │  │                     │         │
│  │ PRs: 50/week    │  │ PRs: 50/week    │  │ PRs: 50/week        │         │
│  │ Cost: $0/PR     │  │ Cost: ~$0.05/PR │  │ Cost: ~$0.50/PR     │         │
│  │                 │  │                 │  │                     │         │
│  │ Weekly: $0      │  │ Weekly: ~$2.50  │  │ Weekly: ~$25        │         │
│  │ Monthly: $0     │  │ Monthly: ~$10   │  │ Monthly: ~$100      │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘         │
│                                                                             │
│  Recommendation:                                                           │
│  • Start with STATIC to prove value                                        │
│  • Move to LIGHT when team sees ROI                                        │
│  • FULL for critical repos or periodic deep analysis                       │
│                                                                             │
│  Alternative: FULL analysis on merge only, STATIC on PR                    │
│  (Captures detailed baseline without per-PR LLM cost)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Team Visibility Features (Post-MVP)

Future CI integration could provide:

```typescript
interface TeamDashboard {
  // Aggregate metrics across team
  metrics: {
    avgConfigQuality: TrendSeries;
    totalPRsAnalysed: number;
    improvementRate: number;  // % of PRs that improved on baseline
  };

  // Team-wide patterns
  patterns: {
    commonIssues: Issue[];
    topRecommendations: Recommendation[];
    configDrift: DriftReport[];  // Diverging configs across team
  };

  // Comparison
  comparison: {
    betweenRepos: RepoComparison[];
    overTime: TimeSeries;
  };
}
```

This supports the "Future Personas" (Team Lead, Enterprise Architect) without being required for MVP.

### Consequences

**Good:**
- Provides team-level visibility without local-first compromise
- Configurable analysis levels let users control cost
- Non-blocking philosophy preserves developer flow
- Baseline tracking enables improvement measurement at scale
- PR comments surface insights without friction

**Bad:**
- Additional complexity in CI configuration
- Baseline storage requires management (artifact retention)
- Users may misuse strict mode against our philosophy
- LLM costs can accumulate if misconfigured

**Neutral:**
- Requires official workflow templates for good DX
- Team features deferred to post-MVP
- External baseline storage adds infrastructure decisions

## Pros and Cons of Options

### Option 1: Observability-First Integration (Chosen)

Non-blocking by default, informational PR comments, configurable analysis levels.

- Good: Aligns with improvement-oriented philosophy
- Good: Configurable cost (static is free)
- Good: Team visibility without gatekeeping
- Good: Preserves developer autonomy
- Neutral: Requires discipline to avoid strict mode creep
- Bad: Some users may want gates; we discourage this

### Option 2: Scheduled/Batch Analysis

Daily/weekly CI jobs instead of per-PR analysis.

- Good: Lower LLM cost (aggregate analysis)
- Good: Better for trend analysis
- Good: No per-PR noise
- Neutral: Less immediate feedback
- Bad: Loses PR-specific insights
- Bad: Harder to connect insights to specific changes

### Option 3: No CI Integration

Keep agentlint purely local.

- Good: Simplest implementation
- Good: Pure local-first adherence
- Good: No CI complexity
- Bad: Loses team visibility
- Bad: Manual baseline management
- Bad: Harder to track improvement at scale
- Bad: Limits value for Team Lead/Enterprise personas

### Option 4: Configurable Gates (ESLint-like)

Traditional quality gate model with blocking on thresholds.

- Good: Familiar pattern for developers
- Good: Enforces standards
- Neutral: Expected by some users
- Bad: Contradicts improvement philosophy
- Bad: Blocks PRs for improvement opportunities (wrong model)
- Bad: Creates friction for AI workflow experimentation

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | CI runs in user's account; no agentlint servers involved |
| II. Improvement-Oriented | Yes | Core purpose is tracking improvement, not gatekeeping |
| III. Causal-First | Yes | Trend tracking helps trace improvements to changes |
| IV. Mixed-Methods | Yes | Supports both static metrics and agentic insights |
| V. Language-Agnostic | Yes | CI integration works regardless of project language |
| VI. Tool-Agnostic | Yes | Analyzes all AI tool configs in CI context |
| VII. Static-First | Yes | Default level is static-only (no LLM cost) |
| VIII. Progressive Value | Yes | Static analysis provides value; LLM is opt-in enhancement |
| IX. Agent-Aware | N/A | CI doesn't involve agentlint's own agent |

## More Information

### Related Documents
- [ADR-0020: Output Formats and Execution UX](./0020-output-formats-and-execution-ux.md) - Exit codes, output modes
- [ADR-0021: Caching Strategy](./0021-caching-strategy.md) - Cache storage in CI context
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - XDG paths vs CI paths
- [Personas](../../requirements/personas.md) - User needs driving CI integration
- Design Questions: [Section 6.3 - CI/CD Integration](../../design-questions.md#63-cicd-integration-patterns)

### Research Sources

**AI Productivity & Metrics:**
- [Faros AI: The AI Productivity Paradox](https://www.faros.ai/blog/ai-software-engineering) - 60% lack metrics; team gains don't scale
- [Index.dev: AI Coding Assistant ROI](https://www.index.dev/blog/ai-coding-assistants-roi-productivity) - Real productivity data
- [Qodo: State of AI Code Quality 2025](https://www.qodo.ai/reports/state-of-ai-code-quality/) - Quality impact research
- [Axify: Are AI Assistants Saving Time?](https://axify.io/blog/are-ai-coding-assistants-really-saving-developers-time) - Measurement challenges

**DORA & DevOps Metrics:**
- [DORA.dev](https://dora.dev/) - Official DORA metrics guidance
- [DORA AI Capabilities Model](https://dora.dev/research/ai/) - AI adoption success factors
- [GetDX: DORA Metrics Guide](https://getdx.com/blog/dora-metrics/) - Continuous improvement approach
- [Oobeya: DORA Metrics 2025](https://www.oobeya.io/blog/dora-metrics-2025-best-practices) - Best practices

**CI/CD Observability:**
- [Datadog: CI Pipeline Visibility](https://www.datadoghq.com/product/ci-cd-monitoring/) - Observability patterns
- [InfoQ: CI/CD Observability](https://www.infoq.com/articles/ci-cd-observability/) - Non-blocking feedback
- [JetBrains: State of CI/CD 2025](https://blog.jetbrains.com/teamcity/2025/10/the-state-of-cicd/) - 73% don't use AI in CI yet
- [Katalon: CI/CD Trends 2025](https://katalon.com/resources-center/blog/ci-cd-pipeline-trends) - Observability-first trend

**GitHub Actions Patterns:**
- [GitHub Marketplace: Add PR Comment](https://github.com/marketplace/actions/add-pr-comment) - Non-blocking comments
- [Graphite: PR Comments Guide](https://graphite.com/guides/how-to-post-comment-on-pr-github-actions) - Implementation patterns
- [DEV.to: PR Review Types](https://dev.to/msnmongare/github-pr-reviews-comment-vs-approve-vs-request-changes-when-to-use-each-1ph2) - Comment vs Request Changes

### Implementation Notes

#### 1. Official GitHub Action (MVP)

```yaml
# .github/workflows/agentlint.yml
name: agentlint

on:
  pull_request:
  push:
    branches: [main]

jobs:
  analyse:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write  # For PR comments
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: agentlint Analysis
        uses: agentlint/action@v1  # Official action
        with:
          level: ${{ vars.AGENTLINT_LEVEL || 'static' }}
          comment: true
          artifact: true
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

#### 2. Sticky Comments (Update, Don't Spam)

Use [sticky-pull-request-comment](https://github.com/marocchino/sticky-pull-request-comment) pattern to update rather than create new comments:

```typescript
// Use hidden marker to identify and update existing comment
const COMMENT_MARKER = '<!-- agentlint-analysis -->';

async function upsertPRComment(
  octokit: Octokit,
  context: Context,
  body: string
): Promise<void> {
  const { owner, repo } = context.repo;
  const issue_number = context.payload.pull_request!.number;

  const markedBody = `${COMMENT_MARKER}\n${body}`;

  // Find existing comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number,
  });

  const existing = comments.find(c => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: markedBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: markedBody,
    });
  }
}
```

#### 3. Baseline Artifact Workflow

```yaml
# Download previous baseline from main branch
- name: Download Baseline
  uses: dawidd6/action-download-artifact@v3
  with:
    workflow: agentlint.yml
    branch: main
    name: agentlint-baseline
    if_no_artifact_found: ignore
  continue-on-error: true

# Run analysis with baseline comparison
- name: Analyse
  run: |
    if [ -f agentlint-baseline.json ]; then
      agentlint analyse --baseline agentlint-baseline.json --output ci
    else
      agentlint analyse --output ci
    fi

# Upload new baseline on merge to main
- name: Update Baseline
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  uses: actions/upload-artifact@v4
  with:
    name: agentlint-baseline
    path: analysis-report.json
    retention-days: 90
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Official GitHub Action**: Build `agentlint/action@v1` for DX
2. **GitLab CI Template**: Example `.gitlab-ci.yml`
3. **Team Dashboard Design**: Post-MVP aggregate visibility features
4. **Baseline Storage Strategy**: When to move from artifacts to dedicated storage
