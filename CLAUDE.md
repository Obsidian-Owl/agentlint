# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

agentlint is a local-first CLI tool for continuous improvement of AI-assisted development workflows. It traces issues to their origins and provides preventive recommendations that compound value over time. Unlike traditional linters, agentlint analyzes the AI development system itself—configuration quality, session effectiveness, and workflow optimization.

**Status**: EP02 Complete (Orchestration Core implemented)

**Stack**: TypeScript + Bun, Claude Agent SDK (@anthropic-ai/claude-agent-sdk), Zod validation

**Implemented Epics**:
- EP01: Project Setup (CI/CD, TypeScript config, test framework)
- EP02: Orchestration Core (Claude Agent SDK wrapper, streaming, checkpoints, session management)

## Constitution

All work must align with the 9-principle Constitution at `.specify/memory/constitution.md`. Key principles:

1. **Local-First**: All analysis on user's machine, no data transmission without consent
2. **Causal-First**: Trace issues to origin, recommend prevention (DETECT → TRACE → UNDERSTAND → RECOMMEND)
3. **Agent-Aware**: The agent IS the system; design serves agent cognitive needs
4. **Mixed-Methods**: Agent decides which analysis methods to apply based on context

**Decision test**: Does the feature support continuous improvement? Trace to root cause? Maintain local-first? Preserve user agency (recommend, don't automate)?

## Development Workflow

Use the dev.* skills in `.claude/skills/` for structured feature development:

```
/dev.specify → /dev.clarify → /dev.plan → /dev.tasks → /dev.taskstolinear → /dev.implement → /dev.integration-check → /dev.pr
```

- **Branch naming**: `ep##-feature-name` (e.g., `ep01-project-setup`) matching epic IDs from `docs/planning/epic-catalogue.md`
- **Feature specs**: Created in `specs/ep##-feature-name/` with spec.md, plan.md, tasks.md
- **Task tracking**: Linear integration via MCP (configured in `.mcp.json`)

## Key Architecture Concepts

**6-Layer Architecture**: CLI → Orchestration (Claude Agent SDK) → Tools → ACT Adapters → Persistence → Integration

**Two-Layer Analysis**: Static tools for speed (parsing, extraction) + agent reasoning for depth (causal analysis, quality judgment)

**Signal Types**: Leading (predict), Lagging (reflect), Qualitative (semantic), Causal (traced origins)

## Documentation Structure

| Location | Content |
|----------|---------|
| `docs/architecture/arc42/` | 12-section Arc42 architecture docs |
| `docs/architecture/adr/` | 18 Architecture Decision Records |
| `docs/planning/epic-catalogue.md` | 12 implementation epics with dependencies |
| `docs/requirements/` | Functional requirements, use cases, personas |
| `docs/vision/north-star.md` | Mission, vision, success indicators |

## Orchestration Module (EP02)

The `src/orchestration/` module wraps the Claude Agent SDK:

| Component | File | Purpose |
|-----------|------|---------|
| Orchestrator | `orchestrator.ts` | Main loop wrapping SDK `query()` |
| ToolRegistry | `tool-registry.ts` | MCP tool registration via `createSdkMcpServer()` |
| StreamProcessor | `streaming.ts` | SDK message → StreamChunk conversion |
| CheckpointHandler | `checkpoint.ts` | Crash recovery checkpoints |
| SessionState | `session-state.ts` | Session persistence to JSON |
| CognitiveWorkspace | `cognitive-workspace.ts` | Hierarchical context for agent |
| Context | `context.ts` | Large result summarization |

**Key patterns**:
- Tool definitions use SDK's `tool()` with Zod schemas
- Streaming yields `StreamChunk` objects with verbosity levels
- Checkpoints emit on tool completion, findings, phase changes, intervals
- Subagent depth limited to 1 per Constitution Principle C8

**Configuration** (`~/.agentlint/config.json`):
```json
{
  "model": "claude-sonnet-4-20250514",
  "checkpoint": { "intervalMs": 60000 },
  "verbosity": "normal"
}
```

## ADR Implementation Pattern

ADRs describe tool capabilities and data structures, NOT agent orchestration:
- **Good**: Tool schemas, data structures, SQL queries, API surfaces
- **Anti-pattern**: Functions that dictate session workflows, code that orchestrates agent behavior

## Available Skills

Architecture: `adr`, `arc42-architecture-design`, `arc42-epic-decomposer`, `arch-review`

Dev workflow: `dev.specify`, `dev.clarify`, `dev.plan`, `dev.tasks`, `dev.taskstolinear`, `dev.implement`, `dev.pr`, `dev.integration-check`

Quality: `dev.analyze`, `dev.checklist`, `dev.constitution`
