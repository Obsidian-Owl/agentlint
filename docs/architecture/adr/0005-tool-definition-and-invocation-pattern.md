---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0005: Tool Definition and Invocation Pattern

## Context and Problem Statement

agentlint's agent requires a set of tools to gather context about projects—parsing configurations, querying session logs, analyzing git history, etc. Building on ADR-0002's decision to use the Claude Agent SDK, we need to define how tools are defined, documented, and invoked, with particular attention to agent comprehension and handling large tool outputs that could overflow the context window.

## Decision Drivers

- **Agent Comprehension**: Tools must be documented so the agent understands when and how to use them
- **Type Safety**: Tool inputs and outputs should be validated at runtime (not just compile-time)
- **Large Result Handling**: Session logs and git history queries can return results exceeding context limits
- **Simplicity**: Avoid infrastructure overhead that doesn't serve agentlint's specific needs
- **Claude Agent SDK Alignment**: Leverage SDK's native patterns per ADR-0002

## Considered Options

1. SDK Native `tool()` with Zod (no MCP protocol)
2. Full MCP Server Architecture
3. Custom Schema with Future MCP Bridge

## Decision Outcome

Chosen option: **"SDK Native `tool()` with Zod"** because the Claude Agent SDK already provides a type-safe, MCP-compatible tool definition pattern via its `tool()` function. This approach delivers Zod schema validation, rich documentation support, and format compatibility with MCP—without the protocol overhead of running actual MCP servers.

**Large Result Strategy**: Hybrid summarization with storage—if result exceeds threshold, return LLM summary while storing full result for on-demand retrieval.

### Consequences

**Good:**
- Zero additional dependencies—uses SDK's built-in `tool()` function
- Type safety via Zod schemas with static TypeScript inference
- Rich tool descriptions optimize agent comprehension
- MCP-compatible format preserved for future ecosystem integration
- Hybrid summarization balances context efficiency with data availability

