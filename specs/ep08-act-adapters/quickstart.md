# Quickstart: ACT Subagents

> How to use and extend the ACT subagent system

---

## Overview

ACT Subagents are specialized analysis agents that the main agentlint orchestrator invokes for AI Coding Tool-specific analysis. They use the Claude Agent SDK's native subagent pattern.

---

## Basic Usage

### Automatic Invocation

Subagents are automatically available when using the agentlint orchestrator. The main agent decides when to invoke them based on the task:

```typescript
import { Orchestrator } from 'agentlint';

const orchestrator = new Orchestrator();

// The orchestrator automatically has access to ACT subagents
// Claude will invoke them when analyzing ACT configurations
await orchestrator.run("Analyze my Claude Code configuration");
```

### Manual Specification

You can explicitly request a subagent in your prompt:

```
"Use the claude-code-analyzer subagent to analyze my CLAUDE.md files"
```

---

## Available Subagents

### claude-code-analyzer

**When it's used**: Projects with CLAUDE.md or `.claude/` directory

**What it analyzes**:
- CLAUDE.md memory files (global, project, local)
- settings.json configuration
- Skills and rules definitions
- Session logs at `~/.claude/projects/`

**Example prompt**:
```
"Analyze my Claude Code configuration for potential improvements"
```

### generalized-analyzer

**When it's used**: Projects with AGENTS.md or unknown ACT configurations

**What it analyzes**:
- Generic AI agent instruction files
- Configuration quality using heuristics
- Common patterns across tools

**Example prompt**:
```
"Analyze my AI coding assistant configuration"
```

---

## Integration Points

### Orchestrator Integration

The subagents are integrated via `buildACTSubagents()`:

```typescript
import { buildACTSubagents } from '../act';
import { query } from '@anthropic-ai/claude-agent-sdk';

const response = await query({
  prompt: task,
  options: {
    allowedTools: [...tools, 'Task'],  // Task enables subagent invocation
    agents: buildACTSubagents(),        // Register ACT subagents
  },
});
```

### Tool Access

Subagents have access to EP05/EP06 tools:

| Tool | Purpose |
|------|---------|
| `discover_configs` | Find ACT configuration files |
| `parse_config` | Parse config file content |
| `analyze_hierarchy` | Understand config precedence |
| `search_sessions` | Query session history |
| `get_session_stats` | Aggregate metrics |

---

## Adding a New ACT Subagent

### Step 1: Create Instructions File

Create `src/act/instructions/{act-name}.ts`:

```typescript
import type { ACTInstructions } from '../types';

export const myToolInstructions: ACTInstructions = {
  name: 'my-tool-analyzer',
  displayName: 'My Tool Analyzer',
  description: 'Analyzes My Tool configurations and settings',
  actTypes: ['my-tool'],  // Add to ACTType enum first
  priority: 50,
  tools: ['discover_configs', 'parse_config'],
  prompt: `
# My Tool Analyzer

You are a specialist for analyzing My Tool configurations...

## DOMAIN KNOWLEDGE
{Tool-specific knowledge}

## YOUR TASK
{What to analyze}

## TOOLS AVAILABLE
{Tool guidance}

## OUTPUT FORMAT
{How to report findings}
`,
};
```

### Step 2: Register in Index

Update `src/act/instructions/index.ts`:

```typescript
import { claudeCodeInstructions } from './claude-code';
import { generalizedInstructions } from './generalized';
import { myToolInstructions } from './my-tool';

export const allInstructions = [
  claudeCodeInstructions,
  myToolInstructions,
  generalizedInstructions,  // Keep fallback last (lowest priority)
];
```

### Step 3: Update ACTType (if needed)

In EP05's `src/tools/config/types.ts`, add the new type:

```typescript
export type ACTType =
  | 'claude-code'
  | 'my-tool'  // Add new type
  | 'agents-md'
  | 'unknown';
```

---

## Context Engineering Guidelines

When writing subagent prompts, follow these best practices:

### 1. Structure Hierarchically

```markdown
# ROLE IDENTITY
{Who the subagent is}

## DOMAIN KNOWLEDGE
{What it needs to know}

## YOUR TASK
{What to do}

## TOOLS AVAILABLE
{How to gather information}

## OUTPUT FORMAT
{How to report}
```

### 2. Be Specific, Not Brittle

**Good**: "Parse each discovered config file to understand settings precedence"

**Bad**: "Call parse_config on file1.json, then file2.json, then merge results using algorithm X"

### 3. Provide Grounding

Don't assume shared context. Include:
- File locations and formats
- Configuration schemas
- Common patterns and anti-patterns

### 4. Enable Intelligent Tool Selection

Describe WHEN to use each tool, not just WHAT it does:

```markdown
| Tool | When to Use |
|------|-------------|
| `discover_configs` | Start here - find all config files |
| `parse_config` | After discovery - parse each file |
```

---

## Common Patterns

### Configuration Quality Analysis

```typescript
// Example analysis flow
const findings = {
  actType: 'claude-code',
  config: {
    filesAnalyzed: ['CLAUDE.md', '.claude/settings.json'],
    issues: [
      {
        severity: 'warning',
        file: 'CLAUDE.md',
        message: 'CLAUDE.md exceeds 10KB - may cause context bloat',
        suggestion: 'Split into .claude/rules/*.md for modular loading',
      },
    ],
    qualityScore: 75,
  },
  recommendations: [
    {
      type: 'preventive',
      priority: 1,
      action: 'Add common commands to CLAUDE.md',
      rationale: 'Reduces repetitive typing in sessions',
    },
  ],
};
```

### Session Pattern Detection

```typescript
// For Claude Code analyzer
const sessionPatterns = {
  compactionRate: 0.15,  // 15% of sessions hit compaction
  avgSessionLength: 45,  // messages
  commonToolFailures: ['Bash(npm test)'],
  recommendation: 'Add npm test to permissions allowlist',
};
```

---

## Testing Subagents

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { ACTSubagentRegistry } from '../registry';
import { claudeCodeInstructions } from '../instructions/claude-code';

describe('ACTSubagentRegistry', () => {
  it('converts to SDK agents option', () => {
    const registry = new ACTSubagentRegistry();
    registry.register(claudeCodeInstructions);

    const agents = registry.toAgentsOption();

    expect(agents['claude-code-analyzer']).toBeDefined();
    expect(agents['claude-code-analyzer'].description).toBe(
      claudeCodeInstructions.description
    );
  });
});
```

### Integration Tests

```typescript
import { buildACTSubagents } from '../act';

describe('buildACTSubagents', () => {
  it('returns all registered subagents', () => {
    const agents = buildACTSubagents();

    expect(Object.keys(agents)).toContain('claude-code-analyzer');
    expect(Object.keys(agents)).toContain('generalized-analyzer');
  });
});
```
