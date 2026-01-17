# Implementation Plan: Config Analysis Tools

> **Epic**: EP05
> **Spec**: specs/ep05-config-analysis/spec.md
> **Created**: 2026-01-17
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Implement the `parse_config` tool and supporting infrastructure that enables the agent to discover, parse, and assess AI Coding Tool (ACT) configuration files.

**Technical Approach**: Use the unified/remark ecosystem (mdast) for markdown parsing, Claude Agent SDK `tool()` pattern for tool definition, and Zod for schema validation. Implement an adapter pattern for multi-ACT support with Claude Code as the primary adapter.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x |
| **Primary Dependencies** | unified, remark, remark-frontmatter, remark-gfm, Zod, Claude Agent SDK |
| **Storage** | In-memory only (no persistence per clarification Q3) |
| **Testing Framework** | Bun test runner |
| **Target Platform** | CLI, Node.js/Bun |
| **Project Type** | CLI Tool with agentic orchestration |
| **Performance Goals** | < 5s scan time (NFR-001), < 50MB memory (NFR-004) |
| **Constraints** | Local-first, no external services |
| **Scale/Scope** | Single developer |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | All parsing local; no data transmission; in-memory only |
| II | Improvement-Oriented | ✓ | Quality metrics enable before/after comparison via baselines |
| III | Causal-First | ✓ | AST position tracking enables precise issue location for tracing |
| IV | Mixed-Methods | ✓ | Quantitative (metrics, scores) + qualitative (anti-patterns) |
| V | Language-Agnostic | ✓ | Config parsing independent of project language |
| VI | Agent-Agnostic | ✓ | Adapter pattern supports Claude Code, AGENTS.md, future ACTs |
| VII | Intelligent Tooling | ✓ | Rich tool descriptions; agent decides what to parse |
| VIII | Compounding Value | ✓ | Quality signals feed baseline tracking (EP09) |
| IX | Agent-Aware | ✓ | Structured output optimized for agent consumption (poka-yoke) |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep05-config-analysis/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Research findings
├── data-model.md     # Entity definitions
├── quickstart.md     # Usage guide
├── contracts/        # API definitions
│   └── interfaces.ts # TypeScript interfaces
└── checklists/
    ├── requirements.md  # Spec quality (complete)
    └── design.md        # Design quality
```

### Source Code Structure (Proposed)

```
src/
├── tools/                    # New directory for EP05+ tools
│   ├── index.ts              # Public exports
│   ├── types.ts              # Tool-specific types
│   ├── config/               # Config analysis tools
│   │   ├── index.ts          # Module exports
│   │   ├── parse-config.ts   # Main parse_config tool
│   │   ├── discovery.ts      # File discovery logic
│   │   ├── metrics.ts        # Metrics extraction
│   │   ├── quality.ts        # Quality assessment
│   │   └── skills.ts         # SKILL.md parsing
│   └── adapters/             # ACT-specific adapters
│       ├── index.ts          # Adapter registry
│       ├── types.ts          # Adapter interface
│       └── claude-code.ts    # Claude Code adapter (MVP)
│       # Note: agents-md.ts deferred to EP08 (ACT Adapters)
├── parsers/                  # Parsing infrastructure
│   ├── index.ts              # Public exports
│   ├── markdown.ts           # mdast/remark wrapper
│   ├── frontmatter.ts        # YAML frontmatter handling
│   └── json-config.ts        # JSON settings parsing
└── orchestration/            # Existing (EP02)
    └── tool-registry.ts      # Register EP05 tools here
```

---

## Complexity Tracking

> No constitution violations—no entries needed

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| Markdown parser | unified/remark + mdast | Battle-tested, position tracking, TypeScript support | ADR-0007 |
| Tool pattern | SDK `tool()` with Zod | Aligns with EP02, type safety, rich descriptions | ADR-0005 |
| Multi-ACT support | Adapter pattern | Agent-agnostic principle; normalize output | ADR-0007 |
| Caching strategy | In-memory only | Parsing is fast (<5s); no persistence overhead | Clarification Q3 |
| Frontmatter | remark-frontmatter | Industry standard, preserves positions | Clarification Q4 |
| SKILL.md format | Parse frontmatter + content | Claude Code standard format | Research |

---

## Architecture Integration

### Tool Layer Position

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER (EP02)                    │
│   Master Agent Loop • Context Management • Tool Selection        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                       TOOL LAYER (EP05+)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    CONFIG ANALYSIS (EP05)                 │   │
│  │  parse_config • discovery • metrics • quality • skills    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   SESSION ANALYSIS (EP06)                 │   │
│  │  search_sessions • get_session_stats • query_git          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   BASELINE TOOLS (EP09)                   │   │
│  │  store_baseline • query_baseline • list_baselines         │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                      ADAPTER LAYER (EP08)                        │
│   Claude Code │ AGENTS.md │ Cursor (future) │ Windsurf (future) │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Registration Flow

```typescript
// src/tools/index.ts - exported and registered in orchestrator setup
import { parseConfigTool, discoverConfigsTool } from './config';

export const configAnalysisTools = [
  parseConfigTool,
  discoverConfigsTool,
];

// Registration happens in orchestrator.ts or main entry point
registry.registerMany(configAnalysisTools);
```

---

## Implementation Phases

### Phase 1: Core Parsing Infrastructure
- Markdown parser wrapper (mdast/remark)
- Frontmatter extraction
- JSON settings validator
- AST position tracking

### Phase 2: Discovery & Detection
- Config file discovery (CLAUDE.md, AGENTS.md, .claude/)
- SKILL.md detection
- Glob-based exclusions (node_modules, .git)
- Hierarchy mapping (global → project → local)

### Phase 3: Metrics & Quality
- Token count estimation
- Structure metrics (sections, depth, code blocks)
- Emphasis marker analysis
- Anti-pattern detection
- Quality scoring

### Phase 4: Tool Integration
- `parse_config` tool definition with Zod schema
- Integration with ToolRegistry
- Large result handling (summarization)
- Error handling patterns

---

## References

- **Spec**: [spec.md](./spec.md)
- **Epic**: [EP05 Config Analysis Tools](../../docs/planning/epics/EP05-config-analysis.md)
- **Arc42**: [§5 Building Blocks](../../docs/architecture/arc42/05-building-blocks.md), [§8 Crosscutting Concepts](../../docs/architecture/arc42/08-crosscutting-concepts.md)
- **ADRs**: [ADR-0005](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md), [ADR-0007](../../docs/architecture/adr/0007-configuration-parser-design.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-17 | Claude | Initial plan |
