# EP01: Project Foundation & CI/CD

> Establish the development environment, tooling, and CI/CD pipeline for agentlint.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Foundation |
| **Priority** | P0-Critical |
| **Size** | M |
| **Estimated Duration** | 4 weeks |
| **Target Stories** | 8-10 stories |

## Business Outcome Hypothesis

**If** we establish a robust development foundation with TypeScript + Bun, proper tooling, and CI/CD pipeline,
**Then** all subsequent epics will have a stable, tested base to build upon,
**Measured by** successful CI runs, <30s build times, and zero configuration blockers for EP02-EP12.

## Scope Definition

### In Scope

- [ ] Initialize TypeScript + Bun project structure per ADR-0001
- [ ] Configure ESLint + Prettier with strict TypeScript rules
- [ ] Set up project directory structure (src/, tests/, docs/)
- [ ] Configure Bun test runner with coverage reporting
- [ ] Create GitHub Actions workflow for lint, type-check, test
- [ ] Set up `bun compile` for native binary builds
- [ ] Configure npm package structure for secondary distribution
- [ ] Create install script (`curl | bash` pattern per ADR-0018)
- [ ] Document developer setup in CONTRIBUTING.md

### Out of Scope

- Actual CLI commands (EP04)
- Claude Agent SDK integration (EP02)
- Any analysis functionality (EP05-EP10)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- TypeScript + Bun project compiles successfully
- CI pipeline runs lint + test on PR
- Single `bun compile` produces executable binary

**MVP validates:** Development infrastructure supports subsequent implementation

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Integration Layer (build tooling) |
| **Runtime Scenarios** | N/A (foundation) |
| **Quality Requirements** | QS-7 (contributor onboarding <1 day) |
| **Crosscutting Concepts** | Code style conventions |
| **ADRs** | ADR-0001 (Runtime Platform), ADR-0018 (Distribution) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Contributors (clean layers, testable components) |
| **Use Cases** | N/A (foundation) |
| **Requirements** | NFR-7 (Maintainability) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| None | — | First epic to implement |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP02 | Hard | Project structure, TypeScript config |
| EP03 | Hard | Bun:sqlite availability, storage locations |
| EP04 | Hard | CLI entry point, Ink dependency |
| EP05-EP12 | Hard | All epics need build infrastructure |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| Bun runtime | v1.x with compile support | Available |
| GitHub Actions | CI/CD runner | Available |
| npm registry | Package publishing | Available |

## Technical Considerations

### Key Decisions

- Use Bun as runtime and test runner (not Jest/Vitest separately)
- TypeScript strict mode enabled from start
- Monorepo-ready structure even though single package initially

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bun compile issues on different platforms | Low | Medium | Test on macOS arm64, macOS x64, Linux x64 in CI |
| TypeScript strict mode slows development | Low | Low | Accept the tradeoff for better type safety |

### Spikes Needed

- [ ] Verify Bun compile produces working binary on all target platforms
- [ ] Test npm fallback when Bun not available

### Constitution Alignment

- **VII. Intelligent Tooling**: Tooling setup serves agent development needs
- **II. Improvement-Oriented**: CI enables continuous quality improvement

## Acceptance Criteria (High-Level)

### Functional

- [ ] `bun install` installs all dependencies
- [ ] `bun run build` produces compiled TypeScript
- [ ] `bun run build:binary` produces native executable
- [ ] `bun test` runs test suite with coverage
- [ ] `bun run lint` validates code style

### Non-Functional

- [ ] Build time < 30 seconds
- [ ] Binary size < 50MB
- [ ] CI pipeline completes < 5 minutes

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] CONTRIBUTING.md documents setup
- [ ] CI pipeline green on main branch
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Contributors
- **Workflow**: Clone repo → install → build → test → contribute
- **Outcome**: Developer productive within 1 day

### Constraints to Encode

From ADRs:
- ADR-0001: TypeScript + Bun, no Node.js-specific APIs
- ADR-0018: Native binary primary, npm secondary

From Constitution:
- VII. Intelligent Tooling: Setup must serve development needs

### Key Scenarios to Specify

1. New contributor clones and builds successfully
2. CI blocks PR with linting errors
3. Release workflow produces binaries for all platforms

### Tech Stack Notes (for `/speckit.plan`)

- Bun v1.x runtime
- TypeScript 5.x with strict mode
- ESLint + Prettier
- GitHub Actions for CI/CD

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
