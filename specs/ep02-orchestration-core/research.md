# Research Findings: EP02 Orchestration Core

> **Created**: 2026-01-16
> **Status**: Complete

---

## Decision Log

### 1. SDK Version Selection

**Decision**: Pin `@anthropic-ai/claude-agent-sdk@0.2.7`

**Rationale**:
- Latest stable version as of 2026-01-16
- Released 2026-01-14 (v0.2.7)
- Stable V1 API with V2 preview available
- Migration from "Claude Code SDK" to "Claude Agent SDK" complete

**Alternatives Considered**:
- `@latest`: Rejected - could introduce breaking changes
- Earlier 0.1.x versions: Rejected - missing V1 API improvements

**References**:
- [GitHub Releases](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.2.7)
- [npm Package](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)

**Implementation Note**:
```json
// package.json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "0.2.7",
    "zod": "^3.24.1"
  }
}
```

---

### 2. Core API Pattern: `query()` Function

**Decision**: Use `query()` as the primary interface

**Rationale**:
- Implements master loop internally (`while(tool_call) → execute → repeat`)
- Returns `AsyncGenerator<SDKMessage>` for streaming
- Supports all required options: `resume`, `hooks`, `mcpServers`, `model`
- V2 interface available but V1 is stable and sufficient

**Key Pattern**:
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const result = query({
  prompt: taskPrompt,
  options: {
    model: 'claude-sonnet-4-20250514',
    cwd: process.cwd(),
    includePartialMessages: true,
    resume: sessionId,  // For session resume
    settingSources: ['project'],  // REQUIRED: Loads CLAUDE.md for analysis
    hooks: { /* ... */ },
    mcpServers: { /* ... */ },
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: customInstructions
    }
  }
});

for await (const message of result) {
  // Handle SDKMessage types
}
```

**References**:
- [TypeScript SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Code Behind-the-Scenes](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)

---

### 3. Tool Registration Pattern

**Decision**: Use `tool()` + `createSdkMcpServer()` for agentlint tools

**Rationale**:
- SDK-native pattern, MCP-compatible
- Type-safe with Zod schemas
- In-process execution (no IPC overhead)
- Consistent with ADR-0005

**Key Pattern**:
```typescript
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const parseConfigTool = tool(
  'parse_config',
  'Parse and analyze CLAUDE.md configuration file',
  {
    path: z.string().describe('Path to CLAUDE.md file'),
    includeMetrics: z.boolean().optional().describe('Include quality metrics')
  },
  async (args) => {
    // Tool implementation
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  }
);

const agentlintServer = createSdkMcpServer({
  name: 'agentlint',
  version: '0.1.0',
  tools: [parseConfigTool, /* ... more tools */]
});

// Register with query()
query({
  prompt: '...',
  options: {
    mcpServers: {
      agentlint: agentlintServer
    }
  }
});
```

**References**:
- [SDK TypeScript Reference - tool()](https://platform.claude.com/docs/en/agent-sdk/typescript#tool)
- [ADR-0005 Tool Definition Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)

---

### 4. Hooks System for Checkpointing

**Decision**: Use SDK hooks for checkpoint events

**Available Hooks**:
| Hook | Trigger | Use Case |
|------|---------|----------|
| `PostToolUse` | After tool execution | Checkpoint after findings |
| `SessionEnd` | Session terminates | Final checkpoint |
| `PreCompact` | Before context compression | Save pre-compression state |
| `SessionStart` | Session begins | Initialize state |
| `SubagentStart/Stop` | Subagent lifecycle | Track delegations |

**Key Pattern**:
```typescript
import type { HookCallback, PostToolUseHookInput } from '@anthropic-ai/claude-agent-sdk';

