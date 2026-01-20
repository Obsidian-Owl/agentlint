# Implementation Plan: Recommendation Advisor

> **Epic**: EP10
> **Spec**: specs/ep10-recommendation-advisor/spec.md
> **Created**: 2026-01-20
> **Status**: Design Complete
> **Author**: Claude Opus 4.5

---

## Summary

**Primary Requirement**: Implement a reasoning-heavy recommendation subagent that synthesizes actionable recommendations from analysis findings, maintains case-based state management with append-only event logs, and supports collaborative interaction through the orchestrator.

**Technical Approach**: Build on the EP08 ACT subagent pattern (like Temporal Analyzer) with a context-engineered system prompt. Use the EP03 persistence patterns (atomic JSON writes) for case storage. Implement token-based rolling budget for context loading with on-the-fly compression.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x |
| **Primary Dependencies** | Claude Agent SDK, Zod, Bun |
| **Storage** | JSON files (`.agentlint/recommendations/{id}.json`) |
| **Testing Framework** | Vitest |
| **Target Platform** | CLI, Node.js 20+ / Bun |
| **Project Type** | CLI Tool (subagent + tools) |
| **Performance Goals** | < 500ms recommendation creation, < 200ms list, 8K token context budget |
| **Constraints** | Single subagent depth (no Task tool), local-first storage |
| **Scale/Scope** | Single developer, project-scoped recommendations |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ | All recommendations stored in `.agentlint/recommendations/` locally |
| II | Improvement-Oriented | ✅ | Case-based model tracks evolution over time; historic recommendations inform new analysis |
| III | Causal-First | ✅ | Every recommendation requires `tracedOrigin` linking to finding/session/config gap |
| IV | Mixed-Methods | ✅ | Subagent reasons about which recommendation type applies; tools provide data |
| V | Language-Agnostic | ✅ | Recommendations work for any project language |
| VI | Agent-Agnostic | ✅ | Recommendations are ACT-independent (config changes apply to any ACT) |
| VII | Intelligent Tooling | ✅ | Tools provide state (CRUD); subagent provides judgment (synthesis, prioritization) |
| VIII | Compounding Value | ✅ | Historic recommendations loaded for context; case events accumulate learnings |
| IX | Agent-Aware | ✅ | Subagent IS the recommendation engine; design serves cognitive needs |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep10-recommendation-advisor/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Research findings
├── data-model.md     # Entity definitions
├── quickstart.md     # Usage guide
├── contracts/        # API definitions
│   └── types.ts      # TypeScript interfaces
└── checklists/       # Validation checklists
    ├── requirements.md
    └── design.md
```

### Source Code Structure (Proposed)

```
src/
├── recommendations/
│   ├── index.ts              # Public exports
│   ├── types.ts              # Recommendation, Event, Summary types
│   ├── subagent/
│   │   ├── index.ts          # Subagent exports
│   │   ├── types.ts          # Subagent-specific types
│   │   └── recommendation-advisor.ts  # System prompt & AgentDefinition
│   ├── tools/
│   │   ├── index.ts          # Tool exports
│   │   ├── create-recommendation.ts
│   │   ├── get-recommendation.ts
│   │   ├── list-recommendations.ts
│   │   ├── add-event.ts
│   │   ├── update-status.ts
│   │   ├── refine-recommendation.ts
│   │   ├── complete-recommendation.ts
│   │   └── spawn-advisor.ts  # spawn_recommendation_advisor tool
│   ├── storage/
│   │   ├── index.ts          # Storage exports
│   │   ├── storage.ts        # CRUD operations with atomic writes
│   │   └── compression.ts    # Token-based compression utilities
│   └── __tests__/
│       ├── types.test.ts
│       ├── storage.test.ts
│       ├── compression.test.ts
│       └── tools.test.ts
└── persistence/
    └── recommendations/      # Alternative: colocate with persistence module
        └── ...
```

**Decision**: Place under `src/recommendations/` as a new top-level module (like `src/temporal/`) rather than under `src/persistence/`. This follows the pattern of EP09 Temporal Analysis which has its own module.

---

## Complexity Tracking

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| None | N/A | N/A | N/A |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Subagent pattern | Follow EP08/EP09 Temporal Analyzer | Proven pattern, SDK-compatible | ADR-0005 |
| Storage location | `.agentlint/recommendations/` | Consistent with baselines, tracking | EP03 patterns |
| Context budget | 8K token rolling budget | Per clarification Q2, Anthropic guidance | N/A |
| EP09 type relationship | Replace RecommendationTracking | Case model subsumes tracking | Clarification Q4 |
| Question handling | Via orchestrator | Simpler, follows SDK patterns | Clarification Q1 |
| Compaction | Synchronous | Acceptable for P3, avoids job queue | Clarification Q3 |
| Module location | `src/recommendations/` | Follows EP09 temporal pattern | N/A |

---

## References

- **Spec**: [spec.md](./spec.md)
- **Epic**: [Linear Project](https://linear.app/obsidianowl/project/ep10-recommendation-advisor-9c31dbd16212)
- **Arc42**: §5 Building Blocks (Tool Layer, Subagent Layer)
- **ADRs**: ADR-0005 (Tool Definition), ADR-0019 (Tool/Agent Boundary)
- **Patterns**: EP08 ACT Subagent, EP09 Temporal Storage

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-20 | Claude Opus 4.5 | Initial plan |
