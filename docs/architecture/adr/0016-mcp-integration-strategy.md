---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0016: MCP Integration Strategy

## Context and Problem Statement

Model Context Protocol (MCP) has become the industry standard for AI tool integration, with adoption by ChatGPT, Cursor, Gemini, VS Code, and Microsoft Copilot. As of December 2025, MCP was donated to the Linux Foundation's Agentic AI Foundation, with founding members including OpenAI, Google, Microsoft, Amazon, Anthropic, and Block.

Given MCP's trajectory, we need to decide how agentlint should integrate with the protocol. However, ADR-0002 (Claude Agent SDK) and ADR-0005 (Tool Definition Pattern) already provide MCP compatibility at the definition level.

## Decision Drivers

- **Future-Proofing**: Ensure architecture doesn't block later MCP adoption
- **MVP Focus**: Avoid premature complexity for features not yet needed
- **Existing Compatibility**: ADR-0002/0005 already provide MCP-compatible patterns
- **Ecosystem Direction**: MCP is clearly the industry direction (97M monthly downloads, 10K+ servers)
- **Overhead Awareness**: MCP adds milliseconds of latency per call (negligible for agent use cases)

## Considered Options

1. Defer full MCP integration (maintain current compatibility)
2. Add MCP server consumption capability
3. Expose agentlint as MCP server
4. Full MCP adoption (both directions)

## Decision Outcome

**Chosen option: "Defer full MCP integration"** because ADR-0002 and ADR-0005 already provide MCP compatibility at the tool definition level. The Claude Agent SDK creates MCP-compatible tool definitions via the `tool()` function, and the SDK natively supports MCP connectors if needed later. No additional work is required for future-proofing.

This is an explicit **defer decision**—we acknowledge MCP's importance while avoiding premature complexity.

### Consequences

**Good:**
- Zero additional implementation work for MVP
- Current tool definitions are already MCP-compatible (format)
- Claude Agent SDK provides native MCP connector support if needed later
- Can add full MCP integration when concrete use cases emerge
- Avoids protocol overhead for internal-only tools

**Bad:**
- Cannot consume ecosystem MCP servers (filesystem, GitHub, etc.) immediately
- Other agents cannot invoke agentlint via MCP until we add server capability
- May need to revisit if ecosystem integration becomes valuable

**Neutral:**
- Decision explicitly documented for future reference
- Clear upgrade path exists via Claude Agent SDK

## Pros and Cons of Options

### Option 1: Defer Full MCP Integration (Current State)

Maintain ADR-0002/0005's MCP-compatible tool definitions without adding MCP protocol runtime.

- Good: Zero additional implementation
- Good: Tool definitions already MCP-compatible via SDK `tool()` function
- Good: SDK provides MCP connector support if needed later
- Good: No protocol overhead for internal tools
- Good: MVP stays focused
- Neutral: Explicit defer decision, not neglect
- Bad: Cannot consume ecosystem MCP servers
- Bad: Cannot expose agentlint to external MCP clients

### Option 2: Add MCP Server Consumption

Enable consuming external MCP servers via `.mcp.json` configuration.

- Good: Access to 10,000+ ecosystem MCP servers
- Good: Low implementation effort (SDK supports it natively)
- Good: Extends capabilities without custom tool development
- Neutral: Adds dependency on external MCP server processes
- Bad: Protocol overhead per tool call
- Bad: Complexity of managing external server lifecycle
- Bad: Unclear which MCP servers agentlint would actually use

### Option 3: Expose agentlint as MCP Server

Package agentlint's analysis capabilities as an MCP server for other agents.

- Good: Other agents (ChatGPT, Cursor) could invoke agentlint
- Good: Positions agentlint in ecosystem
- Good: Enables composition with other tools
- Neutral: Requires defining stable public API
- Bad: Medium implementation effort
- Bad: Must maintain backward compatibility
- Bad: Unclear demand for this capability

### Option 4: Full MCP Adoption

Both consume ecosystem MCP servers and expose agentlint as MCP server.

