---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0023: Git Hooks Integration

## Context and Problem Statement

ADR-0012 (Incremental Analysis Strategy) established git hooks as one of several trigger mechanisms for agentlint analysis. ADR-0022 (CI/CD Integration) established the **observability-first philosophy**—tools should inform and track, not block.

This ADR addresses the implementation details for git hook integration:

1. **Which hooks to support** - pre-commit, post-commit, pre-push, post-push?
2. **Blocking vs. observability** - should hooks ever block git operations?
3. **Intelligent scheduling** - how to avoid running analysis too frequently?
4. **Framework integration** - how to work with husky, lefthook, pre-commit?
5. **User configuration** - how to set up during init and modify later?

### Key Insight: agentlint is Different

Traditional linters (ESLint, Prettier) check code quality → blocking pre-commit makes sense.

agentlint tracks AI workflow effectiveness → **what would blocking achieve?**

A "low AI config score" doesn't mean the code is bad or the commit should be rejected. It means there's improvement opportunity. Blocking commits/pushes for improvement opportunities contradicts our philosophy of tracking changes over time.

## Decision Drivers

- **Observability-First principle** (ADR-0022): Inform, don't gate
- **Improvement-Oriented principle**: Track changes over time, not point-in-time checks
- **Performance target** (ADR-0011): 30 seconds is too slow for synchronous hooks
- **Notification fatigue research**: 60% of users disable notifications when overwhelmed
- **User control**: Let users configure their preferred experience
- **Framework compatibility**: Work with existing hook ecosystems
- **Frequency modes** (ADR-0012): Calm/Regular/Active already define trigger behavior

## Considered Options

1. Observability Triggers with Smart Throttling (Recommended)
2. Configurable Blocking (ESLint-like)
3. Framework Integration Only (No Standalone Hooks)
4. Minimal Hooks (Defer to CI)

## Decision Outcome

Chosen option: **"Observability Triggers with Smart Throttling"** because it:
1. Aligns with observability-first philosophy (ADR-0022)
2. Supports "tracking changes over time" (not point-in-time blocking)
3. Prevents notification fatigue through intelligent scheduling
4. Gives users full control over hook behavior
5. Integrates with existing hook frameworks

### Core Philosophy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GIT HOOKS PHILOSOPHY                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ❌ NOT THIS (Quality Gate Model)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ git push → Run analysis → Score below threshold → BLOCK PUSH        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ✅ THIS (Observability Model)                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ git push → Check cooldown → Run background analysis → Notify later  │   │
│  │                         ↑                                           │   │
│  │                  Smart scheduling:                                  │   │
│  │                  - Skip if last run < 4h ago                        │   │
│  │                  - Skip if no significant changes                   │   │
│  │                  - Batch multiple pushes                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Key Principle: We track improvement OVER TIME, not per-operation          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GIT HOOKS ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ HOOK TYPES BY PURPOSE                                                │   │
│  │                                                                      │   │
│  │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │   │
│  │ │ PRE-COMMIT      │  │ POST-COMMIT     │  │ PRE-PUSH / POST-PUSH│   │   │
│  │ │ (Not Recommended)│  │ (Counter Only)  │  │ (Recommended)       │   │   │
│  │ │                 │  │                 │  │                     │   │   │
│  │ │ • User opt-in   │  │ • Increment     │  │ • Smart scheduling  │   │   │
│  │ │ • Static only   │  │   session count │  │ • Background analysis│   │   │
│  │ │ • <2s timeout   │  │ • Never blocks  │  │ • Desktop notify    │   │   │
│  │ │ • Exit 0 always │  │ • Lightweight   │  │ • Exit 0 always     │   │   │
│  │ └─────────────────┘  └─────────────────┘  └─────────────────────┘   │   │
│  │                                                                      │   │
│  │ Recommendation: Use POST-PUSH as primary trigger                    │   │
│  │ Rationale: Pushes represent "I'm ready to share" - natural checkpoint│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ SMART THROTTLING                                                     │   │
│  │                                                                      │   │
│  │ Prevent notification fatigue with intelligent scheduling:           │   │
│  │                                                                      │   │
│  │ 1. COOLDOWN CHECK                                                   │   │
│  │    ┌─────────────────────────────────────────────────────────────┐  │   │
│  │    │ if (now - last_analysis) < cooldown_hours:                  │  │   │
│  │    │     skip analysis, exit 0                                   │  │   │
│  │    └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │ 2. CHANGE SIGNIFICANCE CHECK                                        │   │
│  │    ┌─────────────────────────────────────────────────────────────┐  │   │
│  │    │ if no_significant_changes_since_last_analysis:              │  │   │
│  │    │     skip analysis, exit 0                                   │  │   │
│  │    │                                                             │  │   │
│  │    │ Significant changes:                                        │  │   │
│  │    │   • CLAUDE.md, .cursorrules modified                        │  │   │
│  │    │   • N+ new AI sessions logged                               │  │   │
│  │    │   • .agentlint/ config changed                              │  │   │
│  │    └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  │ 3. BATCH WINDOW                                                     │   │
│  │    ┌─────────────────────────────────────────────────────────────┐  │   │
│  │    │ Multiple pushes within batch_window → single analysis       │  │   │
│  │    │ Default: 30 minutes                                         │  │   │
│  │    └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ EXECUTION MODES                                                      │   │
│  │                                                                      │   │
│  │ ┌─────────────────────┐  ┌─────────────────────────────────────┐    │   │
│  │ │ SYNCHRONOUS         │  │ BACKGROUND (Default)                │    │   │
│  │ │                     │  │                                     │    │   │
│  │ │ • Blocks git op     │  │ • Non-blocking                      │    │   │
│  │ │ • Shows inline      │  │ • Analysis runs in background       │    │   │
│  │ │   status            │  │ • Desktop notification when done    │    │   │
│  │ │ • Must be fast      │  │ • Full analysis possible            │    │   │
│  │ │   (<5s timeout)     │  │                                     │    │   │
│  │ │ • Static only       │  │                                     │    │   │
│  │ │                     │  │                                     │    │   │
│  │ │ Use case:           │  │ Use case:                           │    │   │
│  │ │ Quick status check  │  │ Full analysis without blocking      │    │   │
│  │ └─────────────────────┘  └─────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │ Background pattern (bash):                                          │   │
│  │ (agentlint analyse --trigger=post-push --notify) &> /dev/null &    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hook Types and Recommendations

