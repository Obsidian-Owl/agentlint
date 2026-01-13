---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0002: Distribution and Packaging Strategy

## Context and Problem Statement

With TypeScript + Bun selected as the runtime (ADR-0001), agentlint needs a distribution strategy that reaches all developers (not just JS/TS), supports easy updates, and minimizes maintenance burden for MVP. The primary platform is macOS, with cross-platform expansion planned for later phases.

## Decision Drivers

- **Audience breadth**: Target all developers, not just JavaScript ecosystem
- **MVP simplicity**: Minimize distribution infrastructure for initial launch
- **macOS primary**: MVP focuses on macOS (per scope decision)
- **Update experience**: Users should have familiar update paths
- **Runtime dependency acceptable**: Requiring Bun/npm is acceptable (per scope decision)
- **Future flexibility**: Strategy should allow adding compiled binaries later

## Considered Options

1. npm Package (Primary) + Homebrew Formula (Convenience)
2. Homebrew Primary with Bun Dependency
3. Compiled Binary Distribution
4. npm Only (Simplest)

## Decision Outcome

Chosen option: **"npm Package (Primary) + Homebrew Formula (Convenience)"** because it provides the fastest path to distribution with familiar update mechanisms, while the Homebrew formula offers a native macOS experience for developers who prefer it. This approach maintains a single source of truth (npm) while maximizing reach.

### Consequences

**Good:**
- Single source of truth (npm package) simplifies versioning
- Familiar installation for 17M+ npm developers
- Homebrew provides native macOS experience
- Works with npm, yarn, pnpm, and bun package managers
- Easy CI/CD integration via npx
- Future compiled binary can be added without breaking existing users

**Bad:**
- Users need npm or Bun pre-installed
- Homebrew tap requires separate maintenance
- Some Python/Go developers may need to install npm first

**Neutral:**
- Will need to document both installation paths
- Homebrew formula review process if submitting to homebrew-core

## Pros and Cons of Options

### Option 1: npm Package + Homebrew Formula

npm as primary distribution channel with a Homebrew formula that wraps the npm package for macOS convenience.

- Good: Widest reach (npm has 17M+ developers)
- Good: Single source of truth for versioning
- Good: Familiar update mechanism (`npm update -g`)
- Good: Easy CI/CD integration (`npx agentlint`)
- Good: Homebrew handles dependency management on macOS
- Neutral: Two installation methods to document
- Bad: Requires Node.js or Bun pre-installed
- Bad: Homebrew tap maintenance overhead

### Option 2: Homebrew Primary

Homebrew tap as primary distribution, with formula declaring Bun as a dependency.

- Good: Native macOS experience
- Good: Automatic dependency management (Bun installed via formula)
- Good: Familiar to all macOS developers
- Neutral: Standard `brew upgrade` updates
- Bad: macOS/Linux only
- Bad: Requires maintaining Homebrew tap
- Bad: Less familiar for Windows users (future expansion)

### Option 3: Compiled Binary Distribution

Standalone binary using `bun build --compile`, distributed via curl script or GitHub releases.

- Good: No runtime dependency
- Good: Fastest startup (no JIT warmup)
- Good: Works for any developer regardless of ecosystem
- Good: Can containerize without runtime
- Neutral: Enables lightweight Docker containers
- Bad: Higher build complexity (cross-compilation)
- Bad: Binary signing required (Apple notarization, Windows Authenticode)
- Bad: Larger download size (~90MB per platform)
- Bad: Must implement own update mechanism

### Option 4: npm Only

Simplest approach: just publish to npm, no Homebrew.

- Good: Minimal maintenance
- Good: Single distribution channel
- Good: Fast time to market
- Bad: Less native macOS experience
- Bad: May seem less "serious" to non-JS developers
- Bad: Missing opportunity for Homebrew discoverability

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | Installs locally, no network required post-install |
| II. Improvement-Oriented | Yes | npm/Homebrew updates support continuous improvement |
| III. Causal-First | N/A | Distribution doesn't affect tracing capability |
| IV. Mixed-Methods | N/A | Distribution doesn't affect analysis methods |
| V. Language-Agnostic | Yes | npm is available regardless of project language |
| VI. Tool-Agnostic | N/A | Distribution doesn't affect adapter pattern |
| VII. Intelligent Tooling | N/A | Distribution doesn't affect analysis approach |
| VIII. Compounding Value | Yes | Baselines compound value over time |
| IX. Agent-Aware | N/A | Distribution doesn't affect agent architecture |

## More Information

### Related Documents
- [ADR-0001: Language and Runtime Selection](./0001-language-and-runtime-selection.md) - Establishes TypeScript + Bun
- Design Questions: [Section 1.2 - Distribution & Packaging](../../design-questions.md#12-distribution--packaging)

### Research Sources
- [Bun Installation Methods](https://bun.com/docs/installation) - Official Bun installation options
- [Bun Single-file Executables](https://bun.com/docs/bundler/executables) - Compiled binary documentation
- [npm vs npx Best Practices](https://blog.logrocket.com/npm-vs-npx/) - When to use global install vs npx
- [ElysiaJS Production Deployment](https://elysiajs.com/patterns/deploy) - Bun compile recommendations
- [Building CLI with TypeScript and Bun](https://pmbanugo.me/blog/build-cli-typescript-bun) - CLI distribution patterns
- [Homebrew Autoupdate](https://github.com/DomT4/homebrew-autoupdate) - Update mechanism documentation

### Implementation Notes

**npm Package Setup:**
```json
{
  "name": "agentlint",
  "bin": {
    "agentlint": "./bin/agentlint.ts"
  }
}
```

**Installation Commands:**
```bash
# npm (primary)
npm install -g agentlint
# or
bunx agentlint

# Homebrew (convenience)
brew tap agentlint/tap
brew install agentlint
```

**Homebrew Formula Structure:**
- Create `homebrew-tap` repository
- Formula depends on `bun` cask
- Points to npm package or compiled binary

**Future: Compiled Binary Path:**
- Use `bun build --compile --minify` for releases
- Add to GitHub releases with `--target` for cross-platform
- Consider binary signing when expanding beyond MVP
- Update Homebrew formula to use binary instead of npm
