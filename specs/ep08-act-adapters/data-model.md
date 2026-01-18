# Data Model: ACT Subagents

> Entity definitions for EP08 ACT Subagents feature

---

## Entities

### AgentDefinition (SDK Type)

From `@anthropic-ai/claude-agent-sdk` - represents a subagent configuration.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| description | string | Yes | Natural language description - Claude uses this to decide invocation |
| prompt | string | Yes | The agent's system prompt (context-engineered instructions) |
| tools | string[] | No | Allowed tool names. Omit to inherit all, use [] to deny all. |
| disallowedTools | string[] | No | Explicit blacklist of tool names |
| model | 'sonnet' \| 'opus' \| 'haiku' \| 'inherit' | No | Model override (defaults to inherit) |
| mcpServers | Array<{name, config}> | No | MCP servers available to subagent |

**Validation Rules:**
- `description` must be non-empty, max 500 characters
- `prompt` must be non-empty, max 50KB (NFR-002)
- `tools` must NOT include 'Task' (single-depth constraint)
- `model` defaults to `'inherit'`

**Note:** Import this type from SDK in implementation:
```typescript
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
```

---

### ACTInstructions

Bundled instructions for an ACT - used to build SDK AgentDefinition objects.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Unique identifier - becomes agent key (e.g., "claude-code-analyzer") |
| displayName | string | Yes | Human-readable name (internal metadata) |
| description | string | Yes | When to invoke - Claude uses this for delegation decisions |
| prompt | string | Yes | Full context-engineered system prompt |
| tools | string[] | Yes | Tool names this subagent can use (must NOT include 'Task') |
| actTypes | ACTType[] | Yes | Which ACT types this analyzer handles (internal routing) |
| priority | number | Yes | Selection priority (higher = preferred, internal) |
| model | 'sonnet' \| 'opus' \| 'haiku' \| 'inherit' | No | Model override (defaults to inherit) |

**Validation Rules:**
- `name` must be lowercase, alphanumeric with hyphens, max 50 chars
- `tools` must NOT include 'Task' (enforces single-depth constraint)
- `actTypes` must reference valid ACTType values
- `priority` must be positive integer (1-100)

**Mapping to AgentDefinition:**
- `name` → key in `Record<string, AgentDefinition>`
- `description`, `prompt`, `tools`, `model` → map directly to SDK fields
- `displayName`, `actTypes`, `priority` → internal metadata only

**State Transitions:** N/A (stateless configuration)

---

### ACTSubagentRegistry

Registry managing ACT subagent lifecycle.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subagents | Map<string, ACTInstructions> | Yes | Registered subagent instructions |

**Methods:**

| Method | Signature | Description |
|--------|-----------|-------------|
| register | (instructions: ACTInstructions) => void | Add subagent to registry |
| get | (name: string) => ACTInstructions \| undefined | Get by name |
| list | () => ACTInstructions[] | List all registered |
| getForACTType | (actType: ACTType) => ACTInstructions \| undefined | Find by ACT type |
| toAgentsOption | () => Record<string, AgentDefinition> | Convert to SDK format |

**Validation Rules:**
- Duplicate names throw error
- Names must match `name` field in ACTInstructions

---

### ACTType (from EP05)

Enum of supported AI Coding Tool types.

| Value | Description |
|-------|-------------|
| `claude-code` | Anthropic's Claude Code |
| `agents-md` | Generic AGENTS.md standard |
| `cursor` | Cursor AI (future) |
| `aider` | Aider (future) |
| `copilot-cli` | GitHub Copilot CLI (future) |
| `unknown` | Unrecognized tool |

---

## Entity Relationships

```
┌─────────────────────────────┐
│     ACTSubagentRegistry     │
│  - subagents: Map<>         │
│  + register()               │
│  + get()                    │
│  + toAgentsOption()         │
└─────────────────────────────┘
              │
              │ contains 1:N
              ▼
┌─────────────────────────────┐
│      ACTInstructions        │
│  - name: string             │
│  - description: string      │
│  - prompt: string           │
│  - tools: string[]          │
│  - actTypes: ACTType[]      │
└─────────────────────────────┘
              │
              │ produces 1:1
              ▼
┌─────────────────────────────┐
│   AgentDefinition (SDK)     │
│  - description: string      │
│  - prompt: string           │
│  - tools?: string[]         │
│  - model?: string           │
└─────────────────────────────┘
              │
              │ passed to
              ▼
┌─────────────────────────────┐
│  query({ agents: {...} })   │
│  Claude Agent SDK           │
└─────────────────────────────┘
```

---

## Integration with EP05/EP06

### Tools Accessible to Subagents

| Tool | Source | Purpose in Subagent |
|------|--------|---------------------|
| `discover_configs` | EP05 | Find ACT config files in project |
| `parse_config` | EP05 | Parse CLAUDE.md, settings.json |
| `analyze_hierarchy` | EP05 | Understand config precedence |
| `search_sessions` | EP06 | Query session log history |
| `get_session_stats` | EP06 | Aggregate session metrics |

### ACTType Integration

Subagents use `ACTType` from EP05's config discovery to:
1. Match detected ACT type to appropriate subagent
2. Provide type-specific analysis guidance
3. Report which ACT types were analyzed

---

## Zod Schemas

```typescript
// Defined in src/act/types.ts

import { z } from 'zod';

export const ACTInstructionsSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens')
    .min(1)
    .max(50),
  displayName: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  prompt: z.string().min(1).max(51200), // 50KB limit per NFR-002
  tools: z
    .array(z.string())
    .min(1)
    .refine((tools) => !tools.includes('Task'), {
      message: "Subagent tools must NOT include 'Task' (single-depth constraint)",
    }),
  actTypes: z.array(z.enum([
    'claude-code',
    'agents-md',
    'cursor',
    'aider',
    'copilot-cli',
    'unknown'
  ])).min(1),
  priority: z.number().int().min(1).max(100),
  model: z.enum(['sonnet', 'opus', 'haiku', 'inherit']).optional(),
});

export type ACTInstructions = z.infer<typeof ACTInstructionsSchema>;

// Note: AgentDefinition should be imported from SDK, not redefined
// import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
```

---

## Default Subagents

### claude-code-analyzer

| Field | Value |
|-------|-------|
| name | `claude-code-analyzer` |
| displayName | Claude Code Analyzer |
| description | Analyzes Claude Code configurations, settings, and session logs |
| actTypes | `['claude-code']` |
| priority | 100 (highest) |
| tools | discover_configs, parse_config, analyze_hierarchy, search_sessions, get_session_stats |

### generalized-analyzer

| Field | Value |
|-------|-------|
| name | `generalized-analyzer` |
| displayName | Generalized ACT Analyzer |
| description | Best-effort analysis for unknown or unsupported AI coding tools |
| actTypes | `['agents-md', 'unknown']` |
| priority | 10 (fallback) |
| tools | discover_configs, parse_config |
