# Section 4: Solution Strategy

> Fundamental decisions and solution approaches driving agentlint's architecture.

**Last Updated**: January 2026
**Related Sections**: [Building Blocks](05-building-blocks.md), [Architecture Decisions](09-architecture-decisions.md)

---

## Core Strategy: Two-Layer Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENTIC REASONING LAYER                      │
│  • Semantic understanding • Quality judgments                   │
│  • Causal analysis • Context-aware recommendations              │
├─────────────────────────────────────────────────────────────────┤
│                    STATIC ANALYSIS LAYER                        │
│  • Fast, deterministic extraction • Config parsing              │
│  • Session metrics • Git queries • Doc structure                │
└─────────────────────────────────────────────────────────────────┘
```

**Key Insight**: Neither layer is privileged. The agent decides which approach serves each task best.

---

## Quality Goal Mapping

| Quality Goal        | Strategic Approach                       |
| ------------------- | ---------------------------------------- |
| Privacy/Local-First | All processing local; user-owned API key |
| Reliability         | Checkpointing; graceful degradation      |
| Extensibility       | Adapter pattern for ACTs                 |
| Performance         | Static tools for speed; agent for depth  |
| Maintainability     | 6-layer separation; >80% coverage        |

---

## Technology Stack

| Decision     | Choice                          | Rationale                                                  |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| Runtime      | TypeScript + Bun                | Claude Code's proven stack                                 |
| Framework    | Opencode SDK (@opencode-ai/sdk) | Unified SDK for AI coding tools; replaces Claude Agent SDK |
| CLI          | Ink + Commander.js              | React-based terminal UI                                    |
| Tools        | SDK `tool()` + Zod              | Type-safe, MCP-compatible                                  |
| Search       | SQLite FTS5                     | Full-text with BM25 ranking                                |
| Storage      | JSON + SQLite index             | Human-readable + fast queries                              |
| Distribution | Bun compile                     | Native binary; `curl \| bash` install                      |

---

## Reference Pattern: Claude Code

agentlint explicitly adopts Claude Code's proven patterns:

| Pattern                        | Implementation                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `while(tool_use)` loop         | Master agent loop                                                                    |
| Gather → Act → Verify → Repeat | Analysis feedback cycle                                                              |
| Subagent depth limits          | Bounded delegation (single level)                                                    |
| Rich tool descriptions         | Poka-yoke design ([ADR-0005](../adr/0005-tool-definition-and-invocation-pattern.md)) |
| Context compaction             | Hierarchical cognitive workspace                                                     |
| Human-in-the-loop              | Recommendation system, not automation                                                |

---

## Causal Analysis Model

```
DETECT → TRACE → UNDERSTAND → RECOMMEND
   │        │          │           │
   │        │          │           └─ Preventive changes
   │        │          └─ Identify the gap
   │        └─ Search sessions/git for origin
   └─ Static or agent identifies issue
```

This is agentlint's key differentiator: tracing to origin enables prevention.
