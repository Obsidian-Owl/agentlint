# Opencode SDK Integration

The `opencode` module provides the integration layer between agentlint and the Opencode SDK, replacing the previous Claude Agent SDK implementation.

## Purpose

This module enables agentlint to use Opencode for agent orchestration while maintaining full control over server lifecycle, tool registration, and local-first privacy compliance.

## Components

| Component               | File                 | Purpose                                              |
| ----------------------- | -------------------- | ---------------------------------------------------- |
| OpencodeOrchestrator    | orchestrator.ts      | Main orchestration integrating all sub-modules       |
| OpencodeServerManager   | server.ts            | Server lifecycle (start, stop, health monitoring)    |
| AgentlintOpencodeClient | client.ts            | SDK client wrapper for session and event interaction |
| AgentlintMcpServer      | mcp-server.ts        | MCP server exposing agentlint tools via JSON-RPC     |
| StreamAdapter           | streaming.ts         | Converts Opencode SSE events to StreamChunk format   |
| HybridSessionManager    | sessions.ts          | Manages Opencode sessions with agentlint metadata    |
| TelemetryTracker        | telemetry-tracker.ts | Tracks tool and LLM usage with FIFO correlation      |
| adaptTool               | tool-adapter.ts      | Converts Zod schemas to MCP-compatible JSON Schema   |

## Data Flow

```
CLI (analyse command)
  → OpencodeOrchestrator.run(task)
    → OpencodeServerManager.start()
    → AgentlintOpencodeClient.connect()
    → HybridSessionManager.startSession()
    → Client.prompt() → Client.subscribe()
    → StreamAdapter.adaptStream() → yields StreamChunk
    → TelemetryTracker forwards metrics
  → TUI renders StreamChunks
```

## Entry Points

The primary entry point is the `OpencodeOrchestrator` class, which implements the `IOrchestrator` interface defined in `src/orchestration/interfaces.ts`. The module also exports all components via `index.ts` for specialized use.

## Key Patterns

### Tool Adaptation

Tools are defined using Zod schemas and adapted to the Opencode MCP format via `adaptTool()`. This preserves type safety while ensuring compatibility with the SDK's expectations.

### Stream Conversion

The `StreamAdapter` converts Opencode's server-sent events into agentlint's internal `StreamChunk` format. This abstraction allows the TUI to remain agnostic of the underlying SDK.

### Telemetry Tracking

Since the Opencode SDK does not provide unique identifiers for tool calls, the `TelemetryTracker` uses a FIFO queue per tool name to correlate start and completion events for latency and usage tracking.

## Related

- [ADR-0024: Opencode SDK Migration](../../docs/architecture/adr/0024-opencode-sdk-migration.md)
- [ADR-0025: Telemetry Architecture](../../docs/architecture/adr/0025-telemetry-architecture.md)
- `src/orchestration/interfaces.ts`
