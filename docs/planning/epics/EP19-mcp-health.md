# EP19: MCP Integration Health

## Business Outcome Hypothesis

**If** we implement MCP integration health monitoring from session logs,
**Then** users can identify misconfigured, underused, or failing MCP servers and optimize their external tool integrations,
**Measured by** MCP error rate reduction, unused server identification, and usage pattern insights.

## Classification

* **Type**: Business
* **Priority**: P2-Medium
* **Size**: S
* **Duration**: 3 weeks
* **Dependencies**: EP06 (Session Analysis)
* **Extends**: ADR-0006 (Session Log Processing Architecture)

## In Scope

* MCP tool invocation detection from session logs (`mcp__*` prefix)
* Per-server usage statistics (call count, error rate)
* Unused server identification (configured but never called)
* Error pattern analysis (connection, timeout, auth failures)
* Server health scoring

## Out of Scope

* MCP server configuration management
* Real-time MCP monitoring
* MCP server discovery/installation
* Performance benchmarking of MCP servers

## Key Deliverables

### Phase 1: Core Implementation (Weeks 1-2)

1. **MCP Tool Detector**
   - Parse `tool_use.name.startsWith("mcp__")` entries
   - Extract server name from tool name prefix
   - Track invocation success/failure via `is_error` flag
   - Capture error messages for failure analysis

2. **Server Usage Analyzer**
   - Aggregate calls per MCP server
   - Calculate error rate per server
   - Identify usage frequency patterns (daily, session-based)
   - Detect unused servers (0 calls over analysis period)

3. **Error Pattern Classifier**
   - Connection errors (server unreachable)
   - Timeout errors (slow responses)
   - Authentication errors (credential issues)
   - Schema errors (invalid tool input)

4. **Health Scoring**
   - Per-server health score (0-100)
   - Factors: error rate, usage frequency, error diversity
   - Thresholds: healthy (>80), degraded (50-80), unhealthy (<50)

5. **MCP Health Tools**
   - `analyzeMcpHealthTool` - Comprehensive MCP health analysis
   - `getMcpServerStatsTool` - Query per-server metrics
   - `identifyUnusedServersTool` - Find configured but unused servers

### Phase 2: Integration (Week 2-3)

1. **CLI Integration**
   - Add MCP health to `agentlint analyse` output
   - Add `--mcp` flag for focused MCP analysis
   - Show health scores with action recommendations

2. **Configuration Cross-Reference**
   - Read MCP config from `.mcp.json` or settings
   - Compare configured servers vs. actually used
   - Identify configuration drift

3. **Testing**
   - Unit tests for MCP tool detection, error classification
   - Integration tests for health scoring
   - Test fixtures with varied MCP usage patterns

### Phase 3: Cleanup (Week 3)

1. **Dead Code Removal**
   - Remove any redundant MCP tracking code
   - Clean up temporary analysis scaffolding

2. **Documentation**
   - Update Arc42 with MCP Health component
   - Update ADR-0006 with MCP health extension
   - Add MCP troubleshooting guide

## Technical Approach

### MCP Tool Detection

```typescript
interface McpToolCall {
  sessionId: string;
  serverName: string;
  toolName: string;
  timestamp: string;
  isError: boolean;
  errorMessage?: string;
}

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
CREATE TABLE mcp_tool_calls (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  server_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  is_error BOOLEAN NOT NULL DEFAULT 0,
  error_type TEXT,
  error_message TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_mcp_calls_session ON mcp_tool_calls(session_id);
CREATE INDEX idx_mcp_calls_server ON mcp_tool_calls(server_name);
```

### Health Scoring

```typescript
interface McpServerHealth {
  serverName: string;
  totalCalls: number;
  errorCount: number;
  errorRate: number;
  errorTypes: Record<string, number>;
  healthScore: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unused';
  recommendations: string[];
}

function calculateServerHealth(
  serverName: string,
  calls: McpToolCall[]
): McpServerHealth {
  const serverCalls = calls.filter((c) => c.serverName === serverName);
  const errorCount = serverCalls.filter((c) => c.isError).length;
  const errorRate = serverCalls.length > 0 ? errorCount / serverCalls.length : 0;

  // Classify errors
  const errorTypes: Record<string, number> = {};
  for (const call of serverCalls.filter((c) => c.isError)) {
    const type = classifyError(call.errorMessage);
    errorTypes[type] = (errorTypes[type] || 0) + 1;
  }

  // Calculate health score
  let healthScore = 100;
  healthScore -= errorRate * 50; // Up to -50 for errors
  healthScore -= Object.keys(errorTypes).length * 10; // -10 per error type

  const status =
    serverCalls.length === 0
      ? 'unused'
      : healthScore > 80
        ? 'healthy'
        : healthScore > 50
          ? 'degraded'
          : 'unhealthy';

  return {
    serverName,
    totalCalls: serverCalls.length,
    errorCount,
    errorRate,
    errorTypes,
    healthScore: Math.max(0, healthScore),
    status,
    recommendations: generateRecommendations(status, errorTypes),
  };
}
```

## Success Criteria

- [ ] Can detect MCP tool calls with server attribution
- [ ] Can calculate per-server health scores
- [ ] Can identify unused/misconfigured servers
- [ ] Can classify error patterns with recommendations
- [ ] Integration with EP17 TUI for MCP health exploration

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| II. Improvement-Oriented | MCP health tracking enables integration optimization |
| III. Causal-First | Error classification traces issues to root cause |
| VII. Intelligent Tooling | Health data supports agent reasoning about tools |

## Related Documents

- [ADR-0006: Session Log Processing Architecture](../../architecture/adr/0006-session-log-processing-architecture.md)
- [Strategic Review](../../review/agentlint-strategic-review-jan26.md)