| Hook Type | Recommended | Behavior | Use Case |
|-----------|-------------|----------|----------|
| **pre-commit** | No | Opt-in only, static checks, <2s timeout | Config syntax validation |
| **post-commit** | Neutral | Increment counters, never analyze | Session tracking |
| **pre-push** | Yes | Show quick status (sync) or trigger analysis (async) | Natural checkpoint |
| **post-push** | Yes (Primary) | Background analysis with smart throttling | Primary trigger |

**Why post-push is recommended:**

1. **Natural checkpoint**: "I'm ready to share" moment
2. **Non-blocking**: Analysis runs after push completes
3. **Appropriate frequency**: Pushes are less frequent than commits
4. **Aligns with CI**: Analysis results ready before CI runs

### Smart Throttling Configuration

```toml
# .agentlint/config.toml

[hooks]
# Which hooks to enable
enabled = ["post-push"]  # Default: only post-push
# enabled = ["post-commit", "post-push"]  # Add post-commit counting
# enabled = ["pre-commit", "post-push"]   # Add pre-commit (not recommended)

# Execution mode
mode = "background"  # "background" | "sync" (default: background)

# Notification on completion
notify = true        # Desktop notification when analysis completes

[hooks.throttle]
# Cooldown: minimum time between analyses
cooldown_hours = 4   # Skip if last analysis was within this window

# Change significance: minimum changes to trigger analysis
min_sessions = 3     # Skip if fewer than N new sessions
min_config_age_hours = 24  # Skip if config unchanged for N hours

# Batch window: combine rapid triggers
batch_window_minutes = 30  # Multiple triggers within window → single analysis

[hooks.pre_commit]
# Pre-commit specific (only if enabled)
enabled = false      # Must explicitly enable
timeout_seconds = 2  # Hard timeout for pre-commit
static_only = true   # Never run LLM in pre-commit
```

**Global defaults** in `~/.config/agentlint/config.toml`:

```toml
[hooks]
enabled = ["post-push"]
mode = "background"
notify = true

[hooks.throttle]
cooldown_hours = 4
min_sessions = 3
batch_window_minutes = 30
```

### Throttling Implementation

