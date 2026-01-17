# Architecture Review Report

> Feature: EP07 - Causal Tracing Engine
> Branch: ep07-causal-tracing-engine
> Reviewed: 2026-01-18

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Violations | 0 | ✓ |
| Drift | 0 | ✓ (3 resolved) |
| Enhancements | 5 | ℹ️ |

**Overall**: PASS (all documentation updated)

---

## Changes Analyzed

| File | Category | Arc42 Section |
|------|----------|---------------|
| `src/tools/causal/types.ts` | New | §5 Tool Layer |
| `src/tools/causal/index.ts` | New | §5 Tool Layer |
| `src/tools/causal/trace-issue-tool.ts` | New | §5 Tool Layer |
| `src/tools/causal/get-patterns-tool.ts` | New | §5 Tool Layer |
| `src/tools/causal/evidence-collector.ts` | New | §5 Tool Layer |
| `src/tools/causal/gap-analyzer.ts` | New | §5 Tool Layer |
| `src/tools/causal/chain-builder.ts` | New | §5 Tool Layer |
| `src/tools/causal/pattern-detector.ts` | New | §5 Tool Layer |
| `src/tools/causal/confidence.ts` | New | §5 Tool Layer |
| `src/tools/causal/counterfactual.ts` | New | §5 Tool Layer |
| `src/tools/causal/git-evidence.ts` | New | §5 Tool Layer |
| `src/tools/causal/config-snapshot.ts` | New | §5 Tool Layer |
| `src/tools/causal/pattern-tracking.ts` | New | §5 Tool Layer |
| `src/persistence/causal/index.ts` | New | §5 Persistence Layer |
| `src/persistence/causal/schema.ts` | New | §5 Persistence Layer |
| `src/persistence/causal/queries.ts` | New | §5 Persistence Layer |
| `tests/unit/tools/causal/*.test.ts` | New | §8 Testing Strategy |
| `tests/integration/causal/*.test.ts` | New | §8 Testing Strategy |
| `tests/performance/causal.test.ts` | New | §8 Testing Strategy |

**Total**: 27 files changed, +11,236 lines

---

## Architecture Compliance Check

### Building Block View (§5)

| Check | Status | Notes |
|-------|--------|-------|
| Component in documented layer | ✓ | Tools under `src/tools/`, persistence under `src/persistence/` |
| Dependencies as documented | ✓ | Tools → Persistence → SQLite (Integration) |
| Responsibilities aligned | ✓ | Follows Tool Layer definition: deterministic data gathering |

**Assessment**: EP07 correctly places causal tracing tools in the Tool Layer as documented in §5. The implementation follows the established pattern of SDK tool definitions with Zod schemas.

### Runtime View (§6)

| Check | Status | Notes |
|-------|--------|-------|
| Flows match documented sequences | ✓ | Implements §6.2 DETECT → TRACE → UNDERSTAND → RECOMMEND |
| Interfaces as specified | ✓ | `trace_issue_origin` follows tool pattern |
| Error paths handled | ✓ | Comprehensive error handling with `TraceIssueOutput.error` |

**Assessment**: The implementation precisely matches the §6.2 Causal Tracing runtime flow documented in Arc42.

### Cross-cutting Concepts (§8)

| Concept | Compliance | Notes |
|---------|------------|-------|
| §8.1 Domain Model | ✓ | Issue → origin → recommendation pattern implemented |
| §8.2 Security | ✓ | Local-first, no data transmission |
| §8.3 Error Handling | ✓ | Follows ToolError pattern with warnings |
| §8.4 Context Management | ✓ | Evidence deduplication, chain depth limits |
| §8.5 Testing Strategy | ✓ | Unit + integration + performance tests |

**Assessment**: Implementation follows all cross-cutting concepts consistently.

### Architecture Decisions (§9)

| ADR | Compliance | Notes |
|-----|------------|-------|
| ADR-0002 (Agentic Framework) | ✓ | Uses Claude Agent SDK |
| ADR-0005 (Tool Definition) | ✓ | `tool()` + Zod schemas |
| ADR-0006 (Session Processing) | ✓ | Extends SQLite FTS5 database |
| ADR-0010 (Checkpointing) | N/A | No checkpoint changes |
| ADR-0015 (Git Integration) | ✓ | CLI-based git queries via `spawnSync` |

**Assessment**: All relevant ADRs followed. Security review identified and fixed command injection risk in git-evidence.ts.

### Constitution Alignment

| Principle | Compliance | Evidence |
|-----------|------------|----------|
| I. Local-First | ✓ | All processing local, SQLite storage |
| II. Constraint-Aware | ✓ | Depth limits (max 5), timeout handling |
| III. Causal-First | ✓ | **This IS the implementation** |
| IV. Mixed-Methods | ✓ | Static evidence + agent reasoning |
| VII. Intelligent Tooling | ✓ | Tools provide evidence, agent reasons |
| VIII. Conventional | ✓ | Follows Claude Code patterns |

