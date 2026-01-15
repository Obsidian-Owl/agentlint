# Section 8: Crosscutting Concepts

> Patterns and approaches applied across multiple building blocks.

**Last Updated**: January 2026
**Related Sections**: [Building Blocks](05-building-blocks.md), [Quality Requirements](10-quality-requirements.md)

---

## 8.1 Domain Model

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Baseline   │◄───►│   Analysis   │────►│Recommendation│
│ • metrics    │     │ • findings   │     │ • evidence   │
│ • config     │     │ • issues     │     │ • status     │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Session    │────►│    Issue     │     │   Learning   │
│ • tokens     │     │ • origin     │     │ • scope      │
│ • iterations │     │ • severity   │     │ • pattern    │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 8.2 Security Concept

| Aspect | Approach |
|--------|----------|
| **Data Privacy** | Local-first; all storage in `.agentlint/` |
| **API Credentials** | User-provided via `ANTHROPIC_API_KEY` |
| **Secret Detection** | Identify but never store ([ADR-0013](../adr/0013-secret-detection-strategy.md)) |
| **File Access** | Read project; write only to `.agentlint/` |
| **Telemetry** | Zero usage tracking |

---

## 8.3 Error Handling

```typescript
interface ToolError {
  error: true;
  message: string;      // Human-readable
  suggestion: string;   // Actionable guidance
  recoverable: boolean; // Can analysis continue?
}
```

| Error Type | Response |
|------------|----------|
| File not found | Suggest correct path, continue |
| Parse error | Return partial, flag issue |
| API error | Retry with backoff, checkpoint |
| Not indexed | Suggest `agentlint scan` |

---

## 8.4 Context Management

Following Claude Code patterns:

| Strategy | Implementation |
|----------|----------------|
| **Hierarchical Workspace** | Task → Context → Progress → Findings → Baseline |
| **Static Pre-Processing** | Tools extract before agent receives |
| **Incremental Loading** | Load on demand, not upfront |
| **Compression Triggers** | Auto-summarize near limit |
| **Priority Preservation** | Goals, errors, decisions always retained |
| **Large Results** | Summarize + store, retrieve on demand |

---

## 8.5 Testing Strategy

| Type | Scope | Approach |
|------|-------|----------|
| **Unit** | Functions, parsers | Jest/Vitest patterns |
| **Integration** | Tool + adapter | Fixture-based |
| **Evaluation** | Agent reasoning | LLM-as-judge ([ADR-0012](../adr/0012-evaluation-framework-for-analysis-quality.md)) |
| **E2E** | Full CLI | Real project fixtures |
| **Snapshot** | Output format | Golden file comparison |

---

## 8.6 Logging & Observability

| Concern | Approach |
|---------|----------|
| User Output | Streaming via Ink; progressive disclosure |
| Debug Logging | `DEBUG=agentlint:*` environment control |
| Agent Transparency | Tool invocations visible in verbose mode |
| Session Recording | Analysis logged to `.agentlint/session-state/` |
