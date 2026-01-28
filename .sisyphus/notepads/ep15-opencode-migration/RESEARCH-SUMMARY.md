# Opencode SDK Agent Configuration Research Summary

**Research Date**: 2026-01-28  
**Task**: T15 - Research Opencode SDK agent configuration format  
**Status**: ✅ Complete

## Executive Summary

Opencode SDK uses **config-based agent definitions** (JSON or Markdown) instead of programmatic TypeScript definitions. Agents are configured via the `agent` field in the config object, which is passed to the SDK via the `OPENCODE_CONFIG_CONTENT` environment variable.

## Key Findings

### 1. Agent Definition Format

**Two formats supported**:

1. **JSON** (programmatic): Defined in `config.agent` object
2. **Markdown** (file-based): YAML frontmatter + markdown body in `.opencode/agents/*.md`

### 2. Agent Configuration Schema

```typescript
type AgentConfig = {
  description?: string;           // Required: when to use this agent
  mode?: "subagent" | "primary" | "all";
  model?: string;                 // Format: "provider/model-id"
  temperature?: number;
  prompt?: string;                // System prompt
  tools?: { [name: string]: boolean };
  permission?: { /* fine-grained control */ };
  maxSteps?: number;              // Limit iterations
  hidden?: boolean;               // Hide from UI
  // ... provider-specific options
};
```

### 3. Tool Restrictions

**Two mechanisms**:

1. **Tool enablement** (`tools` field): Boolean flags
2. **Permissions** (`permission` field): `"ask" | "allow" | "deny"`

```typescript
tools: {
  read: true,
  write: false,
  task: false  // Disable subagent spawning
}

permission: {
  bash: {
    "*": "ask",
    "git diff": "allow"
  }
}
```

### 4. Subagent Depth Limiting

**Enforce depth=1** by disabling the `task` tool:

```typescript
{
  mode: "subagent",
  tools: {
    task: false  // Cannot spawn other subagents
  }
}
```

### 5. SDK Configuration

```typescript
import { createOpencodeServer } from "@opencode-ai/sdk";

const server = await createOpencodeServer({
  config: {
    model: "anthropic/claude-sonnet-4-20250514",
    agent: {
      "my-agent": {
        description: "Agent description",
        mode: "subagent",
        tools: { read: true, write: false, task: false }
      }
    }
  }
});
```

**How it works**: SDK spawns `opencode` CLI with config passed as JSON in `OPENCODE_CONFIG_CONTENT` env var.

## Migration Strategy for agentlint

### Step-by-Step Conversion

1. **Convert agent definitions** from TypeScript to JSON config
2. **Map tool restrictions** to `tools` and `permission` fields
3. **Enforce depth=1** by setting `tools.task: false`
4. **Pass config via SDK**: `createOpencodeServer({ config: { agent: {...} } })`
5. **Use markdown files** for agents with long prompts

### Example Conversion

**Before (Claude Agent SDK)**:
```typescript
const subagent = {
  name: "code-analyzer",
  instructions: "Analyze code for patterns...",
  tools: [readTool, grepTool]
};

await query({
  agents: [subagent],
  maxDepth: 1
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
          task: false  // Depth=1
        }
      }
    }
  }
});
```

## Key Differences from Claude Agent SDK

| Feature | Claude Agent SDK | Opencode SDK |
|---------|------------------|--------------|
| **Agent Definition** | Code-based (TypeScript) | Config-based (JSON/Markdown) |
| **Configuration** | Programmatic API | JSON config + env var |
| **Tool Restrictions** | Via tool definitions | Via `tools` + `permission` fields |
| **Subagent Invocation** | Direct function calls | Via `task` tool |
| **Depth Limiting** | Manual tracking | Via `task` tool permissions |
| **Agent Registration** | `agents` option in `query()` | `agent` field in config |

## Deliverables

Three documents created in `.sisyphus/notepads/ep15-opencode-migration/`:

1. **`learnings.md`**: Comprehensive research notes with all details
2. **`agent-config-examples.md`**: 8 complete working examples
3. **`agent-config-quick-reference.md`**: Quick lookup guide

## Next Steps for T15

1. ✅ Research complete - agent configuration format documented
2. ⏭️ Proceed to T16: Design Opencode SDK adapter interface
3. ⏭️ Use findings to implement agent configuration in adapter

## References

- **Official Docs**: https://opencode.ai/docs/agents
- **Config Docs**: https://opencode.ai/docs/config
- **SDK Repo**: https://github.com/anomalyco/opencode (commit: f2bf620)
- **Type Definitions**: `packages/sdk/js/src/gen/types.gen.ts` (lines 975-1030)

## Questions Answered

✅ **How are agents defined in Opencode?**  
→ JSON config or Markdown files with YAML frontmatter

✅ **What's the file structure for agent definitions?**  
→ `.opencode/agents/*.md` or `config.agent` object

✅ **How are prompts/instructions specified?**  
→ `prompt` field (string or `{file:path}`)

✅ **How are tool restrictions enforced?**  
→ `tools` (boolean flags) + `permission` (ask/allow/deny)

✅ **How is subagent depth limited?**  
→ Set `tools.task: false` to prevent nested subagents

✅ **How are agents registered in opencode.json?**  
→ `config.agent` object with agent names as keys

✅ **Example configurations?**  
→ See `agent-config-examples.md` for 8 complete examples

## Blockers Resolved

- ✅ No blockers - all information needed for T16 is now available
- ✅ Type definitions found in SDK source
- ✅ Real-world examples found in GitHub repos
- ✅ Official documentation comprehensive and up-to-date

---

**Research completed successfully. Ready to proceed with T16: Design Opencode SDK adapter interface.**
