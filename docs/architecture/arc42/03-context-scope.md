# Section 3: Context and Scope

> System boundaries, external interfaces, and integration points.

**Last Updated**: January 2026
**Related Sections**: [Building Blocks](05-building-blocks.md), [Deployment](07-deployment-view.md)

---

## 3.1 Business Context

```
                              ┌─────────────────────────────────┐
                              │         agentlint               │
    ┌─────────────┐           │                                 │
    │  Developer  │◄─────────►│  Local CLI Analysis Tool        │
    │   (User)    │  CLI      │                                 │
    └─────────────┘           └──────────┬──────────────────────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │                              │                              │
          ▼                              ▼                              ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  AI Coding Tools    │     │   Project Files     │     │   Anthropic API     │
│  (Claude Code,      │     │   (Configs, Logs,   │     │   (LLM Provider)    │
│   Cursor, etc.)     │     │    Git History)     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### External Interfaces

| Entity | Input to agentlint | Output from agentlint |
|--------|-------------------|----------------------|
| **Developer** | CLI commands, API key, decisions | Results, recommendations, baselines |
| **AI Coding Tools** | Config files, session logs | None (read-only) |
| **Project Files** | Source, docs, git history | `.agentlint/` storage only |
| **Anthropic API** | LLM responses | Prompts, tool calls |

---

## 3.2 Technical Context

```
┌─────────────────────────────────────────────────────────────────────┐
│                            agentlint                                 │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                 │
│  │  CLI (Ink) │───►│ Agent Loop │───►│   Tools    │                 │
│  └────────────┘    └────────────┘    └────────────┘                 │
│                           │                 │                        │
│                           ▼                 ▼                        │
│                    ┌─────────────────────────────┐                   │
│                    │     Adapter Layer           │                   │
│                    │  Claude Code │ Generalized  │                   │
│                    └─────────────────────────────┘                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   Filesystem           SQLite DBs         Anthropic API
   (local)              (local)            (HTTPS)
```

### Channels

| Channel | Protocol | Data Format |
|---------|----------|-------------|
| User CLI | Stdin/Stdout | Text (Ink), JSON, Markdown |
| Anthropic API | HTTPS + SSE | JSON (Messages API) |
| Filesystem | Direct | JSON, JSONL, Markdown |
| SQLite | `bun:sqlite` | SQL (FTS5 for search) |

---

## Data Flow Summary

1. **User** invokes CLI command
2. **Agent** orchestrates analysis via tools
3. **Tools** query adapters for ACT-specific data
4. **Adapters** normalize config/log formats
5. **Agent** synthesizes findings, generates recommendations
6. **CLI** renders results to user
