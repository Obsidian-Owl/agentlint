# Architecture Review Report

> **Feature**: EP08 - ACT Subagents
> **Branch**: ep08-act-adapters
> **Reviewed**: 2026-01-18

---

## Summary

| Category     | Count | Status |
| ------------ | ----- | ------ |
| Violations   | 0     | ✓      |
| Drift        | 0     | ✓      |
| Enhancements | 3     | ℹ️     |

**Overall**: PASS

---

## Changes Analyzed

| File                                | Category | Arc42 Section          |
| ----------------------------------- | -------- | ---------------------- |
| src/act/index.ts                    | New      | §5 Adapter Layer       |
| src/act/registry.ts                 | New      | §5 Adapter Layer       |
| src/act/types.ts                    | New      | §5 Adapter Layer       |
| src/act/instructions/claude-code.ts | New      | §5 Adapter Layer       |
| src/act/instructions/generalized.ts | New      | §5 Adapter Layer       |
| src/act/instructions/index.ts       | New      | §5 Adapter Layer       |
| src/orchestration/orchestrator.ts   | Modified | §5 Orchestration Layer |
| src/orchestration/config.ts         | Modified | §5 Orchestration Layer |
| src/orchestration/types.ts          | Modified | §5 Orchestration Layer |
| src/tools/types.ts                  | Modified | §5 Tool Layer          |
| tests/unit/act/\*.test.ts           | New      | §8.5 Testing           |
| tests/integration/act/\*.test.ts    | New      | §8.5 Testing           |
| tests/e2e/act/\*.test.ts            | New      | §8.5 Testing           |

---

## Building Block Alignment

### §5 Building Blocks - Level 2: Adapter Layer

**Documented Structure**:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  CLAUDE CODE     │  │  GENERALIZED     │  │  FUTURE          │
│  Config: CLAUDE.md│  │  Common patterns │  │  Cursor, etc.    │
│  Logs: ~/.claude/ │  │  AGENTS.md       │  │  Plugin pattern  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Implementation Alignment**: ✓ ALIGNED

EP08 implements the documented adapter pattern:

- `claude-code-analyzer` - Claude Code specialist (priority 100)
- `generalized-analyzer` - Fallback for unknown ACTs (priority 10)
- Registry pattern enables future ACT additions (Cursor, Aider, Windsurf)

### §5 Building Blocks - Level 2: Orchestration Layer

**Documented Structure**:

