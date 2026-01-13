# 3. Context and Scope

This section defines agentlint's boundaries, external interfaces, and integration points.

## 3.1 Business Context

### System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BUSINESS CONTEXT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐          ┌─────────────────┐          ┌──────────────┐  │
│   │  Developer   │──uses───▶│   agentlint     │◀─reads───│ AI Config    │  │
│   │  (Human)     │          │   CLI Tool      │          │ Files        │  │
│   └──────────────┘          └────────┬────────┘          │ (CLAUDE.md,  │  │
│          │                           │                   │ .cursorrules)│  │
│          │                           │                   └──────────────┘  │
│          │                           │                                      │
│          │              ┌────────────┼────────────┐                        │
│          │              │            │            │                        │
│          │              ▼            ▼            ▼                        │
│          │     ┌─────────────┐ ┌──────────┐ ┌──────────────┐               │
│          │     │ LLM Provider│ │ Git Repo │ │ AI Session   │               │
│          │     │ (Anthropic, │ │ (Local)  │ │ Logs         │               │
│          │     │  OpenAI)    │ │          │ │ (JSONL)      │               │
│          │     └─────────────┘ └──────────┘ └──────────────┘               │
│          │                                                                  │
│          │     ┌─────────────────────────────────────────────────────┐     │
│          └────▶│                 Analysis Results                     │     │
│                │  • Findings (issues, patterns)                       │     │
│                │  • Recommendations (actionable improvements)         │     │
│                │  • Baselines (historical comparison)                 │     │
│                │  • Causal Traces (issue origins)                     │     │
│                └─────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### External Actors

| Actor | Type | Interaction |
|-------|------|-------------|
| **Developer** | Human | Runs CLI commands, receives reports, implements recommendations |
| **CI/CD Pipeline** | System | Triggers analysis on PR/push, receives exit codes and artifacts |
| **AI Coding Assistant** | System | Produces session logs and configs that agentlint analyzes |
| **LLM Provider** | Service | Provides agentic reasoning capabilities (required—agent IS the orchestrator) |

### Business Interfaces

| Interface | Direction | Description |
|-----------|-----------|-------------|
| CLI Commands | In | Developer issues commands (`analyse`, `recommend`, `trace`) |
| Terminal Output | Out | Human-readable analysis results |
| JSON/SARIF Output | Out | Machine-readable results for automation |
| PR Comments | Out | Analysis insights posted to pull requests |
| Exit Codes | Out | Semantic status codes for CI/CD integration |

## 3.2 Technical Context

### System Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TECHNICAL CONTEXT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌──────────────────────────┐                       │
│                          │      agentlint CLI       │                       │
│                          │                          │                       │
│  ┌───────────────────────┤  ┌──────────────────┐   │                       │
│  │ INPUTS                │  │  Analysis Agent  │   │                       │
│  │                       │  │  (Orchestrator)  │   │                       │
│  │ • CLAUDE.md          ─┼─▶│                  │   │                       │
│  │ • .cursorrules       ─┼─▶│  ┌────────────┐  │   │                       │
│  │ • .aider/            ─┼─▶│  │ Subagents  │  │   │                       │
│  │ • Session logs (.jsonl)┼─▶│  │ (ADR-0011) │  │   │                       │
│  │ • Git history        ─┼─▶│  └────────────┘  │   │                       │
│  │ • Source code        ─┼─▶│                  │   │                       │
│  │ • Config (.agentlint/)┼─▶│  ┌────────────┐  │   │                       │
│  │                       │  │  │   Tools    │  │   │                       │
│  └───────────────────────┤  │  │            │  │   ├──────────────────────┐│
│                          │  │  │ • Config   │  │   │ OUTPUTS              ││
│  ┌───────────────────────┤  │  │ • Session  │  │   │                      ││
│  │ EXTERNAL SERVICES     │  │  │ • Git      │  │   │ • Terminal report   ─┼┤
│  │                       │  │  │ • Language │  │   │ • JSON output       ─┼┤
│  │ • Anthropic API      ◀┼──│  │ • Search   │  │   │ • SARIF format      ─┼┤
│  │ • OpenAI API         ◀┼──│  └────────────┘  │   │ • JUnit format      ─┼┤
│  │ • Keychain (macOS)   ◀┼──│                  │   │ • Baseline files    ─┼┤
│  │                       │  └──────────────────┘   │ • Exit codes        ─┼┤
│  └───────────────────────┤                         │ • PR comments       ─┼┤
│                          │  ┌──────────────────┐   │ • Notifications     ─┼┤
│                          │  │  SQLite Storage  │   │                      ││
│                          │  │  • Findings      │   └──────────────────────┘│
│                          │  │  • Baselines     │                           │
│                          │  │  • Hindsight     │                           │
│                          │  │  • Cache         │                           │
│                          │  └──────────────────┘                           │
│                          │                                                  │
│                          └──────────────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technical Interfaces

