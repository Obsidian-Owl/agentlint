---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0012: Incremental Analysis Strategy

## Context and Problem Statement

agentlint's core value proposition is **continuous improvement** of AI coding assistant effectiveness. The Constitution's Principle II defines the improvement loop: `BASELINE → CHANGE → OBSERVE → UNDERSTAND → REFINE`.

This ADR addresses:
1. **Change detection**: How does agentlint know what changed since the last analysis?
2. **Automation triggers**: When should analysis run automatically vs. manually?
3. **Recommendation lifecycle**: How do we track if recommendations are adopted and effective?
4. **Agentic learning**: How does the agent focus on what matters when analyzing incrementally?

This is NOT about performance caching—it's about creating a learning system that tracks progress over time.

## Decision Drivers

- **Improvement-Oriented principle**: Must support the continuous improvement cycle
- **Causal-First principle**: Changes should be traceable to their effects
- **Compounding Value principle**: Each incremental analysis adds to historical baseline
- **User control**: Users should configure automation to match their workflow
- **Session awareness**: AI session completion is a natural trigger point
- **Low friction**: Automation should feel helpful, not intrusive

## Considered Options

1. Hybrid Change Detection + Multi-Trigger Automation
2. Git-Only Change Detection with CI Integration
3. Full Re-Analysis with Smart Caching
4. Watch Mode (Continuous Monitoring)

## Decision Outcome

Chosen option: **"Hybrid Change Detection + Multi-Trigger Automation"** because it provides comprehensive change awareness (git + sessions), supports multiple trigger modes to match user workflows, and enables meaningful recommendation lifecycle tracking.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INCREMENTAL ANALYSIS ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 1: CHANGE DETECTION (Hybrid)                                  │   │
│  │                                                                      │   │
│  │ ┌───────────────────────┐  ┌───────────────────────────────────┐   │   │
│  │ │ GIT CHANGE DETECTOR   │  │ SESSION CHANGE DETECTOR           │   │   │
│  │ │                       │  │                                   │   │   │
│  │ │ • Diff since last     │  │ • Scan session log directories    │   │   │
│  │ │   baseline commit     │  │ • Compare timestamps to last      │   │   │
│  │ │ • Track config files  │  │   analysis                        │   │   │
│  │ │ • Track code changes  │  │ • Detect new/modified sessions    │   │   │
│  │ │ • Identify affected   │  │ • Index new sessions into FTS5    │   │   │
│  │ │   analysis domains    │  │                                   │   │   │
│  │ └───────────────────────┘  └───────────────────────────────────┘   │   │
│  │                       │                    │                        │   │
│  │                       └────────┬───────────┘                        │   │
│  │                                ▼                                    │   │
│  │              ┌─────────────────────────────────┐                   │   │
│  │              │ CHANGE MANIFEST                 │                   │   │
│  │              │ • files_changed: string[]       │                   │   │
│  │              │ • sessions_added: string[]      │                   │   │
│  │              │ • config_modified: boolean      │                   │   │
│  │              │ • domains_affected: Domain[]    │                   │   │
│  │              │ • last_baseline_age: Duration   │                   │   │
│  │              │ • sessions_since_baseline: int  │                   │   │
│  │              └─────────────────────────────────┘                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 2: TRIGGER SYSTEM                                             │   │
│  │                                                                      │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │   │
│  │ │ MANUAL      │ │ GIT HOOKS   │ │ SESSION     │ │ STALENESS   │    │   │
│  │ │ TRIGGER     │ │ TRIGGER     │ │ TRIGGER     │ │ TRIGGER     │    │   │
│  │ │             │ │             │ │             │ │             │    │   │
│  │ │ • analyse   │ │ • post-     │ │ • Detect    │ │ • Baseline  │    │   │
│  │ │   command   │ │   commit    │ │   session   │ │   age check │    │   │
│  │ │ • --full    │ │ • pre-push  │ │   end       │ │ • Session   │    │   │
│  │ │   flag      │ │ • Async     │ │ • Watch     │ │   count     │    │   │
│  │ │             │ │   notify    │ │   session   │ │ • First-run │    │   │
│  │ │             │ │             │ │   dirs      │ │   of day    │    │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │   │
│  │                                                                      │   │
│  │ User configures triggers in config.toml:                            │   │
│  │ [triggers]                                                          │   │
│  │ manual = true              # Always available                       │   │
│  │ git_hooks = ["post-commit"] # Which hooks to install                │   │
│  │ session_watch = true       # Watch for new sessions                 │   │
│  │ staleness_days = 7         # Suggest re-analysis after N days       │   │
│  │ staleness_sessions = 10    # Suggest after N sessions               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 3: INCREMENTAL ANALYSIS                                       │   │
│  │                                                                      │   │
│  │ Given Change Manifest, the agent:                                   │   │
│  │                                                                      │   │
│  │ 1. FOCUS: Prioritize analysis on changed domains                    │   │
│  │    • If config_modified → deep config analysis                      │   │
│  │    • If sessions_added → session quality + causal tracing          │   │
│  │    • If code_changed → pattern analysis on affected files          │   │
│  │                                                                      │   │
│  │ 2. CONTEXT: Provide agent with delta context                        │   │
│  │    • "Since last baseline: 3 sessions, CLAUDE.md modified"          │   │
│  │    • "Previous recommendations: 2 adopted, 1 pending"               │   │
│  │    • "Effectiveness trend: improving (+5% session quality)"        │   │
│  │                                                                      │   │
│  │ 3. COMPARE: Generate delta report                                   │   │
│  │    • New issues introduced                                          │   │
│  │    • Issues resolved (by adopted recommendations?)                  │   │
│  │    • Metric changes (better/worse/stable)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 4: RECOMMENDATION LIFECYCLE                                   │   │
│  │                                                                      │   │
│  │ ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐           │   │
│  │ │PROPOSED │ →  │ ADOPTED │ →  │MEASURED │ →  │ CLOSED  │           │   │
│  │ └─────────┘    └─────────┘    └─────────┘    └─────────┘           │   │
│  │                                                                      │   │
│  │ PROPOSED:                                                            │   │
│  │ • New recommendation generated                                       │   │
│  │ • Linked to causal trace (ADR-0007)                                 │   │
│  │ • Priority assigned (ADR-0010)                                      │   │
│  │                                                                      │   │
│  │ ADOPTED (Auto-detect + User confirm):                               │   │
│  │ • Auto-detect: Config diff shows recommendation implemented         │   │
│  │ • User confirm: `agentlint recommend --mark-adopted <id>`           │   │
│  │ • Timestamp recorded                                                 │   │
│  │                                                                      │   │
│  │ MEASURED:                                                            │   │
│  │ • Compare metrics before/after adoption                             │   │
│  │ • Calculate effectiveness_delta                                     │   │
│  │ • Flag if metrics improved, regressed, or unchanged                 │   │
│  │                                                                      │   │
│  │ CLOSED:                                                              │   │
│  │ • Recommendation completed its lifecycle                            │   │
│  │ • Becomes historical data for learning                              │   │
│  │ • If effective → strengthen similar recommendations                 │   │
│  │ • If ineffective → learn from failure                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Change Detection Strategy