- Good: Full ecosystem participation
- Good: Maximum flexibility
- Good: Positioned for future interoperability
- Neutral: Aligns with industry direction
- Bad: Highest implementation complexity
- Bad: Protocol overhead in both directions
- Bad: Premature for MVP—no concrete use cases yet

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | MCP servers run locally; no cloud dependency |
| II. Improvement-Oriented | N/A | Protocol choice doesn't affect improvement model |
| III. Causal-First | N/A | Protocol choice doesn't affect causal analysis |
| IV. Mixed-Methods | N/A | Protocol choice doesn't affect analysis methods |
| V. Language-Agnostic | Yes | MCP is language-agnostic protocol |
| VI. Agent-Agnostic | Yes | MCP enables multi-agent interoperability |
| VII. Intelligent Tooling | Yes | Tools remain freely selectable by agent |
| VIII. Compounding Value | N/A | Protocol choice doesn't affect baselines |
| IX. Agent-Aware | Yes | MCP compatibility preserved for future integration |

## More Information

### Related Documents

- Design Decisions: [DD-017](../design-decisions.md#dd-017-mcp-integration-strategy)
- Prior Decisions: [ADR-0002 - Agentic Framework](./0002-agentic-framework-strategy.md), [ADR-0005 - Tool Definition Pattern](./0005-tool-definition-and-invocation-pattern.md)

### Research Sources

- [MCP joins the Agentic AI Foundation - MCP Blog](http://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation/)
- [Linux Foundation Announces Agentic AI Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
- [GitHub Blog - MCP joins Linux Foundation](https://github.blog/open-source/maintainers/mcp-joins-the-linux-foundation-what-this-means-for-developers-building-the-next-era-of-ai-tools-and-agents/)
- [MCP in the Claude Agent SDK - Claude Docs](https://docs.claude.com/en/docs/agent-sdk/mcp)
- [API vs MCP: Everything You Need to Know - Composio](https://composio.dev/blog/api-vs-mcp-everything-you-need-to-know)
- [MCP vs APIs: When to Use Which - Tinybird](https://www.tinybird.co/blog/mcp-vs-apis-when-to-use-which-for-ai-agent-development)
- [TypeScript MCP SDK - GitHub](https://github.com/modelcontextprotocol/typescript-sdk)

### Implementation Notes

#### 1. Current MCP Compatibility (via ADR-0002/0005)

The Claude Agent SDK's `tool()` function already creates MCP-compatible definitions:

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// This tool definition is MCP-compatible at the format level
const analyzeConfigTool = tool(
  "analyze_config",
  "Analyze an AI coding tool configuration file",
  {
    file_path: z.string().describe("Path to config file"),
  },
  async (args) => {
    // Implementation
    return { analysis: result };
  }
);
```

#### 2. Future MCP Server Consumption (If Needed)

The Claude Agent SDK supports MCP server consumption via `.mcp.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/path/to/project"
      }
    }
  }
}
```

When and if this is needed, it can be enabled with minimal code changes.

#### 3. Future MCP Server Exposure (If Needed)

To expose agentlint as an MCP server, use the TypeScript MCP SDK:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";

const server = new Server({
  name: "agentlint",
  version: "1.0.0",
});

server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "analyze_config",
      description: "Analyze an AI coding tool configuration",
      inputSchema: { /* ... */ },
    },
  ],
}));

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

This is documented for future reference but not implemented for MVP.

#### 4. Upgrade Path

When MCP integration is needed:

1. **Consume MCP servers**: Add `.mcp.json` to project, use SDK's native connector
2. **Expose as MCP server**: Create `src/mcp-server.ts` using TypeScript MCP SDK
3. **Both**: Combine above approaches

The current architecture does not block any of these paths.

#### 5. MCP Ecosystem Context (December 2025)

For historical context, the MCP ecosystem at time of this decision:

- **SDK downloads**: 97 million monthly
- **Public servers**: 10,000+
- **Major adopters**: ChatGPT, Cursor, Gemini, VS Code, Microsoft Copilot
- **Governance**: Agentic AI Foundation (Linux Foundation)
- **Founding members**: OpenAI, Google, Microsoft, Amazon, Anthropic, Block

This context supports the decision to maintain compatibility while deferring full integration until concrete use cases emerge.