```typescript
interface ThrottleState {
  lastAnalysisAt: Date;
  lastPushAt: Date;
  sessionsSinceAnalysis: number;
  configModifiedAt: Date;
  pendingTriggers: TriggerEvent[];
}

interface ThrottleConfig {
  cooldownHours: number;
  minSessions: number;
  minConfigAgeHours: number;
  batchWindowMinutes: number;
}

async function shouldRunAnalysis(
  state: ThrottleState,
  config: ThrottleConfig,
  trigger: TriggerEvent
): Promise<{ run: boolean; reason: string }> {
  const now = new Date();

  // 1. Cooldown check
  const hoursSinceAnalysis = (now.getTime() - state.lastAnalysisAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceAnalysis < config.cooldownHours) {
    return {
      run: false,
      reason: `Cooldown: last analysis ${hoursSinceAnalysis.toFixed(1)}h ago (threshold: ${config.cooldownHours}h)`,
    };
  }

  // 2. Change significance check
  const hasSignificantChanges =
    state.sessionsSinceAnalysis >= config.minSessions ||
    isConfigModified(state, config);

  if (!hasSignificantChanges) {
    return {
      run: false,
      reason: `No significant changes: ${state.sessionsSinceAnalysis} sessions (threshold: ${config.minSessions})`,
    };
  }

  // 3. Batch window check (debounce rapid triggers)
  const pendingInWindow = state.pendingTriggers.filter(t =>
    (now.getTime() - t.timestamp.getTime()) < config.batchWindowMinutes * 60 * 1000
  );

  if (pendingInWindow.length > 0 && trigger.type !== 'batch-flush') {
    // Queue this trigger, don't run yet
    state.pendingTriggers.push(trigger);
    scheduleBatchFlush(config.batchWindowMinutes);
    return {
      run: false,
      reason: `Batched: will run in ${config.batchWindowMinutes}m window`,
    };
  }

  return { run: true, reason: 'Throttle checks passed' };
}
```

### Hook Script Templates

**post-push (recommended, background mode):**

```bash
#!/bin/bash
# agentlint post-push hook
# Installed by: agentlint hooks install

# Only run in agentlint-configured projects
if [[ ! -d ".agentlint" ]]; then
  exit 0
fi

# Background execution with output redirected
# This pattern ensures the hook exits immediately
(
  # Run analysis with throttle checks
  agentlint analyse \
    --trigger=post-push \
    --background \
    --notify
) &> /dev/null &

# Always exit 0 - observability, not blocking
exit 0
```

**post-commit (counter only):**

```bash
#!/bin/bash
# agentlint post-commit hook
# Installed by: agentlint hooks install

# Only run in agentlint-configured projects
if [[ ! -d ".agentlint" ]]; then
  exit 0
fi

# Just increment counter, no analysis
agentlint _internal increment-commit-count

exit 0
```

**pre-commit (optional, sync mode):**

```bash
#!/bin/bash
# agentlint pre-commit hook (OPTIONAL - not recommended)
# Installed by: agentlint hooks install --pre-commit

# Only run in agentlint-configured projects
if [[ ! -d ".agentlint" ]]; then
  exit 0
fi

# Quick status check with hard timeout
timeout 2s agentlint status --quick --format=oneline

# Always exit 0 - never block commits
exit 0
```

### Framework Integration

**Integration with husky:**

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

```bash
# .husky/post-push
agentlint analyse --trigger=post-push --background --notify &> /dev/null &
```

**Integration with lefthook:**

```yaml
# lefthook.yml
post-push:
  parallel: true
  commands:
    agentlint:
      run: agentlint analyse --trigger=post-push --background --notify
      background: true
```

**Integration with pre-commit framework:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: agentlint-status
        name: agentlint status
        entry: agentlint status --quick --format=oneline
        language: system
        always_run: true
        pass_filenames: false
        stages: [pre-push]  # Note: pre-push, not pre-commit
```

### CLI Commands

```bash
# Install hooks based on config
agentlint hooks install
# → Installs hooks specified in config (default: post-push only)

# Install specific hooks
agentlint hooks install --hooks=post-commit,post-push

# Install with pre-commit (explicitly opt-in)
agentlint hooks install --pre-commit

# Uninstall all agentlint hooks
agentlint hooks uninstall

# Show current hook status
agentlint hooks status

# Test hook (dry-run)
agentlint hooks test post-push
```

### Init Wizard Integration

During `agentlint init`, users configure hook preferences:

```
$ agentlint init

...

Git Hooks Configuration
━━━━━━━━━━━━━━━━━━━━━━━

