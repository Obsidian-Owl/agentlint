# Architecture Review Report

> Feature: EP11 - Quality & Security
> Branch: ep11-quality-security
> Reviewed: 2026-01-20

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Violations | 0 | ✓ |
| Drift | 3 | ⚠️ |
| Enhancements | 5 | ℹ️ |

**Overall**: PASS (documentation updates needed)

## Changes Analyzed

| File/Module | Category | Arc42 Section |
|-------------|----------|---------------|
| `src/debug/` | New Module | §8.6 Logging & Observability |
| `src/eval/` | New Module | §8.5 Testing Strategy |
| `src/security/` | New Module | §8.2 Security Concept |
| `src/persistence/outcome-storage.ts` | New Component | §5 Persistence Layer |
| `src/orchestration/checkpoint.ts` | Extended | §6.4 Long-Running Session Support |
| `src/cli/commands/session.ts` | New | §5.2 CLI Interface Layer |
| `src/temporal/qualitative/sentiment.ts` | Modified | §5.3 Temporal Analysis |
| `docs/architecture/adr/0020-sentiment-scale-normalization.md` | New | §9 Architecture Decisions |

**Files Changed**: 103 files
**Lines Changed**: +25,348 / -461

## Findings

### Drift

**D1: Debug Infrastructure Not Documented in Building Blocks**
- Location: `src/debug/`
- Issue: New debug module (logger, redaction, metrics, namespaces) not documented in §5 Building Blocks
- Impact: Low - follows established patterns from §8.6
- Recommendation: Add `src/debug/` to §5 with component descriptions

**D2: Evaluation Framework Module Undocumented**
- Location: `src/eval/`
- Issue: New evaluation module (scoring, graders, runner, feedback) references §8.5 Testing Strategy but has no Building Block entry
- Impact: Medium - this is a significant new capability
- Recommendation: Add Level 3 diagram for `src/eval/` in §5

**D3: Security Module Missing from Building Blocks**
- Location: `src/security/`
- Issue: Secret detection module (detector, classifier, entropy, patterns) not in §5, though referenced in §8.2 Security Concept (ADR-0013)
- Impact: Low - aligns with documented security strategy
- Recommendation: Add `src/security/` to §5 Tool Layer

### Enhancements

**E1: Session Recording Infrastructure (EP11 T054)**
- Location: `src/orchestration/checkpoint.ts` (SessionRecorder, SessionReplayer)
- Alignment: Extends §6.4 Long-Running Session Support as documented
- Documentation Status: §6.4 mentions "Session Recording" - implementation matches
- Recommendation: Document storage location (`~/.agentlint/session-state/`)

**E2: Outcome Storage for Recommendation Tracking**
- Location: `src/persistence/outcome-storage.ts`
- Alignment: Follows §5 Persistence Layer patterns (SQLite, local storage)
- Documentation Status: Not explicitly documented but follows established patterns
- Recommendation: Add to §8.1 Domain Model (Recommendation → Outcome relationship)

**E3: CLI Session Commands**
- Location: `src/cli/commands/session.ts`
- Alignment: Follows §5.2 CLI Interface Layer patterns
- Commands Added: `list`, `replay`, `delete`, `cleanup`
- Recommendation: Add to CLI command table in §5.3

**E4: ADR-0020 Sentiment Scale Normalization**
- Location: `docs/architecture/adr/0020-sentiment-scale-normalization.md`
- Alignment: Follows ADR format, properly linked from code
- Documentation Status: Complete
- Recommendation: Add to §9 ADR Summary table

**E5: Scale Conversion Utilities**
- Location: `src/temporal/qualitative/sentiment.ts`
- Alignment: Follows ADR-0019 tool/agent boundary - provides data, not judgment
- Functions Added: `likertToNormalized()`, `normalizedToLikert()`, `normalizedToLikertSentiment()`
- Recommendation: No documentation update needed (internal implementation detail)

## Architecture Compliance

### Building Block View (§5)

