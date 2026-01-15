# Section 11: Risks and Technical Debt

> Known risks and architectural gaps requiring attention.

**Last Updated**: January 2026
**Related Sections**: [Constraints](02-constraints.md), [Architecture Decisions](09-architecture-decisions.md)

---

## 11.1 SDK Dependencies

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Claude Agent SDK API changes | Medium | Medium | Pin versions; monitor changelog; adapter layer |
| Preview features may change | Medium | Low | Use stable V1 patterns; isolate preview usage |
| Performance differs from expectations | Low | Medium | Benchmark during implementation; fallback patterns |
| API rate limits affect long sessions | Medium | Medium | Backoff strategy; frequent checkpoints; resume |

---

## 11.2 Architecture Gaps

| Gap | Description | Impact | Resolution |
|-----|-------------|--------|------------|
| **Multi-provider abstraction** | Anthropic-only; no LLM provider adapter | Limits future flexibility | Post-MVP: thin provider abstraction |
| **MCP protocol** | Format compatible, not running servers | Cannot share tools with ecosystem | Optional: MCP server mode if needed |
| **Additional adapters** | Only Claude Code for MVP | Limited ACT support | Implement based on user demand |
| **Skills as producer** | Can consume but not produce | Cannot package as skill | Future: expose as SKILL.md |
| **Evaluation framework** | ADR-0012 defines but not implemented | Cannot measure quality | Implement during initial development |

---

## 11.3 Technical Debt Tracking

| Item | Priority | Plan |
|------|----------|------|
| Context compaction testing | High | Verify SDK's ~92% compaction with realistic sessions |
| Large result lifecycle | Medium | Implement TTL or session-scoped cleanup |
| Subagent coordination | Medium | Load test parallel analysis scenarios |

---

## 11.4 Risk Monitoring

**Quarterly Review Items:**
- SDK version compatibility
- API rate limit changes
- New ACT releases requiring adapters
- Community feedback on gaps

---

## References

- [ADR-0002: Agentic Framework](../adr/0002-agentic-framework-strategy.md) - SDK choice rationale
- [ADR-0016: MCP Integration](../adr/0016-mcp-integration-strategy.md) - Protocol decision