**Hybrid approach** combining Git and Session awareness:

| Source | What it Detects | How |
|--------|-----------------|-----|
| Git | Config file changes | `git diff <last_baseline_commit>..HEAD -- CLAUDE.md .cursorrules` |
| Git | Code changes | `git diff --stat` for affected files/directories |
| Git | Baseline age | Compare `last_baseline_commit` timestamp to now |
| Sessions | New AI sessions | Compare session log mtimes to `last_analysis_timestamp` |
| Sessions | Session count | Count sessions since last baseline |

```typescript
interface ChangeManifest {
  // Git-detected changes
  filesChanged: string[];
  configModified: boolean;
  lastBaselineCommit: string;
  baselineAge: Duration;

  // Session-detected changes
  sessionsAdded: SessionInfo[];
  sessionsSinceBaseline: number;

  // Computed
  domainsAffected: AnalysisDomain[];
  significantChange: boolean;  // True if worthy of analysis
}
```

### Trigger Configuration

**Frequency mode** is the primary configuration, set during `agentlint init`:

```toml
# ~/.config/agentlint/config.toml (global defaults)
# Can be overridden per-project in .agentlint/config.toml

[frequency]
mode = "regular"              # "calm", "regular", or "active"

# Calm mode settings
[frequency.calm]
digest_day = "monday"         # Day of week for weekly digest
digest_time = "09:00"         # Local time for digest notification

# Regular mode settings
[frequency.regular]
session_threshold = 5         # Analyse after N sessions
git_hooks = ["pre-push"]      # Only on push, not every commit
desktop_notify = true         # Show notification when threshold reached

# Active mode settings
[frequency.active]
session_threshold = 1         # Analyse every session
git_hooks = ["post-commit", "pre-push"]
desktop_notify = true
shell_prompt = false          # Still opt-in even in active mode

# Advanced: override individual triggers
[triggers]
manual = true                 # Always available
ci_cd = true                  # Always available
shell_prompt = false          # Opt-in only (causes notification fatigue)
```

