# Future Considerations

This document collects future architectural considerations that are explicitly deferred from current ADRs. These are not blocking MVP implementation but represent potential future enhancements.

## Agentic Plan Caching (from ADR-0021)

Recent research (NeurIPS 2025) introduces a new paradigm: **Agentic Plan Caching** (APC). Unlike query-level caching (suitable for chatbots), APC operates at the task level—caching reusable plan templates that can be adapted for similar tasks.

### How APC differs from current layers

| Aspect | Current Prompt Caching (Layer 3) | Agentic Plan Caching |
|--------|----------------------------------|----------------------|
| What's cached | Prompt prefixes (exact match) | Task templates (semantic match) |
| Matching | Exact prefix match | Keyword extraction |
| Adaptation | None (must match exactly) | Small model adapts template to context |
| Scope | Within-session reuse | Cross-session reuse |

### Potential benefits

- 46-50% additional cost reduction on top of prompt caching
- Reuse planning work across similar analysis tasks
- Reduce "cold start" latency for common analysis patterns

### Why this isn't implemented now

- Requires infrastructure for template extraction and storage
- Needs semantic matching beyond exact-prefix
- Current prompt caching already delivers 90% savings

This could be a **Layer 5** in future iterations, complementing rather than replacing the current architecture. See [arXiv: Agentic Plan Caching](https://arxiv.org/abs/2506.14852) for details.

## Other Deferred Decisions

### From ADR-0012: Incremental Analysis Strategy

1. **Watch Mode Implementation**: Full file system watching for continuous mode
2. **IDE Integration**: VS Code extension with status bar indicator

### From ADR-0017: Versioning and Migration

1. **Baseline Retention Policy**: Configurable retention periods for historical baselines

### From Design Questions

1. **Pricing Model**: Post-MVP business model considerations
2. **MCP Server Mode**: agentlint as Model Context Protocol server
3. **IDE Extensions**: VS Code, Cursor, JetBrains integrations
