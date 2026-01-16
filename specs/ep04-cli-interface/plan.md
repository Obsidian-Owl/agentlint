# Implementation Plan: CLI Interface & Commands

> **Epic**: EP04
> **Spec**: specs/ep04-cli-interface/spec.md
> **Created**: 2026-01-16
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Implement the command-line interface for agentlint using Ink (React-based terminal UI) and Commander.js for argument parsing, providing the user-facing entry point for all analysis workflows with streaming output, progress indicators, and multiple output formats.

**Technical Approach**: Use Commander.js for argument parsing and Ink for terminal rendering. The CLI invokes the EP02 orchestration layer for analysis and uses EP03 persistence for baseline storage. Output modes are determined by flags and TTY detection, with graceful degradation to JSON for non-TTY contexts.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x with Bun runtime |
| **Primary Dependencies** | Ink v4.x, @inkjs/ui, Commander.js, chalk |
| **Storage** | EP03 Persistence (SQLite indexes + JSON files) |
| **Testing Framework** | Bun test |
| **Target Platform** | CLI, Bun runtime (Node.js 22+ compatible) |
| **Project Type** | CLI Tool |
| **Performance Goals** | < 100ms command startup, < 100MB peak memory |
| **Constraints** | No interactive input (Bun/Ink useInput bug); local-first |
| **Scale/Scope** | Single developer workstation |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ | CLI runs entirely on user's machine; no data transmission |
| II | Improvement-Oriented | ✅ | baseline/compare commands support continuous improvement cycle |
| III | Causal-First | ✅ | trace command visualizes issue → origin → recommendation chain |
| IV | Mixed-Methods | ✅ | Multiple output formats (terminal, JSON, Markdown) for human + machine |
| V | Language-Agnostic | ✅ | CLI framework independent of analyzed project language |
| VI | Agent-Agnostic | ✅ | Command structure works for any ACT via adapters |
| VII | Intelligent Tooling | ✅ | CLI serves agent output needs; streaming displays agent reasoning |
| VIII | Compounding Value | ✅ | baseline history enables trend tracking over time |
| IX | Agent-Aware | ✅ | Streaming output optimized for displaying agent progress |

**Gate Status**: [✅] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep04-cli-interface/
├── spec.md           # Feature specification
├── plan.md           # This file
├── research.md       # Research findings (Phase 1)
├── data-model.md     # Entity definitions (Phase 2)
├── quickstart.md     # Usage guide (Phase 2)
├── contracts/        # API definitions (Phase 2)
│   └── interfaces.ts # TypeScript interface definitions
└── checklists/       # Validation checklists
    ├── requirements.md
    └── design.md
```

### Source Code Structure (Proposed)

```
src/
├── cli/                      # EP04: CLI components
│   ├── index.ts              # Public exports
│   ├── program.ts            # Commander.js program setup
│   ├── commands/             # Command implementations
│   │   ├── scan.ts           # agentlint scan
│   │   ├── analyse.ts        # agentlint analyse
│   │   ├── baseline.ts       # agentlint baseline
│   │   ├── compare.ts        # agentlint compare
│   │   ├── recommend.ts      # agentlint recommend
│   │   ├── trace.ts          # agentlint trace
│   │   ├── validate.ts       # agentlint validate
│   │   └── learn.ts          # agentlint learn (subcommands)
│   ├── components/           # Ink React components
│   │   ├── App.tsx           # Root application component
│   │   ├── Progress.tsx      # Progress indicators
│   │   ├── FindingsList.tsx  # Findings display
│   │   ├── CausalTree.tsx    # Tree visualization
│   │   ├── Summary.tsx       # Analysis summary
│   │   └── CompareView.tsx   # Delta comparison view
│   ├── formatters/           # Output formatters
│   │   ├── json.ts           # JSON/JSON Lines formatter
│   │   ├── markdown.ts       # Markdown formatter
│   │   └── plain.ts          # Plain text formatter
│   └── utils/                # CLI utilities
│       ├── output.ts         # Output mode detection
│       ├── colors.ts         # Color support (NO_COLOR aware)
│       └── terminal.ts       # Terminal width/capability detection
├── orchestration/            # EP02: Agent orchestration (existing)
├── persistence/              # EP03: Storage layer (existing)
└── cli.ts                    # Entry point (existing, to be enhanced)
```

---

## Complexity Tracking

> No constitution violations identified

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|
| - | - | - | - |

---

## Key Design Decisions

| Decision | Choice | Rationale | ADR |
|----------|--------|-----------|-----|
| CLI Framework | Ink + Commander.js | Same architecture as Claude Code; proven for agentic CLIs | ADR-0003 |
| Output Rendering | @inkjs/ui + Custom CausalTree | Reuse battle-tested components; custom tree for core differentiator | ADR-0004 |
| JSON Streaming | JSON Lines format | One object per line for jq compatibility during streaming | ADR-0004 |
| Exit Codes | 0=success, 1=error | Unix standard; --fail-on-findings for CI | spec.md |
| No Interactive Input | Flags-only interface | Bun/Ink useInput bug; output-focused tool | ADR-0003 |
| Default Output | Full analysis (config + sessions) | Most common use case; narrow with flags | spec.md |

---

## Integration Points

### EP02 Orchestration Integration

```typescript
// CLI invokes orchestrator for analysis
import { createOrchestrator, createToolRegistry } from '../orchestration';

const registry = createToolRegistry();
const orchestrator = createOrchestrator(config, registry);

for await (const chunk of orchestrator.run(task)) {
  // Render StreamChunks via Ink or JSON formatter
}
```

### EP03 Persistence Integration

```typescript
// Baseline operations
import { saveBaseline, getLatest, compareBaselines } from '../persistence';

// Learn operations
import { saveLearning, queryLearnings, listAllLearnings } from '../persistence';

// Session recovery
import { findIncomplete, loadSessionState } from '../persistence';
```

---

## References

- **Spec**: [specs/ep04-cli-interface/spec.md](./spec.md)
- **Epic**: [EP04 CLI Interface & Commands](../../docs/planning/epics/EP04-cli-interface.md)
- **Arc42**: Section 6 (Runtime View), Section 8 (Cross-cutting Concerns)
- **ADRs**: [ADR-0003](../../docs/architecture/adr/0003-cli-framework-and-command-structure.md), [ADR-0004](../../docs/architecture/adr/0004-output-format-and-rendering.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-16 | Claude | Initial plan |
