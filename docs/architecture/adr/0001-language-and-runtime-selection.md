---
status: accepted
date: 2026-01-12
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0001: Language and Runtime Selection

## Context and Problem Statement

agentlint requires a language and runtime that supports fast CLI startup (<100ms), efficient parsing of large session logs (100MB+), cross-platform distribution, and integration with Anthropic's LLM ecosystem. The choice fundamentally constrains distribution strategy, development velocity, and long-term maintenance.

## Decision Drivers

- **Startup time <100ms**: Critical for CLI DX with frequent invocations
- **Large file processing**: Session logs can exceed 100MB, requiring efficient streaming
- **Cross-platform support**: Must work on macOS, Linux, and Windows
- **LLM ecosystem access**: Need Anthropic SDK and preferably Agent SDK for AX implementation
- **Local-first storage**: Built-in or efficient SQLite support for baselines and history
- **Agent-Aware principle**: Ability to implement good AX scaffolding for agentlint's own agent
- **Development velocity**: Faster iteration preferred for MVP phase

## Considered Options

1. TypeScript + Bun
2. Go + Cobra/Viper
3. Rust + Clap/Tokio
4. TypeScript + Node.js

## Decision Outcome

Chosen option: **"TypeScript + Bun"** because it uniquely satisfies the <100ms startup requirement while providing access to Anthropic's Agent SDK (critical for Agent-Aware principle), built-in SQLite support, and the same tech stack used by Claude Code itself.

### Consequences

**Good:**
- CLI startup <50ms achievable (4-10x faster than Node.js)
- Built-in SQLite is 3-6x faster than better-sqlite3
- Native TypeScript execution with no build step
- Agent SDK access enables proper AX/UX/DX implementation
- Same stack as Claude Code improves model understanding of codebase
- Can compile to single binary for future distribution flexibility

**Bad:**
- Less production track record than Node.js (mitigated: Bun 1.3 is stable)
- Some edge-case npm packages may need workarounds
- Team may need Bun-specific knowledge acquisition

**Neutral:**
- Requires updating constitution's Technical Boundaries section
- Development documentation will specify Bun as primary runtime

## Pros and Cons of Options

### Option 1: TypeScript + Bun

Bun is a fast all-in-one JavaScript runtime with native TypeScript support, built-in SQLite, and the fastest cold-start times among JS runtimes.

- Good: Startup time <50ms (fastest JS runtime)
- Good: Built-in SQLite 3-6x faster than alternatives
- Good: Native TypeScript, no transpilation step
- Good: Full Anthropic SDK + Agent SDK available
- Good: Same stack as Claude Code
- Neutral: Can compile to single binary (via bun build --compile)
- Bad: Newer ecosystem (1.0 in 2023)
- Bad: Some npm packages with C++ bindings may not work

### Option 2: Go + Cobra/Viper

Go provides true single-binary distribution with excellent CLI tooling (Cobra for commands, Viper for configuration) used by Docker, Kubernetes, and Terraform.

- Good: Native binary with <30ms startup
- Good: Battle-tested CLI ecosystem (Docker, kubectl, Terraform)
- Good: Excellent cross-platform compilation
- Good: Strong standard library for file processing
- Neutral: Official Anthropic Go SDK available
- Bad: No Agent SDK (must use REST API for agent features)
- Bad: More verbose than TypeScript
- Bad: Smaller LLM library ecosystem

### Option 3: Rust + Clap/Tokio

Rust offers the best raw performance and memory safety, with Clap for CLI parsing and Tokio for async operations.

- Good: Fastest startup (<20ms)
- Good: Best performance for large file processing
- Good: True single binary, no runtime
- Good: Memory safety without garbage collection
- Bad: No official Anthropic SDK
- Bad: Steeper learning curve, slower development
- Bad: Would need to implement LLM integration from scratch

### Option 4: TypeScript + Node.js

Node.js is the most mature JavaScript runtime with the widest ecosystem and best production track record.

- Good: Most mature ecosystem
- Good: All npm packages work
- Good: Full Anthropic SDK + Agent SDK
- Bad: Startup 150-300ms (fails <100ms requirement)
- Bad: Requires build step for TypeScript
- Bad: No built-in SQLite

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | Runs entirely locally, no network required |
| II. Improvement-Oriented | Yes | Built-in SQLite supports historical tracking |
| III. Causal-First | Yes | No blocker to tracing implementation |
| IV. Mixed-Methods | Yes | Can implement both quantitative and qualitative analysis |
| V. Language-Agnostic | Yes | Can analyze any codebase regardless of its language |
| VI. Tool-Agnostic | Yes | Adapter pattern implementable in TypeScript |
| VII. Intelligent Tooling | Yes | Runtime supports both tool execution and agent reasoning |
| VIII. Compounding Value | Yes | Baselines compound value over time |
| IX. Agent-Aware | Yes | Agent SDK enables proper AX scaffolding |

## More Information

### Related Documents
- Architecture Vision: [Section 7 - agentlint Agent Design](../../agentlint-architecture-vision.md#7-agentlint-agent-design)
- Design Questions: [Section 1.1 - Language & Runtime Selection](../../design-questions.md#11-language--runtime-selection)
- Design Questions: [Section 12 - agentlint Agent Architecture](../../design-questions.md#12-agentlint-agent-architecture-self-application-of-axuxdx)

### Research Sources
- [Node.js vs Deno vs Bun: Comparing JavaScript Runtimes](https://betterstack.com/community/guides/scaling-nodejs/nodejs-vs-deno-vs-bun/) - Startup time benchmarks
- [Bun SQLite Documentation](https://bun.com/docs/runtime/sqlite) - Built-in SQLite performance
- [Deno 2 vs Node.js vs Bun 2026 Comparison](https://dev.to/pockit_tools/deno-2-vs-nodejs-vs-bun-in-2026-the-complete-javascript-runtime-comparison-1elm) - Runtime comparison
- [AI CLI Tools: Why Claude Code Uses TypeScript](https://mer.vin/2025/12/ai-cli-tools-comparison-why-openai-switched-to-rust-while-claude-code-stays-with-typescript/) - Claude Code architecture rationale
- [Anthropic Client SDKs Documentation](https://platform.claude.com/docs/en/api/client-sdks) - SDK availability
- [Go CLI with Cobra and Viper](https://www.glukhov.org/post/2025/11/go-cli-applications-with-cobra-and-viper/) - Go CLI best practices
- [Rust CLI with Clap](https://hemaks.org/posts/building-production-ready-cli-tools-in-rust-with-clap-from-zero-to-hero/) - Rust CLI development
- [Processing Large Files in Node.js](https://dev.to/pmbanugo/nodejs-performance-processing-14gb-files-78-faster-with-buffer-optimization-540i) - Large file streaming

### Implementation Notes
- Update constitution's Technical Boundaries to confirm "Primary runtime: Bun (TypeScript)"
- Create project with `bun init` and configure for CLI development
- Use `bun:sqlite` module for local storage (no external dependency)
- Consider `bun build --compile` for future single-binary distribution
- This decision unblocks ADR for Distribution & Packaging (design question 1.2)
