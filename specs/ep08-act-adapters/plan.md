# Implementation Plan: ACT Subagents

> **Epic**: EP08
> **Spec**: specs/ep08-act-adapters/spec.md
> **Created**: 2026-01-18
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Implement specialized analysis subagents for different AI Coding Tools (ACTs) using the Claude Agent SDK's native subagent pattern.

**Technical Approach**: Define programmatic subagents with context-engineered prompts that leverage existing EP05/EP06 tools. Subagents are bundled with agentlint, not stored in user's `.claude/` directory.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x |
| **Primary Dependencies** | @anthropic-ai/claude-agent-sdk, Zod |
| **Storage** | Bundled in `src/act/` (not filesystem) |
| **Testing Framework** | Vitest |
| **Target Platform** | CLI Tool (Node.js 20+, Bun) |
| **Project Type** | Agent submodule |
| **Performance Goals** | < 100ms subagent loading |
| **Constraints** | No user `.claude/` pollution; single subagent depth |
| **Scale/Scope** | Single developer, local analysis |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | Subagents run locally, no data transmission |
| II | Improvement-Oriented | ✓ | Subagents support analysis that feeds improvement cycle |
| III | Causal-First | ✓ | Subagents trace issues to config/session origins |
| IV | Mixed-Methods | ✓ | Agent decides which subagent/tools to use |
| V | Language-Agnostic | ✓ | Analyzes ACT configs, not source code |
| VI | Agent-Agnostic | ✓ | Subagent pattern supports multiple ACTs |
| VII | Intelligent Tooling | ✓ | Main agent chooses when to invoke subagents |
| VIII | Compounding Value | ✓ | Analysis results feed into recommendations |
| IX | Agent-Aware | ✓ | Prompts engineered for agent cognition |

**Gate Status**: [✓] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep08-act-adapters/
├── spec.md                      # Feature specification
├── plan.md                      # This file
├── research.md                  # Research findings (complete)
├── data-model.md                # Entity definitions
├── contracts/                   # API definitions
│   └── interfaces.ts            # TypeScript interfaces
├── quickstart.md                # Usage guide
└── checklists/
    ├── requirements.md          # From /dev.specify
    └── design.md                # Design validation
```

### Source Code Structure (Proposed)

```
src/
└── act/
    ├── index.ts                 # Public exports: buildACTSubagents()
    ├── types.ts                 # ACTSubagentDefinition, ACTInstructions
    ├── registry.ts              # ACTSubagentRegistry class
    ├── instructions/
    │   ├── index.ts             # Instructions aggregator
    │   ├── claude-code.ts       # Claude Code specialist
    │   └── generalized.ts       # Fallback analyzer
    └── __tests__/
        ├── registry.test.ts
        └── instructions.test.ts
```

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Extension mechanism | SDK Subagents | Native to Claude Agent SDK, programmatic | N/A |
| Storage location | `src/act/` bundled | Not in user's `.claude/`, ships with agentlint | N/A |
| Prompt structure | Hierarchical layered | Context engineering best practice | N/A |
| Model selection | Inherit from orchestrator | Simpler, consistent behavior | N/A |
| Subagent depth | Single level only | SDK constraint, aligns with Constitution C8 | N/A |
| Tool access | EP05/EP06 tools only | Read-only analysis, minimal risk | N/A |

---

## Subagent Prompt Engineering Strategy

Based on research findings, subagent prompts follow the **hierarchical layered structure**:

### Layer 1: Role Identity
- Clear specialist identity
- Domain expertise declaration
- Constraints on scope

### Layer 2: Domain Knowledge
- ACT-specific file locations
- Configuration schemas
- Session log formats
- Hierarchy/precedence rules

### Layer 3: Task Instructions
- What to analyze
- Analysis methodology
- Tool selection guidance

### Layer 4: Output Format
- Structured findings format
- How to report to orchestrator

### Key Principles Applied

1. **Right Altitude**: Not too specific (brittle), not too vague (ungrounded)
2. **Quality Over Quantity**: Essential knowledge only
3. **Explicit Grounding**: Don't assume shared context
4. **Tool Guidance**: Clear when to use which tool

---

## Integration Points

### Orchestrator Integration

```typescript
// src/orchestration/orchestrator.ts
import { buildACTSubagents } from '../act';
import { query } from '@anthropic-ai/claude-agent-sdk';

// In run() method - streaming pattern
for await (const message of query({
  prompt: task,
  options: {
    model: this.config.model,
    mcpServers: { agentlint: mcpServer },
    // CRITICAL: 'Task' must be in allowedTools for subagent invocation
    allowedTools: [...builtinTools, 'Task'],
    // EP08 integration - ACT analyzer subagents
    agents: buildACTSubagents(),
  },
})) {
  // Process streaming messages
  // Detect subagent invocation: tool_use with name === 'Task'
}
```

**SDK Constraints:**
- `Task` tool enables subagent invocation - must be in main agent's allowedTools
- Subagents CANNOT spawn their own subagents (single-depth)
- Subagent tools must NOT include `Task`

### Tool Registry Integration

Subagents access tools from `ToolRegistry`:
- `discover_configs` (EP05)
- `parse_config` (EP05)
- `analyze_hierarchy` (EP05)
- `search_sessions` (EP06)
- `get_session_stats` (EP06)

---

## Complexity Tracking

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| *None* | *No violations identified* | | |

---

## References

- **Spec**: [specs/ep08-act-adapters/spec.md](./spec.md)
- **Research**: [specs/ep08-act-adapters/research.md](./research.md)
- **Epic**: [docs/planning/epics/EP08-act-adapters.md](../../docs/planning/epics/EP08-act-adapters.md)
- **Arc42**: [docs/architecture/arc42/05-building-blocks.md](../../docs/architecture/arc42/05-building-blocks.md)
- **ADRs**: [ADR-0002 Agentic Framework Strategy](../../docs/architecture/adr/0002-agentic-framework-strategy.md)
- **SDK Docs**: [Agent SDK Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- **Context Engineering**: [Anthropic - Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-18 | Claude | Initial plan with research findings |