---

## Findings

### Drift

**D1: Undocumented causal tools module**
- Location: `src/tools/causal/`
- Issue: New module directory not documented in §5.2 Building Blocks
- Impact: Low - follows established patterns
- Recommendation: Add "Level 3: Causal Analysis Tools (EP07)" section to §5

**D2: Persistence layer extension**
- Location: `src/persistence/causal/`
- Issue: New persistence module extends sessions database
- Impact: Low - clean extension of existing pattern
- Recommendation: Add to §5 "Level 3: Persistence Modules" with causal schema documentation

**D3: Additional evidence types**
- Location: `src/tools/causal/types.ts`
- Issue: EvidenceType enum defines 5 types not in domain model
- Impact: Low - valid extension
- Recommendation: Update §8.1 Domain Model to include EvidenceItem entity

### Enhancements

**E1: New SDK tool definitions**
- Location: `src/tools/causal/trace-issue-tool.ts`, `get-patterns-tool.ts`
- Alignment: Follows ADR-0005 Tool Definition pattern
- Status: Correctly implemented

**E2: Causal chain entity**
- Location: `src/tools/causal/types.ts`
- Alignment: Implements §8.1 Domain Model's Issue → origin → recommendation
- Status: Well-structured with Zod validation

**E3: Evidence collector pattern**
- Location: `src/tools/causal/evidence-collector.ts`
- Alignment: Integrates with EP06 session search
- Status: Clean separation of concerns

**E4: Git evidence collection**
- Location: `src/tools/causal/git-evidence.ts`
- Alignment: Follows ADR-0015 Git Integration Strategy
- Status: Security hardened with `spawnSync`

**E5: Pattern tracking**
- Location: `src/tools/causal/pattern-tracking.ts`
- Alignment: Implements FR-6.3 Pattern Recognition requirement
- Status: Supports systemic vs one-off distinction

---

## Tool Registry

The following tools are added by EP07:

| Tool | Description | Arc42 Reference |
|------|-------------|-----------------|
| `trace_issue_origin` | Traces issues to origin in session logs | §6.2 |
| `get_issue_patterns` | Queries recurring issue patterns | §6.2 |

These should be added to §5 Tool Layer table.

---

## Recommendations

### Required (Merge Blocker)

None - implementation is architecturally sound.

### Documentation Updates ✅ COMPLETED

The following Arc42 documentation has been updated:

1. **§5 Building Blocks**: ✅ Added "Level 3: Causal Analysis Tools (EP07)" section
   - Documented module structure: `src/tools/causal/`
   - Listed all components with responsibilities
   - Added tool definitions table
   - Documented persistence integration and schema

2. **§5 Building Blocks**: ✅ Added causal persistence documentation
   - Documented `src/persistence/causal/` module
   - Described tables: `causal_chains`, `evidence_items`, `issue_patterns`, `chain_patterns`

3. **§5 Tool Layer Table**: ✅ Added EP07 tools
   - `trace_issue_origin`
   - `get_issue_patterns`

4. **§8.1 Domain Model**: ✅ Extended diagram and documentation
   - Added CausalChain entity with relationships
   - Added EvidenceItem and IssuePattern entities
   - Documented evidence types and gap categories
   - Shows Issue → CausalChain → EvidenceItem/IssuePattern flow

5. **§9 ADR Summary**: Optional - consider ADR-0019 for causal chain structure in future

---

## Architecture Debt

| Item | Severity | Effort | Priority | Status |
|------|----------|--------|----------|--------|
| §5 causal tools documentation | Low | 1 hour | P3 | ✅ Done |
| §5 causal persistence documentation | Low | 30 min | P3 | ✅ Done |
| §8.1 domain model update | Low | 30 min | P3 | ✅ Done |
| Consider ADR for causal model | Optional | 2 hours | P4 | Deferred |

---

## Security Review Notes

A security review was conducted on 2026-01-18 identifying:

- **Issue**: Potential command injection in `git-evidence.ts` via shell commands
- **Resolution**: Replaced `execSync` with `spawnSync` using argument arrays
- **Status**: Fixed and tested with 4 new input validation tests

The implementation now follows security best practices for subprocess execution.

---

## Conclusion

**Merge approved.**

EP07 Causal Tracing Engine is architecturally sound and follows all established patterns. The implementation:

- ✓ Correctly implements §6.2 Causal Tracing runtime flow
- ✓ Follows ADR-0005 tool definition pattern
- ✓ Extends EP06 session infrastructure cleanly
- ✓ Passes all 1992 tests (64 skipped EP08 placeholders)
- ✓ Security hardened after review

Documentation updates can be addressed in a follow-up PR.
