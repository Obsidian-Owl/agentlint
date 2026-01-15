# Research Findings: Project Setup

> **Epic**: EP01
> **Created**: 2026-01-15

---

## Decision Log

### Runtime Platform

**Decision**: TypeScript + Bun
**Rationale**: Follows Claude Code's proven architecture. Bun provides native single-binary compilation, faster startup (~10x vs Node.js), and TypeScript-first support.
**Alternatives Considered**:
- Node.js: Maximum compatibility but slower, no clean single-binary story
- Rust: Best performance but unofficial Anthropic SDK, steeper learning curve
- Python: Distribution complexity (PyInstaller bloat)
- Go: No official Anthropic SDK

**References**: [ADR-0001](../../docs/architecture/adr/0001-runtime-platform-and-language.md)

---

### Distribution Strategy

**Decision**: Native binary primary, npm secondary
**Rationale**: Zero runtime dependency for users (no Node.js/Bun required). Follows Claude Code's installation pattern.
**Alternatives Considered**:
- npm only: Requires Node.js pre-installed
- Binary only: Excludes npm-preferring users

**References**: [ADR-0018](../../docs/architecture/adr/0018-distribution-and-installation-strategy.md)

---

### Project Structure

**Decision**: Simple flat structure (no monorepo)
**Rationale**: Single package initially. Monorepo adds complexity without current benefit. Can migrate to turborepo/nx later if multiple packages needed.
**Alternatives Considered**:
- Turborepo: Overkill for single package
- Nx: Same reasoning

**References**: Spec Q1 clarification

---

### Node.js Fallback Version

**Decision**: Node.js 22 LTS minimum
**Rationale**: Active LTS (not just maintenance). Maintained until April 2027. Better ESM support and performance than 20.
**Alternatives Considered**:
- Node.js 18: EOL April 2025
- Node.js 20: Maintenance mode, EOL April 2026
- Node.js 24+: Not yet LTS

**References**: Spec Q2 clarification

---

### PATH Handling in Install Script

**Decision**: Print instructions only (don't auto-modify shell config)
**Rationale**: Matches Claude Code pattern. Safer — user controls their shell config. Works with any shell (bash, zsh, fish, etc.).
**Alternatives Considered**:
- Auto-add to PATH: Modifies user's dotfiles, shell-specific complexity

**References**: Spec Q3 clarification, [Claude Code install docs](https://code.claude.com/docs/en/quickstart)

---

### Linting & Formatting

**Decision**: ESLint + Prettier with TypeScript strict mode
**Rationale**: Industry standard combination. ESLint for logic/style rules, Prettier for formatting. TypeScript strict mode catches more bugs at compile time.
**Alternatives Considered**:
- Biome: Newer, faster, but less ecosystem support
- TSLint: Deprecated

**References**: Common practice, no ADR needed

---

### Testing Framework

**Decision**: Bun test runner (built-in)
**Rationale**: Zero additional dependency. Fast. Jest-compatible API. Integrated with Bun runtime.
**Alternatives Considered**:
- Vitest: Great but separate dependency
- Jest: Slower, Node.js focused

**References**: [Bun test docs](https://bun.sh/docs/cli/test)

---

### CI Platform

**Decision**: GitHub Actions
**Rationale**: Free for open source. Native GitHub integration. Good Bun support via `oven-sh/setup-bun` action.
**Alternatives Considered**:
- CircleCI: Good but extra config
- GitLab CI: Would require repo migration

**References**: Common practice

---

## Open Items

None — all unknowns resolved during spec clarification phase.
