# Feature Specification: Project Setup

> **Legacy Note (2026-01)**: This specification references "Claude Agent SDK" which was replaced by Opencode SDK. See [ADR-0024](../../docs/architecture/adr/0024-opencode-sdk-migration.md).

> **Epic**: EP01
> **Created**: 2026-01-15
> **Status**: Ready for Planning
> **Author**: Claude Code

---

## 1. Overview

Establish the foundational development infrastructure for agentlint: TypeScript + Bun project structure, linting/formatting tooling, CI/CD pipeline, and distribution mechanisms. This enables all subsequent epics (EP02-EP12) to build on a stable, tested base.

### 1.1 Business Context

This is the first implementation epic. All other functionality depends on this foundation being solid. The project must support:

- Rapid TypeScript development with Bun runtime (ADR-0001)
- Native binary distribution with npm fallback (ADR-0018)
- CI that blocks broken code from merging

### 1.2 Out of Scope

- CLI commands implementation (EP04)
- Claude Agent SDK integration (EP02)
- Any analysis functionality (EP05-EP10)
- Windows platform support (post-MVP)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: New Contributor Setup

**As a** contributor,
**I want** to clone, install, and run tests in under 5 minutes,
**So that** I can start contributing quickly.

**Acceptance Criteria:**

- [ ] Given a fresh clone, when I run `bun install`, then all dependencies install without errors
- [ ] Given dependencies installed, when I run `bun test`, then the test suite executes and reports results
- [ ] Given dependencies installed, when I run `bun run lint`, then code style is validated
- [ ] Given dependencies installed, when I run `bun run build`, then TypeScript compiles without errors

**Test Scenarios:**

- Happy path: Fresh clone → `bun install` → `bun test` → all pass
- Error case: Missing Bun installation → clear error message with install instructions

---

### US-002 [P1]: CI Validation on PR

**As a** maintainer,
**I want** PRs to be validated automatically,
**So that** broken code cannot be merged.

**Acceptance Criteria:**

- [ ] Given a PR is opened, when CI runs, then lint, type-check, and tests execute
- [ ] Given any check fails, when CI completes, then the PR is blocked from merging
- [ ] Given all checks pass, when CI completes, then the PR shows green status

**Test Scenarios:**

- Happy path: PR with valid code → all checks pass → mergeable
- Error case: PR with lint error → lint check fails → PR blocked

---

### US-003 [P1]: Binary Distribution

**As a** user,
**I want** to install agentlint via a single curl command,
**So that** I don't need Node.js or Bun pre-installed.

**Acceptance Criteria:**

- [ ] Given macOS (arm64 or x64), when I run the install script, then a working binary is placed in `~/.agentlint/bin/`
- [ ] Given Linux (x64 or arm64), when I run the install script, then a working binary is placed in `~/.agentlint/bin/`
- [ ] Given the binary is installed, when I run `agentlint --version`, then the version is displayed

**Test Scenarios:**

- Happy path: `curl -fsSL install.sh | bash` → binary installed → `agentlint --version` works
- Error case: Unsupported platform → clear error message

---

### US-004 [P2]: npm Installation Fallback

**As a** user with Node.js,
**I want** to install agentlint via npm,
**So that** I can use my familiar package manager.

**Acceptance Criteria:**

- [ ] Given Node.js 22+ installed, when I run `npm install -g @agentlint/cli`, then the CLI is available
- [ ] Given npm installation, when I run `agentlint --version`, then the version matches the package version

**Test Scenarios:**

- Happy path: `npm install -g @agentlint/cli` → `agentlint --version` works
- Error case: Node.js < 22 → installation fails with version requirement message

---

### US-005 [P2]: Release Pipeline

**As a** maintainer,
**I want** releases to be automated on git tag,
**So that** I can ship new versions reliably.

**Acceptance Criteria:**

- [ ] Given a `v*` tag is pushed, when GitHub Actions runs, then binaries are built for all platforms
- [ ] Given binaries are built, when release completes, then they are uploaded to GitHub Releases
- [ ] Given release completes, when npm publish runs, then package is published to npm registry

**Test Scenarios:**

- Happy path: Push `v0.1.0` tag → 4 binaries + npm package published
- Error case: Build fails on one platform → release blocked, maintainer notified

---

### US-006 [P3]: Self-Update Command

**As a** user,
**I want** to update agentlint without reinstalling,
**So that** I can easily stay on the latest version.

**Acceptance Criteria:**

- [ ] Given a newer version exists, when I run `agentlint update`, then the binary is replaced with the latest
- [ ] Given already on latest, when I run `agentlint update`, then a message indicates no update needed
- [ ] Given update downloads, when checksum verification fails, then update is aborted with error

**Test Scenarios:**

- Happy path: Old version → `agentlint update` → new version installed
- Error case: Network failure → graceful error, existing binary preserved

