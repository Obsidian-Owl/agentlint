---
status: superseded
superseded-by: ADR-0024
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0010: Session State and Checkpointing

> **⚠️ SUPERSEDED**: This ADR has been superseded by [ADR-0024: Opencode SDK Migration](0024-opencode-sdk-migration.md). The content below describes the original Claude Agent SDK session management.

## Context and Problem Statement

agentlint analysis sessions can run for 30+ minutes, involving multiple tool calls, findings, and recommendations. Long-running sessions need:

1. **Crash recovery**: Resume analysis if agentlint crashes or is killed
2. **Pause/resume**: User explicitly pauses work and continues hours/days later

The Claude Agent SDK (ADR-0002) already provides conversation persistence via session IDs. The question is what additional state agentlint needs to checkpoint beyond the SDK's conversation history.

## Decision Drivers

- **Resume Fidelity**: Analysis should continue exactly where it left off
- **Crash Recovery**: No work lost on unexpected termination
- **Low Overhead**: Checkpointing shouldn't slow down analysis
- **Storage Efficiency**: Reasonable checkpoint file sizes
- **Simplicity**: Leverage SDK's built-in capabilities where possible
- **Consistency**: Follow patterns from ADR-0008 (baselines) and ADR-0009 (learnings)

## Considered Options

1. SDK sessions + state file
2. Event sourcing
3. Phase-based snapshots
4. Incremental checkpoints

## Decision Outcome

**Chosen option: "SDK sessions + state file"** with **event + interval triggers**. The Claude Agent SDK handles conversation persistence natively. agentlint adds a lightweight JSON state file for analysis-specific data (findings, tool results, progress). Checkpoints are saved on significant events AND at time intervals (whichever comes first).

### Consequences

**Good:**

- Leverages SDK's battle-tested session management
- Simple JSON state file follows established patterns (ADR-0008)
- Dual triggers (events + intervals) ensure reasonable checkpoint frequency
- Low implementation complexity
- Resume loads both SDK session and agentlint state atomically

**Bad:**

- Two systems to keep in sync (SDK session + state file)
- Coarser granularity than event sourcing
- State file may grow large for very long sessions

**Neutral:**

- SDK session ID becomes the correlation key for state files
- Interval-based saves add minor CPU overhead

## Pros and Cons of Options

### Option 1: SDK sessions + state file

Use Claude Agent SDK's built-in session management for conversation state. Add a separate JSON file for agentlint-specific analysis state.

- Good: SDK handles conversation persistence—don't reinvent
- Good: JSON state file follows ADR-0008 pattern
- Good: Simple implementation
- Good: Clear separation of concerns
- Good: SDK's resume loads full conversation context
- Neutral: Two files per session (SDK JSONL + agentlint JSON)
- Bad: Must keep SDK session and state file in sync
- Bad: No event replay capability

### Option 2: Event sourcing

Log every state change as an immutable event. Reconstruct state by replaying events.

- Good: 100% audit trail of analysis
- Good: Can replay to any point in time
- Good: Perfect crash recovery—replay from last committed event
- Good: Enables "time travel" debugging
- Neutral: Industry-proven pattern (Martin Fowler)
- Bad: High implementation complexity
- Bad: Replay time grows with session length
- Bad: Storage overhead for event log
- Bad: Overkill for typical agentlint sessions

### Option 3: Phase-based snapshots

Save complete state only at analysis phase boundaries (scan → analyze → recommend → complete).

- Good: Natural checkpoints at meaningful boundaries
- Good: Simple implementation
- Good: Small number of checkpoints per session
- Neutral: Aligned with analysis workflow
- Bad: Can lose significant work within a phase
- Bad: Long phases may have no intermediate saves
- Bad: Not suitable for crash recovery mid-phase

### Option 4: Incremental checkpoints

Save state after every tool call and finding.

- Good: Finest granularity—minimal work lost
- Good: Excellent crash recovery
- Good: Can track exact progress
- Neutral: Similar to event sourcing but simpler
- Bad: High I/O overhead
- Bad: Many small writes can fragment storage
- Bad: Checkpoint validation complexity

