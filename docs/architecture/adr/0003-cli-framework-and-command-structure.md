---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0003: CLI Framework and Command Structure

## Context and Problem Statement

agentlint is a command-line tool requiring excellent terminal UX for long-running agentic analysis sessions (30+ minutes). We need to select a CLI framework that supports streaming output, progressive feedback, and cross-platform compatibility while aligning with our TypeScript/Bun runtime (ADR-0001) and Claude Agent SDK (ADR-0002) decisions.

## Decision Drivers

- **Streaming Output**: Agent sessions require real-time streaming of analysis progress and findings
- **Claude Code Alignment**: Claude Code uses Ink for terminal UI—proven pattern for agentic CLIs
- **Bun Compatibility**: Must work with Bun runtime per ADR-0001
- **Long-Running Operations**: 30+ minute analysis sessions need progress indication
- **Multiple Output Formats**: Terminal (default), JSON, Markdown for scripted/CI usage
- **Subcommand Structure**: Commands include scan, analyse, baseline, compare, recommend, trace, validate, learn

## Considered Options

1. Ink + Commander.js (React terminal UI with argument parsing)
2. Commander.js Standalone (lightweight with custom streaming)
3. oclif (enterprise-grade framework)
4. Citty (minimal UnJS builder)

## Decision Outcome

Chosen option: **"Ink + Commander.js"** because it provides the same proven terminal UI architecture that powers Claude Code, with React-based component composition for streaming output, combined with Commander's lightweight argument parsing. This maximizes development velocity by following an established pattern for agentic CLI tools.

**Command Structure**: Verb-based commands at the top level (git-like pattern):
- `agentlint scan` - Discover AI configurations
- `agentlint analyse` - Run full analysis
- `agentlint baseline` - Capture current state
- `agentlint compare` - Compare against baseline
- `agentlint recommend` - Generate recommendations
- `agentlint trace` - Trace issue to origin
- `agentlint validate` - Validate configurations
- `agentlint learn` - Manage learnings

### Consequences

**Good:**
- Same architecture as Claude Code—proven at scale for agentic applications
- React component model enables rich streaming UI with Flexbox layouts via Yoga
- Commander provides lightweight, well-tested argument parsing (238M weekly downloads)
- `<Static>` component perfect for permanent log output during streaming
- React DevTools support for debugging terminal UI
- Familiar mental model for developers who know React

