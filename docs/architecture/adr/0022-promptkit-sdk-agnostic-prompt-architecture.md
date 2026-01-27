---
status: accepted
date: 2026-01-27
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0022: PromptKit - SDK-Agnostic Prompt Architecture

## Context and Problem Statement

agentlint uses prompts across multiple tiers:

1. **Analysis prompts** - Versioned (v1.0.0), registry pattern
2. **Subagent prompts** - 4-layer structure (Role→Domain→Task→Output), NOT versioned
3. **Welcome/TUI prompts** - Inline, NOT versioned, personality sprawl

Research revealed that:

- **Personality was defined in TWO places** (welcome-prompt.ts, conversation.ts) - sprawl
- **Prompts were not versioned** - no ability to track effectiveness or A/B test
- **Prompts were tightly coupled to SDK** - migration to different SDKs would require rewriting prompts
- **No centralized registry** - prompts scattered across codebase

Claude Code uses 110+ modular prompt strings with per-release versioning. Industry best practices recommend:

- Single Source of Truth for personality
- Component-based prompt composition
- Prompt registries with version tracking
- SDK-agnostic intermediate representation (IR)

## Decision Drivers

- **Learning Over Time** (Constitution): Need versioned prompts to track which versions produce better outcomes
- **SDK Portability**: Planned migration away from Claude Agent SDK requires decoupled prompts
- **Personality Consistency**: Users should experience consistent personality across all interactions
- **Maintainability**: Scattered prompt definitions are hard to maintain and evolve

## Considered Options

1. **Quick Fix Only** - Just fix the personality sprawl, leave structure as-is
2. **Full PromptKit** - Build SDK-agnostic IR, registry, adapters, migrate all prompts
3. **Foundation Now + Full Migration Later** - Build core infrastructure now, migrate prompts incrementally

## Decision Outcome

Chosen option: **"Foundation Now + Full Migration Later"** - Build the PromptKit infrastructure and centralized persona immediately, migrate remaining prompts incrementally as they're touched.

### Consequences

**Good:**

- Personality sprawl fixed immediately
- Foundation enables versioning and learning
- SDK migration becomes prompt-content-stable
- Low risk - prompts are already just strings

**Bad:**

- Partial migration state during transition
- Some prompts still in old locations temporarily

### Implementation

#### Directory Structure

```
src/prompts/
├── index.ts                    # Master barrel export
├── promptkit/
│   ├── types.ts                # PromptSpec, PromptMessage, PromptRole
│   ├── registry.ts             # PromptRegistry with version management
│   └── index.ts                # Barrel export
├── components/
│   ├── index.ts                # Barrel export
│   └── persona/
│       ├── detective-persona.ts # DETECTIVE_PERSONA single source of truth
│       └── index.ts            # Barrel export
├── adapters/                   # (Future) SDK adapters
│   ├── types.ts                # PromptAdapter interface
│   └── claude-agent-sdk.ts     # Claude SDK adapter
├── welcome/                    # (Future) Welcome prompts as PromptSpec
├── analysis/                   # (Future) Analysis prompts as PromptSpec
└── subagents/                  # (Future) Subagent prompts as PromptSpec
```

#### Core Types

```typescript
type PromptRole = 'system' | 'developer' | 'user';

interface PromptMessage {
  role: PromptRole;
  content: string;
}

interface PromptSpec<TCtx = void> extends PromptMetadata {
  id: string; // e.g., "welcome/system"
  version: string; // semver
  createdAt: string; // ISO 8601
  description: string;
  tags?: string[];
  render(ctx: TCtx): PromptMessage[];
}
```

#### Centralized Persona

```typescript
export const DETECTIVE_PERSONA = {
  name: 'Detective',
  traits: [
    'Observant detective with dry wit - notices things and comments wryly',
    'Professional but not stiff - occasional understated humor is welcome',
    'Concise and direct - 2-3 sentences max, no fluff',
    'Helpful - if there is something actionable, mention it',
  ],
  toneExamples: [...],
  antiPatterns: [...],
} as const;

export function buildPersonaBlock(): string { ... }
export function buildMinimalPersonaBlock(): string { ... }
```

#### Registry Usage

```typescript
import { getPromptRegistry, type PromptSpec } from '../prompts';

// Register a prompt
const registry = getPromptRegistry();
registry.register(welcomeSystemPrompt);

// Retrieve latest version
const prompt = registry.get('welcome/system');

// Retrieve specific version
const prompt = registry.get('welcome/system', '1.0.0');

// List all prompts
const all = registry.list();

// Get all versions of a prompt
const versions = registry.getVersions('welcome/system');
```

#### SDK Adapter Pattern (Future)

When migrating away from Claude Agent SDK:

```typescript
interface PromptAdapter<TOutput> {
  adapt<TCtx>(spec: PromptSpec<TCtx>, ctx: TCtx): TOutput;
}

class ClaudeAgentSdkAdapter implements PromptAdapter<string> {
  adapt<TCtx>(spec: PromptSpec<TCtx>, ctx: TCtx): string {
    const messages = spec.render(ctx);
    return messages.map((m) => m.content).join('\n\n');
  }
}

class AnthropicMessagesAdapter implements PromptAdapter<MessageParam[]> {
  adapt<TCtx>(spec: PromptSpec<TCtx>, ctx: TCtx): MessageParam[] {
    return spec.render(ctx).map((m) => ({
      role: m.role === 'developer' ? 'user' : m.role,
      content: m.content,
    }));
  }
}
```

### Migration Path

1. **Phase 1 (DONE)**: Core infrastructure - types, registry, persona
2. **Phase 2 (DONE)**: Welcome prompts use centralized persona
3. **Phase 3 (Incremental)**: Migrate analysis, ACT, session prompts as touched
4. **Phase 4 (SDK Migration)**: Add adapter layer, swap SDK

Prompts themselves are already SDK-agnostic (just strings). The SDK coupling is in:

- `orchestration/orchestrator.ts` - `query()` call
- `orchestration/tool-registry.ts` - `createSdkMcpServer()`
- `**/tools/*.ts` (63 files) - `tool()` definitions

Migration requires changing ~5 core orchestration files, NOT rewriting prompts.

## Related Decisions

- **ADR-0002**: Agentic Framework Strategy (Claude Agent SDK selection)
- **ADR-0019**: Tool/Agent Boundary (prompts guide agent reasoning)
- **ADR-0021**: TUI Architecture (welcome flow uses prompts)

## Notes

Research sources:

- Claude Code uses 110+ modular prompt strings (Piebald-AI analysis)
- Claude Code versions prompts per-release with token delta tracking
- Production agents (Cline, Gemini CLI, Khoj) use prompt registries
- Industry best practice: Single Source of Truth for personality