**Per-project override** in `.agentlint/config.toml`:
```toml
# Override global frequency for this project
[frequency]
mode = "active"               # This project gets more attention

# Project-specific thresholds
session_threshold = 3         # Lower threshold for this project
```

### Trigger Architecture

**Key Insight**: Users won't remember to invoke agentlint, but **notification fatigue is real**. Research shows high-frequency notifications lead to dismissal ([Smashing Magazine](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/)). Facebook's study found fewer notifications improved long-term engagement.

**Design Principles:**
1. **Quiet by default** - start slow, let users increase frequency
2. **Project-scoped** - only trigger in folders with `.agentlint/` config
3. **Threshold-based** - notify on significance, not every event
4. **User-controlled frequency** - maps directly to LLM cost

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRIGGER ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FREQUENCY MODES (User configures during `agentlint init`)                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ 🌙 CALM MODE        │  │ ⚖️ REGULAR MODE     │  │ ⚡ ACTIVE MODE      │ │
│  │ (Low Cost)          │  │ (Balanced)          │  │ (High Engagement)  │ │
│  │                     │  │                     │  │                    │ │
│  │ • Weekly digest     │  │ • Session-end hook  │  │ • Every session    │ │
│  │ • Manual trigger    │  │ • Desktop notify on │  │ • Real-time notify │ │
│  │   only by default   │  │   threshold (5+)    │  │ • IDE integration  │ │
│  │ • No interruptions  │  │ • Git hook on push  │  │ • Shell prompt     │ │
│  │                     │  │   (not commit)      │  │   (opt-in)         │ │
│  │ ~$1-5/month         │  │ ~$10-20/month       │  │ ~$30-50/month      │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
│  PROJECT SCOPE                                                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                             │
│  All triggers are PROJECT-SCOPED:                                          │
│  • Only fire when working in a folder with `.agentlint/` config            │
│  • Per-project frequency settings in `.agentlint/config.toml`              │
│  • Global defaults in `~/.config/agentlint/config.toml`                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Notification Strategy

**Avoid notification fatigue** by using threshold-based, context-aware notifications:

| Notification Type | When | Intrusiveness | Default |
|-------------------|------|---------------|---------|
| **On-demand status** | User runs `agentlint status` | None (user-initiated) | ✅ Always |
| **Desktop notification** | Threshold exceeded (N sessions) | Low (dismissible) | ✅ Regular/Active |
| **Weekly digest** | Scheduled summary | Very Low | ✅ Calm mode |
| **Shell prompt indicator** | Every prompt | High (constant) | ❌ Opt-in only |
| **IDE status bar** | While editor open | Low (ambient) | Future |

**Why NOT shell prompt by default:**
- Causes notification fatigue (constant visual noise)
- Users already have git branch, node version, etc.
- Research shows fewer notifications → better long-term engagement
- Available as opt-in for power users who want it

### Trigger Behaviors by Mode

| Trigger | Calm 🌙 | Regular ⚖️ | Active ⚡ | Notes |
|---------|---------|------------|----------|-------|
| **Manual CLI** | ✅ | ✅ | ✅ | Always available |
| **Claude Code SessionEnd** | ❌ | ✅ threshold | ✅ every | Primary passive trigger |
| **Git post-commit** | ❌ | ❌ | ✅ | High frequency |
| **Git pre-push** | ❌ | ✅ | ✅ | Natural checkpoint |
| **Weekly digest** | ✅ | ✅ | ❌ | Batched summary |
| **Desktop notify** | Digest only | On threshold | Real-time | Configurable |
| **Shell prompt** | ❌ | ❌ | Opt-in | Never default |
| **CI/CD** | ✅ | ✅ | ✅ | Always available |

### Claude Code SessionEnd Hook

