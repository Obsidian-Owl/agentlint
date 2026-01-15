# Epic Catalogue: agentlint

> Generated from Arc42 architecture documentation on 2026-01-15

## Executive Summary

agentlint enables continuous improvement of AI-assisted development workflows through systematic analysis, issue tracing, and preventive recommendations. This catalogue decomposes the Arc42 architecture into 12 implementable epics spanning foundation infrastructure, core analysis tools, and advanced features.

**Total Epics**: 12
**Estimated Duration**: 20-24 weeks (with parallelization)
**Critical Path**: EP01 → EP02 → EP06 → EP07 → EP10

## Epic Overview

| Epic | Name | Type | Priority | Size | Duration | Status |
|------|------|------|----------|------|----------|--------|
| EP01 | Project Foundation & CI/CD | Foundation | P0 | M | 4 weeks | Not Started |
| EP02 | Orchestration Core | Foundation | P0 | L | 6 weeks | Not Started |
| EP03 | Persistence Layer | Foundation | P0 | M | 4 weeks | Not Started |
| EP04 | CLI Interface & Commands | Business | P1 | M | 4 weeks | Not Started |
| EP05 | Config Analysis Tools | Business | P1 | L | 6 weeks | Not Started |
| EP06 | Session Analysis Tools | Business | P1 | L | 6 weeks | Not Started |
| EP07 | Causal Tracing Engine | Business | P1 | L | 6 weeks | Not Started |
| EP08 | ACT Adapters | Business | P1 | M | 5 weeks | Not Started |
| EP09 | Temporal Analysis | Business | P1 | M | 5 weeks | Not Started |
| EP10 | Recommendation Engine | Business | P1 | M | 4 weeks | Not Started |
| EP11 | Quality & Security | Enabler | P2 | M | 4 weeks | Not Started |
| EP12 | Global Learnings | Integration | P2 | M | 4 weeks | Not Started |

## Dependency Matrix

|          | EP01 | EP02 | EP03 | EP04 | EP05 | EP06 | EP07 | EP08 | EP09 | EP10 | EP11 | EP12 |
|----------|------|------|------|------|------|------|------|------|------|------|------|------|
| **EP01** | —    |      |      |      |      |      |      |      |      |      |      |      |
| **EP02** | H    | —    |      |      |      |      |      |      |      |      |      |      |
| **EP03** | H    |      | —    |      |      |      |      |      |      |      |      |      |
| **EP04** | H    | H    |      | —    |      |      |      |      |      |      |      |      |
| **EP05** | H    | H    | S    |      | —    |      |      |      |      |      |      |      |
| **EP06** | H    | H    | H    |      |      | —    |      |      |      |      |      |      |
| **EP07** | H    | H    | H    |      | S    | H    | —    |      |      |      |      |      |
| **EP08** | H    | S    |      |      |      |      |      | —    |      |      |      |      |
| **EP09** | H    | S    | H    |      |      |      |      |      | —    |      |      |      |
| **EP10** | H    | H    | H    |      | S    | S    | H    |      | S    | —    |      |      |
| **EP11** | H    | H    |      |      | S    | S    |      |      |      |      | —    |      |
| **EP12** | H    |      | H    |      |      |      |      |      | S    |      |      | —    |

**Legend:**
H = Hard dependency (row epic depends on column epic)
S = Soft dependency (row epic prefers column epic complete)

## Implementation Phases

### Phase 1: Foundation (Weeks 1-6)

| Epic | Focus | Key Deliverables |
|------|-------|-----------------|
| EP01 | Project Foundation & CI/CD | TypeScript + Bun setup, ESLint, Prettier, GitHub Actions, project structure |
| EP02 | Orchestration Core | Master agent loop, Claude SDK integration, context management |
| EP03 | Persistence Layer | SQLite setup, JSON storage, baseline format, session state |

**Phase Gate**: Agent loop executes with mock tools; persistence stores/retrieves baselines

### Phase 2: Core Tools (Weeks 5-14)

| Epic | Focus | Key Deliverables |
|------|-------|-----------------|
| EP04 | CLI Interface & Commands | Ink UI, Commander.js commands, progress indicators, output formats |
| EP05 | Config Analysis Tools | Config detection, parsing, quality assessment tools |
| EP06 | Session Analysis Tools | Session discovery, metrics extraction, FTS5 search |
| EP08 | ACT Adapters | Claude Code adapter, Generalized adapter, adapter interface |

**Parallel Tracks**: EP04 + EP05 can proceed in parallel after EP02
**Phase Gate**: `agentlint scan` and `agentlint analyse` produce meaningful output

### Phase 3: Advanced Features (Weeks 10-20)

| Epic | Focus | Key Deliverables |
|------|-------|-----------------|
| EP07 | Causal Tracing Engine | Evidence collection, causal chain reasoning, origin linking |
| EP09 | Temporal Analysis | Baseline management, delta calculation, trend tracking |
| EP10 | Recommendation Engine | Generation, prioritization, tracking, effectiveness correlation |

**Phase Gate**: Full causal analysis flow: detect → trace → understand → recommend

### Phase 4: Polish & Enhancement (Weeks 16-24)

