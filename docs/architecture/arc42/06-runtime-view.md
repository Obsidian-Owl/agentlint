# Section 6: Runtime View

> Key scenarios showing dynamic behavior and component interactions.

**Last Updated**: January 2026
**Related Sections**: [Building Blocks](05-building-blocks.md), [Quality Requirements](10-quality-requirements.md)

---

## 6.1 Full Analysis (`agentlint analyse`)

```
User          CLI           Orchestration        Tools          Adapter
  │            │                  │                 │               │
  │ analyse    │                  │                 │               │
  │───────────►│                  │                 │               │
  │            │ Parse command    │                 │               │
  │            │─────────────────►│                 │               │
  │            │                  │                 │               │
  │            │                  │ ┌─────────────────────────────┐ │
  │            │                  │ │ MASTER LOOP                 │ │
  │            │                  │ │                             │ │
  │            │                  │ │ 1. "Need config data"       │ │
  │            │                  │ │    invoke parse_config ────────►│
  │            │                  │ │                             │ │
  │            │                  │ │ 2. Observe result ◄────────────│
  │            │                  │ │                             │ │
  │            │                  │ │ 3. "Analyze sessions"       │ │
  │            │                  │ │    invoke search_sessions ────►│
  │            │                  │ │                             │ │
  │            │                  │ │ 4. Synthesize findings      │ │
  │            │                  │ │    Generate recommendations │ │
  │            │                  │ └─────────────────────────────┘ │
  │            │                  │                 │               │
  │            │ Stream findings  │                 │               │
  │◄───────────│◄─────────────────│                 │               │
```

**Key Characteristics**: Streaming output, agent-directed tool order, checkpointing.

---

## 6.2 Causal Tracing (`agentlint trace`)

User asks: "Why did my session add a secret to CLAUDE.md?"

```
┌─────────────────────────────────────────────────────────────┐
│ DETECT                                                       │
│   Tool: parse_config                                        │
│   Finding: "AWS_SECRET_KEY in CLAUDE.md:42"                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TRACE                                                        │
│   Tool: search_sessions                                     │
│   Finding: Session 2026-01-10, prompt "add my API config"   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ UNDERSTAND (Agent Reasoning)                                 │
│   Analysis: No credential handling guidance existed          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ RECOMMEND                                                    │
│   "Add: 'Use environment variables for credentials'"        │
│   Evidence: Issue → Session → Gap → Prevention              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6.3 Baseline Comparison (`agentlint compare`)

```
1. Load latest baseline from .agentlint/baselines/
2. Run current analysis
3. Calculate delta (jsondiffpatch)
4. Present comparison:

   ┌───────────────────────────────────────────────────┐
   │ Baseline: 2026-01-10 → Current: 2026-01-15       │
   │                                                   │
   │ Metrics:                                          │
   │   Config tokens: 1,200 → 1,450 (+20.8%)          │
   │   Warnings: 3 → 1 (-66.7%) ✓                     │
   │   Coverage: 65% → 78% (+13 pts) ✓                │
   │                                                   │
   │ Recommendations resolved: 2                       │
   │ New recommendations: 1                            │
   └───────────────────────────────────────────────────┘

5. Optionally save new baseline
```

---

## 6.4 Long-Running Session Support

Sessions may run 30+ minutes for thorough analysis:

| Feature | Implementation |
|---------|---------------|
| Streaming | Findings visible as discovered |
| Checkpointing | State saved after major phases |
| Resumability | `agentlint resume` continues from checkpoint |
| Pause/Resume | User can pause, review, continue |

### Session Recording (EP11)

Session checkpoints are recorded to disk for crash recovery and debugging:

**Storage Location**: `~/.agentlint/session-state/{sessionId}/`

```
~/.agentlint/session-state/
├── {session-uuid-1}/
│   ├── 0001.json           # First checkpoint
│   ├── 0002.json           # Second checkpoint
│   └── ...
├── {session-uuid-2}/
│   └── ...
└── ...
```

**Checkpoint Structure**:

```typescript
interface SessionCheckpoint {
  version: string;           // Schema version
  sessionId: string;         // UUID
  timestamp: string;         // ISO 8601
  sequence: number;          // Monotonic counter
  phase: AnalysisPhase;      // init | scan | analyze | recommend | complete
  trigger: CheckpointTrigger; // tool_complete | finding | phase_change | interval | etc.
  toolHistory: ToolCall[];   // Recent tool invocations
  findings: Finding[];       // Accumulated findings
  metrics: SessionMetrics;   // Token usage, elapsed time
  workspaceState?: unknown;  // Cognitive workspace state
}
```

**CLI Commands**:

| Command | Description |
|---------|-------------|
| `agentlint session list` | List recorded sessions with metadata |
| `agentlint session replay <id>` | Restore session state from checkpoint |
| `agentlint session delete <id>` | Remove a session's checkpoints |
| `agentlint session cleanup --days <n>` | Delete sessions older than n days |

**Retention Policy**: Sessions are retained for 30 days by default. Use `agentlint session cleanup` to manage storage.
