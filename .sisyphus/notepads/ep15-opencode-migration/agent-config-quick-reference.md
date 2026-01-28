# Opencode Agent Configuration Quick Reference

## Agent Config Type Definition

```typescript
type AgentConfig = {
  // Required
  description?: string;           // When to use this agent
  
  // Agent behavior
  mode?: "subagent" | "primary" | "all";  // Default: "all"
  model?: string;                 // Format: "provider/model-id"
  temperature?: number;           // 0.0-1.0
  top_p?: number;
  prompt?: string;                // System prompt or "{file:path}"
  
  // Iteration control
  maxSteps?: number;              // Limit agentic iterations
  
  // Tool control
  tools?: {
    [toolName: string]: boolean;  // true = enabled, false = disabled
  };
  
  // Fine-grained permissions
  permission?: {
    edit?: "ask" | "allow" | "deny";
    bash?: "ask" | "allow" | "deny" | {
      [command: string]: "ask" | "allow" | "deny";  // Glob patterns supported
    };
    webfetch?: "ask" | "allow" | "deny";
    task?: {
      [agentName: string]: "ask" | "allow" | "deny";  // Control subagent invocation
    };
  };
  
  // UI
  color?: string;                 // Hex color code
  hidden?: boolean;               // Hide from @ autocomplete (subagents only)
  disable?: boolean;              // Disable agent entirely
  
  // Provider-specific options
  [key: string]: unknown;
};
```

## Common Tool Names

```typescript
tools: {
  // File operations
  read: boolean,
  write: boolean,
  edit: boolean,
  
  // Search
  grep: boolean,
  find: boolean,
  
  // System
  bash: boolean,
  
  // Agent control
  task: boolean,        // Spawn subagents
  
  // MCP tools (use wildcards)
  "mymcp_*": boolean,   // All tools from MCP server
}
```

## Permission Patterns

### Deny All, Allow Specific
```typescript
permission: {
  bash: {
    "*": "deny",
    "git diff": "allow",
    "git log*": "allow"
  }
}
```

### Ask All, Allow Safe Commands
```typescript
permission: {
  bash: {
    "*": "ask",
    "git status": "allow",
    "grep *": "allow"
  }
}
```

### Control Subagent Access
```typescript
permission: {
  task: {
    "*": "deny",              // Deny all by default
    "analyzer": "allow",      // Allow specific subagents
    "test-generator": "ask"   // Ask before invoking
  }
}
```

## Depth Limiting (Prevent Nested Subagents)

### Method 1: Disable Task Tool
```typescript
{
  mode: "subagent",
  tools: {
    task: false  // Cannot spawn any subagents
  }
}
```

### Method 2: Deny All Task Permissions
```typescript
{
  mode: "subagent",
  permission: {
    task: {
      "*": "deny"  // Deny all subagent invocations
    }
  }
}
```

## Configuration Formats

### JSON (Programmatic)
```typescript
import { createOpencodeServer } from "@opencode-ai/sdk";

const server = await createOpencodeServer({
  config: {
    agent: {
      "agent-name": { /* AgentConfig */ }
    }
  }
});
```

### Markdown (File-based)

**Location**: `.opencode/agents/agent-name.md`

```markdown
---
description: Agent description
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  read: true
  write: false
  task: false
permission:
  bash:
    "*": ask
---

System prompt goes here.
```

## Model ID Format

Always use `provider/model-id` format:

```typescript
model: "anthropic/claude-sonnet-4-20250514"
model: "openai/gpt-4"
model: "anthropic/claude-haiku-4-20250514"
```

## Agent Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `primary` | User-facing, switchable with Tab | Main development agents |
| `subagent` | Invoked by primary or @mention | Specialized tasks |
| `all` | Can be both (default) | Flexible agents |

## Hidden Agents

```typescript
{
  mode: "subagent",
  hidden: true  // Hide from @ autocomplete, but model can still invoke
}
```

**Note**: Hidden agents are still invokable via the task tool if permissions allow.

## External Prompt Files

```typescript
{
  prompt: "{file:./prompts/agent.txt}"  // Relative to config file
}
```

## Complete Minimal Example

```typescript
const server = await createOpencodeServer({
  config: {
    agent: {
      "my-agent": {
        description: "Does something useful",
        mode: "subagent",
        tools: {
          read: true,
          write: false,
          task: false  // No nested subagents
        }
      }
    }
  }
});
```

## Testing Agent Config

```typescript
const { client, server } = await createOpencode({
  config: { agent: { /* ... */ } }
});

// List agents
const agents = await client.app.agents();
console.log(agents.data);

// Cleanup
server.close();
```

## Migration Checklist

- [ ] Convert `instructions` → `prompt`
- [ ] Convert tool list → tool flags object
- [ ] Add `mode: "subagent"`
- [ ] Add `tools.task: false` for depth=1
- [ ] Add `description` field
- [ ] Prefix model with provider: `anthropic/`
- [ ] Test agent appears in `client.app.agents()`

## Common Mistakes

❌ **Wrong**: `model: "claude-sonnet-4-20250514"`  
✅ **Right**: `model: "anthropic/claude-sonnet-4-20250514"`

❌ **Wrong**: `tools: [readTool, writeTool]`  
✅ **Right**: `tools: { read: true, write: true }`

❌ **Wrong**: Forgetting to disable `task` tool  
✅ **Right**: `tools: { task: false }` for subagents

❌ **Wrong**: `permission.bash: "*": "deny"` (wrong nesting)  
✅ **Right**: `permission: { bash: { "*": "deny" } }`

## SDK vs CLI

| Aspect | SDK | CLI |
|--------|-----|-----|
| Config source | `options.config` | `opencode.json` or `.opencode/agents/*.md` |
| Config passing | `OPENCODE_CONFIG_CONTENT` env var | File system |
| Agent invocation | Via client API | Via TUI or `opencode run` |

## References

- [Full research notes](./learnings.md)
- [Complete examples](./agent-config-examples.md)
- [Official docs](https://opencode.ai/docs/agents)