| Epic | Focus | Key Deliverables |
|------|-------|-----------------|
| EP11 | Quality & Security | LLM-as-judge evaluation, secret detection, debug logging |
| EP12 | Global Learnings | Cross-project learning storage, transfer, promotion |

**Phase Gate**: Production-ready with evaluation and security features

## Roadmap Visualization

```
Week:  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24
       ├───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┤
EP01   ████████████████
EP02   ████░░░░████████████████████
EP03   ████████████████████
EP04                   ████████████████████
EP05                   ████████████████████████████
EP06                       ████████████████████████████
EP07                                       ████████████████████████████
EP08   ░░░░████████████████████████
EP09                           ████████████████████████
EP10                                               ████████████████████
EP11                                   ████████████████████████████████
EP12                                       ████████████████████████

Legend: ████ Active development  ░░░░ Awaiting dependency
       └─── Foundation ──────┘└────────── Core Tools ────────────┘└──── Advanced ─────┘└─ Polish ─┘
```

## Risk Register

| Risk | Affected Epics | Likelihood | Impact | Mitigation |
|------|----------------|------------|--------|------------|
| Claude Agent SDK API changes | EP02, EP07 | Medium | Medium | Pin versions; adapter layer isolation |
| Large session logs exceed context | EP06, EP07 | Medium | High | Pre-summarization; chunked processing |
| FTS5 performance with large datasets | EP06 | Low | Medium | Benchmarking; index optimization |
| Causal analysis accuracy | EP07, EP10 | Medium | High | LLM-as-judge evaluation framework |
| Multi-adapter complexity | EP08 | Low | Medium | Comprehensive adapter interface tests |

## Arc42 Coverage

| Arc42 Section | Covered By Epics |
|---------------|------------------|
| §4 Solution Strategy | EP02 (Two-layer analysis) |
| §5 Building Blocks - CLI | EP04 |
| §5 Building Blocks - Orchestration | EP02 |
| §5 Building Blocks - Tools | EP05, EP06, EP07, EP09, EP10 |
| §5 Building Blocks - Adapters | EP08 |
| §5 Building Blocks - Persistence | EP03 |
| §5 Building Blocks - Integration | EP06, EP12 |
| §6 Runtime Scenarios | EP05, EP06, EP07, EP09 |
| §7 Deployment | EP01 |
| §8 Crosscutting Concepts | EP11 |
| §10 Quality Requirements | All (distributed) |
| §11 Risks | EP11 |

## External Dependencies

| Dependency | Required By | Owner | Status | Notes |
|------------|-------------|-------|--------|-------|
| Claude Agent SDK | EP02 | Anthropic | Available | Pin to stable version |
| Bun runtime | EP01 | Oven | Available | v1.x required |
| ANTHROPIC_API_KEY | EP02 | User | Required | Environment variable |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Static analysis <10s | QR from §10 | Automated benchmark |
| Trend queries <2s | QR from §10 | Automated benchmark |
| >80% test coverage | NFR-7.2 | CI coverage report |
| Session resumability | 100% recovery | Integration tests |
| Config detection accuracy | >95% | Evaluation framework |

## Constitution Alignment

All epics must respect the 9 constitutional principles:

| Principle | Primary Enforcers | Validation |
|-----------|-------------------|------------|
| I. Local-First | EP03, EP12 | No external data transmission |
| II. Improvement-Oriented | EP09, EP12 | Baseline tracking core |
| III. Causal-First | EP07, EP10 | Trace to origin |
| IV. Mixed-Methods | EP05, EP06, EP07 | Quantitative + qualitative |
| V. Language-Agnostic | EP05 | No language-specific core logic |
| VI. Agent-Agnostic | EP08 | Adapter pattern |
| VII. Intelligent Tooling | EP02, All tools | Agent decides approach |
| VIII. Compounding Value | EP09, EP12 | Learnings accumulate |
| IX. Agent-Aware | EP02 | Design serves agent cognition |

## Appendix

### Epic Files

- [EP01: Project Foundation & CI/CD](epics/EP01-project-foundation.md)
- [EP02: Orchestration Core](epics/EP02-orchestration-core.md)
- [EP03: Persistence Layer](epics/EP03-persistence-layer.md)
- [EP04: CLI Interface & Commands](epics/EP04-cli-interface.md)
- [EP05: Config Analysis Tools](epics/EP05-config-analysis.md)
- [EP06: Session Analysis Tools](epics/EP06-session-analysis.md)
- [EP07: Causal Tracing Engine](epics/EP07-causal-tracing.md)
- [EP08: ACT Adapters](epics/EP08-act-adapters.md)
- [EP09: Temporal Analysis](epics/EP09-temporal-analysis.md)
- [EP10: Recommendation Engine](epics/EP10-recommendation-engine.md)
- [EP11: Quality & Security](epics/EP11-quality-security.md)
- [EP12: Global Learnings](epics/EP12-global-learnings.md)

### Related Documents

- [Dependency Graph](dependency-graph.mermaid)
- [Speckit Guide](speckit-guide.md)
- [Arc42 Documentation](../architecture/arc42/)
- [ADRs](../architecture/adr/)
- [Constitution](../../.specify/memory/constitution.md)