The **primary passive trigger** for agentlint. Behavior varies by frequency mode:

```typescript
// Configured during agentlint init
interface SessionEndBehavior {
  mode: 'skip' | 'count-only' | 'threshold' | 'always';
  threshold?: number;        // Run after N sessions (default: 5)
  notify: 'none' | 'desktop' | 'digest';
  background: boolean;       // Don't block session end
}

// Examples by frequency mode:
const calmMode: SessionEndBehavior = {
  mode: 'count-only',        // Just increment counter, no analysis
  notify: 'digest',          // Include in weekly digest
  background: true,
};

const regularMode: SessionEndBehavior = {
  mode: 'threshold',
  threshold: 5,              // Run analysis every 5 sessions
  notify: 'desktop',         // Notify when analysis runs
  background: true,
};

const activeMode: SessionEndBehavior = {
  mode: 'always',            // Analyze every session
  notify: 'desktop',
  background: true,
};
```

**Hook installation:**
```bash
# Installed during: agentlint init
# Location: ~/.claude/hooks/session-end.sh

#!/bin/bash
# agentlint SessionEnd hook

# Check if in an agentlint-configured project
if [[ ! -d ".agentlint" ]]; then
  exit 0  # Silently skip - not an agentlint project
fi

# Increment session counter (always, regardless of mode)
agentlint _internal session-ended

# Trigger analysis based on project/user frequency settings
agentlint _internal maybe-analyse --trigger=session-end
```

### Staleness Tracking (Project-Scoped)

Staleness is tracked **per-project**, not globally:

```typescript
// Per-project state: .agentlint/state.json (gitignored)
interface ProjectStalenessState {
  projectPath: string;
  lastAnalysisAt: Date;
  lastBaselineCommit: string;
  sessionsSinceAnalysis: number;
  lastSessionTimestamp: Date;
}

// Global digest state: ~/.local/state/agentlint/digest.json
interface DigestState {
  projects: Map<string, ProjectStalenessState>;
  lastDigestSentAt: Date;
  nextDigestScheduledAt: Date;
}
```

**Surfaced through (by frequency mode):**

| Mode | How User Learns About Staleness |
|------|--------------------------------|
| 🌙 Calm | Weekly digest email/notification summarizing all projects |
| ⚖️ Regular | Desktop notification when threshold reached |
| ⚡ Active | Real-time desktop notification + optional shell prompt |

### Shell Prompt Integration (Opt-In Only)

**Not enabled by default** due to notification fatigue. Available for power users:

```bash
# Opt-in: agentlint config set shell_prompt true
# Or during init: choose "Active" mode and enable shell prompt

# Only shows when in agentlint project AND stale
_agentlint_prompt() {
  # Skip if not in agentlint project
  [[ ! -d ".agentlint" ]] && return

  local state=".agentlint/state.json"
  [[ ! -f "$state" ]] && return

  local sessions=$(jq -r '.sessionsSinceAnalysis // 0' "$state" 2>/dev/null)
  local threshold=$(jq -r '.notifyThreshold // 5' ".agentlint/config.toml" 2>/dev/null)

  # Only show if over threshold (not every session)
  if [[ "$sessions" -ge "$threshold" ]]; then
    echo "⚠️ lint:$sessions "
  fi
}
```

### Weekly Digest (Calm Mode Default)

For users who want minimal interruption:

```typescript
interface WeeklyDigest {
  generatedAt: Date;
  projects: ProjectDigestEntry[];
}

interface ProjectDigestEntry {
  projectPath: string;
  sessionsSinceLastDigest: number;
  issuesFound: number;
  topRecommendations: Recommendation[];  // Top 3
  trend: 'improving' | 'stable' | 'declining';
}

// Delivered via:
// 1. Desktop notification with summary
// 2. `agentlint digest` command to view full details
// 3. Future: email if user opts in
```

**Digest notification example:**
```
📊 agentlint Weekly Digest

myproject: 12 sessions, 3 new recommendations
  → Top: "Add error handling guidance to CLAUDE.md"

other-project: 5 sessions, stable
  → No new recommendations

Run `agentlint digest` for full details.
```

### Recommendation Lifecycle

Recommendations flow through states:

