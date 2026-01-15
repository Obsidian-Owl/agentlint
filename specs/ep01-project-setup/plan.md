# Implementation Plan: Project Setup

> **Epic**: EP01
> **Spec**: specs/ep01-project-setup/spec.md
> **Created**: 2026-01-15
> **Status**: Design Complete
> **Author**: Claude Code

---

## Summary

**Primary Requirement**: Establish foundational development infrastructure for agentlint — TypeScript + Bun project structure, linting/formatting, CI/CD pipeline, and binary distribution.

**Technical Approach**: Initialize a TypeScript project with Bun runtime, configure ESLint + Prettier for code quality, set up GitHub Actions for CI, and implement `bun compile` for native binary distribution with npm as secondary channel.

---

## Technical Context

> Fill in project-specific values. Mark unknowns as `[NEEDS CLARIFICATION]`.

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x (strict mode) |
| **Runtime** | Bun 1.x (primary), Node.js 22+ (npm fallback) |
| **Primary Dependencies** | ESLint, Prettier, @anthropic-ai/sdk (future) |
| **Storage** | None for EP01 (SQLite in EP03) |
| **Testing Framework** | Bun test runner (built-in) |
| **Target Platform** | CLI - macOS (arm64, x64), Linux (arm64, x64) |
| **Project Type** | CLI Tool |
| **Performance Goals** | Build < 30s, Binary < 50MB, Startup < 500ms |
| **Constraints** | No Windows (post-MVP), No external services |
| **Scale/Scope** | Single developer initially |

---

## Constitution Check

> Validate against project constitution at `.specify/memory/constitution.md`

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | All tools run locally. No telemetry. CI runs in user's GitHub. |
| II | Improvement-Oriented | ✓ | Foundation enables future improvement features. CI provides feedback loop. |
| III | Causal-First | N/A | Infrastructure epic — no analysis functionality yet. |
| IV | Mixed-Methods | N/A | Infrastructure epic — no analysis functionality yet. |
| V | Language-Agnostic | ✓ | TypeScript tooling doesn't constrain analyzed languages. |
| VI | Agent-Agnostic | ✓ | No ACT-specific code in foundation. Adapter layer comes in EP08. |
| VII | Intelligent Tooling | ✓ | Project structure designed to serve agent needs (EP02). |
| VIII | Compounding Value | ✓ | CI/testing enables quality compounding over time. |
| IX | Agent-Aware | ✓ | Structure prepared for agent orchestration in EP02. |

**Gate Status**: [x] All principles pass (III, IV marked N/A for infrastructure epic)

---

## Project Structure

### Documentation Structure

```
specs/ep01-project-setup/
├── spec.md           # Feature specification
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
└── checklists/       # Validation checklists
    └── requirements.md
```

### Source Code Structure (Proposed)

```
agentlint/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── version.ts          # Version info for --version
│   └── commands/           # Command implementations (minimal for EP01)
│       └── update.ts       # Self-update command (P3)
├── scripts/
│   └── install.sh          # curl | bash installer
├── tests/
│   └── cli.test.ts         # Basic CLI tests
├── .github/
│   └── workflows/
│       ├── ci.yml          # PR validation
│       └── release.yml     # Tag-triggered release
├── package.json            # Project manifest
├── tsconfig.json           # TypeScript config
├── bunfig.toml             # Bun configuration
├── .eslintrc.cjs           # ESLint config
├── .prettierrc             # Prettier config
├── CONTRIBUTING.md         # Developer setup guide
└── README.md               # Project overview
```

---

## Complexity Tracking

> Only add rows if constitution principles require justified violations

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| (none) | — | — | — |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Runtime | Bun | Faster startup, native compile, Claude Code pattern | ADR-0001 |
| Distribution | Binary primary, npm secondary | Zero runtime dependency for users | ADR-0018 |
| Linting | ESLint + Prettier | Industry standard, good TypeScript support | N/A |
| Testing | Bun test | Built-in, fast, no extra dependency | N/A |
| CI | GitHub Actions | Free for OSS, good Bun support | N/A |
| Project structure | Flat (no monorepo) | Simple start, migrate if needed later | Spec Q1 |
| Node.js version | 22 LTS | Active LTS, maintained until April 2027 | Spec Q2 |
| PATH handling | Print instructions | Matches Claude Code, safer | Spec Q3 |

---

## References

- **Spec**: [specs/ep01-project-setup/spec.md](./spec.md)
- **Epic**: [docs/planning/epics/EP01-project-foundation.md](../../docs/planning/epics/EP01-project-foundation.md)
- **Arc42**: [07-deployment-view.md](../../docs/architecture/arc42/07-deployment-view.md)
- **ADRs**: [ADR-0001](../../docs/architecture/adr/0001-runtime-platform-and-language.md), [ADR-0018](../../docs/architecture/adr/0018-distribution-and-installation-strategy.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-15 | Claude Code | Initial plan |
