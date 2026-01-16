# Analysis Report: EP02 Orchestration Core

> **Generated**: 2026-01-16
> **Artifacts Analyzed**: spec.md, plan.md, research.md, data-model.md, contracts/interfaces.ts, quickstart.md
> **Validated Against**: Claude Agent SDK documentation (platform.claude.com), Arc42, ADRs, Constitution
> **Updated**: 2026-01-16 (critical errors fixed)

---

## Summary

| Artifact | Errors | Warnings | Info |
|----------|--------|----------|------|
| spec.md | 0 | 0 | 2 |
| plan.md | 0 | 1 | 1 |
| research.md | 0 | 1 | 2 |
| data-model.md | 0 | 0 | 0 |
| contracts/interfaces.ts | 0 | 1 | 1 |
| quickstart.md | 0 | 0 | 1 |
| SDK Alignment | 0 | 1 | 2 |
| Architecture | 0 | 1 | 0 |
| **Total** | **0** | **5** | **9** |

**Overall Status**: ✅ PASS (ready for `/dev.tasks`)

---

## Findings

### Errors (FIXED)

#### E-001: Missing `settingSources` Option in Contracts ✅ FIXED

**Location**: `contracts/interfaces.ts`, `OrchestratorConfig` interface

**Issue**: The SDK documentation explicitly states:
> "When settingSources is omitted or undefined, the SDK does **not** load any filesystem settings... **Must include 'project' to load CLAUDE.md files**"

**Resolution**: Added `settingSources` option to `OrchestratorConfig` interface with proper documentation.

---

#### E-002: SDK Message Type Handling in Research ✅ FIXED

**Location**: `research.md:244-293` (Streaming Output Pattern)

**Issue**: Incorrect SDK message type handling pattern.

**Resolution**: Updated research.md with:
- Proper TypeScript type imports
- Type-safe message handling with explicit casts
- Added `settingSources: ['project']` to code examples

---

### Warnings (SHOULD FIX)

#### W-001: Context Compression Threshold Clarification ✅ FIXED

**Location**: `spec.md:FR-004`

**Issue**: Spec said "configurable threshold" but SDK threshold is internal.

**Resolution**: Updated FR-004 to:
```
FR-004: Context compression handled by SDK via PreCompact hook (~92% internal threshold)
```

---

#### W-002: StreamChunkType Missing 'stream_event'

**Location**: `contracts/interfaces.ts:20-28`

**Issue**: The `StreamChunkType` enum doesn't include mapping for SDK's `'stream_event'` type:
```typescript
// Current
export type StreamChunkType =
  | 'text'
  | 'tool_start'
  | 'tool_result'
  // ... missing 'stream_event'
```

**Recommendation**: Either:
1. Add SDK type mapping, or
2. Document that EP02 transforms SDK types to agentlint types

---

#### W-003: SDK Version Verification Needed

**Location**: `research.md:12-13`

**Issue**: Research pins `@anthropic-ai/claude-agent-sdk@0.2.7` but this should be verified during Phase 0 SDK Spike. The version was identified via web search but npm registry should be checked directly.

**Recommendation**: Phase 0 should explicitly verify:
```bash
npm view @anthropic-ai/claude-agent-sdk version
```

---

#### W-004: Hook Return Type Missing Async Pattern

**Location**: `research.md:149-179`

**Issue**: SDK docs show hooks can return async:
```typescript
type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;

type AsyncHookJSONOutput = {
  async: true;
  asyncTimeout?: number;
}
```

Our research only documents sync patterns. For long-running checkpoint operations, async may be needed.

**Recommendation**: Add async hook pattern to research.md.

---

#### W-005: CognitiveWorkspace to systemPrompt Mapping Unclear

**Location**: `spec.md:US-009`, `research.md:286-329`

**Issue**: Spec defines rich `CognitiveWorkspace` structure with `baselineAwareness`, `globalLearnings`, etc. But SDK's `systemPrompt.append` is just a string.

How does the hierarchical CognitiveWorkspace map to a string append?

**Recommendation**: Add explicit mapping function design to research.md:
```typescript
function buildCognitiveWorkspacePrompt(workspace: CognitiveWorkspace): string {
  return `
## Analysis Context
- Task: ${workspace.taskGoal}
- Phase: ${workspace.progress.currentPhase}
- Findings: ${workspace.findings.length} detected

## Baseline Awareness
${workspace.baselineAwareness ? formatBaseline(workspace.baselineAwareness) : 'No baseline'}

## Global Learnings
${workspace.globalLearnings.join('\n- ')}
  `.trim();
}
```

---

#### W-006: SubagentStart Hook Fields Missing from Research

**Location**: `research.md:141-148`

**Issue**: SDK docs show `SubagentStartHookInput` includes:
```typescript
type SubagentStartHookInput = BaseHookInput & {
  hook_event_name: 'SubagentStart';
  agent_id: string;      // Missing from research.md
  agent_type: string;    // Missing from research.md
}
```

**Recommendation**: Update hooks documentation to include all fields.

---

#### W-007: Existing Implementation Gap

**Location**: `src/errors/index.ts`

**Issue**: Current error hierarchy defines `NetworkError`, `ChecksumMismatchError` but not the orchestration-specific errors defined in research.md:
- `OrchestrationError`
- `SessionResumeError`
- `ToolRegistrationError`
- `ApiKeyError`

**Recommendation**: research.md section 9 defines these correctly; ensure they're added to `src/errors/` during implementation.

---

### Info (CONSIDER)

#### I-001: Two-Layer Analysis Correctly Resolved

**Location**: `spec.md:C5`