---

## 3. Requirements

### 3.1 Functional Requirements

| ID     | Requirement                                       | Priority | User Story |
| ------ | ------------------------------------------------- | -------- | ---------- |
| FR-001 | Project initializes with `bun install`            | P1       | US-001     |
| FR-002 | TypeScript compiles with `bun run build`          | P1       | US-001     |
| FR-003 | Tests run with `bun test` and report coverage     | P1       | US-001     |
| FR-004 | ESLint validates code with `bun run lint`         | P1       | US-001     |
| FR-005 | Prettier formats code with `bun run format`       | P1       | US-001     |
| FR-006 | GitHub Actions runs lint, type-check, test on PR  | P1       | US-002     |
| FR-007 | `bun run build:binary` produces native executable | P1       | US-003     |
| FR-008 | Install script downloads correct platform binary  | P1       | US-003     |
| FR-009 | npm package publishes and installs correctly      | P2       | US-004     |
| FR-010 | Release workflow builds all platform binaries     | P2       | US-005     |
| FR-011 | Release workflow uploads to GitHub Releases       | P2       | US-005     |
| FR-012 | `agentlint update` downloads and replaces binary  | P3       | US-006     |
| FR-013 | Update command verifies checksums                 | P3       | US-006     |

### 3.2 Non-Functional Requirements

| ID      | Requirement     | Metric                | Target       |
| ------- | --------------- | --------------------- | ------------ |
| NFR-001 | Build time      | Duration              | < 30 seconds |
| NFR-002 | Binary size     | File size             | < 50 MB      |
| NFR-003 | CI duration     | Pipeline time         | < 5 minutes  |
| NFR-004 | Test coverage   | Line coverage         | > 80%        |
| NFR-005 | Startup time    | Cold start            | < 500ms      |
| NFR-006 | Onboarding time | Clone to test passing | < 5 minutes  |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity  | Description                        | Key Attributes                            |
| ------- | ---------------------------------- | ----------------------------------------- |
| Project | The agentlint repository structure | name, version, scripts, dependencies      |
| Binary  | Compiled native executable         | platform, architecture, version, checksum |
| Release | A versioned distribution           | tag, binaries[], changelog                |

### 4.1 Entity Relationships

```
Project --1:N--> Binary (one project produces multiple platform binaries)
Release --1:N--> Binary (one release contains multiple binaries)
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80%, no critical bugs
- [ ] **Performance**: Build < 30s, binary < 50MB, CI < 5 min
- [ ] **Adoption**: EP02 can begin without blockers from EP01

---

## 6. Edge Cases & Error Handling

| Scenario                       | Expected Behavior                        | Priority |
| ------------------------------ | ---------------------------------------- | -------- |
| Bun not installed              | Clear error with install instructions    | P1       |
| Network failure during install | Graceful error, no partial state         | P1       |
| Unsupported platform (Windows) | Clear "not yet supported" message        | P1       |
| Checksum mismatch on update    | Abort update, preserve existing binary   | P2       |
| npm publish fails              | CI fails, release blocked                | P2       |
| GitHub API rate limited        | Retry with backoff, then fail gracefully | P3       |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency      | Type     | Status    | Impact if Missing          |
| --------------- | -------- | --------- | -------------------------- |
| Bun v1.x        | External | Available | Cannot build/run           |
| GitHub Actions  | External | Available | Cannot CI/CD               |
| npm registry    | External | Available | Cannot publish npm package |
| GitHub Releases | External | Available | Cannot host binaries       |

### 7.2 Assumptions

- Bun's `compile` feature remains stable for target platforms
- GitHub Actions macOS runners can cross-compile for Intel
- npm package naming `@agentlint/cli` is available

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should we use a monorepo structure (turborepo/nx) even for single package initially? — **RESOLVED: No, simple structure. Single package.json, can migrate later if needed.**
- [x] **Q2**: What is the minimum Node.js version for npm fallback? — **RESOLVED: Node.js 22 LTS (active LTS, maintained until April 2027).**
- [x] **Q3**: Should install script add to PATH automatically or just print instructions? — **RESOLVED: Print instructions only (matches Claude Code pattern).**

---

## 9. References

- [Epic: EP01-project-foundation.md](../../docs/planning/epics/EP01-project-foundation.md)
- [ADR-0001: Runtime Platform and Language](../../docs/architecture/adr/0001-runtime-platform-and-language.md)
- [ADR-0018: Distribution and Installation Strategy](../../docs/architecture/adr/0018-distribution-and-installation-strategy.md)
- [Arc42 Section 07: Deployment View](../../docs/architecture/arc42/07-deployment-view.md)

---

## Clarifications

> This section is populated by /dev.clarify

<!-- Clarifications will be added here -->
