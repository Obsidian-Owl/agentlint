# EP19: MCP Integration Data

## Business Outcome Hypothesis

**If** we provide tools for MCP integration data from session logs,
**Then** the agent can analyze MCP server usage, reason about error patterns, and provide optimization recommendations,
**Measured by** MCP data accuracy, error pattern visibility, and recommendation relevance.

## Classification

* **Type**: Business
* **Priority**: P2-Medium
* **Size**: S
* **Duration**: 3 weeks
* **Dependencies**: EP06 (Session Analysis)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* MCP tool invocation extraction from session logs (`mcp__*` prefix)
* Per-server usage data (call count, success/failure counts)
* Error message extraction with categorization
* MCP configuration parsing for server inventory
* Data access tools for agent-driven MCP analysis

## Out of Scope

* MCP server configuration management
* Real-time MCP monitoring
* MCP server discovery/installation
* Programmatic health scoring (agent reasons about health)

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **MCP Tool Extractor**
   - Parse `tool_use.name.startsWith("mcp__")` entries
   - Extract server name from tool name prefix
   - Track invocation success/failure via `is_error` flag
   - Capture error messages for agent analysis

2. **Server Usage Data**
   - Aggregate call counts per MCP server
   - Track success/failure counts per server
   - Extract usage frequency data (timestamps, sessions)
   - Provide data for agent to reason about patterns

3. **Error Data Extraction**
   - Extract error messages with timestamps
   - Provide error text for agent classification
   - Include context (which tool, what input hash)

4. **MCP Configuration Parser**
   - Read MCP config from `.mcp.json` or settings
   - Extract configured server list
   - Provide configuration data for comparison with usage

5. **MCP Data Access Tools**
   - `getMcpServerStatsTool` - Query per-server usage data
   - `getMcpErrorsTool` - Query error events with context
   - `getMcpConfigTool` - Get configured MCP servers

**Agent Reasoning (NOT tools):**
- Whether error rates indicate a problem
- Which servers are "unhealthy" or need attention
- Whether usage patterns are appropriate
- What configuration changes to recommend
- How to troubleshoot specific error types

### Phase 2: Integration (Week 2-3)

1. **CLI Integration**
   - Add MCP data to `agentlint analyse` output
   - Add `--mcp` flag for focused MCP analysis
   - Agent presents findings with recommendations

2. **Configuration Comparison**
   - Provide data for agent to compare configured vs. used servers
   - Agent reasons about configuration drift
   - Agent identifies unused servers

3. **Testing**
   - Unit tests for MCP tool extraction, config parsing
   - Integration tests for MCP data queries
   - Evaluations for agent reasoning quality (VCR + LLM-as-judge)

### Phase 3: Cleanup (Week 3)

1. **Dead Code Removal**
   - Remove any redundant MCP extraction code
   - Clean up temporary data extraction scaffolding

2. **Documentation**
   - Update Arc42 with MCP Data component
   - Update ADR-0006 with MCP data extension
   - Add MCP data interpretation guide

## Technical Approach

### MCP Tool Extraction

```typescript
interface McpToolCall {
  sessionId: string;
  serverName: string;
  toolName: string;
  timestamp: string;
  isError: boolean;
  errorMessage?: string;
}

// Deterministic extraction—tool extracts data, agent reasons about health
function extractMcpCalls(entries: SessionEntry[]): McpToolCall[] {
  const mcpCalls: McpToolCall[] = [];

  for (const entry of entries) {
    for (const block of entry.message?.content || []) {
      if (block.type === 'tool_use' && block.name.startsWith('mcp__')) {
        // Parse server name: mcp__servername__toolname or mcp__servername
        const parts = block.name.split('__');
        const serverName = parts[1] || 'unknown';
        const toolName = parts.slice(2).join('__') || block.name;

        mcpCalls.push({
          sessionId: entry.sessionId,
          serverName,
          toolName,
          timestamp: entry.timestamp,
          isError: entry.isError || false,
          errorMessage: entry.errorMessage,
        });
      }
    }
  }

  return mcpCalls;
}
```

### Database Schema

```sql
-- Raw MCP data for agent analysis
CREATE TABLE mcp_tool_calls (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_error BOOLEAN NOT NULL DEFAULT 0,
  error_message TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_mcp_calls_session ON mcp_tool_calls(session_id);
CREATE INDEX idx_mcp_calls_server ON mcp_tool_calls(server_name);
```

**Note**: No `mcp_server_health` table with health scores—agent reasons about this from raw data.

### Server Stats Query

```typescript
interface McpServerStats {
  serverName: string;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  errorMessages: string[];  // Raw messages for agent analysis
  firstCall: string;
  lastCall: string;
}

// Returns data for agent to reason about server health
function getServerStats(serverName: string, calls: McpToolCall[]): McpServerStats {
  const serverCalls = calls.filter((c) => c.serverName === serverName);
  const errors = serverCalls.filter((c) => c.isError);

  return {
    serverName,
    totalCalls: serverCalls.length,
    successCount: serverCalls.length - errors.length,
    errorCount: errors.length,
    errorMessages: errors.map(e => e.errorMessage).filter(Boolean),
    firstCall: serverCalls[0]?.timestamp || '',
    lastCall: serverCalls[serverCalls.length - 1]?.timestamp || '',
    // Agent decides if this is "healthy" or "unhealthy"
  };
}
```

## Success Criteria

- [ ] Tools provide MCP call data, error events, and server config
- [ ] Agent can reason about server health using provided data
- [ ] Agent can compare configured vs. used servers
- [ ] Clean data extraction with no embedded judgments
- [ ] Tools return data; agent provides judgment (Constitution Principle VII)

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | MCP data enables integration optimization |
| III. Causal-First | Agent traces errors to configuration or server issues |
| VII. Intelligent Tooling | Tools provide data; agent reasons about health |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
