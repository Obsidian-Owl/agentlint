## Opencode SDK Agent Configuration Research (2026-01-28)

### Agent Configuration Format

Opencode supports **two formats** for defining agents:

#### 1. JSON Configuration (`opencode.json`)

Agents are defined in the `agent` field of the config object:

```typescript
// TypeScript SDK usage
import { createOpencodeServer } from "@opencode-ai/sdk";

const server = await createOpencodeServer({
  config: {
    agent: {
      "my-agent": {
        description: "Description of when to use this agent",
        mode: "subagent",  // or "primary" or "all"
        model: "anthropic/claude-sonnet-4-20250514",
        temperature: 0.1,
        prompt: "System prompt for the agent",
        tools: {
          write: false,
          edit: false,
          bash: false
        },
        permission: {
          edit: "deny",
          bash: {
            "*": "ask",
            "git diff": "allow",
            "git log*": "allow"
          },
          webfetch: "deny"
        },
        maxSteps: 5  // Optional: limit agentic iterations
      }
    }
  }
});
```

#### 2. Markdown Files

Agents can be defined as markdown files with YAML frontmatter:

**Location**: 
- Global: `~/.config/opencode/agents/`
- Project: `.opencode/agents/`

**Format**:
```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  write: false
  edit: false
  bash: false
permission:
  edit: deny
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
    "grep *": allow
  webfetch: deny
---

You are in code review mode. Focus on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance implications
- Security considerations

Provide constructive feedback without making direct changes.
```

**Note**: The filename (without `.md`) becomes the agent name.

### Agent Configuration Schema (TypeScript)

From `@opencode-ai/sdk` generated types:

```typescript
export type AgentConfig = {
  model?: string;
  temperature?: number;
  top_p?: number;
  prompt?: string;
  tools?: {
    [key: string]: boolean;
  };
  disable?: boolean;
  /**
   * Description of when to use the agent
   */
  description?: string;
  mode?: "subagent" | "primary" | "all";
  /**
   * Hex color code for the agent (e.g., #FF5733)
   */
  color?: string;
  /**
   * Maximum number of agentic iterations before forcing text-only response
   */
  maxSteps?: number;
  permission?: {
    edit?: "ask" | "allow" | "deny";
    bash?:
      | ("ask" | "allow" | "deny")
      | {
          [key: string]: "ask" | "allow" | "deny";
        };
    webfetch?: "ask" | "allow" | "deny";
    doom_loop?: "ask" | "allow" | "deny";
    external_directory?: "ask" | "allow" | "deny";
  };
  // Additional provider-specific options can be added
  [key: string]: unknown;
};

export type Config = {
  // ... other config fields
  agent?: {
    plan?: AgentConfig;
    build?: AgentConfig;
    general?: AgentConfig;
    explore?: AgentConfig;
    [key: string]: AgentConfig | undefined;
  };
  // ... other config fields
};
```

### SDK Server Configuration

The SDK passes configuration via environment variable:

```typescript
// From packages/sdk/js/src/server.ts
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

**Key insight**: The SDK spawns the `opencode` CLI with config passed as JSON in `OPENCODE_CONFIG_CONTENT` env var.

### Tool Restrictions

Tools are controlled via two mechanisms:

#### 1. Tool Enablement (`tools` field)

Boolean flags to enable/disable tools:

```typescript
tools: {
  write: false,
  edit: false,
  bash: false,
  task: false,  // Prevents subagent from spawning other subagents
  "mymcp_*": false  // Wildcard to disable all tools from an MCP server
}
```

#### 2. Permissions (`permission` field)

Fine-grained control with `ask`, `allow`, or `deny`:

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

### Subagent Depth Limiting

To enforce depth=1 (prevent nested subagents):

```typescript
{
  mode: "subagent",
  tools: {
    task: false  // Disable the task tool entirely
  },
  // OR use permissions:
  permission: {
    task: {
      "*": "deny"  // Deny all subagent invocations
    }
  }
}
```

**Note**: When set to `deny`, the subagent is removed from the Task tool description entirely, so the model won't attempt to invoke it.

### Agent Modes

- **`primary`**: User-facing agents (switchable with Tab key)
- **`subagent`**: Invoked by primary agents or via `@mention`
- **`all`**: Can be used as both (default if not specified)

### Hidden Subagents

```typescript
{
  mode: "subagent",
  hidden: true  // Hide from @ autocomplete menu
}
```

Only affects user visibility. Hidden agents can still be invoked by the model via the Task tool if permissions allow.

### Configuration Precedence

1. Remote config (from `.well-known/opencode`)
2. Global config (`~/.config/opencode/opencode.json`)
3. Custom config (`OPENCODE_CONFIG` env var)
4. Project config (`opencode.json` in project)
5. `.opencode` directories (agents, commands, plugins)
6. Inline config (`OPENCODE_CONFIG_CONTENT` env var) ← **SDK uses this**

### Key Differences from Claude Agent SDK

| Feature | Claude Agent SDK | Opencode SDK |
|---------|------------------|--------------|
| **Agent Definition** | Code-based (TypeScript) | Config-based (JSON/Markdown) |
| **Configuration** | Programmatic API | JSON config + env var |
| **Tool Restrictions** | Via tool definitions | Via `tools` + `permission` fields |
| **Subagent Invocation** | Direct function calls | Via `task` tool |
| **Depth Limiting** | Manual tracking | Via `task` tool permissions |
| **Agent Registration** | `agents` option in `query()` | `agent` field in config |

### Migration Strategy for agentlint

1. **Convert agent definitions** from TypeScript to JSON config format
2. **Map tool restrictions** to `tools` and `permission` fields
3. **Enforce depth=1** by setting `tools.task: false` for all subagents
4. **Pass config via SDK**: Use `createOpencodeServer({ config: { agent: {...} } })`
5. **Markdown files** for complex agents with long prompts

### Example: Converting agentlint's Subagent

**Before (Claude Agent SDK)**:
```typescript
const subagent = {
  name: "code-analyzer",
  instructions: "Analyze code for patterns...",
  tools: [readTool, grepTool]  // Restricted tool list
};

await query({
  agents: [subagent],
  maxDepth: 1  // Prevent nesting
});
```

**After (Opencode SDK)**:
```typescript
const server = await createOpencodeServer({
  config: {
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
          task: false  // Prevent nested subagents
        }
      }
    }
  }
});
```

### References

- Official docs: https://opencode.ai/docs/agents
- Config docs: https://opencode.ai/docs/config
- SDK repo: https://github.com/anomalyco/opencode (commit: f2bf620)
- Type definitions: `packages/sdk/js/src/gen/types.gen.ts`
