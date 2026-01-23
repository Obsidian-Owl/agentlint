# Phase 2 Strategic Analysis: Implementation Gap Assessment

**Date:** January 23, 2026
**Based on:** Strategic Review (agentlint-strategic-review-jan26.md)
**Status:** Planning Document
**Version:** 2.0 (revised after OpenCode TUI research)

---

## Executive Summary

The strategic review validated that agentlint's pivot from "config linting" to "effectiveness measurement" is both technically feasible and strategically valuable. Session logs contain all signals needed to measure Skills effectiveness, context efficiency, and symptom patterns.

**Current State:** Strong foundation (EP01, EP02, EP06, EP07, EP09, EP10, EP11) with orchestration, session parsing, causal tracing, and temporal analysis. However, the TUI architecture is incomplete - Ink components exist but are not wired as the primary rendering path.

**Critical Gaps:**
1. **Analysis Gap:** Session analysis extracts generic metrics but not Skills/delegation/pattern-specific signals
2. **UX Gap:** TUI uses TerminalRenderer + readline, not the Ink components that exist. No dialog system, no focus management, no agent-led exploration capability.

**Path Forward:** Six new epics with EP17 (TUI Architecture) as the foundation for the agent-led exploration UX.

---

## Phase 2 Epics

| Epic | Name | Priority | Duration | Key Deliverable |
|------|------|----------|----------|-----------------|
| EP14 | Skills Effectiveness | P0 | 6 weeks | Invocation rates, missed opportunities |
| EP15 | Context Efficiency | P1 | 5 weeks | Re-read ratios, compression correlation |
| EP16 | Symptom Patterns | P1 | 5 weeks | Circular calls, instruction drift |
| EP17 | TUI Architecture | P0 | 10 weeks | Ink-based dialogs, agent-led exploration |
| EP18 | Subagent Delegation | P2 | 4 weeks | Delegation tracking, context savings |
| EP19 | MCP Health | P2 | 3 weeks | Usage stats, error rates |

**Each Epic Includes:**
- Phase 1: Core Implementation
- Phase 2: Integration (wiring + testing)
- Phase 3: Cleanup (dead code removal + docs)

**ADR Changes:**
- **ADR-0021 Recreated** as "TUI Architecture & Interaction Model" ✓
- **Update existing ADRs** (0004, 0006, 0016, 0017) with extensions during implementation
- **No new ADRs** beyond recreated 0021

**Total Duration:** ~20 weeks with parallelization

**Linear Projects:** All six epics created under agentlint initiative ✓

See individual epic files in `docs/planning/epics/` for detailed specifications.

---

## Deliverables Completed

| Deliverable | Location | Status |
|-------------|----------|--------|
| Strategic Review | `docs/review/agentlint-strategic-review-jan26.md` | ✓ |
| Phase 2 Analysis | `docs/review/phase2-strategic-analysis.md` | ✓ |
| EP14: Skills Effectiveness | `docs/planning/epics/EP14-skills-effectiveness.md` | ✓ |
| EP15: Context Efficiency | `docs/planning/epics/EP15-context-efficiency.md` | ✓ |
| EP16: Symptom Patterns | `docs/planning/epics/EP16-symptom-patterns.md` | ✓ |
| EP17: TUI Architecture | `docs/planning/epics/EP17-tui-architecture.md` | ✓ |
| EP18: Subagent Delegation | `docs/planning/epics/EP18-subagent-delegation.md` | ✓ |
| EP19: MCP Health | `docs/planning/epics/EP19-mcp-health.md` | ✓ |
| ADR-0021 (recreated) | `docs/architecture/adr/0021-tui-architecture-interaction-model.md` | ✓ |
| Linear Projects | EP14-EP19 under agentlint initiative | ✓ |
| Epic Catalogue Update | `docs/planning/epic-catalogue.md` | ✓ |
