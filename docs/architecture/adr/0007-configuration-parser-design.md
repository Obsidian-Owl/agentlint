---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0007: Configuration Parser Design

## Context and Problem Statement

agentlint must parse AI Coding Tool (ACT) configuration files—CLAUDE.md, .cursorrules, .cursor/rules/*.mdc, and future formats—to extract quality signals for analysis. These files vary in structure but share common patterns. We need an architecture that supports multiple ACT types while focusing MVP implementation on Claude Code.

## Decision Drivers

- **Agent-Agnostic Architecture**: Must support Claude Code, Cursor, Windsurf, Copilot, and future ACTs
- **Quality Signal Extraction**: Parser must extract signals that correlate with configuration effectiveness
- **Structural Analysis Focus**: Extract structure, metrics, patterns—not semantic understanding
- **MVP Scope**: Implement Claude Code adapter first; others via community contribution
- **TypeScript/Bun Alignment**: Must work with existing runtime decisions (ADR-0001)

## Considered Options

1. mdast + Adapter Pattern
2. Per-Format Custom Parsers
3. Regex + Heuristics
4. Tree-sitter Grammar

## Decision Outcome

**Chosen option: "mdast + Adapter Pattern"**

We will use the unified/remark ecosystem to parse markdown-based configurations into an Abstract Syntax Tree (mdast), then traverse that tree to extract quality signals. Each ACT type gets its own adapter that implements a common interface, normalizing output regardless of source format.

**Why this approach:**

1. **Proven ecosystem**: remark/mdast has 24M+ weekly downloads, handles edge cases we'd otherwise have to solve ourselves (nested code blocks, escaped characters, frontmatter)

2. **TypeScript-native**: Full type definitions work seamlessly with our Bun runtime

3. **Extensible by design**: The adapter pattern means adding Cursor or Windsurf support doesn't touch core parsing logic—just add a new adapter

4. **Structural analysis fit**: AST traversal is perfect for counting headings, measuring sections, finding patterns—exactly the structural analysis we need

5. **Position tracking**: AST nodes include line/column positions, enabling precise warning locations for causal tracing

**What we extract:**

Research identified these quality signals that correlate with effective configurations:

- **Size metrics**: Line count, token estimate, code block density
- **Structure**: Section hierarchy, WHAT/WHY/HOW coverage, heading depth
- **Content patterns**: Build/test commands, file references, emphasis markers
- **Anti-patterns**: Generic rules, embedded secrets, linter jobs, instruction overload

### Consequences

**Good:**
- Battle-tested parsing handles markdown edge cases automatically
- New ACT adapters can be added without core changes
- Normalized output enables cross-ACT comparison in baselines
- Extensions for frontmatter and GFM cover all current ACT formats

**Bad:**
- Dependency on unified ecosystem (~5 packages)
- Non-markdown formats need separate handling
- More complex than regex for trivial extractions

**Neutral:**
- Quality signal schema will evolve as we learn what matters most
- Cursor's .mdc format uses frontmatter—covered by remark-frontmatter extension

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All parsing happens locally |
| II. Improvement-Oriented | Yes | Quality signals enable before/after comparison |
| III. Causal-First | Yes | AST positions enable precise issue location |
| IV. Mixed-Methods | Yes | Extracts quantitative (metrics) and qualitative (patterns) |
| V. Language-Agnostic | Yes | Handles configs regardless of project language |
| VI. Agent-Agnostic | Yes | Adapter pattern explicitly supports multiple ACTs |
| VII. Intelligent Tooling | Yes | Rich extraction enables agent reasoning about quality |
| VIII. Compounding Value | Yes | Quality signals tracked across baselines |
| IX. Agent-Aware | Yes | Normalized output optimized for agent consumption |

## More Information

### Research-Backed Quality Thresholds

Based on research from Anthropic, HumanLayer, Arize, and community best practices:

| ACT | Recommended Lines | Max Lines | Notes |
|-----|------------------|-----------|-------|
| Claude Code | < 60 | 300 | "Less is more" - HumanLayer |
| Cursor | < 100 per file | 500 | Split across .mdc files |
| Generic | < 80 | 300 | Conservative default |

Token weight classes:
- **Lightweight** (< 3k tokens): Optimal for multi-agent workflows
- **Medium** (3k-15k tokens): Acceptable for single-agent use
- **Heavy** (> 25k tokens): Creates bottlenecks, likely ignored

### Key Anti-Patterns to Detect

1. **Generic rules**: "Write clean code" wastes tokens without guidance
2. **Linter jobs**: Style rules belong in ESLint/Prettier, not config
3. **Instruction overload**: Models reliably follow ~150-200 instructions max
4. **Embedded secrets**: API keys, passwords must never appear
5. **Code snippets**: Use file:line references instead—snippets go stale

### Related Documents

- Design Decisions: [DD-006](../design-decisions.md#dd-006-configuration-parser-design)
- Implementation Reference: [Configuration Parser Implementation](./references/0007-config-parser-implementation.md)
- Prior Decisions: [ADR-0001](./0001-runtime-platform-and-language.md), [ADR-0005](./0005-tool-definition-and-invocation-pattern.md)

### Research Sources

- [Claude Code: Best practices for agentic coding - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Writing a good CLAUDE.md - HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Optimizing Coding Agent Rules - Arize AI](https://arize.com/blog/optimizing-coding-agent-rules-claude-md-agents-md-clinerules-cursor-rules-for-improved-accuracy/)
- [mdast - Markdown Abstract Syntax Tree](https://github.com/syntax-tree/mdast)
- [remark - unified markdown processor](https://unifiedjs.com/explore/package/remark/)