```typescript
interface Recommendation {
  id: string;
  status: 'proposed' | 'adopted' | 'measured' | 'closed';

  // Proposed
  proposedAt: Date;
  causalTraceId?: string;      // Link to ADR-0007 trace
  priority: PriorityScore;     // From ADR-0010

  // Adopted (auto-detect + confirm)
  adoptedAt?: Date;
  adoptionEvidence?: string;   // Git diff showing implementation
  userConfirmed?: boolean;     // User explicitly confirmed

  // Measured
  measuredAt?: Date;
  metricsBefore?: SessionMetrics;
  metricsAfter?: SessionMetrics;
  effectivenessDelta?: number; // Positive = improvement

  // Closed
  closedAt?: Date;
  outcome?: 'effective' | 'ineffective' | 'inconclusive';
}
```

**Auto-detection of adoption:**
```typescript
async function detectAdoption(rec: Recommendation): Promise<AdoptionResult> {
  // 1. Check if config contains recommendation content
  const configContent = await readConfigFile();
  const implemented = checkImplementation(rec, configContent);

  // 2. Check git history for related changes
  const gitEvidence = await findRelatedCommits(rec);

  if (implemented || gitEvidence) {
    return {
      detected: true,
      confidence: implemented && gitEvidence ? 'HIGH' : 'MEDIUM',
      evidence: gitEvidence?.commitHash,
      requiresConfirmation: true,  // Ask user to confirm
    };
  }

  return { detected: false };
}
```

### Agentic Considerations

When running incrementally, the agentlint agent receives:

```typescript
interface IncrementalContext {
  // Delta information
  changeManifest: ChangeManifest;
  daysSinceLastAnalysis: number;

  // Previous state
  previousBaseline: BaselineSummary;
  previousRecommendations: Recommendation[];
  adoptedSinceLastRun: Recommendation[];

  // Focus guidance
  priorityDomains: AnalysisDomain[];  // Based on what changed
  skipDomains: AnalysisDomain[];       // No changes, skip deep analysis
}
```

The agent uses this to:
1. **Focus**: Spend more tokens on changed areas, less on unchanged
2. **Compare**: Generate meaningful delta insights
3. **Learn**: Consider if adopted recommendations helped
4. **Recommend**: Prioritize new recommendations based on what worked before

### Consequences

**Good:**
- Hybrid detection catches both code and session changes
- Multiple trigger modes fit different workflows
- Staleness detection prompts without being intrusive
- Recommendation lifecycle enables continuous learning
- User control over automation level

**Bad:**
- Git dependency means non-git repos need content-hash fallback
- Session watching requires knowing AI tool log locations
- Adoption auto-detection may have false positives (hence confirmation)

**Neutral:**
- Watch mode deferred to future (simpler triggers first)
- Staleness is suggestion-based by default (low friction)

## Pros and Cons of Options

### Option 1: Hybrid Change Detection + Multi-Trigger Automation

Git for code/config, session timestamps for AI sessions, configurable triggers.

- Good: Comprehensive change awareness
- Good: Matches user workflow preferences
- Good: Low friction with suggestion-based staleness
- Good: Recommendation lifecycle enables learning
- Neutral: Requires Git for full functionality
- Bad: More complex than single-source detection

### Option 2: Git-Only Change Detection with CI Integration

Rely entirely on Git for change detection, integrate with CI for automation.

- Good: Simple, single source of truth
- Good: Works well in CI pipelines
- Neutral: Familiar patterns for developers
- Bad: Misses session log changes (core use case)
- Bad: Requires CI setup for automation
- Bad: No local automation options

### Option 3: Full Re-Analysis with Smart Caching

Always run full analysis, cache results for performance.

- Good: Always correct (no stale detection)
- Good: Simple mental model
- Neutral: Caching complexity
- Bad: Slower for large projects
- Bad: No focus on what changed
- Bad: No meaningful delta reports

### Option 4: Watch Mode (Continuous Monitoring)

File system watcher runs analysis on every relevant change.

- Good: Immediate feedback
- Good: Most responsive
- Neutral: Requires background process
- Bad: High resource usage
- Bad: May be too noisy
- Bad: Complex error handling
- Bad: Deferred to future phase

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All change detection and triggers run locally |
| II. Improvement-Oriented | Yes | Core purpose is continuous improvement loop |
| III. Causal-First | Yes | Recommendations link to traces, track effectiveness |
| IV. Mixed-Methods | Yes | Quantitative (metrics delta) + qualitative (recommendations) |
| V. Language-Agnostic | Yes | Change detection independent of target language |
| VI. Tool-Agnostic | Yes | Session detection via adapter pattern (ADR-0006) |
| VII. Intelligent Tooling | Yes | Agent prioritizes changed areas using both detection tools and reasoning |
| VIII. Compounding Value | Yes | Incremental analysis enables continuous improvement |
| IX. Agent-Aware | Yes | IncrementalContext focuses agent on what matters |