agentlint can automatically analyse your AI workflow when you push changes.

? Which git hooks should agentlint use?
  ○ None (manual analysis only)
  ● Post-push only (recommended)
  ○ Post-commit + Post-push
  ○ Pre-push (sync status check)
  ○ Custom configuration

? Minimum time between analyses? (cooldown)
  ○ 1 hour (active development)
  ● 4 hours (recommended)
  ○ 8 hours (calm)
  ○ 24 hours (minimal)

? Notify when analysis completes?
  ● Yes, desktop notification
  ○ No, silent background

✓ Hook configuration saved to .agentlint/config.toml
✓ Run 'agentlint hooks install' to activate hooks
```

### Exit Code Semantics

**All hooks exit 0 by default** (observability-first):

| Exit Code | Meaning | When |
|-----------|---------|------|
| 0 | Hook completed | Always (unless internal error) |
| 0 | Analysis skipped (cooldown) | Throttle check triggered |
| 0 | Analysis skipped (no changes) | No significant changes |
| 1 | Internal error | agentlint crashed |
| 2 | Invalid configuration | Config file error |

**No exit code for "low score"** - findings are observations, not failures.

### Consequences

**Good:**
- Aligns with observability-first philosophy
- Prevents notification fatigue through smart throttling
- User control over hook behavior
- Framework compatibility (husky, lefthook, pre-commit)
- Natural integration with ADR-0012 frequency modes

**Bad:**
- More complex than "just run analysis"
- Throttle state requires local storage
- Users may expect blocking behavior (education needed)
- Background mode means delayed feedback

**Neutral:**
- Pre-commit support exists but is discouraged
- Different behavior than traditional linters (intentional)

## Pros and Cons of Options

### Option 1: Observability Triggers with Smart Throttling (Chosen)

Hooks trigger background analysis with intelligent scheduling, never block.

- Good: Aligns with improvement-over-time philosophy
- Good: Prevents notification fatigue
- Good: User configurable frequency
- Good: Works with existing frameworks
- Neutral: Delayed feedback (background mode)
- Bad: May confuse users expecting blocking

### Option 2: Configurable Blocking

Default non-blocking, but allow opt-in blocking for enforcement.

- Good: Flexibility for different team preferences
- Good: Familiar to ESLint users
- Neutral: More configuration complexity
- Bad: Blocking contradicts agentlint philosophy
- Bad: Blocking on "improvement opportunity" is wrong model
- Bad: Creates friction for AI workflow experimentation

### Option 3: Framework Integration Only

Only provide examples for husky/lefthook, no standalone installation.

- Good: Simpler implementation
- Good: Leverages existing tooling
- Neutral: Works for teams with frameworks
- Bad: Excludes teams without hook frameworks
- Bad: Less control over agentlint-specific behavior
- Bad: Harder to implement smart throttling

### Option 4: Minimal Hooks (Defer to CI)

Document manual setup only, focus on CI/CD.

- Good: Simplest implementation
- Good: CI (ADR-0022) is already defined
- Neutral: Less local automation
- Bad: Misses natural trigger points
- Bad: Less frequent analysis
- Bad: Doesn't align with ADR-0012 trigger system

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All hooks run locally |
| II. Improvement-Oriented | Yes | Tracks changes over time, not point-in-time gates |
| III. Causal-First | Yes | Analysis links to git events |
| IV. Mixed-Methods | Yes | Works with both static and agentic analysis |
| V. Language-Agnostic | Yes | Hooks work regardless of project language |
| VI. Tool-Agnostic | Yes | Analyzes all AI tool configs |
| VII. Static-First | Yes | Pre-commit (if enabled) uses static only |
| VIII. Progressive Value | Yes | Hooks work without LLM config |
| IX. Agent-Aware | N/A | Hooks don't involve agentlint's agent |

## More Information

### Related Documents
- [ADR-0012: Incremental Analysis Strategy](./0012-incremental-analysis-strategy.md) - Defines hooks as trigger mechanism
- [ADR-0022: CI/CD Integration Patterns](./0022-cicd-integration-patterns.md) - Establishes observability-first philosophy
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - 30-second performance target
- Design Questions: [Section 6.4 - Git Hooks Integration](../../design-questions.md#64-git-hooks-integration)

### Research Sources

**Git Hooks & Frameworks:**
- [Git Hooks for Automated Code Quality Checks Guide 2025](https://dev.to/arasosman/git-hooks-for-automated-code-quality-checks-guide-2025-372f) - Best practices
- [Lefthook vs Husky: Which Git Hooks Tool is Better? 2025](https://www.edopedia.com/blog/lefthook-vs-husky/) - Framework comparison
- [Husky Official Documentation](https://typicode.github.io/husky/) - Node.js hook manager
- [Lefthook GitHub](https://github.com/evilmartians/lefthook) - Fast, language-agnostic hooks
- [Pre-commit Framework](https://pre-commit.com/) - Multi-language hook management
- [Background Long-Running Git Hooks](https://ylan.segal-family.com/blog/2022/05/21/background-long-running-git-hooks/) - Background execution pattern

**Performance & Throttling:**
- [Effortless Code Quality: Pre-Commit Hooks Guide 2025](https://gatlenculp.medium.com/effortless-code-quality-the-ultimate-pre-commit-hooks-guide-for-2025-57ca501d9835) - Speed optimization
- [Ruff 0.6 Pre-Commit Configuration 2025](https://johal.in/ruff-0-6-pre-commit-git-hooks-configuration-2025/) - Fast linting patterns
- [Atlassian Git Hooks Tutorial](https://www.atlassian.com/git/tutorials/git-hooks) - Hook types explained

**Notification UX:**
- [Design Guidelines For Better Notifications UX - Smashing Magazine](https://www.smashingmagazine.com/2025/07/design-guidelines-better-notifications-ux/) - Notification fatigue research
- [How to Reduce Notification Fatigue - Courier](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies/) - Throttling strategies
- [Push Notification UX Design Guide 2025](https://uxcam.com/blog/push-notification-guide/) - Frequency best practices

### Implementation Notes

#### 1. Throttle State Storage

```typescript
// .agentlint/state.json (gitignored)
interface HookState {
  lastAnalysisAt: string;        // ISO timestamp
  lastPushAt: string;            // ISO timestamp
  sessionsSinceAnalysis: number;
  commitsSinceAnalysis: number;
  configHash: string;            // Detect config changes
  pendingTriggers: Array<{
    type: string;
    timestamp: string;
  }>;
}
```

#### 2. Hook Installation

```typescript
async function installHooks(config: HooksConfig): Promise<void> {
  const gitDir = await findGitRoot();
  const hooksDir = path.join(gitDir, '.git', 'hooks');

  for (const hookType of config.enabled) {
    const hookPath = path.join(hooksDir, hookType);
    const hookContent = generateHookScript(hookType, config);

    // Check for existing hook
    if (await exists(hookPath)) {
      const existing = await readFile(hookPath, 'utf-8');
      if (!existing.includes('agentlint')) {
        // Append to existing hook
        await appendFile(hookPath, `\n\n# agentlint hook\n${hookContent}`);
      } else {
        // Update existing agentlint section
        await updateAgentlintSection(hookPath, hookContent);
      }
    } else {
      await writeFile(hookPath, `#!/bin/bash\n\n${hookContent}`);
    }

    await chmod(hookPath, 0o755);
  }
}
```

#### 3. Background Execution Pattern

```bash
# The key pattern for non-blocking background execution:
(
  # Subshell groups all commands
  agentlint analyse --trigger=post-push --notify
) &> /dev/null &
#    ↑            ↑
#    │            └── Background the entire subshell
#    └── Redirect stdout AND stderr to /dev/null
#        This disconnects the subshell from the parent's streams,
#        allowing the parent (git hook) to exit immediately
```

#### 4. Desktop Notification

```typescript
async function sendDesktopNotification(
  title: string,
  message: string,
  options?: { action?: string }
): Promise<void> {
  const platform = process.platform;

  if (platform === 'darwin') {
    // macOS
    await exec(`osascript -e 'display notification "${message}" with title "${title}"'`);
  } else if (platform === 'linux') {
    // Linux (requires notify-send)
    await exec(`notify-send "${title}" "${message}"`);
  } else if (platform === 'win32') {
    // Windows (PowerShell)
    await exec(`powershell -Command "& {Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message}', '${title}')}"`);
  }
}
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Husky/Lefthook Plugins**: Should we publish official npm packages?
2. **IDE Integration**: VS Code extension with hook status (less intrusive than CLI)
3. **Team Hook Sharing**: How to share hook configs across team (committed vs. setup scripts)?