## Constitution Compliance

| Principle                | Compliance | Notes                                                         |
| ------------------------ | ---------- | ------------------------------------------------------------- |
| I. Local-First           | Yes        | All checkpoints stored locally in `.agentlint/`               |
| II. Improvement-Oriented | Yes        | Preserved findings enable continued improvement               |
| III. Causal-First        | Yes        | Checkpoint captures traced origins of findings                |
| IV. Mixed-Methods        | Yes        | Both quantitative progress and qualitative findings preserved |
| V. Language-Agnostic     | Yes        | Checkpoint format independent of analyzed project             |
| VI. Agent-Agnostic       | Yes        | State schema supports any ACT adapter                         |
| VII. Intelligent Tooling | Yes        | Agent can query checkpoint state                              |
| VIII. Compounding Value  | Yes        | Session state feeds into baselines                            |
| IX. Agent-Aware          | Yes        | Checkpoint structure optimized for agent consumption          |

## More Information

### Related Documents

- Design Decisions: [DD-009](../design-decisions.md#dd-009-session-state-and-checkpointing)
- Prior Decisions: [ADR-0002 - Agentic Framework](./0002-agentic-framework-strategy.md), [ADR-0008 - Baseline Storage](./0008-baseline-storage-format-and-strategy.md)

### Research Sources

- [Claude Agent SDK - Session Management](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Claude Agent SDK - File Checkpointing](https://platform.claude.com/docs/en/agent-sdk/file-checkpointing)
- [LangGraph Memory Overview](https://docs.langchain.com/oss/python/langgraph/memory)
- [LangChain Blog - Building LangGraph](https://blog.langchain.com/building-langgraph/)
- [Event Sourcing - Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Snapshots in Event Sourcing - Kurrent](https://www.kurrent.io/blog/snapshots-in-event-sourcing)

### Implementation Notes

#### 1. Storage Layout

```
.agentlint/
├── sessions/
│   ├── abc123-state.json          # agentlint state for session abc123
│   ├── def456-state.json
│   └── ...
├── baselines/                      # (from ADR-0008)
├── baselines.db
└── sessions.db                     # (from ADR-0006)

~/.claude/projects/[encoded]/
├── abc123.jsonl                   # SDK conversation history (managed by SDK)
└── ...
```

#### 2. Session State Schema

```typescript
interface SessionState {
  // Identity
  id: string; // Matches SDK session ID
  version: string; // Schema version
  createdAt: string; // ISO-8601
  updatedAt: string; // Last checkpoint time

  // Analysis context
  projectPath: string;
  actType: ACTType;
  configPath: string;
  command: string; // 'analyse' | 'scan' | 'compare' | etc.

  // Progress tracking
  phase: AnalysisPhase;
  phaseProgress: number; // 0-100 within current phase
  completedPhases: AnalysisPhase[];

  // Findings (accumulated during analysis)
  findings: Finding[];
  warnings: Warning[];
  recommendations: Recommendation[];

  // Cached tool results (avoid re-running expensive operations)
  toolResultCache: {
    [toolCallId: string]: {
      tool: string;
      input: unknown;
      result: unknown;
      cachedAt: string;
    };
  };

  // Baseline comparison (if running compare command)
  comparison?: {
    baselineId: string;
    deltaCalculated: boolean;
    delta?: BaselineDelta;
  };

  // Checkpoint metadata
  checkpoint: {
    trigger: 'event' | 'interval' | 'user' | 'phase';
    sequence: number; // Monotonic checkpoint number
    lastEventTime: string;
    lastIntervalTime: string;
  };
}

type AnalysisPhase =
  | 'init'
  | 'config_parsing'
  | 'session_search'
  | 'pattern_analysis'
  | 'recommendation_generation'
  | 'baseline_comparison'
  | 'report_generation'
  | 'complete';

interface Finding {
  id: string;
  type: FindingType;
  severity: 'info' | 'warning' | 'error';
  message: string;
  location?: { file: string; line?: number };
  detectedAt: string;
  detectedInPhase: AnalysisPhase;
}
```

#### 3. Checkpoint Triggers

```typescript
interface CheckpointConfig {
  // Event-based triggers
  eventTriggers: {
    onFinding: boolean; // Save when new finding detected
    onPhaseComplete: boolean; // Save at phase boundaries
    onToolResult: boolean; // Save after tool calls
    onRecommendation: boolean; // Save when recommendation generated
  };

  // Interval-based trigger
  intervalMs: number; // Save every N milliseconds (default: 60000 = 1 min)

  // Minimum time between checkpoints (debounce)
  minIntervalMs: number; // Don't save more often than this (default: 10000 = 10s)
}

const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  eventTriggers: {
    onFinding: true,
    onPhaseComplete: true,
    onToolResult: false, // Too frequent
    onRecommendation: true,
  },
  intervalMs: 60000, // 1 minute
  minIntervalMs: 10000, // 10 seconds minimum between saves
};
```

#### 4. Checkpoint Manager

```typescript
class CheckpointManager {
  private state: SessionState;
  private config: CheckpointConfig;
  private lastCheckpointTime: number = 0;
  private checkpointSequence: number = 0;
  private intervalTimer: Timer | null = null;

  constructor(sessionId: string, config: CheckpointConfig = DEFAULT_CHECKPOINT_CONFIG) {
    this.config = config;
    this.state = this.loadOrCreate(sessionId);
    this.startIntervalTimer();
  }

  // Load existing state or create new
  private loadOrCreate(sessionId: string): SessionState {
    const statePath = this.getStatePath(sessionId);

    if (fs.existsSync(statePath)) {
      const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      console.log(`Resumed session ${sessionId} from checkpoint ${data.checkpoint.sequence}`);
      return data;
    }

    return this.createInitialState(sessionId);
  }

  // Event-triggered checkpoint
  async onEvent(event: CheckpointEvent): Promise<void> {
    const shouldSave = this.shouldCheckpointForEvent(event);

    if (shouldSave && this.canCheckpoint()) {
      await this.saveCheckpoint('event');
    }
  }

  // Interval-triggered checkpoint
  private startIntervalTimer(): void {
    this.intervalTimer = setInterval(async () => {
      if (this.canCheckpoint()) {
        await this.saveCheckpoint('interval');
      }
    }, this.config.intervalMs);
  }

  // Check debounce
  private canCheckpoint(): boolean {
    const now = Date.now();
    return now - this.lastCheckpointTime >= this.config.minIntervalMs;
  }

  // Save checkpoint to disk
  async saveCheckpoint(trigger: CheckpointTrigger): Promise<void> {
    this.checkpointSequence++;
    this.lastCheckpointTime = Date.now();

    this.state.updatedAt = new Date().toISOString();
    this.state.checkpoint = {
      trigger,
      sequence: this.checkpointSequence,
      lastEventTime:
        trigger === 'event' ? this.state.updatedAt : this.state.checkpoint.lastEventTime,
      lastIntervalTime:
        trigger === 'interval' ? this.state.updatedAt : this.state.checkpoint.lastIntervalTime,
    };

    const statePath = this.getStatePath(this.state.id);
    await Bun.write(statePath, JSON.stringify(this.state, null, 2));
  }

  // Update state methods
  addFinding(finding: Finding): void {
    this.state.findings.push(finding);
    this.onEvent({ type: 'finding', data: finding });
  }

  setPhase(phase: AnalysisPhase): void {
    if (this.state.phase !== phase) {
      this.state.completedPhases.push(this.state.phase);
      this.state.phase = phase;
      this.state.phaseProgress = 0;
      this.onEvent({ type: 'phase_complete', data: { phase } });
    }
  }

  cacheToolResult(toolCallId: string, tool: string, input: unknown, result: unknown): void {
    this.state.toolResultCache[toolCallId] = {
      tool,
      input,
      result,
      cachedAt: new Date().toISOString(),
    };
    this.onEvent({ type: 'tool_result', data: { tool } });
  }

  // Clean up on session complete
  async finalize(): Promise<void> {
    this.state.phase = 'complete';
    await this.saveCheckpoint('phase');

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }

  private getStatePath(sessionId: string): string {
    return path.join(process.cwd(), '.agentlint', 'sessions', `${sessionId}-state.json`);
  }
}
```

#### 5. Resume Flow

```typescript
async function resumeAnalysis(sessionId: string): Promise<void> {
  // 1. Resume SDK session (loads conversation history)
  const response = query({
    prompt: 'Continue the analysis from where we left off',
    options: {
      resume: sessionId,
      model: 'claude-sonnet-4-5',
    },
  });

  // 2. Load agentlint state
  const checkpointManager = new CheckpointManager(sessionId);
  const state = checkpointManager.getState();

  // 3. Inject state summary into conversation
  const stateSummary = generateStateSummary(state);
  console.log(`Resuming from phase: ${state.phase}`);
  console.log(`Findings so far: ${state.findings.length}`);
  console.log(`Checkpoint: #${state.checkpoint.sequence}`);

  // 4. Continue analysis from current phase
  await continueAnalysis(response, checkpointManager);
}

function generateStateSummary(state: SessionState): string {
  return `
Analysis session resumed. Current state:
- Phase: ${state.phase} (${state.phaseProgress}% complete)
- Findings: ${state.findings.length} detected
- Recommendations: ${state.recommendations.length} generated
- Last checkpoint: ${state.updatedAt}

Continue from where we left off.
  `.trim();
}
```

#### 6. Crash Recovery

```typescript
// On startup, check for incomplete sessions
async function checkForRecovery(): Promise<SessionState | null> {
  const sessionsDir = path.join(process.cwd(), '.agentlint', 'sessions');

  if (!fs.existsSync(sessionsDir)) return null;

  const stateFiles = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('-state.json'));

  for (const file of stateFiles) {
    const state = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf-8'));

    // Check if session was not completed
    if (state.phase !== 'complete') {
      return state;
    }
  }

  return null;
}

// CLI integration
async function main(): Promise<void> {
  const incompleteSession = await checkForRecovery();

  if (incompleteSession) {
    console.log(`Found incomplete session from ${incompleteSession.updatedAt}`);
    console.log(
      `Phase: ${incompleteSession.phase}, Findings: ${incompleteSession.findings.length}`
    );

    const shouldResume = await promptUser('Resume this session? (y/n)');

    if (shouldResume) {
      await resumeAnalysis(incompleteSession.id);
      return;
    }
  }

  // Start fresh analysis
  await startNewAnalysis();
}
```

#### 7. Tool Result Caching

```typescript
// When resuming, check cache before re-running expensive tools
async function getToolResult(
  checkpointManager: CheckpointManager,
  tool: string,
  input: unknown
): Promise<unknown> {
  const state = checkpointManager.getState();

  // Check cache for existing result
  for (const [id, cached] of Object.entries(state.toolResultCache)) {
    if (cached.tool === tool && deepEqual(cached.input, input)) {
      console.log(`Using cached result for ${tool}`);
      return cached.result;
    }
  }

  // Run tool and cache result
  const result = await runTool(tool, input);
  const toolCallId = generateId();
  checkpointManager.cacheToolResult(toolCallId, tool, input, result);

  return result;
}
```

#### 8. Session Cleanup

```typescript
// Clean up old completed sessions
async function cleanupOldSessions(retentionDays: number = 30): Promise<void> {
  const sessionsDir = path.join(process.cwd(), '.agentlint', 'sessions');
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const stateFiles = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('-state.json'));

  for (const file of stateFiles) {
    const filePath = path.join(sessionsDir, file);
    const state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Only clean up completed sessions older than retention period
    if (state.phase === 'complete') {
      const updatedAt = new Date(state.updatedAt).getTime();

      if (updatedAt < cutoff) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old session: ${state.id}`);
      }
    }
  }
}
```
