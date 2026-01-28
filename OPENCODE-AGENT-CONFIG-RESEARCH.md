# Opencode SDK Agent Configuration Research

**Date**: 2026-01-28  
**Purpose**: Research for EP15 (Opencode SDK Migration) - Task T15

## Quick Answer

Opencode SDK uses **config-based agent definitions** instead of programmatic TypeScript definitions.

### Minimal Working Example

```typescript
import { createOpencodeServer } from "@opencode-ai/sdk";

const server = await createOpencodeServer({
  config: {
    agent: {
      "my-subagent": {
        description: "Analyzes code patterns",
        mode: "subagent",
        prompt: "You are a code analyzer...",
        tools: {
          read: true,
          grep: true,
          write: false,
          edit: false,
          bash: false,
          task: false  // Prevents nested subagents (depth=1)
        }
      }
    }
  }
});
```

## 1. Agent Configuration Format

### JSON Configuration (Programmatic)

```typescript
import { createOpencodeServer } from "@opencode-ai/sdk";

const server = await createOpencodeServer({
  config: {
    model: "anthropic/claude-sonnet-4-20250514",  // Global model
    agent: {
      "code-reviewer": {
        description: "Reviews code for best practices and potential issues",
        mode: "subagent",
        model: "anthropic/claude-sonnet-4-20250514",  // Optional override
        temperature: 0.1,
        prompt: "You are a code reviewer. Focus on security, performance, and maintainability.",
        tools: {
          read: true,
          grep: true,
          write: false,
          edit: false,
          bash: false,
          task: false  // CRITICAL: Prevents nested subagents
        },
        permission: {
          bash: {
            "*": "ask",
            "git diff": "allow",
            "git log*": "allow"
          }
        }
      }
    }
  }
});
```

### Markdown File Configuration

**Location**: `.opencode/agents/code-reviewer.md`

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  read: true
  grep: true
  write: false
  edit: false
  bash: false
  task: false
permission:
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
---

You are in code review mode. Focus on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance implications
- Security considerations

Provide constructive feedback without making direct changes.
```

**Note**: Filename (without `.md`) becomes the agent name.

## 2. Agent Definition Schema

From `@opencode-ai/sdk` TypeScript types:

```typescript
export type AgentConfig = {
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

## 3. Tool Restrictions

### Method 1: Tool Enablement (Boolean Flags)

```typescript
tools: {
  // File operations
  read: true,
  write: false,
  edit: false,
  
  // Search
  grep: true,
  find: false,
  
  // System
  bash: false,
  
  // Agent control
  task: false,        // CRITICAL: Prevents nested subagents
  
  // MCP tools (wildcards)
  "mymcp_*": false    // Disable all tools from MCP server
}
```

### Method 2: Permissions (Fine-Grained Control)

```typescript
permission: {
  edit: "deny",
  bash: {
    "*": "ask",           // Default: ask for all bash commands
    "git diff": "allow",  // Allow specific commands
    "git log*": "allow",  // Glob patterns supported
    "git push": "deny"    // Deny specific commands
  },
  webfetch: "deny",
  task: {
    "*": "deny",                    // Deny all subagents by default
    "my-allowed-subagent": "allow"  // Allow specific subagents
  }
}
```

**Permission precedence**: Last matching rule wins (put `*` first, specific rules after).

## 4. Subagent Depth Limiting

To enforce depth=1 (prevent nested subagents):

```typescript
{
  mode: "subagent",
  tools: {
    task: false  // Disable the task tool entirely
  }
}
```

**Alternative using permissions**:

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

**Note**: When set to `deny`, the subagent is removed from the Task tool description entirely, so the model won't attempt to invoke it.

## 5. How SDK Passes Configuration

From `packages/sdk/js/src/server.ts`:

```typescript
export async function createOpencodeServer(options?: ServerOptions) {
  const proc = spawn(`opencode`, args, {
    signal: options.signal,
    env: {
      ...process.env,
      OPENCODE_CONFIG_CONTENT: JSON.stringify(options.config ?? {}),
    },
  });
  // ...
}
```

**Key insight**: SDK spawns the `opencode` CLI with config passed as JSON in `OPENCODE_CONFIG_CONTENT` environment variable.

## 6. Complete Working Example

```typescript
import { createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk";

// Start server with agent configuration
const server = await createOpencodeServer({
  config: {
    model: "anthropic/claude-sonnet-4-20250514",
    agent: {
      // Primary agent (user-facing)
      "build": {
        mode: "primary",
        tools: {
          write: true,
          edit: true,
          bash: true
        }
      },
      
      // Read-only analysis subagent
      "analyzer": {
        description: "Analyzes code patterns and architecture",
        mode: "subagent",
        temperature: 0.1,
        tools: {
          read: true,
          grep: true,
          write: false,
          edit: false,
          bash: false,
          task: false  // No nested subagents
        }
      },
      
      // Test generation subagent
      "test-generator": {
        description: "Generates unit tests for code",
        mode: "subagent",
        temperature: 0.2,
        tools: {
          read: true,
          write: true,
          edit: false,
          bash: false,
          task: false  // No nested subagents
        },
        permission: {
          write: "ask"  // Ask before creating test files
        }
      }
    }
  }
});

// Create client
const client = createOpencodeClient({ baseUrl: server.url });

// List available agents
const agents = await client.app.agents();
console.log("Available agents:", agents.data);

// Use the client...
// (client API calls here)

// Cleanup
server.close();
```

## 7. Migration from Claude Agent SDK

### Before (Claude Agent SDK)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const subagent = {
  name: "code-analyzer",
  instructions: "Analyze code for patterns...",
  tools: [readTool, grepTool]
};

