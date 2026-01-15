# Section 2: Constraints

> Technical, organizational, and conventional boundaries shaping agentlint's architecture.

**Last Updated**: January 2026
**Related Sections**: [Solution Strategy](04-solution-strategy.md), [Architecture Decisions](09-architecture-decisions.md)

---

## 2.1 Technical Constraints

| Constraint | Rationale | Source |
|------------|-----------|--------|
| TypeScript + Bun | Claude Code's proven stack; native compile | [ADR-0001](../adr/0001-runtime-platform-and-language.md) |
| Claude Agent SDK | Same infrastructure as Claude Code | [ADR-0002](../adr/0002-agentic-framework-strategy.md) |
| Anthropic-only (MVP) | Development velocity; deep optimization | [ADR-0002](../adr/0002-agentic-framework-strategy.md) |
| CLI-only interface | Focus on core value | Constitution Non-Goals |
| Local filesystem | Privacy-first; no cloud dependencies | Constitution Principle I |
| SQLite for indexing | Bun's built-in `bun:sqlite` | [ADR-0006](../adr/0006-session-log-processing-architecture.md) |

---

## 2.2 Organizational Constraints

| Constraint | Rationale |
|------------|-----------|
| Design-first approach | Comprehensive documentation before implementation |
| Constitutional governance | 9 principles guide all decisions |
| ADR-driven decisions | Major technical choices formally documented |
| MVP scope focus | Core value delivery before expansion |

---

## 2.3 Conventions

| Area | Convention |
|------|------------|
| **Code Style** | TypeScript strict mode; ESLint + Prettier |
| **Documentation** | Markdown; progressive disclosure structure |
| **Architecture** | Single-threaded master loop (Claude Code pattern) |
| **Tool Design** | Poka-yoke; rich descriptions for agent comprehension |
| **Naming** | camelCase (code); kebab-case (files) |

---

## Non-Goals (MVP)

These are explicitly out of scope:

- Web Dashboard
- SaaS Backend
- Real-Time Analysis
- Enterprise Governance
- IDE Plugins
- Cross-Machine Sync
