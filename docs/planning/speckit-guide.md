# Speckit Implementation Guide

> Workflow for implementing agentlint epics using Speckit

## Prerequisites

Before starting implementation:

1. ✅ Epic catalogue reviewed and approved
2. ✅ Dependencies validated
3. ✅ Constitution established at `.specify/memory/constitution.md`
4. ✅ Speckit initialized in project (`specify init . --ai claude`)

## Implementation Order

Execute epics in this sequence (respecting dependencies):

### Wave 1: Foundation (Weeks 1-6)

| Order | Epic | Branch Name | Blocked By |
|-------|------|-------------|------------|
| 1 | EP01: Project Foundation & CI/CD | `ep01-project-foundation` | None |
| 2 | EP02: Orchestration Core | `ep02-orchestration-core` | EP01 |
| 3 | EP03: Persistence Layer | `ep03-persistence-layer` | EP01 |

**Parallel opportunity**: EP02 and EP03 can proceed in parallel after EP01 basics complete.

### Wave 2: Core Tools (Weeks 5-14)

| Order | Epic | Branch Name | Blocked By |
|-------|------|-------------|------------|
| 4 | EP04: CLI Interface & Commands | `ep04-cli-interface` | EP01, EP02 |
| 5 | EP05: Config Analysis Tools | `ep05-config-analysis` | EP01, EP02 |
| 6 | EP06: Session Analysis Tools | `ep06-session-analysis` | EP01, EP02, EP03 |
| 7 | EP08: ACT Adapters | `ep08-act-adapters` | EP01 |

**Parallel opportunity**: EP04, EP05, EP08 can proceed in parallel. EP06 waits for EP03.

### Wave 3: Advanced Features (Weeks 10-20)

| Order | Epic | Branch Name | Blocked By |
|-------|------|-------------|------------|
| 8 | EP07: Causal Tracing Engine | `ep07-causal-tracing` | EP02, EP03, EP06 |
| 9 | EP09: Temporal Analysis | `ep09-temporal-analysis` | EP03 |
| 10 | EP10: Recommendation Engine | `ep10-recommendation-engine` | EP02, EP03, EP07 |

**Parallel opportunity**: EP09 can proceed alongside EP07 after EP03.

### Wave 4: Polish & Enhancement (Weeks 16-24)

| Order | Epic | Branch Name | Blocked By |
|-------|------|-------------|------------|
| 11 | EP11: Quality & Security | `ep11-quality-security` | EP01, EP02 |
| 12 | EP12: Global Learnings | `ep12-global-learnings` | EP01, EP03 |

**Parallel opportunity**: EP11 and EP12 can proceed in parallel throughout development.

## Per-Epic Workflow

For each epic, follow this workflow:

### 1. Create Branch

```bash
git checkout main
git pull origin main
git checkout -b epXX-epic-name
```

### 2. Run /speckit.specify

Open Claude Code and run:

```
/speckit.specify
```

Then paste the epic's business outcome and scope:

```
[Copy from EPxx.md]

## Business Outcome Hypothesis
If we deliver [capability],
Then [stakeholder] will be able to [outcome],
Measured by [metric].

## In Scope
- [capability 1]
- [capability 2]

## Primary Persona
[persona name and description]

## Key Scenarios
1. [scenario 1]
2. [scenario 2]
```

### 3. Run /speckit.clarify

```
/speckit.clarify
```

Answer questions to refine the specification.

### 4. Run /speckit.plan

```
/speckit.plan
```

Include technical constraints:

```
Technical constraints from architecture:
- [From ADR-XXX: constraint]
- [From constitution: principle]

Tech stack:
- [Framework/library]
- [Pattern to follow]

Integration points:
- [System/API to integrate with]
```

### 5. Run /speckit.tasks

```
/speckit.tasks
```

Review generated tasks for completeness.

### 6. Run /speckit.implement

```
/speckit.implement
```

Monitor implementation, address issues as they arise.

### 7. Create PR

```bash
git add .
git commit -m "feat(epXX): [epic name] implementation"
gh pr create --title "EP[XX]: [Epic Name]" --body "## Summary
[Epic description]

## Acceptance Criteria
- [ ] [criterion 1]
- [ ] [criterion 2]

## Testing
- [ ] Unit tests passing
- [ ] Integration tests passing

## Documentation
- [ ] README updated
- [ ] API docs updated"
```

### 8. Update Epic Status

Update `docs/planning/epic-catalogue.md`:
- Change status to "In Review" or "Complete"
- Note actual duration
- Record any scope changes

## Epic-Specific Notes

### EP01: Project Foundation & CI/CD

**Speckit Focus:**
- TypeScript strict mode configuration
- Bun runtime setup and testing
- CI/CD pipeline with lint, type-check, test

**Key Constraints:**
- ADR-0001: TypeScript + Bun, no Node.js-specific APIs
- ADR-0018: Native binary primary, npm secondary

**Watch Out For:**
- Bun compile behavior differs across platforms

---

### EP02: Orchestration Core

**Speckit Focus:**
- Claude Agent SDK integration
- Master loop implementation
- Context management with compression

