---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0001: Runtime Platform and Language

## Context and Problem Statement

agentlint is a CLI tool that orchestrates LLM-powered analysis of AI-assisted development workflows. We need to select a runtime platform and programming language that supports excellent async/streaming for LLM interactions, provides a great CLI user experience, offers mature LLM library ecosystems, and enables efficient distribution across macOS, Linux, and Windows.

## Decision Drivers

- **LLM Ecosystem Maturity**: Must have first-class Anthropic SDK support with streaming and tool calling
- **Developer Productivity**: Rapid iteration is essential; agentlint will evolve quickly
- **CLI Framework Quality**: Excellent terminal UX is a key requirement (rich output, streaming, progress)
- **Distribution Simplicity**: Single-binary or simple install is preferred (nice to have, not critical)
- **Long-term Maintainability**: Type safety, large talent pool, proven at scale
- **Self-Building Capability**: Following Claude Code's pattern, the tool should be buildable by itself
- **Constitution Alignment**: Must support Local-First, Agent-Aware, and other principles

## Considered Options

1. TypeScript with Bun runtime
2. TypeScript with Node.js
3. Rust
4. Python
5. Go

## Decision Outcome

Chosen option: **"TypeScript with Bun runtime"** because it provides the best combination of LLM ecosystem maturity, developer productivity, CLI framework options, and aligns with Claude Code's proven architecture pattern. Bun adds native single-binary compilation and faster startup while maintaining TypeScript compatibility.

### Consequences

**Good:**
- First-class Anthropic SDK with full streaming and tool-calling support
- Vercel AI SDK provides mature agentic patterns (agents, streaming, tool execution)
- Excellent CLI frameworks available (oclif, Ink for React-based terminal UI)
- Bun enables single-binary distribution via `bun compile`
- TypeScript enables self-building capability (Claude Code wrote 90% of its own code)
- Large talent pool and ecosystem for long-term maintainability
- Faster startup time with Bun compared to Node.js

**Bad:**
- Bun is newer than Node.js; some edge cases may exist
- Single binary still ~88MB+ (includes Bun runtime)
- Some npm packages may have Bun compatibility issues

**Neutral:**
- Need to ensure Node.js compatibility for users who prefer npm install
- Will evaluate Ink vs oclif for CLI framework in a separate decision

## Pros and Cons of Options

### Option 1: TypeScript with Bun Runtime

TypeScript on Bun runtime, following Claude Code's architecture. Native single-binary compilation, TypeScript-first, modern APIs.

- Good: Claude Code's proven architecture—90% of Claude Code written by itself
- Good: First-class Anthropic TypeScript SDK with streaming and tool calling
- Good: Vercel AI SDK 6 provides mature agent abstractions and tool patterns
- Good: Native `bun compile` for single-binary distribution
- Good: Faster startup (~10x faster than Node.js cold start)
- Good: TypeScript type safety for maintainability
- Good: Excellent CLI frameworks (Ink/React for terminal UI)
- Neutral: Newer runtime, but rapidly maturing
- Bad: Some npm packages may have compatibility issues
- Bad: Bun-specific APIs may reduce Node.js fallback compatibility

### Option 2: TypeScript with Node.js

Standard TypeScript on Node.js LTS, maximum compatibility approach.

- Good: Maximum npm ecosystem compatibility
- Good: Proven stability at scale
- Good: Same Anthropic SDK and Vercel AI SDK benefits
- Neutral: Single-binary via SEA (experimental) or pkg
- Bad: Slower startup than Bun
- Bad: SEA has significant limitations (no VFS, limited native module support)
- Bad: pkg no longer actively maintained

### Option 3: Rust

Native compiled language, OpenAI Codex CLI's choice for performance.

- Good: Best performance and memory efficiency
- Good: True single-binary distribution with no runtime
- Good: Native access to OS APIs (sandboxing, security)
- Good: ~10ms startup time
- Neutral: Growing Rust talent pool
- Bad: Only unofficial Anthropic SDKs available (not first-class)
- Bad: Steeper learning curve, slower iteration
- Bad: Less mature agentic framework ecosystem than TypeScript
- Bad: Harder for agentlint to "write itself" (model less fluent in Rust)

### Option 4: Python

Aider's choice, rich ML ecosystem.

- Good: Rich ML/AI ecosystem, rapid prototyping
- Good: Official Anthropic Python SDK with full feature parity
- Good: Typer/Click for CLI development
- Neutral: Type hints available but optional
- Bad: Distribution complexity (PyInstaller issues, 10x size bloat reported)
- Bad: No clean single-binary story
- Bad: Cross-platform builds require separate CI for each OS
- Bad: Version conflicts common with poetry/PyInstaller

### Option 5: Go

Single binary, good concurrency, Google ADK available.

- Good: True single-binary distribution
- Good: Excellent concurrency primitives
- Good: Google Agent Development Kit (ADK) available
- Good: Fast compilation and startup
- Neutral: LangChainGo available for agentic patterns
- Bad: No official Anthropic SDK (community libraries only)
- Bad: Less dynamic than TypeScript for agent patterns
- Bad: Smaller ecosystem for streaming UI (no Ink equivalent)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All runtimes support local execution; no principle impact |
| II. Improvement-Oriented | Yes | TypeScript enables rapid iteration on improvement features |
| III. Causal-First | Yes | No principle impact from language choice |
| IV. Mixed-Methods | Yes | TypeScript supports both static tools and agent reasoning |
| V. Language-Agnostic | Yes | TypeScript/Bun can analyze projects in any language |
| VI. Agent-Agnostic | Yes | Adapter pattern implementable in any language |
| VII. Intelligent Tooling | Yes | Vercel AI SDK provides excellent tool abstraction |
| VIII. Compounding Value | Yes | Baseline storage and historical queries not affected |
| IX. Agent-Aware | Yes | TypeScript enables model to reason about/modify itself |

## More Information

### Related Documents
- Architecture Vision: [Section 4 - High-Level Architecture](../../vision/agentlint-architecture-vision.md#4-high-level-architecture)
- Design Decisions: [DD-001](../design-decisions.md#dd-001-runtime-platform-and-language)
- Conceptual Architecture: [Section 3 - Architectural Layers](../conceptual-architecture.md#3-conceptual-architecture-layers)

### Research Sources
- [AI CLI Tools Comparison: Why OpenAI Switched to Rust While Claude Code Stays with TypeScript](https://mer.vin/2025/12/ai-cli-tools-comparison-why-openai-switched-to-rust-while-claude-code-stays-with-typescript/)
- [How Claude Code is Built - Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [Vercel AI SDK 6 - Agent Abstractions](https://vercel.com/blog/ai-sdk-6)
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Bun Single-file Executable](https://bun.com/docs/bundler/executables)
- [oclif: The Open CLI Framework](https://oclif.io/)
- [Building LLM-powered applications in Go](https://go.dev/blog/llmpowered)
- [Creating Standalone Executable Applications in Python](https://pythonic.blog/2025/02/24/creating-standalone-executable-applications-in-python-a-guide-with-pros-and-cons/)

### Implementation Notes

1. **Primary Runtime**: Bun for development and single-binary distribution
2. **Fallback Compatibility**: Maintain Node.js LTS compatibility for npm install option
3. **CLI Framework**: Evaluate Ink vs oclif in separate decision (DD-010)
4. **Agentic SDK**: Evaluate Vercel AI SDK vs custom loop in DD-002
5. **Distribution Strategy**:
   - Primary: `bun compile` for single-binary releases
   - Secondary: npm package for users preferring npm install
6. **Testing**: Ensure CI tests against both Bun and Node.js