const checkpointHook: HookCallback = async (input, toolUseId, { signal }) => {
  if (input.hook_event_name === 'PostToolUse') {
    const { tool_name, tool_response, session_id } = input as PostToolUseHookInput;

    // Emit checkpoint event
    await emitCheckpoint({
      trigger: 'tool_complete',
      toolName: tool_name,
      sessionId: session_id,
      state: getCurrentState()
    });
  }

  return { continue: true };
};

query({
  prompt: '...',
  options: {
    hooks: {
      PostToolUse: [{ hooks: [checkpointHook] }],
      SessionEnd: [{ hooks: [finalCheckpointHook] }],
      PreCompact: [{ hooks: [preCompactHook] }]
    }
  }
});
```

**References**:
- [SDK Hooks Guide](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [ADR-0010 Session State](../../docs/architecture/adr/0010-session-state-and-checkpointing.md)

---

### 5. Session Resume Pattern

**Decision**: Use SDK's `resume` option with session ID

**Rationale**:
- SDK handles conversation restore internally
- agentlint adds state restoration via hooks
- `forkSession` option allows branching

**Key Pattern**:
```typescript
// Resume existing session
const result = query({
  prompt: 'Continue analysis',
  options: {
    resume: 'session-uuid-here',
    // forkSession: true,  // Optional: fork to new session
    hooks: {
      SessionStart: [{
        hooks: [async (input) => {
          if (input.hook_event_name === 'SessionStart' && input.source === 'resume') {
            // Restore agentlint state
            const state = await loadAgentlintState(input.session_id);
            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: 'SessionStart',
                additionalContext: formatStateForAgent(state)
              }
            };
          }
          return { continue: true };
        }]
      }]
    }
  }
});
```

**References**:
- [SDK Reference - resume option](https://platform.claude.com/docs/en/agent-sdk/typescript#options)

---

### 6. Streaming Output Pattern

**Decision**: Use `includePartialMessages: true` for real-time streaming

**Message Types**:
| Type | When | Content |
|------|------|---------|
| `SDKPartialAssistantMessage` | During generation | Streaming chunks |
| `SDKAssistantMessage` | After completion | Full message |
| `SDKSystemMessage` | Session init | Tools, model info |
| `SDKResultMessage` | Session end | Cost, duration, stats |
| `SDKCompactBoundaryMessage` | Context compaction | Compression metadata |

**Key Pattern**:
```typescript
import type {
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKCompactBoundaryMessage,
} from '@anthropic-ai/claude-agent-sdk';

const result = query({
  prompt: '...',
  options: {
    includePartialMessages: true,
    settingSources: ['project'],  // REQUIRED: Loads CLAUDE.md for analysis
  }
});

for await (const message of result) {
  switch (message.type) {
    case 'stream_event': {
      // Real-time streaming chunk (SDKPartialAssistantMessage)
      const partial = message as SDKPartialAssistantMessage;
      handleStreamChunk(partial.event);
      break;
    }
    case 'assistant': {
      // Complete assistant message (SDKAssistantMessage)
      const assistant = message as SDKAssistantMessage;
      handleAssistantMessage(assistant.message);
      break;
    }
    case 'result': {
      // Final result (SDKResultMessage)
      const resultMsg = message as SDKResultMessage;
      handleResult(resultMsg);
      break;
    }
    case 'system': {
      // System messages include init and compact_boundary
      const sysMsg = message as SDKSystemMessage | SDKCompactBoundaryMessage;
      if ('subtype' in sysMsg && sysMsg.subtype === 'compact_boundary') {
        const compactMsg = sysMsg as SDKCompactBoundaryMessage;
        handleCompaction(compactMsg.compact_metadata);
      }
      break;
    }
  }
}
```

**Verbosity Mapping** (per C3):
| Level | Include |
|-------|---------|
| `quiet` | Only `result` with errors |
| `normal` | `result`, `system:init` |
| `verbose` | + `assistant`, tool invocations |
| `debug` | + `stream_event`, `compact_boundary` |

---

### 7. System Prompt Configuration

**Decision**: Use Claude Code preset with append

**Rationale**:
- Inherits Claude Code's proven system prompt
- `append` adds agentlint-specific guidance
- Keeps cognitive workspace structure

**Key Pattern**:
```typescript
const agentlintSystemPrompt = `
## agentlint Analysis Context

You are the agentlint analysis agent. Your task is to analyze AI-assisted development workflows.

### Current Session
- Session ID: ${sessionId}
- Phase: ${phase}
- Findings: ${findingsCount}

### Analysis Guidelines
- Use tools to gather data before reasoning
- Trace issues to their origin (config, session, git)
- Generate preventive recommendations, not just symptomatic fixes
- Report findings incrementally for checkpointing

### Available agentlint Tools
- parse_config: Analyze CLAUDE.md configuration
- search_sessions: Search session logs
- trace_origin: Trace issue to origin
- query_baseline: Compare against baseline
`;

