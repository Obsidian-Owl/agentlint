# 2. Constraints

This section documents technical, organizational, and conventional constraints that shape agentlint's architecture.

## 2.1 Technical Constraints

### Runtime Environment

| Constraint | Description | Rationale | ADR |
|------------|-------------|-----------|-----|
| **Bun Runtime** | TypeScript executed via Bun, not Node.js | <100ms startup, built-in SQLite, native TypeScript | [ADR-0001](../adr/0001-language-and-runtime-selection.md) |
| **Bun ≥1.0** | Minimum Bun version required | API stability, SQLite improvements | [ADR-0001](../adr/0001-language-and-runtime-selection.md) |
| **Cross-platform** | macOS, Linux, Windows support | Target all major development platforms | [ADR-0002](../adr/0002-distribution-and-packaging-strategy.md) |

### Storage

| Constraint | Description | Rationale | ADR |
|------------|-------------|-----------|-----|
| **SQLite Only** | No PostgreSQL/MySQL/external DB | Local-first, zero configuration, portable | [ADR-0003](../adr/0003-local-storage-strategy.md) |
| **WAL Mode** | SQLite Write-Ahead Logging enabled | Concurrent read/write, crash recovery | [ADR-0016](../adr/0016-concurrency-model.md) |
| **XDG Compliance** | Follow XDG Base Directory spec | Standard config/data/cache locations | [ADR-0004](../adr/0004-configuration-file-locations.md) |

### Dependencies

| Constraint | Description | Rationale | ADR |
|------------|-------------|-----------|-----|
| **Open Source Only** | All dependencies must be OSS | Distribution freedom, auditability | [ADR-0001](../adr/0001-language-and-runtime-selection.md) |
| **Permissive License** | Prefer Apache 2.0/MIT licensed deps | Commercial use compatibility | [ADR-0001](../adr/0001-language-and-runtime-selection.md) |
| **Minimal Dependencies** | Avoid bloat, prefer built-ins | Fast install, reduced attack surface | [ADR-0001](../adr/0001-language-and-runtime-selection.md) |

### LLM Integration

| Constraint | Description | Rationale | ADR |
|------------|-------------|-----------|-----|
| **User-Provided API Keys** | No bundled API keys or proxy | Cost clarity, no vendor dependency | [ADR-0005](../adr/0005-credential-storage-strategy.md) |
| **Multi-Provider** | Support Anthropic + OpenAI minimum | User choice, avoid lock-in | [ADR-0006](../adr/0006-agent-orchestrated-analysis.md) |
| **Interactive Setup** | Prompt to configure LLM credentials on first use | User-friendly onboarding | [ADR-0005](../adr/0005-credential-storage-strategy.md) |

## 2.2 Organizational Constraints

### Team Structure

| Constraint | Description | Impact |
|------------|-------------|--------|
| **Small Core Team** | Initial development by small team | Prefer simplicity over flexibility |
| **No Plugin Ecosystem** | Core team maintains all components | Compiled-in adapters only ([ADR-0028](../adr/0028-agent-modularity-and-extension-pattern.md)) |
| **Community Contributions** | Accept PRs, but core team reviews | Quality control over all code |

### Development Process

| Constraint | Description | Impact |
|------------|-------------|--------|
| **ADR-Driven Design** | Major decisions documented as ADRs | Explicit reasoning, traceable history |
| **Constitution Compliance** | All decisions align with 9 principles | Consistent architectural direction |
| **Test Pyramid** | 4-layer testing (unit → component → integration → eval) | Quality assurance ([ADR-0013](../adr/0013-testing-strategy.md)) |

### Security

| Constraint | Description | Impact |
|------------|-------------|--------|
| **No Code Execution** | Never execute analyzed code | Safe analysis of untrusted repos |
| **Credential Isolation** | API keys in env vars or keychain only | No credentials in logs or config |
| **Read-Only Analysis** | Never modify user's source code | Trust and predictability |

## 2.3 Conventions

### Configuration

| Convention | Description | ADR |
|------------|-------------|-----|
| **TOML Format** | Config files use TOML syntax | [ADR-0004](../adr/0004-configuration-file-locations.md) |
| **Cascading Config** | Global → Project config hierarchy | [ADR-0004](../adr/0004-configuration-file-locations.md) |
| **`.agentlint/` Directory** | Project config in dedicated directory | [ADR-0004](../adr/0004-configuration-file-locations.md) |

### CLI Design

| Convention | Description | ADR |
|------------|-------------|-----|
| **Subcommand Pattern** | `agentlint <command> [options]` style | [ADR-0024](../adr/0024-cli-design-and-help-system.md) |
| **Exit Code Semantics** | 0=success, 1-4=specific failures | [ADR-0020](../adr/0020-output-formats-and-execution-ux.md) |
| **Non-Blocking Default** | Never block git/CI by default | [ADR-0022](../adr/0022-cicd-integration-patterns.md) |

### Output Formats

| Convention | Description | ADR |
|------------|-------------|-----|
| **JSON for Machines** | Structured output via `--output-format json` | [ADR-0020](../adr/0020-output-formats-and-execution-ux.md) |
| **SARIF for IDE** | Static analysis results format | [ADR-0020](../adr/0020-output-formats-and-execution-ux.md) |
| **Markdown for Humans** | Rich text output for reports | [ADR-0020](../adr/0020-output-formats-and-execution-ux.md) |

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Commands | Lowercase, hyphenated | `agentlint analyse`, `agentlint cache-clear` |
| Config keys | snake_case | `analysis.session_depth` |
| TypeScript types | PascalCase | `AnalysisResult`, `AIToolAdapter` |
| TypeScript functions | camelCase | `parseConfig()`, `analyzeSession()` |

## 2.4 Constraint Hierarchy

When constraints conflict, prioritize in this order:

1. **Security** - Never compromise user safety
2. **Privacy (Local-First)** - User data sovereignty is non-negotiable
3. **Simplicity** - Simpler solutions preferred
4. **Performance** - Speed matters for developer experience
5. **Flexibility** - Adapt when possible without sacrificing above

## Related ADRs

All ADRs are implicitly related to constraints. Key references:
- [ADR-0001](../adr/0001-language-and-runtime-selection.md) - Runtime constraints
- [ADR-0003](../adr/0003-local-storage-strategy.md) - Storage constraints
- [ADR-0005](../adr/0005-credential-storage-strategy.md) - Security constraints
- [ADR-0028](../adr/0028-agent-modularity-and-extension-pattern.md) - Extension constraints
