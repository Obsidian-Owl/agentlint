# Requirements Checklist: EP02 Orchestration Core

> Quality validation checklist for specification completeness

## Completeness Checks

### Overview & Scope
- [x] Clear, concise overview (2-3 sentences)
- [x] Business context links to epic and dependencies
- [x] Out of scope items explicitly listed
- [x] Constitution alignment noted

### User Stories
- [x] All user stories follow "As a... I want... So that..." format
- [x] Each story has clear acceptance criteria (Given/When/Then)
- [x] Test scenarios include happy path and error cases
- [x] Stories are prioritized (P1/P2/P3)
- [x] Primary persona is identified for each story

### Requirements
- [x] All functional requirements trace to user stories
- [x] Non-functional requirements have measurable targets
- [x] Requirements are prioritized
- [x] No duplicate requirements

### Entities
- [x] Key entities defined with attributes
- [x] Entity relationships documented
- [x] Entities map to domain model

### Success Criteria
- [x] Measurable outcomes defined
- [x] Criteria align with NFRs
- [x] Clear definition of "done"

### Edge Cases & Errors
- [x] Error scenarios identified
- [x] Recovery behavior specified
- [x] Errors prioritized by impact

### Dependencies
- [x] Internal dependencies identified with status
- [x] External dependencies listed
- [x] Impact if missing documented

## Clarity Checks

### Specificity
- [x] No vague language ("might", "possibly", "could")
- [x] Concrete numbers for performance targets
- [x] Specific technologies named (Claude Agent SDK, Zod, etc.)

### Consistency
- [x] Entity names consistent throughout
- [x] Priority scheme consistent (P1/P2/P3)
- [x] Terminology matches ADRs and Arc42

### Testability
- [x] Acceptance criteria are testable
- [x] NFRs can be measured
- [x] Edge cases have observable outcomes

## Alignment Checks

### Constitution Compliance
- [x] Local-First: No external data transmission
- [x] Agent-Aware: Design serves agent cognitive needs
- [x] Intelligent Tooling: Agent chooses tools freely
- [x] Improvement-Oriented: Checkpointing enables recovery
- [x] Mixed-Methods: Agent decides approach (C5, C7)

### ADR Compliance
- [x] ADR-0002: Claude Agent SDK integration
- [x] ADR-0005: Tool registration pattern
- [x] ADR-0010: Checkpoint state schema

### Arc42 Alignment
- [x] References Section 4 Solution Strategy (Two-Layer clarified in C5)
- [x] References Section 5 Building Blocks
- [x] References Section 6 Runtime View
- [x] References Section 8 Crosscutting Concepts

### SDK Research Validation (Session 3)
- [x] Verified against Claude Code master loop architecture
- [x] Verified against Claude Agent SDK TypeScript API
- [x] Patterns match proven Claude Code implementation
- [x] SDK integration strategy documented (C8, C9)

## Open Items

### Questions Requiring Clarification (Session 1: 2026-01-16)
- [x] Q1: SDK import path and version — **RESOLVED**: Pin specific version
- [x] Q2: Checkpoint interval configuration scope — **RESOLVED**: Global config only
- [x] Q3: Streaming output verbosity formatting — **RESOLVED**: Structured levels (quiet/normal/verbose/debug)
- [x] Q4: API key expiration fallback — **RESOLVED**: Checkpoint and fail with clear error

### Questions Requiring Clarification (Session 2: 2026-01-16)
- [x] Q5: Two-Layer Analysis pattern — **RESOLVED**: Tools self-categorize; EP02 layer-agnostic (C5)
- [x] Q6: Model selection — **RESOLVED**: Configurable with Sonnet 4 default (C6)
- [x] Q7: Analysis phases — **RESOLVED**: Hybrid approach with agent agency (C7)

### Questions Requiring Clarification (Session 3: 2026-01-16 - SDK Research)
- [x] Q8: SDK integration approach — **RESOLVED**: Wrap `query()` function (C8)
- [x] Q9: Checkpoint hooks strategy — **RESOLVED**: Use SDK hooks (PostToolUse, SessionEnd, PreCompact) (C8)
- [x] Q10: Built-in vs custom tools — **RESOLVED**: SDK tools + custom agentlint tools (C9)

### Validation Status
- **Completeness**: PASS
- **Clarity**: PASS
- **Alignment**: PASS (verified against Constitution, ADRs, Arc42)
- **SDK Validation**: PASS (verified against Claude Code architecture + Agent SDK)
- **Open Questions**: All 10 resolved

## Clarification Coverage

| Category | Status | Notes |
|----------|--------|-------|
| Functional Scope | Clear | Two-Layer (C5), phases (C7), SDK integration (C8) |
| Domain Model | Clear | Entities well-defined |
| UX Flow | Deferred | EP04 responsibility |
| Quality Attributes | Clear | Model configurability (C6) |
| Integrations | Clear | SDK hooks for checkpoints, MCP for tools (C8, C9) |
| Edge Cases | Clear | 10 scenarios documented |
| Constraints | Clear | Dependencies documented |
| Terminology | Clear | SDK terminology aligned (C8) |

## Research Sources

- [Claude Code Behind-the-Scenes](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [Agent SDK TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [ZenML - Claude Code Architecture](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)

## Recommendation

**Status**: Ready for planning phase (`/dev.plan`)

All open questions have been resolved across three clarification sessions, including SDK research validation. The specification is:
- Complete with 9 user stories and 16 functional requirements
- Clear with all ambiguities resolved
- Aligned with Constitution principles (especially IV, VII, IX)
- Consistent with ADRs and Arc42 architecture
- **Validated against actual Claude Code architecture and Agent SDK API**

Key findings from SDK research:
1. Our master loop pattern aligns with Claude Code's `while(tool_call)` loop
2. SDK's `query()` function provides foundation; EP02 wraps it
3. SDK hooks replace custom checkpoint events
4. SDK built-in tools (Read, Write, Edit, etc.) reused; agentlint tools added via MCP
5. Streaming input pattern enables h2A-style real-time steering for human-in-the-loop