| Interface | Protocol | Format | Description | ADR |
|-----------|----------|--------|-------------|-----|
| **LLM API** | HTTPS | JSON | Vercel AI SDK abstracts provider differences | [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) |
| **File System** | Local | Various | Read AI configs, session logs, source code | [ADR-0003](../adr/0003-local-storage-strategy.md) |
| **Git** | CLI | Text | Query history, blame, diff for causal analysis | [ADR-0007](../adr/0007-causal-analysis-architecture.md) |
| **SQLite** | Local | Binary | Persistent storage for findings, cache | [ADR-0003](../adr/0003-local-storage-strategy.md) |
| **Keychain** | OS API | Binary | Secure credential storage (macOS/Linux) | [ADR-0005](../adr/0005-credential-storage-strategy.md) |
| **GitHub API** | HTTPS | JSON | PR comments, artifact upload | [ADR-0022](../adr/0022-cicd-integration-patterns.md) |
| **Desktop Notify** | OS API | N/A | Native notifications on analysis complete | [ADR-0023](../adr/0023-git-hooks-integration.md) |

## 3.3 AI Tool Support Matrix

agentlint analyzes multiple AI coding assistants:

| AI Tool | Config Files | Session Logs | Detection | ADR |
|---------|--------------|--------------|-----------|-----|
| **Claude Code** | `CLAUDE.md`, `.claude/` | `~/.claude/projects/**/*.jsonl` | High | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| **Cursor** | `.cursorrules`, `.cursor/` | `.cursor/logs/` | High | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| **Aider** | `.aider/`, `.aider.conf.yml` | `.aider/logs/` | High | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| **Cline** | `.cline/`, `.clinerules` | `.cline/tasks/` | Medium | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| **GitHub Copilot** | `.github/copilot-instructions.md` | N/A | Medium | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |
| **Generic** | Various patterns | N/A | Fallback | [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) |

## 3.4 Language Ecosystem Support

agentlint provides language-specific analysis:

| Language | Tier | Analysis Capabilities | ADR |
|----------|------|----------------------|-----|
| **TypeScript** | 1 (Full) | Types, interfaces, modules, test coverage | [ADR-0019](../adr/0019-language-ecosystem-support.md) |
| **JavaScript** | 1 (Full) | ES modules, JSDoc, test frameworks | [ADR-0019](../adr/0019-language-ecosystem-support.md) |
| **Python** | 2 (Standard) | Type hints, docstrings, pytest | [ADR-0019](../adr/0019-language-ecosystem-support.md) |
| **Go** | 3 (Basic) | Packages, interfaces, test files | [ADR-0019](../adr/0019-language-ecosystem-support.md) |
| **Other** | 4 (Minimal) | File patterns, basic metrics | [ADR-0019](../adr/0019-language-ecosystem-support.md) |

## 3.5 Integration Points

### CI/CD Integration

| Platform | Support Level | Integration Method | ADR |
|----------|--------------|-------------------|-----|
| **GitHub Actions** | Full | Official action, PR comments | [ADR-0022](../adr/0022-cicd-integration-patterns.md) |
| **GitLab CI** | Basic | Script-based, .gitlab-ci.yml example | [ADR-0022](../adr/0022-cicd-integration-patterns.md) |
| **Generic CI** | Basic | Exit codes, JSON output | [ADR-0022](../adr/0022-cicd-integration-patterns.md) |

### Git Hooks Integration

| Hook | Purpose | Mode | ADR |
|------|---------|------|-----|
| **post-push** | Primary analysis trigger | Background | [ADR-0023](../adr/0023-git-hooks-integration.md) |
| **post-commit** | Session counter increment | Sync (fast) | [ADR-0023](../adr/0023-git-hooks-integration.md) |
| **pre-commit** | Optional quick check | Opt-in only | [ADR-0023](../adr/0023-git-hooks-integration.md) |

### Framework Compatibility

| Framework | Integration | ADR |
|-----------|-------------|-----|
| **Husky** | Hook script templates | [ADR-0023](../adr/0023-git-hooks-integration.md) |
| **Lefthook** | YAML configuration | [ADR-0023](../adr/0023-git-hooks-integration.md) |
| **pre-commit** | Repo configuration | [ADR-0023](../adr/0023-git-hooks-integration.md) |

## Related ADRs

- [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) - Agent architecture
- [ADR-0018](../adr/0018-ai-tool-adapter-architecture.md) - AI tool adapters
- [ADR-0019](../adr/0019-language-ecosystem-support.md) - Language support
- [ADR-0022](../adr/0022-cicd-integration-patterns.md) - CI/CD integration
- [ADR-0023](../adr/0023-git-hooks-integration.md) - Git hooks
