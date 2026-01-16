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

### CLI Error Classes

Located in `src/errors/index.ts`:

```typescript
// Base error with exit code mapping
class AgentlintError extends Error {
  constructor(message: string, public readonly code: ExitCode) {}
}

// Specialized error types
class InvalidArgumentError extends AgentlintError { code = ExitCode.InvalidArgument }
class NetworkError extends AgentlintError { code = ExitCode.NetworkError }
class ChecksumMismatchError extends AgentlintError { code = ExitCode.ChecksumMismatch }

// Exit code constants
const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArgument: 2,
  NetworkError: 3,
  ChecksumMismatch: 4,
} as const;
```

### CLI Exit Codes (EP04)

Located in `src/errors/cli.ts`, CLI-specific exit codes use range 10-19:

```typescript
const CLIExitCode = {
  CommandNotFound: 10,    // Unknown command name
  InvalidOption: 11,      // Invalid flag or option value
  MissingArgument: 12,    // Required argument not provided
  OutputError: 13,        // Output formatting/rendering failed
  UserCancelled: 14,      // User cancelled operation (Ctrl+C)
  FindingsPresent: 15,    // Findings present (with --fail-on-findings)
} as const;
```

| Code | Error Class | Description |
|------|-------------|-------------|
| 10 | `CommandNotFoundError` | Unknown command, suggests available commands |
| 11 | `InvalidOptionError` | Invalid flag value or combination |
| 12 | `MissingArgumentError` | Required positional argument missing |
| 13 | `OutputError` | JSON/Markdown/terminal rendering failed |
| 14 | `UserCancelledError` | User interrupted with SIGINT |
| 15 | `FindingsPresentError` | CI mode exit when findings exist |

Additional CLI error classes:
- `ConfigNotFoundError` - AI config file not found (uses GeneralError)
- `BaselineNotFoundError` - No baseline for compare (uses GeneralError)
- `FindingNotFoundError` - Invalid finding ID for trace (uses GeneralError)

### Tool Error Format

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
| Network error | Graceful message, preserve state |
| Checksum mismatch | Abort operation, clear error |

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
| **Performance** | CLI startup, memory | Threshold-based assertions |

### Performance Tests (EP04)

Located in `tests/performance/`:

| Test | NFR | Target | Approach |
|------|-----|--------|----------|
| `cli-startup.test.ts` | NFR-001 | < 100ms | Measure time to first output |
| `cli-memory.test.ts` | NFR-004 | < 100MB | Track peak memory during streaming |

```typescript
// Example: Startup time test
test('CLI starts within 100ms', async () => {
  const start = performance.now();
  await spawn(['agentlint', '--version']);
  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(100);
});
```

Performance tests run in CI but are excluded from standard `bun test` to avoid flakiness on slow runners.

---

## 8.6 Logging & Observability

| Concern | Approach |
|---------|----------|
| User Output | Streaming via Ink; progressive disclosure |
| Debug Logging | `DEBUG=agentlint:*` environment control |
| Agent Transparency | Tool invocations visible in verbose mode |
| Session Recording | Analysis logged to `.agentlint/session-state/` |

### Color Handling (EP04)

Located in `src/cli/utils/colors.ts`:

**Environment Variables**:
| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Disables all ANSI colors ([no-color.org](https://no-color.org/)) |
| `FORCE_COLOR` | Enables colors even in non-TTY environments |

**Color Levels** (NFR-005):
- Uses ANSI 4-bit colors (16 colors) for maximum terminal compatibility
- Avoids 256-color or true-color codes that may not render correctly
- Chalk configured with `level: 1` when colors enabled

**Severity Colors**:
| Severity | Color | ANSI Code |
|----------|-------|-----------|
| Critical | Red | `\x1b[31m` |
| High | Yellow | `\x1b[33m` |
| Medium | Cyan | `\x1b[36m` |
| Low | Blue | `\x1b[34m` |
| Info | White | `\x1b[37m` |

**Output Mode Detection** (`src/cli/utils/output.ts`):
```typescript
function getOutputMode(options: GlobalOptions): OutputMode {
  if (options.json) return 'json';
  if (options.markdown) return 'markdown';
  if (options.plain) return 'plain';
  if (!process.stdout.isTTY) return 'json';  // Auto-JSON for pipes
  return 'terminal';
}
```

---

## 8.7 Shared Type Definitions

Located in `src/types/index.ts`:

| Type | Purpose |
|------|---------|
| `Platform` | Operating system (`'darwin' \| 'linux'`) |
| `Architecture` | CPU architecture (`'arm64' \| 'x64'`) |
| `Binary` | Compiled executable metadata (platform, arch, checksum, size) |
| `Release` | Versioned distribution (tag, binaries, changelog) |
| `InstallPaths` | Standard installation locations |

These types are shared across CLI, commands, and distribution tooling. See [§5 Building Blocks](05-building-blocks.md) for location in architecture.