| Component | Status | Notes |
|-----------|--------|-------|
| CLI Interface Layer | ✓ | Session commands follow patterns |
| Orchestration Layer | ✓ | Checkpoint extensions align |
| Tool Layer | ⚠️ | Security module needs documentation |
| Persistence Layer | ✓ | OutcomeStorage follows SQLite patterns |

### Runtime View (§6)

| Scenario | Status | Notes |
|----------|--------|-------|
| Full Analysis | ✓ | Debug logging integrates correctly |
| Causal Tracing | ✓ | No changes |
| Baseline Comparison | ✓ | No changes |
| Long-Running Sessions | ✓ | Session recording implemented |

### Cross-cutting Concepts (§8)

| Concept | Status | Notes |
|---------|--------|-------|
| Security Concept (§8.2) | ✓ | Secret detection implements ADR-0013 |
| Error Handling (§8.3) | ✓ | No changes |
| Context Management (§8.4) | ✓ | No changes |
| Testing Strategy (§8.5) | ⚠️ | Eval framework needs Building Block entry |
| Logging & Observability (§8.6) | ⚠️ | Debug module needs Building Block entry |

### Architecture Decisions (§9)

| ADR | Status | Notes |
|-----|--------|-------|
| ADR-0011 Testing Strategy | ✓ | Eval framework follows |
| ADR-0012 Evaluation Framework | ✓ | LLM-as-judge implemented |
| ADR-0013 Secret Detection | ✓ | Pattern-based, never store |
| ADR-0019 Tool/Agent Boundary | ✓ | Sentiment functions follow |
| ADR-0020 Sentiment Scale | NEW | Added and properly linked |

### Constitution Alignment

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Local-First | ✓ | All storage in `~/.agentlint/`, opt-in feedback |
| II. Constraint-Aware | ✓ | N/A |
| III. Causal-First | ✓ | N/A |
| IV. Leading Signals | ✓ | N/A |
| V. Lagging Signals | ✓ | Outcome tracking for effectiveness |
| VI. Traceable | ✓ | ADR-0020 documents decision |
| VII. Consistent | ✓ | Likert scale standardized |
| VIII. Conventional | ✓ | Follows existing patterns |
| IX. Agent-Aware | ✓ | Sentiment functions provide data, not judgment |

## Recommendations

### Required (before merge)

None - all implementations follow documented architecture patterns.

### Recommended (follow-up PR)

~~1. **§5 Building Blocks**: Add Level 3 diagrams for:~~
   - ~~`src/debug/` - Debug Infrastructure~~ ✓ DONE
   - ~~`src/eval/` - Evaluation Framework~~ ✓ DONE
   - ~~`src/security/` - Secret Detection~~ ✓ DONE

~~2. **§9 ADR Summary**: Add ADR-0020 to the table~~ ✓ DONE

~~3. **§8.1 Domain Model**: Add `RecommendationOutcome` entity~~ ✓ DONE

### Optional

~~1. **§5.3 CLI Module Structure**: Add `commands/session.ts` to command list~~ ✓ DONE
~~2. **§6.4**: Document session storage location explicitly~~ ✓ DONE

## Architecture Debt

| Item | Severity | Effort | Status |
|------|----------|--------|--------|
| ~~Debug module undocumented~~ | Low | 30 min | ✓ RESOLVED |
| ~~Eval module undocumented~~ | Medium | 1 hr | ✓ RESOLVED |
| ~~Security module undocumented~~ | Low | 30 min | ✓ RESOLVED |
| ~~ADR table update~~ | Low | 5 min | ✓ RESOLVED |

**All architecture debt items resolved.**

## Conclusion

EP11 Quality & Security implementation is **architecturally compliant**. All new modules follow established patterns and documented ADRs. The implementation correctly:

- Uses SQLite with parameterized queries (no SQL injection)
- Follows local-first principles (all storage in `~/.agentlint/`)
- Implements ADR-0013 secret detection (pattern-based, never store secrets)
- Follows ADR-0019 tool/agent boundary (tools provide data, agent provides judgment)
- Adds ADR-0020 documenting the Likert scale decision

**Merge approved.** Arc42 documentation updates recommended in follow-up PR.

---

*Generated by `/arch-review feature`*