```
┌─────────────────────────────────────────────────────────────────┐
│               AGENT COGNITIVE WORKSPACE                         │
│  ├─ Task Goal                                                   │
│  ├─ Project Context (compressed)                                │
│  └─ ...                                                         │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Alignment**: ✓ ALIGNED

- `buildACTSubagents()` integrated at orchestrator.ts:211
- SDK `agents` option properly configured
- `allowedTools` includes 'Task' for subagent invocation

---

## Solution Strategy Alignment (§4)

### Claude Code Reference Pattern

| Pattern                | §4 Documentation                    | EP08 Implementation        | Status |
| ---------------------- | ----------------------------------- | -------------------------- | ------ |
| Subagent depth limits  | "Bounded delegation (single level)" | `MAX_SUBAGENT_DEPTH = 1`   | ✓      |
| Rich tool descriptions | "Poka-yoke design (ADR-0005)"       | Context-engineered prompts | ✓      |

### Two-Layer Analysis

| Layer             | §4 Documentation                            | EP08 Implementation                    | Status |
| ----------------- | ------------------------------------------- | -------------------------------------- | ------ |
| Static Analysis   | "Fast, deterministic extraction"            | Tools: discover_configs, parse_config  | ✓      |
| Agentic Reasoning | "Semantic understanding, quality judgments" | Subagent prompts with domain knowledge | ✓      |

---

## Constitution Compliance

| Principle                | Compliance | Evidence                                                             |
| ------------------------ | ---------- | -------------------------------------------------------------------- |
| I. Local-First           | ✓          | Subagents run locally with user's API key                            |
| II. Improvement-Oriented | ✓          | Recommendations include preventive/systemic types                    |
| III. Causal-First        | ✓          | Output types include ACTRecommendationType: preventive > symptomatic |
| IV. Mixed-Methods        | ✓          | Subagents use both tools and reasoning                               |
| V. Language-Agnostic     | ✓          | No language-specific assumptions                                     |
| VI. Agent-Agnostic       | ✓          | Adapter pattern supports multiple ACTs                               |
| VII. Intelligent Tooling | ✓          | Subagents choose tools via semantic matching                         |
| VIII. Compounding Value  | ✓          | Session analysis enables trend detection                             |
| IX. Agent-Aware          | ✓          | Context-engineered prompts (4-layer structure)                       |

### C8 Single-Depth Constraint

**Enforcement Points**:

1. `ACTInstructionsSchema` - Zod validation rejects 'Task' in tools array
2. `MAX_SUBAGENT_DEPTH = 1` - Orchestrator enforces depth limit
3. `SubagentDepthError` - Error class for depth violations

---

## ADR Compliance

### ADR-0002: Agentic Framework Strategy

| Requirement              | Implementation                     | Status |
| ------------------------ | ---------------------------------- | ------ |
| Use Claude Agent SDK     | SDK `query()` with `agents` option | ✓      |
| Single subagent branches | MAX_SUBAGENT_DEPTH = 1             | ✓      |
| MCP-compatible tools     | Tools use SDK `tool()` pattern     | ✓      |

### ADR-0011: Testing Strategy

| Test Suite        | EP08 Implementation                      | Status |
| ----------------- | ---------------------------------------- | ------ |
| Unit tests        | tests/unit/act/\*.test.ts (every commit) | ✓      |
| Integration tests | tests/integration/act/\*.test.ts (PR)    | ✓      |
| E2E tests         | tests/e2e/act/\*.test.ts (release tags)  | ✓      |

**Note**: E2E tests use `describe.skipIf(SKIP_LIVE_TESTS)` pattern per ADR-0011.

---

## Findings

### Drift

None - all documentation is up to date.

~~**D1: src/act/ not documented in §5 Level 3**~~ → **RESOLVED**

Added "Level 3: ACT Subagent Module (EP08)" to `docs/architecture/arc42/05-building-blocks.md`.

### Enhancements

**E1: Context-engineered prompts follow documented pattern**

- **Location**: `src/act/instructions/claude-code.ts`, `generalized.ts`
- **Alignment**: Implements §4's "Rich tool descriptions - Poka-yoke design"
- **Structure**: 4-layer format (Role → Domain → Task → Output)
- **Recommendation**: Document prompt structure in §8 Crosscutting Concepts

**E2: Priority-based routing system**

- **Location**: `ACTSubagentRegistry.getForACTType()`
- **Alignment**: Enables §5 Adapter Layer's plugin pattern
- **Recommendation**: Consider documenting priority semantics in §8

**E3: ACTType extended with new values**

- **Location**: `src/tools/types.ts` (aider, copilot-cli added)
- **Alignment**: Supports §4's "Future: Cursor, Aider, Windsurf"
- **Recommendation**: None (minor enhancement within existing pattern)

---

## Crosscutting Concepts Check (§8)

### §8.1 Domain Model

**Status**: ✓ ALIGNED

New output types align with domain model:

- `ACTConfigIssue` → maps to Issue entity
- `ACTSessionIssue` → maps to Session entity patterns
- `ACTRecommendation` → maps to Recommendation entity

### §8.2 Security Concept

**Status**: ✓ ALIGNED

- API key delegated to Opencode SDK ([ADR-0026](../adr/0026-opencode-auth-delegation.md))
- No secrets in instruction prompts
- Subagent tools are read-only (discover, parse, analyze, search)

### §8.3 Error Handling

**Status**: ✓ ALIGNED

- `SubagentDepthError` follows established error pattern
- Zod validation errors for malformed instructions

### §8.5 Testing Strategy

**Status**: ✓ ALIGNED

- Unit tests: Fast, mocked (every commit)
- Integration tests: VCR-style patterns referenced
- E2E tests: Live API, skipped without key (release tags only)

---

## Recommendations

### Required (Before Merge)

None - all architectural requirements satisfied.

### Required (Follow-up PR)

~~1. **Update §5 Building Blocks**: Add "Level 3: ACT Subagent Module (EP08)" section~~ ✓ Done
~~2. **Update §5 Adapter Layer diagram**: Add `src/act/` module reference~~ ✓ Done

### Suggested

1. **Consider §8 addition**: Document 4-layer prompt structure as crosscutting pattern
2. **Consider §8 addition**: Document priority-based routing semantics

---

## Architecture Debt

None - all documentation updated.

---

## Conclusion

EP08 ACT Subagents implementation is **architecturally sound** and demonstrates strong alignment with:

- **Building Blocks (§5)**: Adapter Layer pattern implemented correctly, documentation updated
- **Solution Strategy (§4)**: Two-layer analysis, subagent depth limits
- **Constitution**: All 9 principles satisfied, C8 constraint enforced
- **ADRs**: ADR-0002 (SDK), ADR-0011 (Testing) requirements met

**Merge Status**: ✓ APPROVED

All drift items have been resolved. Arc42 documentation is now up to date.

---

**Next Steps**:

1. Run `/dev.integration-check` for final validation
2. Create PR with `/dev.pr`
