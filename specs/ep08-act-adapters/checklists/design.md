# Design Checklist: EP08 ACT Subagents

> Validation checklist for the EP08 implementation plan and design

---

## Research Completeness

- [x] Claude Code architecture documented (files, hierarchy, agent loop)
- [x] Claude Code settings schema documented
- [x] Claude Code session log format documented
- [x] Other ACTs researched (Cursor, Aider, Copilot)
- [x] Context engineering best practices researched
- [x] SDK subagent pattern documented

## Design Artifacts

- [x] plan.md created with technical context
- [x] research.md documents all findings
- [x] data-model.md defines entities
- [x] contracts/interfaces.ts defines TypeScript interfaces
- [x] contracts/claude-code-instructions.md template created
- [x] contracts/generalized-instructions.md template created
- [x] quickstart.md provides usage guidance

## Architecture Alignment

- [x] Uses SDK native `agents` option (not custom abstraction)
- [x] Subagents stored in `src/act/` (not user's `.claude/`)
- [x] Integrates with EP02 Orchestrator
- [x] Uses EP05/EP06 tools (not new tools)
- [x] Single subagent depth (SDK constraint)

## Context Engineering Compliance

- [x] Prompts use hierarchical structure
- [x] Role identity clearly established
- [x] Domain knowledge provided upfront
- [x] Tool guidance specific (when to use, not just what)
- [x] Output format defined
- [x] Limitations section included
- [x] "Right altitude" balance (not too specific, not too vague)

## Constitution Compliance

- [x] I. Local-First: Subagents run locally
- [x] II. Improvement-Oriented: Feeds improvement cycle
- [x] III. Causal-First: Traces to config/session origins
- [x] IV. Mixed-Methods: Agent chooses subagent/tools
- [x] V. Language-Agnostic: Analyzes configs, not code
- [x] VI. Agent-Agnostic: Supports multiple ACTs
- [x] VII. Intelligent Tooling: Main agent decides invocation
- [x] VIII. Compounding Value: Results feed recommendations
- [x] IX. Agent-Aware: Prompts engineered for cognition

## SDK Integration

- [x] AgentDefinition type matches SDK
- [x] Tools array references valid tool names
- [x] Model option supports inherit
- [x] Task tool required in allowedTools
- [x] toAgentsOption() returns correct format

## Data Model Validation

- [x] ACTInstructions schema complete
- [x] ACTSubagentRegistry interface defined
- [x] Zod schemas for validation
- [x] ACTType integration with EP05
- [x] Output types for findings defined

## Extensibility

- [x] Adding new ACT subagent documented
- [x] < 100 LOC for new subagent (target)
- [x] No orchestrator changes needed
- [x] User extensibility path (P3) identified

## Test Strategy

- [x] Unit test examples provided
- [x] Integration test examples provided
- [x] NFR-001: < 100ms loading testable
- [x] NFR-002: < 50KB instruction size measurable

---

## Validation Summary

| Category | Status | Notes |
|----------|--------|-------|
| Research | ✅ Pass | Comprehensive ACT and context engineering research |
| Design Artifacts | ✅ Pass | All required documents created |
| Architecture | ✅ Pass | SDK-native, proper integration points |
| Context Engineering | ✅ Pass | Prompts follow best practices |
| Constitution | ✅ Pass | All 9 principles satisfied |
| SDK Integration | ✅ Pass | Matches SDK types and patterns |
| Data Model | ✅ Pass | Complete with Zod schemas |
| Extensibility | ✅ Pass | Clear path for new subagents |
| Test Strategy | ✅ Pass | Unit and integration tests planned |

**Overall**: Ready for `/dev.tasks` to generate implementation tasks

---

## Key Decisions Documented

| Decision | Choice | Document |
|----------|--------|----------|
| Extension mechanism | SDK Subagents | plan.md |
| Storage location | `src/act/` bundled | plan.md |
| Prompt structure | Hierarchical layered | research.md |
| Tool access | EP05/EP06 only | spec.md |
| Model selection | Inherit | spec.md |
| Subagent depth | Single level | spec.md |

---

## Open Items

None - all questions resolved during /dev.clarify and research phases.

---

## References

- [Effective Context Engineering - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Building Agents with Claude Agent SDK - Anthropic](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Internals - PromptLayer Blog](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [SDK Subagents Documentation](https://platform.claude.com/docs/en/agent-sdk/subagents)
