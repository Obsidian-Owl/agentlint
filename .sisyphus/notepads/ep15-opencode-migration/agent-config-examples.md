# Opencode SDK Agent Configuration Examples

## Complete Working Examples

### Example 1: Basic Subagent (JSON Config)

```typescript
import { createOpencodeServer } from "@opencode-ai/sdk";

const server = await createOpencodeServer({
  config: {
    agent: {
      "code-reviewer": {
        description: "Reviews code for best practices and potential issues",
        mode: "subagent",
        model: "anthropic/claude-sonnet-4-20250514",
        temperature: 0.1,
        prompt: "You are a code reviewer. Focus on security, performance, and maintainability.",
        tools: {
          write: false,
          edit: false,
          bash: false,
          task: false  // Prevent nested subagents (depth=1)
        }
      }
    }
  }
});
```

### Example 2: Subagent with Fine-Grained Permissions

```typescript
const server = await createOpencodeServer({
  config: {
    agent: {
      "security-auditor": {
        description: "Performs security audits and identifies vulnerabilities",
        mode: "subagent",
        model: "anthropic/claude-sonnet-4-20250514",
        temperature: 0.1,
        tools: {
          write: false,
          edit: false,
          task: false  // No nested subagents
        },
        permission: {
          bash: {
            "*": "ask",           // Ask for all bash commands by default
            "grep *": "allow",    // Allow grep searches
            "git diff": "allow",  // Allow git diff
            "git log*": "allow"   // Allow git log commands
          },
          webfetch: "deny"
        }
      }
    }
  }
});
```

### Example 3: Markdown File Format

**File**: `.opencode/agents/docs-writer.md`

```markdown
---
description: Writes and maintains project documentation
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.3
tools:
  read: true
  write: true
  edit: true
  bash: false
  task: false
permission:
  edit: allow
  bash: deny
---

You are a technical writer. Create clear, comprehensive documentation.

Focus on:
- Clear explanations
- Proper structure
- Code examples
- User-friendly language

Always maintain consistency with existing documentation style.
```

### Example 4: Multiple Agents Configuration

```typescript
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
          task: false
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
          task: false
        },
        permission: {
          write: "ask"  // Ask before creating test files
        }
      }
    }
  }
});
```

### Example 5: Hidden Internal Subagent

```typescript
const server = await createOpencodeServer({
  config: {
    agent: {
      "internal-helper": {
        description: "Internal helper for specialized tasks",
        mode: "subagent",
        hidden: true,  // Hide from @ autocomplete
        tools: {
          read: true,
          grep: true,
          write: false,
          edit: false,
          bash: false,
          task: false
        }
      }
    }
  }
});
```

### Example 6: Agent with Max Steps Limit

```typescript
const server = await createOpencodeServer({
  config: {
    agent: {
      "quick-analyzer": {
        description: "Fast analysis with limited iterations",
        mode: "subagent",
        maxSteps: 5,  // Limit to 5 agentic iterations
        temperature: 0.1,
        tools: {
          read: true,
          grep: true,
          write: false,
          edit: false,
          bash: false,
          task: false
        }
      }
    }
  }
});
```

### Example 7: Preventing Subagent Recursion

```typescript
const server = await createOpencodeServer({
  config: {
    agent: {
      "orchestrator": {
        description: "Orchestrates multiple subagents",
        mode: "primary",
        permission: {
          task: {
            "*": "deny",              // Deny all subagents by default
            "analyzer": "allow",      // Allow specific subagents
            "test-generator": "allow"
          }
        }
      },
      
      "analyzer": {
        description: "Analyzes code",
        mode: "subagent",
        tools: {
          task: false  // Cannot spawn other subagents
        }
      },
      
      "test-generator": {
        description: "Generates tests",
        mode: "subagent",
        tools: {
          task: false  // Cannot spawn other subagents
        }
      }
    }
  }
});
```

### Example 8: Using External Prompt File

```typescript
const server = await createOpencodeServer({
  config: {
    agent: {
      "custom-agent": {
        description: "Agent with external prompt",
        mode: "subagent",
        prompt: "{file:./prompts/custom-agent.txt}",  // Load from file
        tools: {
          read: true,
          write: false,
          edit: false,
          bash: false,
          task: false
        }
      }
    }
  }
});
```

**File**: `./prompts/custom-agent.txt`

```
You are a specialized code analysis agent.

Your responsibilities:
1. Analyze code structure
2. Identify patterns
3. Suggest improvements

Always provide evidence-based recommendations.
```

## Key Patterns for agentlint Migration

### Pattern 1: Convert Tool List to Tool Flags

**Before (Claude Agent SDK)**:
```typescript
const subagent = {
  tools: [readTool, grepTool, findTool]
};
```

**After (Opencode SDK)**:
```typescript
const agentConfig = {
  tools: {
    read: true,
    grep: true,
    find: true,
    write: false,
    edit: false,
    bash: false,
    task: false
  }
};
```

### Pattern 2: Enforce Depth Limit

**Before (Claude Agent SDK)**:
```typescript
await query({
  agents: [subagent],
  maxDepth: 1
});
```

**After (Opencode SDK)**:
```typescript
const agentConfig = {
  mode: "subagent",
  tools: {
    task: false  // Disable task tool = no nested subagents
  }
};
```

### Pattern 3: System Prompt Migration

**Before (Claude Agent SDK)**:
```typescript
const subagent = {
  instructions: "You are a code analyzer..."
};
```

**After (Opencode SDK)**:
```typescript
const agentConfig = {
  prompt: "You are a code analyzer..."
};
```

### Pattern 4: Model Configuration

**Before (Claude Agent SDK)**:
```typescript
await query({
  model: "claude-sonnet-4-20250514",
  agents: [subagent]
});
```

**After (Opencode SDK)**:
```typescript
const server = await createOpencodeServer({
  config: {
    model: "anthropic/claude-sonnet-4-20250514",  // Note: provider prefix
    agent: {
      "my-agent": {
        // Inherits model from config unless overridden
        model: "anthropic/claude-haiku-4-20250514"  // Optional override
      }
    }
  }
});
```

## Testing Agent Configuration

```typescript
import { createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk";

// Start server with agent config
const server = await createOpencodeServer({
  config: {
    agent: {
      "test-agent": {
        description: "Test agent",
        mode: "subagent",
        tools: {
          read: true,
          write: false,
          task: false
        }
      }
    }
  }
});

// Create client
const client = createOpencodeClient({ baseUrl: server.url });

// List available agents
const agents = await client.app.agents();
console.log(agents.data);

// Cleanup
server.close();
```

## Common Pitfalls

1. **Forgetting provider prefix**: Use `anthropic/claude-sonnet-4-20250514`, not `claude-sonnet-4-20250514`
2. **Not disabling task tool**: Subagents can spawn other subagents unless `task: false`
3. **Permission precedence**: Last matching rule wins - put `*` first, specific rules after
4. **Hidden vs disabled**: `hidden: true` hides from UI but model can still invoke via task tool
5. **Mode confusion**: `mode: "all"` is default - explicitly set `"subagent"` or `"primary"`

## References

- [Opencode Agents Documentation](https://opencode.ai/docs/agents)
- [Opencode Config Documentation](https://opencode.ai/docs/config)
- [SDK TypeScript Types](https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts)