**Bad:**
- Ink has known `useInput` bug under Bun (interactive input doesn't respond)
- Two dependencies instead of one (Ink + Commander)
- React overhead for what could be simpler text output
- Ink's Bun compatibility is still evolving

**Neutral:**
- Will use Commander for parsing, Ink for rendering—clear separation of concerns
- Input bug is mitigated because agentlint is primarily output-focused (analysis results)
- May need fallback to Node.js for users who encounter Bun compatibility issues

## Pros and Cons of Options

### Option 1: Ink + Commander.js

React-based terminal UI framework used by Claude Code, Gatsby, Prisma, and Shopify, combined with Commander for argument parsing.

- Good: Claude Code uses this exact pattern—proven for agentic CLI tools
- Good: React component model enables declarative UI composition
- Good: Yoga layout engine handles terminal width adaptation automatically
- Good: `<Static>` component for streaming logs without re-rendering
- Good: Rich ecosystem (Ink UI components library)
- Good: React DevTools support for debugging
- Neutral: Two libraries to maintain (Ink + Commander)
- Bad: Known Bun compatibility issue with `useInput` hook
- Bad: React overhead for simpler output scenarios
- Bad: Ink's TypeScript types can be complex

### Option 2: Commander.js Standalone

Lightweight argument parsing library with 238M weekly downloads, using custom streaming output.

- Good: Lightweight (~174KB), minimal dependencies
- Good: Full Bun compatibility confirmed
- Good: Well-documented, mature (10+ years)
- Good: Maximum control over output implementation
- Neutral: Requires building streaming UI from scratch
- Bad: No built-in terminal layout system
- Bad: Manual ANSI handling for rich output
- Bad: Reinventing patterns Claude Code already solved

### Option 3: oclif

Enterprise-grade CLI framework by Salesforce, powering Heroku and Salesforce CLIs.

- Good: Official Bun support as dev runtime
- Good: Plugin architecture for extensibility
- Good: Built-in help generation and completion
- Good: Battle-tested at enterprise scale
- Neutral: Steeper learning curve due to framework conventions
- Bad: Heavier weight—more abstraction than needed
- Bad: Class-based commands create coupling
- Bad: Less aligned with Claude Code's simpler architecture
- Bad: No built-in streaming UI components

### Option 4: Citty (UnJS)

Minimal, modern CLI builder from the UnJS ecosystem.

- Good: Extremely lightweight and modern
- Good: TypeScript-first with good type inference
- Good: Part of well-maintained UnJS ecosystem
- Neutral: Newer library, smaller community
- Bad: No streaming UI components
- Bad: Limited documentation compared to alternatives
- Bad: Would require building all streaming output manually
- Bad: Less proven for complex CLI applications

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | CLI runs entirely on user's machine |
| II. Improvement-Oriented | Yes | Baseline/compare commands directly support improvement cycle |
| III. Causal-First | Yes | trace command enables origin tracing in CLI |
| IV. Mixed-Methods | Yes | Output formats support both human (terminal) and machine (JSON) consumption |
| V. Language-Agnostic | Yes | CLI framework choice doesn't affect analyzed project languages |
| VI. Agent-Agnostic | Yes | Command structure works for any ACT analysis |
| VII. Intelligent Tooling | Yes | CLI serves agent's output needs; streaming enables agent feedback |
| VIII. Compounding Value | Yes | baseline/compare commands enable historical tracking |
| IX. Agent-Aware | Yes | Ink's streaming output optimized for displaying agent reasoning |

## More Information

### Related Documents
- Architecture Vision: [Section 4 - High-Level Architecture](../../vision/agentlint-architecture-vision.md#4-high-level-architecture)
- Design Decisions: [DD-010](../design-decisions.md#dd-010-cli-framework-and-command-structure)
- Prior Decisions: [ADR-0001](./0001-runtime-platform-and-language.md), [ADR-0002](./0002-agentic-framework-strategy.md)

### Research Sources
- [How Claude Code is Built - Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [Ink: React for interactive command-line apps](https://github.com/vadimdemedes/ink)
- [Keep the Terminal Relevant: Patterns for AI Agent Driven CLIs - InfoQ](https://www.infoq.com/articles/ai-agent-cli/)
- [Command Line Interface Guidelines](https://clig.dev/)
- [Commander.js vs Other CLI Frameworks](https://app.studyraid.com/en/read/11908/379336/commanderjs-vs-other-cli-frameworks)
- [npm trends: commander vs oclif vs yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- [Ink Bun Compatibility Issue](https://github.com/oven-sh/bun/issues/6862)
- [oclif: The Open CLI Framework](https://oclif.io/)
- [Citty: Elegant CLI Builder](https://github.com/unjs/citty)

### Implementation Notes

1. **Package Installation**:
   ```bash
   bun add ink ink-spinner commander
   bun add -D @types/ink
   ```

2. **Argument Parsing Strategy**: Use Commander for all argument parsing; Ink for rendering only

3. **Streaming Pattern**: Use Ink's `<Static>` component for permanent output (findings, logs), regular components for live progress

4. **Output Modes**:
   - Default: Rich terminal UI with streaming
   - `--json`: Structured JSON output (bypass Ink rendering)
   - `--plain`: Simple text output for piping
   - `--no-color`: Disable ANSI colors (respect `NO_COLOR` env)

5. **Bun Input Workaround**: For commands requiring user input (e.g., confirmation prompts), consider:
   - Using Commander's built-in prompts instead of Ink's `useInput`
   - Falling back to Node.js for interactive scenarios
   - Adding `--yes` flag to bypass confirmation in scripts

6. **Command Structure Pattern**:
   ```typescript
   // Entry point uses Commander for parsing
   program
     .command('analyse')
     .option('--json', 'Output as JSON')
     .action(async (options) => {
       if (options.json) {
         // Direct JSON output, no Ink
         await runAnalysis({ format: 'json' });
       } else {
         // Render with Ink
         render(<AnalyseUI />);
       }
     });
   ```

7. **Future Considerations**:
   - Monitor Bun's Ink compatibility progress
   - Consider wrapping Ink components for consistent error boundaries
   - DD-011 (Output Format and Rendering) will detail specific rendering patterns
