---
status: accepted
date: 2026-01-28
decision-makers: [Project Lead]
consulted: []
informed: []
supersedes: [ADR-0002, ADR-0005, ADR-0010]
---

# ADR-0024: Opencode SDK Migration

## Context and Problem Statement

agentlint was originally built on the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) as decided in ADR-0002. While this provided proven infrastructure for agent orchestration, we encountered limitations as the project evolved:

1. **Server Lifecycle Control**: The SDK managed its own server processes, limiting our ability to implement robust crash recovery and health monitoring
2. **MCP Integration**: External MCP server processes added deployment complexity
3. **Local-First Architecture**: The SDK's design didn't fully align with Constitution Principle I (Local-First Privacy)
4. **Tool Definition Rigidity**: SDK-specific `tool()` function created tight coupling

With agentlint still in early development (no production users), we have an opportunity for a clean migration to better-aligned infrastructure.

## Decision Drivers

- **Local-First Architecture**: agentlint must control all server processes for privacy compliance
- **Self-Managed Lifecycle**: Need full control over server start/stop/health monitoring
- **MCP Bundling**: Prefer bundled MCP server over external processes
- **SDK Agnosticism**: PromptKit (ADR-0022) already provides SDK-agnostic prompts
- **Tech Debt Resolution**: Existing `any` types and eslint-disable blocks for SDK interop

## Considered Options

1. Continue with Claude Agent SDK (status quo)
2. Migrate to Opencode SDK
3. Build custom orchestration layer from scratch

## Decision Outcome

Chosen option: **"Migrate to Opencode SDK"** because it provides:

- Server-side MCP server management with full lifecycle control
- Built-in tool registration and agent configuration
- Better alignment with local-first architecture
- Clean migration path for existing tools and prompts

### Implementation Approach

Big-bang migration (24 tasks across 5 waves):

1. **Wave 1**: Foundation (dependency, server manager, client wrapper)
2. **Wave 2**: Core infrastructure (MCP server, tool adapter, streaming, sessions)
3. **Wave 3**: Tool migration (40 tools converted to Opencode format)
4. **Wave 4**: Integration (ACT subagents, orchestrator, TUI, permissions)
5. **Wave 5**: Cleanup (tests, types, documentation)

### Consequences

**Good:**

- Full control over server lifecycle (start, stop, health monitoring, crash recovery)
- Bundled MCP server eliminates external process management
- Cleaner tool definitions via `adaptTool()` wrapper
- SDK-agnostic architecture validated (prompts unchanged during migration)
- Tech debt resolved (removed `any` types and eslint-disable blocks)

**Bad:**

- Significant migration effort (24 tasks, 3-4 weeks)
- Old SDK code remains as dead code for test compatibility
- Learning curve for new SDK patterns

**Neutral:**

- StreamChunk abstraction preserved (TUI unchanged)
- Tool interface semantically unchanged (only wrapper syntax changed)
- Session persistence approach similar (hybrid: SDK base + agentlint metadata)

## Superseded ADRs

This ADR supersedes the following decisions:

- **ADR-0002**: Agentic Framework Strategy - Original Claude Agent SDK selection
- **ADR-0005**: Tool Definition Pattern - SDK-specific `tool()` function pattern
- **ADR-0010**: Session State and Checkpointing - SDK-specific session management

The superseded ADRs remain in the repository for historical reference.

## New Architecture

### Components Created

```
src/opencode/
├── server.ts              # OpencodeServerManager - lifecycle control
├── client.ts              # AgentlintOpencodeClient - SDK wrapper
├── mcp-server.ts          # AgentlintMcpServer - tool registration
├── tool-adapter.ts        # adaptTool() - tool format conversion
├── streaming.ts           # StreamAdapter - SSE → StreamChunk
├── sessions.ts            # HybridSessionManager - session persistence
└── orchestrator.ts        # OpencodeOrchestrator - main orchestration
```

### Tool Migration Pattern

```typescript
// Before (Claude Agent SDK)
import { tool } from '@anthropic-ai/claude-agent-sdk';
export const myTool = tool('name', 'desc', schema, handler);

// After (Opencode SDK)
import { adaptTool } from '../../opencode/tool-adapter';
export const myTool = adaptTool({
  name: 'name',
  description: 'desc',
  schema: schema,
  handler: async (args) => {
    /* same logic */
  },
});
```

### ACT Subagent Configuration

Programmatic approach using `buildOpencodeAgents()` instead of markdown config files:

```typescript
// Returns Record<string, OpencodeAgentConfig>
const agents = buildOpencodeAgents();
// Passed to createOpencodeServer({ config: { agent: {...} } })
```

## Validation

- All 4178 tests passing
- TypeScript: 0 errors
- 40 tools successfully migrated
- TUI streaming verified
- SDK-agnostic prompt architecture (ADR-0022) validated

## References

- `.sisyphus/plans/opencode-sdk-migration.md` - Full migration plan
- `.sisyphus/notepads/opencode-sdk-migration/` - Implementation notes
- ADR-0022: PromptKit SDK-Agnostic Architecture (validated by this migration)
- Constitution Principle I: Local-First Privacy