**Key Constraints:**
- ADR-0002: Claude Agent SDK, Anthropic-only MVP
- ADR-0005: Tool definitions use SDK tool() with Zod
- Constitution IX: Agent-Aware design

**Watch Out For:**
- Context window limits
- Streaming output handling

---

### EP03: Persistence Layer

**Speckit Focus:**
- SQLite setup with Bun:sqlite
- JSON baseline storage
- Atomic write operations

**Key Constraints:**
- ADR-0008: JSON + SQLite index pattern
- ADR-0009: Project + global storage scopes
- ADR-0010: JSON checkpointing

**Watch Out For:**
- File permissions across platforms
- SQLite WAL mode for crash safety

---

### EP04: CLI Interface & Commands

**Speckit Focus:**
- Ink component architecture
- Commander.js command structure
- Streaming output for long operations

**Key Constraints:**
- ADR-0003: Ink + Commander.js
- ADR-0004: Custom causal tree rendering

**Watch Out For:**
- Terminal compatibility issues
- Progress indicator UX

---

### EP05: Config Analysis Tools

**Speckit Focus:**
- CLAUDE.md detection and parsing
- Quality assessment metrics
- Zod schema definitions

**Key Constraints:**
- ADR-0005: SDK tool() with Zod
- ADR-0007: Custom parser with Zod validation
- ADR-0017: Detect SKILL.md files

**Watch Out For:**
- Non-standard markdown structures
- Config hierarchy resolution

---

### EP06: Session Analysis Tools

**Speckit Focus:**
- JSONL parsing with streaming
- FTS5 index creation
- BM25 ranking configuration

**Key Constraints:**
- ADR-0006: SQLite FTS5 with BM25
- ADR-0005: Tool definitions with Zod

**Watch Out For:**
- Large session log files (500MB+)
- Memory usage during indexing

---

### EP07: Causal Tracing Engine

**Speckit Focus:**
- Evidence chain construction
- Confidence scoring methodology
- Pattern recognition across sessions

**Key Constraints:**
- Constitution III: Causal-First principle
- Evidence-based reasoning only

**Watch Out For:**
- Speculative causal claims
- Missing evidence handling

---

### EP08: ACT Adapters

**Speckit Focus:**
- Adapter interface definition
- Claude Code adapter implementation
- Git CLI integration

**Key Constraints:**
- ADR-0015: Git via CLI, not library
- Constitution VI: Agent-Agnostic

**Watch Out For:**
- Git command compatibility
- Adapter auto-detection edge cases

---

### EP09: Temporal Analysis

**Speckit Focus:**
- jsondiffpatch integration
- Trend calculation algorithms
- Git history correlation

**Key Constraints:**
- ADR-0008: Baseline format
- Constitution II: Improvement-Oriented

**Watch Out For:**
- Schema version changes
- Large baseline comparison performance

---

### EP10: Recommendation Engine

**Speckit Focus:**
- Three recommendation types
- Evidence chain inclusion
- Implementation detection

**Key Constraints:**
- Constitution III: Include traced origin
- User agency: Recommend, don't automate

**Watch Out For:**
- Recommendation specificity
- False implementation detection

---

### EP11: Quality & Security

**Speckit Focus:**
- LLM-as-judge prompt design
- Secret detection patterns
- Logging with redaction

**Key Constraints:**
- ADR-0012: Multi-dimension evaluation
- ADR-0013: Never store secrets
- Constitution I: Local-First

**Watch Out For:**
- Secret redaction in all paths
- Evaluation consistency

---

### EP12: Global Learnings

**Speckit Focus:**
- Two-scope storage architecture
- Learning promotion workflow
- Relevance scoring

**Key Constraints:**
- ADR-0009: Project + global scopes
- Constitution VIII: Compounding Value

**Watch Out For:**
- Learning staleness
- Context overload from too many learnings

---

## Troubleshooting

### Speckit generates wrong tech stack

Re-run `/speckit.plan` with explicit constraints:
```
Use [specific technology] as specified in ADR-XXX.
Do not use [wrong technology].
```

### Implementation diverges from plan

1. Stop `/speckit.implement`
2. Review divergence with team
3. Update spec if requirements changed
4. Re-run from `/speckit.tasks`

### Cross-epic dependencies not available

1. Check if blocker epic is truly complete
2. If soft dependency, proceed with mock/stub
3. Document assumption for later integration

### Constitution principle violation

1. Stop implementation
2. Review violation with constitution
3. Refactor to comply or document override with justification

## Quality Gates

Before marking epic complete:

```
Epic Completion Checklist:
- [ ] All acceptance criteria from EPxx.md pass
- [ ] Tests cover happy path and error cases
- [ ] Documentation updated
- [ ] PR reviewed and approved
- [ ] Deployed to staging
- [ ] Constitution principles verified
- [ ] ADR constraints respected
- [ ] Product owner sign-off
- [ ] Epic status updated in catalogue
```

## References

- [Epic Catalogue](epic-catalogue.md)
- [Dependency Graph](dependency-graph.mermaid)
- [Arc42 Documentation](../architecture/arc42/)
- [ADRs](../architecture/adr/)
- [Constitution](../../.specify/memory/constitution.md)