await query({
  model: "claude-sonnet-4-20250514",
  agents: [subagent],
  maxDepth: 1
});
```

### After (Opencode SDK)

```typescript
import { createOpencodeServer } from "@opencode-ai/sdk";

const server = await createOpencodeServer({
  config: {
    model: "anthropic/claude-sonnet-4-20250514",  // Note: provider prefix
    agent: {
      "code-analyzer": {
        description: "Analyzes code for patterns",
        mode: "subagent",
        prompt: "Analyze code for patterns...",
        tools: {
          read: true,
          grep: true,
          write: false,
          edit: false,
          bash: false,
          task: false  // Replaces maxDepth: 1
        }
      }
    }
  }
});
```

## 8. Key Differences

| Feature | Claude Agent SDK | Opencode SDK |
|---------|------------------|--------------|
| **Agent Definition** | Code-based (TypeScript) | Config-based (JSON/Markdown) |
| **Configuration** | Programmatic API | JSON config + env var |
| **Tool Restrictions** | Via tool definitions | Via `tools` + `permission` fields |
| **Subagent Invocation** | Direct function calls | Via `task` tool |
| **Depth Limiting** | `maxDepth` parameter | `tools.task: false` |
| **Agent Registration** | `agents` option in `query()` | `agent` field in config |
| **System Prompt** | `instructions` field | `prompt` field |
| **Model Format** | `claude-sonnet-4-...` | `anthropic/claude-sonnet-4-...` |

## 9. Common Pitfalls

1. **Forgetting provider prefix**: Use `anthropic/claude-sonnet-4-20250514`, not `claude-sonnet-4-20250514`
2. **Not disabling task tool**: Subagents can spawn other subagents unless `task: false`
3. **Permission precedence**: Last matching rule wins - put `*` first, specific rules after
4. **Hidden vs disabled**: `hidden: true` hides from UI but model can still invoke via task tool
5. **Mode confusion**: `mode: "all"` is default - explicitly set `"subagent"` or `"primary"`

## 10. References

- **Official Docs**: https://opencode.ai/docs/agents
- **Config Docs**: https://opencode.ai/docs/config
- **SDK Repo**: https://github.com/anomalyco/opencode (commit: f2bf620)
- **Type Definitions**: `packages/sdk/js/src/gen/types.gen.ts` (lines 975-1030)

## Additional Resources

Detailed research notes available in `.sisyphus/notepads/ep15-opencode-migration/`:

1. **`learnings.md`**: Comprehensive research notes
2. **`agent-config-examples.md`**: 8 complete working examples
3. **`agent-config-quick-reference.md`**: Quick lookup guide
4. **`RESEARCH-SUMMARY.md`**: Executive summary

---

**Research completed**: 2026-01-28  
**Status**: ✅ Ready for T16 (Design Opencode SDK adapter interface)