query({
  prompt: taskPrompt,
  options: {
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: agentlintSystemPrompt
    }
  }
});
```

---

### 8. Configuration Schema

**Decision**: Global config at `~/.agentlint/config.json`

**Schema**:
```typescript
interface AgentlintConfig {
  model: string;  // Default: 'claude-sonnet-4-20250514'
  checkpoint: {
    intervalMs: number;  // Default: 60000 (60s)
  };
  verbosity: 'quiet' | 'normal' | 'verbose' | 'debug';  // Default: 'normal'
}
```

**Default Values**:
```json
{
  "model": "claude-sonnet-4-20250514",
  "checkpoint": {
    "intervalMs": 60000
  },
  "verbosity": "normal"
}
```

---

### 9. Error Handling Pattern

**Decision**: Extend existing `AgentlintError` hierarchy

**New Error Types**:
```typescript
// src/errors/orchestration.ts

export class OrchestrationError extends AgentlintError {
  constructor(message: string) {
    super(message, ExitCode.GeneralError);
    this.name = 'OrchestrationError';
  }
}

export class SessionResumeError extends OrchestrationError {
  constructor(sessionId: string, reason: string) {
    super(`Failed to resume session ${sessionId}: ${reason}`);
    this.name = 'SessionResumeError';
  }
}

export class ToolRegistrationError extends OrchestrationError {
  constructor(toolName: string, reason: string) {
    super(`Failed to register tool ${toolName}: ${reason}`);
    this.name = 'ToolRegistrationError';
  }
}

export class ApiKeyError extends AgentlintError {
  constructor() {
    super('API key invalid or expired. Session saved. Re-run with valid ANTHROPIC_API_KEY.');
    this.name = 'ApiKeyError';
  }
}
```

---

### 10. Testing Strategy (per ADR-0011)

**Decision**: VCR recordings + mock tools

**Test Structure**:
```
tests/
├── unit/
│   └── orchestration/
│       ├── tool-registry.test.ts
│       ├── checkpoint.test.ts
│       └── streaming.test.ts
├── integration/
│   ├── recordings/
│   │   └── orchestrator-flow.json
│   └── orchestration/
│       └── orchestrator.test.ts
└── fixtures/
    └── mock-tools.ts
```

**Mock Tool Pattern**:
```typescript
// tests/fixtures/mock-tools.ts
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const mockParseConfig = tool(
  'parse_config',
  'Mock config parser for testing',
  { path: z.string() },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify({ score: 85, warnings: [] }) }]
  })
);
```

---

## Open Items

All research items resolved. No blockers for Phase 2.

---

## Sources

- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Code Behind-the-Scenes](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [GitHub - claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [SDK Hooks Guide](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [ADR-0005 Tool Definition](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
- [ADR-0010 Session State](../../docs/architecture/adr/0010-session-state-and-checkpointing.md)
- [ADR-0011 Testing Strategy](../../docs/architecture/adr/0011-testing-strategy-for-agentic-components.md)