## More Information

### Related Documents
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - SQLite schema for baselines and recommendations
- [ADR-0007: Causal Analysis Architecture](./0007-causal-analysis-architecture.md) - Causal traces linked to recommendations
- [ADR-0008: Session Quality Analysis](./0008-session-quality-analysis.md) - Session metrics for effectiveness measurement
- [ADR-0010: Recommendation Prioritisation](./0010-recommendation-prioritisation-strategy.md) - Priority scoring for recommendations
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Parallel incremental analysis
- Architecture Vision: [Improvement Cycle](../../agentlint-architecture-vision.md#improvement-cycle)
- Design Questions: [Section 2.7 - Incremental Analysis](../../design-questions.md#27-incremental-analysis)

### Research Sources

**Notification UX Research:**
- [Smashing Magazine: Notifications UX Guidelines](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) - Notification fatigue, frequency impacts
- [SuprSend: Notification Preferences Guide](https://www.suprsend.com/post/the-ultimate-guide-to-perfecting-notification-preferences-putting-your-users-in-control) - Calm/regular/power-user modes
- [Medium: Top 8 CLI UX Patterns](https://medium.com/@kaushalsinh73/top-8-cli-ux-patterns-users-will-brag-about-4427adb548b7) - First-run wizard, smart defaults
- [Evil Martians: CLI Progress Displays](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - Progress indicator patterns
- [clig.dev: Command Line Interface Guidelines](https://clig.dev/) - CLI UX best practices

**Incremental Analysis:**
- [Continuous Improvement Metrics 2025](https://www.resolution.de/post/continuous-improvement-metrics/) - Baseline tracking patterns
- [Cortex Software Quality Metrics](https://www.cortex.io/post/software-quality-metrics) - Delta tracking best practices
- [Qodo Code Quality 2025](https://www.qodo.ai/blog/code-quality/) - Feedback loop patterns

**Trigger Automation:**
- [Pre-commit Framework](https://pre-commit.com/) - Git hook automation
- [Git Hooks Guide 2025](https://dev.to/arasosman/git-hooks-for-automated-code-quality-checks-guide-2025-372f) - Hook best practices
- [Claude Code Session Management](https://stevekinney.com/courses/ai-development/claude-code-session-management) - Session detection patterns
- [CCManager](https://github.com/kbwo/ccmanager) - Session status change triggers
- [Chokidar](https://github.com/paulmillr/chokidar) - File watching (future watch mode)

### Implementation Notes

Implementation details for this ADR are documented in:
- [Database Schema Extensions](/docs/implementation/database-schema.md#recommendation-lifecycle-schema) - Recommendation lifecycle and staleness tracking tables
- [Hooks Integration Guide](/docs/implementation/hooks-integration-guide.md) - Git hooks, Claude Code hooks, shell prompt integration

#### Key Interface

```typescript
interface ChangeManifest {
  filesChanged: string[];
  configModified: boolean;
  lastBaselineCommit: string;
  baselineAge: Duration;
  sessionsAdded: SessionInfo[];
  sessionsSinceBaseline: number;
  domainsAffected: AnalysisDomain[];
  significantChange: boolean;
}
```

#### CLI Commands

```bash
agentlint analyse                    # Incremental analysis
agentlint analyse --full             # Force full re-analysis
agentlint config frequency           # Show/set frequency mode (calm/regular/active)
agentlint hooks install              # Install hooks for current frequency mode
agentlint recommend                  # Show current recommendations
agentlint status                     # Show staleness, pending recommendations
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **`agentlint init` Command Design**: Full init workflow including frequency mode selection (see design-questions.md)
2. **Watch Mode Implementation**: Full file system watching for continuous mode (future)
3. **CI/CD Integration**: GitHub Actions / GitLab CI templates for agentlint
4. **IDE Integration**: VS Code extension with status bar indicator (less intrusive than shell prompt)