**Note**: The Two-Layer Analysis ambiguity was correctly resolved via clarification C5. Tools self-categorize; orchestration doesn't need layer awareness. This aligns with Constitution Principle IV (no forced pipelines).

---

#### I-002: Model Selection Correctly Configurable

**Location**: `spec.md:C6`, `contracts/interfaces.ts:43`

**Note**: User-configurable model with default to Sonnet 4 is correctly specified. Supports Constitution Principle I (Local-First—user controls costs).

---

#### I-003: Phase Flexibility Correctly Designed

**Location**: `spec.md:C7`

**Note**: Hybrid approach (suggested phases, agent has agency) correctly balances observability with flexibility. Aligns with Constitution Principle IV.

---

#### I-004: SDK Built-in Tools Correctly Identified

**Location**: `spec.md:C9`, `research.md`

**Note**: Decision to use SDK built-in tools (Read, Write, Edit, Bash, Glob, Grep, Task, TodoWrite, WebFetch, WebSearch) and add custom agentlint tools is correct and aligns with ADR-0005.

---

#### I-005: Quickstart Code Examples Use Correct Patterns

**Location**: `quickstart.md`

**Note**: Example code uses correct patterns (`Orchestrator`, `tool()`, `filterByVerbosity()`). Will need updating if errors E-001/E-002 change interfaces.

---

#### I-006: Constitution Compliance Verified

All 9 Constitution principles are correctly addressed:

| # | Principle | Compliance |
|---|-----------|------------|
| I | Local-First | ✅ Only user's ANTHROPIC_API_KEY |
| II | Improvement-Oriented | ✅ Checkpoints, session state |
| III | Causal-First | ✅ Finding.origin traces to source |
| IV | Mixed-Methods | ✅ Agent chooses tools freely |
| V | Language-Agnostic | ✅ Orchestration layer agnostic |
| VI | Agent-Agnostic | ✅ ToolRegistry adapter pattern |
| VII | Intelligent Tooling | ✅ SDK tools + custom tools |
| VIII | Compounding Value | ✅ BaselineAwareness, globalLearnings |
| IX | Agent-Aware | ✅ CognitiveWorkspace structure |

---

#### I-007: ADR Alignment Verified

| ADR | Alignment |
|-----|-----------|
| ADR-0002 (Agentic Framework) | ✅ Claude Agent SDK chosen, query() wrapper |
| ADR-0005 (Tool Definition) | ✅ tool() + createSdkMcpServer() pattern |
| ADR-0010 (Session State) | ✅ SDK sessions + state file, hooks for checkpointing |
| ADR-0011 (Testing Strategy) | ✅ VCR recordings mentioned in research.md |

---

#### I-008: Arc42 Alignment Verified

| Section | Alignment |
|---------|-----------|
| §5 Building Blocks | ✅ 6-layer architecture, Orchestration Layer matches |
| §6 Runtime View | ✅ Master loop pattern matches SDK query() |

---

## Recommendations

### Completed ✅

1. ~~**Fix E-001**: Add `settingSources` to `OrchestratorConfig` interface~~ ✅
2. ~~**Fix E-002**: Update SDK message type handling pattern in research.md~~ ✅
3. ~~**Fix W-001**: Clarify FR-004 context compression is SDK-managed~~ ✅

### Before Implementation (Recommended)

4. **Address W-005**: Add CognitiveWorkspace → systemPrompt mapping design (can be done during Phase 4)
5. **Address W-007**: Verify Phase 0 includes adding orchestration error types

### During Phase 0 SDK Spike

6. **Verify W-003**: Confirm SDK version `0.2.7` or update
7. **Address W-004**: Test async hook patterns for checkpoint operations
8. **Address W-006**: Document all hook input fields

---

## Traceability Summary

### Spec → Plan
| Requirement | Plan Coverage |
|-------------|---------------|
| FR-001 Master loop | ✅ Phase 1: Orchestrator.run() |
| FR-002 Tool invocation | ✅ Phase 1: ToolRegistry |
| FR-003 Tool registration | ✅ Phase 1: tool() pattern |
| FR-004 Context compression | ⚠️ SDK-managed (clarify) |
| FR-007 Streaming | ✅ Phase 1: StreamChunk |
| FR-008 Checkpoints | ✅ Phase 2: Checkpoint hooks |
| FR-011 Session resume | ✅ Phase 3: SDK resume option |
| FR-015 Cognitive workspace | ✅ Phase 4: System prompt |

### Spec → Contracts
| Entity | Interface |
|--------|-----------|
| MasterLoop | ✅ IOrchestrator |
| ToolRegistry | ✅ IToolRegistry |
| CheckpointEvent | ✅ CheckpointEvent |
| StreamChunk | ✅ StreamChunk |
| SessionState | ✅ SessionState |
| CognitiveWorkspace | ✅ CognitiveWorkspace |

---

## Conclusion

The EP02 specification and planning documents are **well-designed and architecturally sound**. The design correctly leverages the Claude Agent SDK's proven patterns and aligns with agentlint's Constitution principles.

**All critical issues have been resolved:**

1. ✅ **E-001 Fixed**: Added `settingSources` option to `OrchestratorConfig` interface—essential for loading CLAUDE.md files during analysis.

2. ✅ **E-002 Fixed**: Updated SDK message type handling with proper TypeScript types and `settingSources` in code examples.

3. ✅ **W-001 Fixed**: Clarified FR-004 that context compression is SDK-managed with internal threshold.

**The design is now ready for `/dev.tasks`.**

Remaining warnings (W-002 through W-007) are minor and can be addressed during implementation phases without blocking task generation.

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-16 | Claude | Initial analysis report |
| 2026-01-16 | Claude | Fixed E-001 (settingSources), E-002 (SDK types), W-001 (FR-004 clarification) |