**Bad:**
- Must build result storage and retrieval mechanism
- LLM summarization adds latency/cost for large results
- No ecosystem tool sharing (acceptable—agentlint's tools are internal)

**Neutral:**
- Can add full MCP protocol later if ecosystem integration needed
- Tool definitions are simple TypeScript functions, easy to test

## Pros and Cons of Options

### Option 1: SDK Native `tool()` with Zod

Use the Claude Agent SDK's built-in `tool()` function which creates type-safe, MCP-compatible tool definitions using Zod schemas.

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const configParserTool = tool(
  "parse_config",
  "Parse and analyze an AI coding tool configuration file (CLAUDE.md, AGENTS.md, etc.)",
  {
    file_path: z.string().describe("Absolute path to the configuration file"),
    include_metrics: z.boolean().optional().describe("Include token count and structure metrics")
  },
  async (args) => {
    // Implementation
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);
```

- Good: Built into SDK—no additional dependencies
- Good: Zod provides runtime validation and TypeScript type inference
- Good: Tool descriptions support rich documentation for agent comprehension
- Good: Creates MCP-compatible definitions (format, not protocol)
- Good: Simple, direct pattern—tools are just functions
- Neutral: Must implement result truncation/storage ourselves
- Bad: No automatic ecosystem tool discovery/sharing

### Option 2: Full MCP Server Architecture

Run MCP servers (stdio or HTTP) for each tool category, connecting via the SDK's `mcpServers` option.

- Good: Full MCP protocol enables ecosystem tool sharing
- Good: Tools could be used by other MCP-compatible AI applications
- Good: SDK has native MCP connector support
- Neutral: More infrastructure to manage
- Bad: Protocol overhead (server processes, JSON-RPC)
- Bad: Security concerns—research shows many MCP servers lack authentication
- Bad: Solves N×M integration problem, but agentlint only needs internal tools
- Bad: Adds complexity without clear benefit for MVP

### Option 3: Custom Schema with Future MCP Bridge

Build a custom tool registry with purpose-built schema, design for MCP compatibility if ever needed.

- Good: Optimized for agentlint's specific needs
- Good: No framework constraints
- Good: Can add MCP bridge layer later
- Neutral: More initial development effort
- Bad: Non-standard—team must learn custom patterns
- Bad: Miss out on Zod's runtime validation
- Bad: Reinventing patterns SDK already provides

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | Tools run locally; no external services required |
| II. Improvement-Oriented | Yes | Tools enable baseline capture and comparison |
| III. Causal-First | Yes | Tools enable tracing (session search, git query) |
| IV. Mixed-Methods | Yes | Tools support both quantitative (metrics) and qualitative (content) extraction |
| V. Language-Agnostic | Yes | Tool pattern works regardless of analyzed project language |
| VI. Agent-Agnostic | Yes | Tools can be adapted per-ACT via adapter pattern |
| VII. Intelligent Tooling | Yes | Agent chooses tools freely; rich descriptions aid selection |
| VIII. Compounding Value | Yes | Tools enable baseline storage and retrieval |
| IX. Agent-Aware | Yes | Zod descriptions optimized for agent comprehension |

## More Information

### Related Documents
- Architecture Vision: [Section 4 - High-Level Architecture](../../vision/agentlint-architecture-vision.md#4-high-level-architecture)
- Design Decisions: [DD-004](../design-decisions.md#dd-004-tool-definition-and-invocation-pattern)
- Prior Decisions: [ADR-0002 - Agentic Framework Strategy](./0002-agentic-framework-strategy.md)

### Research Sources
- [Claude Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Building Effective Agents - Anthropic](https://www.anthropic.com/research/building-effective-agents)
- [Solving Context Window Overflow in AI Agents - arXiv](https://arxiv.org/html/2511.22729v1)
- [zod-gpt: Structured LLM outputs with Zod](https://github.com/dzhng/zod-gpt)
- [MCP: Getting Beneath the Hype - Thoughtworks](https://www.thoughtworks.com/en-us/insights/blog/generative-ai/model-context-protocol-beneath-hype)
- [Context Engineering in LLM-Based Agents](https://jtanruan.medium.com/context-engineering-in-llm-based-agents-d670d6b439bc)

### Implementation Notes

#### 1. Tool Definition Pattern

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Tool definitions with rich descriptions for agent comprehension
export const configParserTool = tool(
  "parse_config",
  `Parse and analyze an AI coding tool configuration file.

   Use this tool when you need to understand:
   - What configuration exists (CLAUDE.md, AGENTS.md, .cursorrules)
   - Configuration structure and hierarchy
   - Token counts and potential context bloat
   - Secret detection warnings

   Returns structured data including parsed content, metrics, and validation warnings.`,
  {
    file_path: z.string()
      .describe("Absolute path to the configuration file to parse"),
    include_metrics: z.boolean()
      .optional()
      .default(true)
      .describe("Include token count, structure depth, and keyword analysis"),
    detect_secrets: z.boolean()
      .optional()
      .default(true)
      .describe("Scan for potential secrets or credentials in content")
  },
  async (args) => {
    const result = await parseConfig(args);
    return handleToolResult(result);
  }
);

// Create in-process MCP server with tools
export const agentlintTools = createSdkMcpServer({
  name: "agentlint-tools",
  version: "1.0.0",
  tools: [
    configParserTool,
    sessionSearchTool,
    gitQueryTool,
    baselineQueryTool,
    // ... other tools
  ]
});
```

#### 2. Tool Documentation Guidelines (Poka-yoke Principle)

Per Anthropic's research, invest heavily in tool descriptions:

```typescript
// BAD: Minimal description
const badTool = tool(
  "search_sessions",
  "Search session logs",
  { query: z.string() },
  handler
);

// GOOD: Rich description with usage guidance
const goodTool = tool(
  "search_sessions",
  `Search AI coding session logs for specific patterns or events.

   Use this tool when you need to:
   - Find when a specific issue first appeared
   - Trace an error back to its originating session
   - Analyze patterns across multiple sessions

   The tool searches indexed JSONL session logs and returns:
   - Matching entries with session ID and timestamp
   - Line numbers for precise causal references
   - Context around matches (configurable)

   For large result sets, results are summarized with full data available via retrieve_result().

   Example queries:
   - "error" to find all errors
   - "tool:Write file_path:*.ts" to find TypeScript file writes
   - "user_prompt:refactor" to find refactoring requests`,
  {
    query: z.string()
      .describe("Search query. Supports field:value syntax for structured search."),
    session_id: z.string()
      .optional()
      .describe("Limit search to a specific session ID"),
    limit: z.number()
      .optional()
      .default(50)
      .describe("Maximum number of results to return"),
    context_lines: z.number()
      .optional()
      .default(2)
      .describe("Number of context lines before/after each match")
  },
  handler
);
```

#### 3. Large Result Handling (Hybrid Summarization)

```typescript
const RESULT_THRESHOLD = 2000; // characters
const resultStore = new Map<string, unknown>();

async function handleToolResult(result: unknown): Promise<CallToolResult> {
  const serialized = JSON.stringify(result, null, 2);

  if (serialized.length <= RESULT_THRESHOLD) {
    // Small result: return directly
    return { content: [{ type: "text", text: serialized }] };
  }

  // Large result: summarize + store
  const resultId = crypto.randomUUID();
  resultStore.set(resultId, result);

  // Use LLM to create intelligent summary
  const summary = await summarizeResult(result);

  return {
    content: [{
      type: "text",
      text: `${summary}

---
[Result truncated: ${serialized.length} chars]
Full result stored as: ${resultId}
Use retrieve_result("${resultId}") to access complete data.`
    }]
  };
}

// Retrieval tool for accessing full results
export const retrieveResultTool = tool(
  "retrieve_result",
  `Retrieve the full content of a previously truncated tool result.

   Use this when you received a summarized result and need the complete data
   for detailed analysis or to find specific information not in the summary.`,
  {
    result_id: z.string().describe("The result ID provided in the truncated response"),
    offset: z.number().optional().describe("Start position for pagination"),
    limit: z.number().optional().describe("Maximum characters to return")
  },
  async (args) => {
    const result = resultStore.get(args.result_id);
    if (!result) {
      return { content: [{ type: "text", text: "Result not found or expired" }] };
    }

    const serialized = JSON.stringify(result, null, 2);
    const chunk = serialized.slice(args.offset || 0, (args.offset || 0) + (args.limit || 10000));

    return {
      content: [{
        type: "text",
        text: chunk,
      }]
    };
  }
);
```

#### 4. SDK Built-in Tools (Analysis-Focused Subset)

The agent has access to these Claude Agent SDK built-in tools:

| SDK Tool | Purpose | Why Included |
|----------|---------|--------------|
| `Read` | Read any file for analysis | Core analysis capability |
| `Glob` | Find files by pattern | Discover configs, session logs |
| `Grep` | Search file contents | Find patterns across codebase |
| `Bash` | Execute commands (git, etc.) | Git queries, read-only utilities |

**Excluded SDK Tools**: `Write`, `Edit`, `WebFetch`, `WebSearch`, `Task`

The agent analyzes projects but does not modify project source files directly.

#### 5. Controlled Write Scope

The agent CAN write, but ONLY to agentlint-managed paths:

```typescript
const ALLOWED_WRITE_PATHS = [
  '.agentlint/',           // Project-local: baselines, recommendations
  '~/.agentlint/',         // Global: learnings, user config
];

// Custom write tool that enforces path restrictions
export const agentlintWriteTool = tool(
  "agentlint_write",
  "Write data to agentlint configuration paths only.",
  {
    path: z.string().describe("Path relative to .agentlint/ or ~/.agentlint/"),
    content: z.string().describe("Content to write"),
    scope: z.enum(["project", "global"]).describe("Write to project or global config")
  },
  async (args) => {
    const basePath = args.scope === "global"
      ? path.join(os.homedir(), ".agentlint")
      : ".agentlint";
    const fullPath = path.join(basePath, args.path);

    // Security: Ensure path doesn't escape allowed directories
    if (!fullPath.startsWith(basePath)) {
      throw new Error("Path traversal not allowed");
    }

    await fs.writeFile(fullPath, args.content);
    return { content: [{ type: "text", text: `Written to ${fullPath}` }] };
  }
);
```

#### 6. Custom agentlint Tools for MVP

**Analysis Tools**:
| Tool | Purpose | Constitution Principle |
|------|---------|----------------------|
| `parse_config` | Parse ACT config files (CLAUDE.md, AGENTS.md, etc.) | VI (Agent-Agnostic) |
| `search_sessions` | Full-text search across session logs | III (Causal-First) |
| `get_session_stats` | Extract metrics from session logs | IV (Mixed-Methods) |
| `query_git` | Git history queries (blame, log, pickaxe) | III (Causal-First) |
| `retrieve_result` | Get full content of truncated results | VII (Intelligent Tooling) |

**Baseline Tools** (write to `.agentlint/baselines/`):
| Tool | Purpose | Constitution Principle |
|------|---------|----------------------|
| `query_baseline` | Compare current state to baseline | II (Improvement-Oriented) |
| `store_baseline` | Save current analysis as baseline | VIII (Compounding Value) |
| `list_baselines` | List available baselines | II (Improvement-Oriented) |

**Recommendation Tools** (write to `.agentlint/recommendations/`):
| Tool | Purpose | Constitution Principle |
|------|---------|----------------------|
| `store_recommendation` | Save a recommendation with metadata | III (Causal-First) |
| `list_recommendations` | List stored recommendations | II (Improvement-Oriented) |
| `update_recommendation` | Mark implemented/dismissed/deferred | II (Improvement-Oriented) |

**Learning Tools** (write to `.agentlint/learnings/` or `~/.agentlint/learnings/`):
| Tool | Purpose | Constitution Principle |
|------|---------|----------------------|
| `store_learning` | Save a learning (local or global scope) | VIII (Compounding Value) |
| `list_learnings` | List learnings (filter by scope) | VIII (Compounding Value) |
| `promote_learning` | Promote local learning to global | VIII (Compounding Value) |

#### 7. Error Handling Pattern

```typescript
async function safeToolHandler<T>(
  handler: () => Promise<T>
): Promise<CallToolResult> {
  try {
    const result = await handler();
    return handleToolResult(result);
  } catch (error) {
    // Return structured error for agent to reason about
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : "Unknown error",
          suggestion: getSuggestionForError(error)
        })
      }],
      isError: true
    };
  }
}

function getSuggestionForError(error: unknown): string {
  if (error instanceof FileNotFoundError) {
    return "Check if the file path is correct. Use absolute paths.";
  }
  if (error instanceof SessionNotIndexedError) {
    return "Session logs may not be indexed yet. Try running 'agentlint scan' first.";
  }
  return "Review the error message and try again with corrected parameters.";
}
```

#### 8. Future MCP Protocol Migration

If ecosystem integration is ever needed, the migration path is straightforward:

```typescript
// Current: In-process SDK server
const tools = createSdkMcpServer({ name: "agentlint", tools: [...] });

// Future: External MCP server (same tool definitions)
// 1. Export tools to standalone MCP server
// 2. Connect via mcpServers option instead of in-process
```

The tool definitions themselves don't change—only how they're hosted.
