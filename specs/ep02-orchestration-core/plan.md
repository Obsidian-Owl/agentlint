# Implementation Plan: Orchestration Core

> **Epic**: EP02
> **Spec**: specs/ep02-orchestration-core/spec.md
> **Created**: 2026-01-16
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Implement the master agent loop that powers all agentlint analysis, wrapping the Claude Agent SDK's `query()` function with agentlint-specific orchestration (tool registration, checkpoint emission, streaming, session resume).

**Technical Approach**: Wrap SDK's `query()` function to leverage its battle-tested master loop. Register agentlint tools via MCP servers, emit checkpoint events via SDK hooks, and structure the cognitive workspace through system prompt customization.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x + Bun (ESNext target) |
| **Primary Dependencies** | `@anthropic-ai/claude-agent-sdk`, `zod` |
| **Storage** | File system (session state JSON) → EP03 will add SQLite |
| **Testing Framework** | Bun test + VCR recordings (per ADR-0011) |
| **Target Platform** | CLI (Node.js 22+, Bun runtime) |
| **Project Type** | CLI Tool - Agentic Analysis |
| **Performance Goals** | Loop iteration < 5s (excl. LLM), checkpoint resume < 5s |
| **Constraints** | Local-first (no external services except user's Anthropic API) |
| **Scale/Scope** | Single developer, single project at a time |

### SDK Dependencies (to be pinned)

| Package | Purpose | Version Strategy |
|---------|---------|------------------|
| `@anthropic-ai/claude-agent-sdk` | Core agent loop, tools, streaming | Pin specific version |
| `zod` | Schema validation for tools | Pin specific version |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ | All processing local; only user's Anthropic API called |
| II | Improvement-Oriented | ✅ | Checkpoint events enable baseline tracking; session state persists |
| III | Causal-First | ✅ | Findings trace to tool results; checkpoint includes causal chain |
| IV | Mixed-Methods | ✅ | Agent freely chooses between tools and reasoning (C5 decision) |
| V | Language-Agnostic | ✅ | Orchestration is language-independent; tools handle specifics |
| VI | Agent-Agnostic | ✅ | Tool registration pattern supports multiple agent adapters |
| VII | Intelligent Tooling | ✅ | SDK tools + custom tools; agent decides usage (C9 decision) |
| VIII | Compounding Value | ✅ | Session state enables cross-session learnings via EP03 |
| IX | Agent-Aware | ✅ | CognitiveWorkspace structures context hierarchically |

**Gate Status**: ✅ All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep02-orchestration-core/
├── spec.md           # Feature specification ✓
├── plan.md           # This file
├── research.md       # Research findings
├── data-model.md     # Entity definitions
├── quickstart.md     # Usage guide
├── contracts/        # API definitions
│   └── interfaces.ts # TypeScript interfaces
└── checklists/
    ├── requirements.md  # Requirements validation ✓
    └── design.md        # Design validation
```

### Source Code Structure (Proposed)

```
src/
├── orchestration/           # EP02: Orchestration Core
│   ├── index.ts             # Public exports
│   ├── types.ts             # Type definitions
│   ├── orchestrator.ts      # Main Orchestrator class wrapping query()
│   ├── tool-registry.ts     # Tool registration and MCP server
│   ├── checkpoint.ts        # Checkpoint hook handlers
│   ├── streaming.ts         # Stream processing and verbosity
│   ├── session-state.ts     # Session state management
│   ├── cognitive-workspace.ts # System prompt construction
│   └── config.ts            # Configuration loading
├── cli.ts                   # Existing CLI entry
├── commands/                # Existing commands
├── errors/                  # Existing errors (extend for EP02)
└── types/                   # Existing types (extend for EP02)
```

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| SDK Integration | Wrap `query()` | Leverages proven master loop; minimizes maintenance | C8 |
| Checkpoint Events | SDK hooks | Use `PostToolUse`, `SessionEnd`, `PreCompact` hooks | C8, ADR-0010 |
| Tool Registration | `createSdkMcpServer()` | SDK-native pattern; MCP-compatible | C9, ADR-0005 |
| Context Compression | SDK-managed | 92% threshold handled by SDK's `PreCompact` | C8 |
| Built-in Tools | SDK tools + custom | Reuse Read/Write/Edit/Bash; add agentlint tools | C9 |
| Model Selection | User-configurable | Default to Sonnet 4; user controls costs | C6 |
| Analysis Phases | Hybrid (suggested, not enforced) | Agent has agency to skip/add phases | C7 |

---

## Implementation Phases

### Phase 0: SDK Spike (Research)
- Verify SDK version and API surface
- Confirm `query()` patterns work with hooks
- Test MCP server registration
- Document any SDK limitations

### Phase 1: Core Orchestrator (P1 Requirements)
- `Orchestrator` class wrapping `query()`
- `ToolRegistry` with `createSdkMcpServer()`
- Basic streaming output
- Configuration loading

### Phase 2: Checkpointing (P1 Requirements)
- Checkpoint hook handlers
- Session state serialization
- Interval-based checkpoints

### Phase 3: Session Management (P2 Requirements)
- Session resume via SDK `resume` option
- State restoration
- Human-in-the-loop pauses

### Phase 4: Cognitive Workspace (P3 Requirements)
- System prompt construction
- Hierarchical context structure
- Baseline awareness injection

---

## Complexity Tracking

> No constitution violations identified

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| *(none)* | | | |

---

## References

- **Spec**: [specs/ep02-orchestration-core/spec.md](./spec.md)
- **Epic**: [docs/planning/epics/EP02-orchestration-core.md](../../docs/planning/epics/EP02-orchestration-core.md)
- **Arc42**: §5 Building Blocks, §6 Runtime View, §8 Crosscutting Concepts
- **ADRs**: ADR-0002, ADR-0005, ADR-0010, ADR-0011
- **SDK Docs**: [platform.claude.com/docs/en/agent-sdk/typescript](https://platform.claude.com/docs/en/agent-sdk/typescript)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-16 | Claude | Initial plan |
