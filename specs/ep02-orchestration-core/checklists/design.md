# Design Checklist: EP02 Orchestration Core

> Final validation checklist before task generation

## Constitution Compliance (Gate 2)

### Principle Validation

| #    | Principle            | Status | Evidence                                                                    |
| ---- | -------------------- | ------ | --------------------------------------------------------------------------- |
| I    | Local-First          | ✅     | All processing local; Opencode auth used; no telemetry                      |
| II   | Improvement-Oriented | ✅     | SessionState tracks findings over time; checkpoints enable continuity       |
| III  | Causal-First         | ✅     | Finding.origin traces to config/session/git; recommendations are preventive |
| IV   | Mixed-Methods        | ✅     | Agent chooses tools freely (C5); no forced pipelines                        |
| V    | Language-Agnostic    | ✅     | Orchestration layer is language-independent                                 |
| VI   | Agent-Agnostic       | ✅     | ToolRegistry supports any ACT adapter via MCP                               |
| VII  | Intelligent Tooling  | ✅     | SDK tools + custom tools; agent decides usage                               |
| VIII | Compounding Value    | ✅     | BaselineAwareness, globalLearnings in CognitiveWorkspace                    |
| IX   | Agent-Aware          | ✅     | CognitiveWorkspace structures context hierarchically                        |

**Gate Status**: ✅ All principles pass

### No New Violations

- [x] Design does not introduce any new constitution violations
- [x] All design decisions trace to clarifications or ADRs
- [x] No "Complexity Tracking" entries needed

---

## Data Model Validation

### Entity Completeness

- [x] All spec entities defined (MasterLoop → Orchestrator, etc.)
- [x] Attributes match spec Key Entities section
- [x] Relationships documented
- [x] State transitions defined

### Type Safety

- [x] All entities have TypeScript interfaces
- [x] Enums and type aliases defined
- [x] Optional vs required fields specified
- [x] Validation rules documented

### Persistence

- [x] Session state file format defined
- [x] Config file format defined
- [x] File locations specified (`~/.agentlint/`)

---

## Contract Validation

### Interface Completeness

- [x] `IOrchestrator` interface defined with all methods
- [x] `IToolRegistry` interface defined
- [x] `ICheckpointHandler` interface defined
- [x] `IStreamProcessor` interface defined

### SDK Alignment

- [x] Imports from `@anthropic-ai/claude-agent-sdk` typed correctly
- [x] SDK message types referenced properly
- [x] MCP server types used correctly

### Event System

- [x] `OrchestratorEvents` defined for EP03 integration
- [x] Event handler types defined
- [x] All checkpoint triggers covered

---

## Research Validation

### SDK Decisions Documented

- [x] SDK version pinned: `@anthropic-ai/claude-agent-sdk@0.2.7`
- [x] `query()` pattern documented
- [x] `tool()` pattern documented
- [x] Hooks pattern documented
- [x] Resume pattern documented
- [x] Streaming pattern documented

### No Unresolved Unknowns

- [x] All research questions answered
- [x] All `[NEEDS CLARIFICATION]` resolved
- [x] References included for all external sources

---

## Implementation Readiness

### Source Code Structure

- [x] Directory structure proposed: `src/orchestration/`
- [x] File organization planned
- [x] Public exports identified

### Dependencies

- [x] `@anthropic-ai/claude-agent-sdk@0.2.7` identified
- [x] `zod@^3.24.1` identified
- [x] No conflicting dependencies with EP01

### Testing Strategy

- [x] Aligns with ADR-0011 (VCR + TruLens)
- [x] Test directory structure planned
- [x] Mock tool patterns documented

---

## Traceability

### Spec → Data Model

| Spec Entity        | Data Model Entity  |
| ------------------ | ------------------ |
| MasterLoop         | Orchestrator       |
| CognitiveWorkspace | CognitiveWorkspace |
| ToolRegistry       | IToolRegistry      |
| CheckpointEvent    | CheckpointEvent    |
| StreamChunk        | StreamChunk        |
| SessionState       | SessionState       |

### Requirements → Design

| Requirement                | Design Element                       |
| -------------------------- | ------------------------------------ |
| FR-001 Master loop         | Orchestrator.run() wrapping query()  |
| FR-002 Tool invocation     | IToolRegistry.toMcpServer()          |
| FR-003 Tool registration   | IToolRegistry.register() with tool() |
| FR-004 Context compression | SDK PreCompact hook                  |
| FR-007 Streaming           | StreamChunk, IStreamProcessor        |
| FR-008 Checkpoints         | CheckpointEvent, ICheckpointHandler  |
| FR-011 Session resume      | Orchestrator.resume()                |
| FR-015 Cognitive workspace | CognitiveWorkspace interface         |

---

## Final Status

| Artifact                | Status      | Notes                                 |
| ----------------------- | ----------- | ------------------------------------- |
| plan.md                 | ✅ Complete | Technical context, constitution check |
| research.md             | ✅ Complete | 10 decisions documented               |
| data-model.md           | ✅ Complete | All entities defined                  |
| contracts/interfaces.ts | ✅ Complete | TypeScript interfaces                 |
| quickstart.md           | ✅ Complete | Usage guide                           |
| checklists/design.md    | ✅ Complete | This file                             |

---

## Recommendation

**Status**: Ready for task generation (`/dev.tasks`)

All design artifacts are complete:

- Constitution compliance verified
- Data model complete with TypeScript interfaces
- Research decisions documented
- SDK integration patterns validated
- Quickstart guide ready

Proceed to `/dev.tasks` to generate implementation tasks.
