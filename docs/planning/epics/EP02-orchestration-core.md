# EP02: Orchestration Core

> Implement the master agent loop using Claude Agent SDK with context management and tool orchestration.

## Classification

| Attribute              | Value         |
| ---------------------- | ------------- |
| **Type**               | Foundation    |
| **Priority**           | P0-Critical   |
| **Size**               | L             |
| **Estimated Duration** | 6 weeks       |
| **Target Stories**     | 10-12 stories |

## Business Outcome Hypothesis

**If** we implement a robust master agent loop following Claude Code's proven patterns,
**Then** the agentlint agent will reliably orchestrate analysis through tool invocations and reasoning,
**Measured by** successful analysis completion rates >95% and context management within token limits.

## Scope Definition

### In Scope

- [ ] Integrate Claude Agent SDK with Anthropic API
- [ ] Implement `while(tool_use)` master loop pattern
- [ ] Create Agent Cognitive Workspace structure (task, context, progress, findings)
- [ ] Implement context management with compression triggers
- [ ] Create tool registration infrastructure (interfaces, not implementations)
- [ ] Add human-in-the-loop pause/resume mechanism
- [ ] Implement streaming output for real-time agent reasoning visibility
- [ ] Add checkpointing hooks for session state (actual storage in EP03)
- [ ] Configure subagent pattern with depth limits

### Out of Scope

- Specific tool implementations (EP05-EP10)
- Persistence layer (EP03)
- CLI command parsing (EP04)
- Adapter implementations (EP08)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Master loop executes with mock tools
- Agent receives context and produces structured output
- Context compression triggers work correctly

**MVP validates:** Claude Agent SDK integration is correct and loop pattern is stable

## Arc42 Traceability

| Source                    | References                                                   |
| ------------------------- | ------------------------------------------------------------ |
| **Building Blocks**       | Orchestration Layer (Master Agent Loop, Cognitive Workspace) |
| **Runtime Scenarios**     | 6.1 Full Analysis (master loop flow)                         |
| **Quality Requirements**  | QS-2 (checkpoint recovery), QS-3 (graceful degradation)      |
| **Crosscutting Concepts** | 8.4 Context Management                                       |
| **ADRs**                  | ADR-0002 (Agentic Framework), ADR-0005 (Tool Definition)     |

## Requirements Traceability

| Source           | References                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| **Personas**     | Persona 0 (The agentlint Agent) - distilled context, hierarchical memory |
| **Use Cases**    | All use cases depend on orchestration                                    |
| **Requirements** | NFR-1.2 (Agentic Analysis), NFR-1.3 (Long Session Feedback)              |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed                                               |
| ---- | --------------- | ----------------------------------------------------------- |
| EP01 | Hard            | Project structure, TypeScript config, dependency management |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides                    |
| ---- | --------------- | ------------------------------------- |
| EP04 | Hard            | Agent execution entry point           |
| EP05 | Hard            | Tool registration mechanism           |
| EP06 | Hard            | Tool registration, context management |
| EP07 | Hard            | Agent reasoning infrastructure        |
| EP10 | Hard            | Agent synthesis capabilities          |
| EP11 | Hard            | Evaluation integration points         |

### External Dependencies

| System/Team  | Dependency                        | Status                 |
| ------------ | --------------------------------- | ---------------------- |
| Opencode SDK | Tool registration, loop execution | Available              |
| LLM Provider | Anthropic/OpenAI/etc.             | Requires opencode auth |

## Technical Considerations

### Key Decisions

- Follow Claude Code's single-threaded master loop (not parallel agent execution)
- Use hierarchical context structure matching Persona 0 cognitive needs
- Implement ~92% context compaction based on Claude Code benchmarks
- Support subagent delegation with depth=1 limit

### Risks & Mitigations

| Risk                                 | Likelihood | Impact | Mitigation                                  |
| ------------------------------------ | ---------- | ------ | ------------------------------------------- |
| Opencode SDK API changes             | Medium     | Medium | Pin version, monitor changelog              |
| Context window limits hit            | Medium     | High   | Aggressive compression, incremental loading |
| API rate limits during long sessions | Medium     | Medium | Exponential backoff, checkpointing          |

### Spikes Needed

- [ ] Benchmark context compaction with realistic sessions
- [ ] Test streaming output performance
- [ ] Verify subagent pattern isolation

### Constitution Alignment

- **IX. Agent-Aware**: Design serves agent's cognitive needs (primary)
- **VII. Intelligent Tooling**: Agent chooses between tools and reasoning
- **IV. Mixed-Methods**: Agent orchestrates method selection

## Acceptance Criteria (High-Level)

### Functional

- [ ] Master loop executes until tool_use=false or termination condition
- [ ] Agent can invoke registered tools and observe results
- [ ] Context compression triggers at configurable threshold
- [ ] Human-in-the-loop prompts pause execution until user responds
- [ ] Streaming output shows agent reasoning in real-time
- [ ] Checkpointing hooks called after major phases

### Non-Functional

- [ ] Loop iteration <5s average (excluding LLM latency)
- [ ] Context management keeps conversation within 180K tokens
- [ ] Recovery from checkpoint <5s

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration with mock LLM)
- [ ] Documentation updated (architecture, usage)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 0 (The agentlint Agent)
- **Workflow**: Receive task → gather context → invoke tools → synthesize findings
- **Outcome**: Stable, predictable agent execution

### Constraints to Encode

From ADRs:

- ADR-0002: Claude Agent SDK, Anthropic-only for MVP
- ADR-0005: Tool definitions use SDK tool() with Zod schemas

From Constitution:

- IX. Agent-Aware: All design serves agent cognition
- VII. Intelligent Tooling: Agent decides tool vs reasoning

### Key Scenarios to Specify

1. Normal analysis flow with multiple tool invocations
2. Context approaching limit triggers compression
3. Human-in-the-loop request pauses agent
4. Session resumes from checkpoint
5. Agent handles tool error gracefully

### Tech Stack Notes (for `/speckit.plan`)

- Claude Agent SDK (latest stable)
- Zod for schema validation
- Streaming via SDK's built-in support

---

## Change Log

| Date       | Author           | Change                      |
| ---------- | ---------------- | --------------------------- |
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
