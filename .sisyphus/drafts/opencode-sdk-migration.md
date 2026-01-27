# Draft: Opencode SDK Migration

## Requirements (confirmed)

### User Decisions (2024-01-28)

1. **Server Management**: A) agentlint manages
   - agentlint starts opencode server on launch, stops on exit
   - Self-contained deployment model

2. **Tool Architecture**: A) MCP Server bundled
   - Build MCP server that Opencode connects to
   - Tools ship with binary, self-contained

3. **Migration Strategy**: BIG BANG
   - Early dev phase, no users, no impact
   - Full rewrite acceptable, no adapter layer needed

4. **Session Strategy**: A) Hybrid extend
   - Use Opencode sessions as base
   - Extend with agentlint metadata (findings, checkpoints)

5. **Breaking Changes**: C) Significant
   - Full UX redesign acceptable if it improves product
   - Optimize for clean architecture over backwards compatibility

## User's Original Request

Migrate agentlint from `@anthropic-ai/claude-agent-sdk` v0.2.7 to `@opencode-ai/sdk` (Opencode SDK).

## Scope Assessment (from codebase analysis)

### Current SDK Footprint

**Direct SDK Imports**: 45 files across the codebase

**Pattern 1 - Core Orchestration** (3 files):

- `src/orchestration/orchestrator.ts` - Main `query()` wrapper (1009 lines)
- `src/orchestration/tool-registry.ts` - MCP server creation via `createSdkMcpServer()`
- `src/orchestration/can-use-tool.ts` - Permission callback (`PermissionResult`)

**Pattern 2 - Tool Definitions** (40 files):
All use `import { tool } from '@anthropic-ai/claude-agent-sdk'` with pattern:

```typescript
tool('tool_name', `description`, { argSchema: z.string().describe('...') }, async (args) => {
  return { content: [{ type: 'text', text: output }], _rawData: structured };
});
```

**Pattern 3 - Types/Adapters** (2 files):

- `src/prompts/adapters/claude-agent-sdk.ts` - SDK message format conversion
- `src/act/types.ts` - `AgentDefinition` interface

### ACT Subagent System (6 files)

- `src/act/index.ts` - `buildACTSubagents()` returns `Record<string, AgentDefinition>`
- `src/act/registry.ts` - Manages subagent instructions, converts to SDK format
- `src/act/types.ts` - `AgentDefinition`, `ACTInstructions` schemas
- `src/act/instructions/*.ts` - Claude-code, generalized analyzer instructions

**Key Constraint**: Subagents cannot invoke `Task` tool (depth=1 max per Constitution C8)

### Identified Tech Debt

1. **SDK Type Probing** (`tool-registry.ts:221-238`):

   ```typescript
   // Probes internal SDK structure to extract tool names
   const toolAny = toolDef as any;
   if (typeof toolAny.name === 'string') {
     return toolAny.name;
   }
   if (toolAny.name?.name && typeof toolAny.name.name === 'string') {
     return toolAny.name.name;
   }
   ```

2. **eslint-disable blocks**: Multiple files disable type checking for SDK interop
   - `orchestrator.ts`: 300+ lines of SDKMessage processing with `as any`

3. **Hardcoded Claude Code path resolution** (`orchestrator.ts:596-634`)

4. **Prompt adapter coupling** - SDK-specific message format in `claude-agent-sdk.ts`

## Architecture Differences (Critical)

| Aspect           | Claude Agent SDK                    | Opencode SDK                           |
| ---------------- | ----------------------------------- | -------------------------------------- |
| Architecture     | Library (direct API)                | Client-Server (HTTP on port 4096)      |
| Entry Point      | `query()` function                  | `client.session.prompt()`              |
| Tool Definition  | `tool(name, desc, schema, handler)` | `tool({ description, args, execute })` |
| Tool Location    | In-code registration                | File-based `.opencode/tools/`          |
| Tool Return      | `{ content: [...], _rawData }`      | String or object                       |
| Agent Definition | Code: `agents` option               | Config: `opencode.json` or `.md`       |
| MCP Integration  | `createSdkMcpServer()`              | Config: `mcp:` in JSON                 |
| Streaming        | `AsyncIterable<SDKMessage>`         | Server-Sent Events                     |
| Permissions      | `canUseTool` callback               | Config: `permission:`                  |
| State            | In-memory `SessionState`            | Server-side persistent sessions        |

## Open Questions

1. **Opencode Server Lifecycle**: Who starts/stops the Opencode server?
   - Does agentlint start its own server?
   - Does it connect to an existing user-running server?
   - How does this affect the TUI integration?

2. **Tool Location Strategy**: Should tools remain in-code or move to `.opencode/tools/`?
   - In-code = bundled with agentlint binary
   - File-based = requires `.opencode/` directory setup

3. **Session Persistence**: Opencode has server-side sessions.
   - Does this replace agentlint's custom `SessionState`?
   - What about crash recovery and checkpoints?

4. **Local-First Principle (Constitution I)**: Server model implications?
   - Server runs locally = still local-first
   - But adds process management complexity

5. **Migration Strategy**: Big-bang or phased approach?
   - Option A: Complete replacement in one epic
   - Option B: Adapter layer allowing both SDKs
   - Option C: Phased migration by layer

6. **Testing During Migration**: How to maintain test coverage?
   - VCR cassettes tied to current SDK responses
   - Integration tests assume `query()` interface

## Technical Decisions

_Pending interview_

## Research Findings

### From Codebase Analysis

1. **Tool count**: 40+ tools need migration
2. **ACT subagents**: 2 registered (claude-code, generalized)
3. **Streaming critical**: TUI depends on `StreamChunk` from `processMessage()`
4. **Permission system**: TUI has custom `TuiPermissionHandler`
5. **Telemetry integration**: `trackToolEx`, `trackLLMEx` in orchestrator

### Opencode SDK Characteristics (from user context)

1. Plugin system for hooks (`tool.execute.after`, `session.idle`)
2. Agents defined in markdown or JSON config
3. Tools are file-based TypeScript modules
4. Permissions are config-based, not callback-based
5. MCP servers configured in `opencode.json`

## Scope Boundaries

### Likely INCLUDE

- All 45 files with SDK imports
- Test utilities (`tests/utils/sdk-test-helpers.ts`)
- TUI integration with streaming
- ACT subagent system
- Permission handling

### Likely EXCLUDE (TBD)

- Non-SDK business logic (persistence, parsers)
- UI components (unless streaming changes require it)
- External integrations (telemetry, etc.)

## Risk Assessment

### HIGH RISK

- **Breaking streaming**: TUI depends on real-time chunks
- **Tool migration volume**: 40+ tools, high error probability
- **Subagent behavior change**: Different delegation model

### MEDIUM RISK

- **Server lifecycle**: Process management complexity
- **Session state**: Different persistence model
- **Test infrastructure**: VCR cassettes may need re-recording

### LOW RISK

- **Type changes**: More explicit in Opencode
- **Permission config**: Simpler than callback model

## Interview Questions to Ask

1. Migration strategy preference (big-bang vs phased)?
2. Server lifecycle ownership (agentlint-managed vs external)?
3. Tool location preference (bundled vs file-based)?
4. Timeline/deadline constraints?
5. Acceptable downtime during migration?
