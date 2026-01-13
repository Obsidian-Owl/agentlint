---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0025: Logging and Debugging Strategy

## Context and Problem Statement

agentlint needs a comprehensive logging and debugging strategy to support:

1. **User troubleshooting** - When analysis fails or produces unexpected results
2. **Developer debugging** - During development and bug investigation
3. **Performance profiling** - Understanding where time is spent (especially LLM calls)
4. **Audit/diagnostics** - Validating environment setup and configuration

This ADR establishes:
- Logging library selection
- Log level hierarchy and flag mapping
- Stream separation (stdout vs stderr)
- Diagnostic command design
- What information to log (and what to exclude for security)

### Prior ADR Influences

| ADR | Influence |
|-----|-----------|
| ADR-0001 | Bun runtime - logger must be Bun-compatible |
| ADR-0003 | XDG paths for log file storage if needed |
| ADR-0020 | Output modes, --quiet flag |
| ADR-0024 | Global CLI flags including --verbose, --quiet, command structure |

## Decision Drivers

- **Bun compatibility**: Must work natively with Bun runtime (ADR-0001)
- **TypeScript-first**: Strong typing for log levels and configuration
- **CLI integration**: Good terminal output formatting with color support
- **Zero/minimal dependencies**: Align with lightweight runtime approach
- **Developer experience**: Easy to use, informative output
- **Security**: Logs must be safe to share (no secrets, API keys, sensitive data)
- **Performance**: Logging overhead should be negligible

## Considered Options

### Logging Library
1. **Consola** - TypeScript-first, CLI integration, UnJS ecosystem
2. **Pino** - Fastest Node.js logger, structured JSON output
3. **LogTape** - Zero dependencies, Bun/Deno/Node native
4. **Custom wrapper** - Minimal implementation over console.*

### Verbosity Mode Design
1. **Tiered levels** - quiet → default → verbose → debug
2. **Binary toggle** - verbose on/off
3. **Stacked flags** - -v, -vv, -vvv

### Diagnostic Command
1. **agentlint doctor** - npm doctor pattern
2. **agentlint diagnose** - Alternative naming
3. **No diagnostic command** - Rely on --debug output

## Decision Outcome

Chosen options:
- **Logging Library**: Consola
- **Verbosity Mode Design**: Tiered levels
- **Diagnostic Command**: `agentlint doctor`

### Rationale

**Consola** is the optimal choice because:
- TypeScript-first with excellent type definitions
- Part of UnJS ecosystem (same team as Nitro, Nuxt) - well-maintained
- Built-in CLI integration with fancy/basic reporters
- Bun-compatible (tested and documented)
- Browser-compatible (useful for future web UI)
- Supports log level configuration via environment variables
- Zero external dependencies in core

**Tiered levels** provide:
- Clear mental model for users
- Granular control from production to deep debugging
- Consistency with other CLI tools (npm, git)

**`agentlint doctor`** provides:
- Familiar pattern from npm doctor
- Proactive validation of environment and configuration
- Self-service troubleshooting before opening issues

---

## Detailed Design

### Log Level Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOG LEVEL HIERARCHY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Level    │ Consola Level │ CLI Flag   │ Env Var              │ Use Case   │
│  ─────────┼───────────────┼────────────┼──────────────────────┼──────────  │
│  silent   │ -1            │ --silent   │ AGENTLINT_LOG=-1     │ No output  │
│  error    │ 0             │ --quiet    │ AGENTLINT_LOG=0      │ Errors     │
│  warn     │ 1             │ (default)  │ AGENTLINT_LOG=1      │ + Warnings │
│  info     │ 3             │ (default)  │ AGENTLINT_LOG=3      │ + Info     │
│  debug    │ 4             │ --verbose  │ AGENTLINT_LOG=4      │ + Debug    │
│  trace    │ 5             │ --debug    │ AGENTLINT_LOG=5      │ + Trace    │
│                                                                             │
│  Default level: info (3)                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CLI Flag Mapping

| Flag | Effect | Log Level |
|------|--------|-----------|
| `--silent` | Suppress all output except fatal errors | -1 |
| `--quiet, -q` | Errors only | 0 |
| (default) | Info + warnings + errors | 3 |
| `--verbose, -v` | Debug information | 4 |
| `--debug` | Trace-level diagnostics + internal state | 5 |

**Flag precedence**: `--debug` > `--verbose` > `--quiet` > `--silent`

If conflicting flags are provided, the most verbose wins (user wants more info).

### Stream Separation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STREAM SEPARATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  stdout (normal output)          │  stderr (diagnostic output)              │
│  ────────────────────────────────┼────────────────────────────────────────  │
│  • Analysis results              │  • Error messages                        │
│  • JSON/SARIF/JUnit output       │  • Warnings                              │
│  • Recommendations               │  • Debug/trace logs                      │
│  • Progress indicators           │  • Performance timing                    │
│  • Interactive prompts           │  • Stack traces                          │
│                                  │  • LLM call diagnostics                  │
│                                                                             │
│  Rationale: Allows piping/redirecting results while seeing diagnostics     │
│  Example: agentlint analyse --output-format json > results.json            │
│           (errors/warnings still visible in terminal)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Logged Information Categories

#### Always Logged (info level)
- Analysis start/complete
- Number of files analysed
- Summary of findings (X issues, Y recommendations)
- LLM provider being used (not API key)

#### Debug Level (--verbose)
- Analysis stage transitions
- Files being processed
- Cache hits/misses
- LLM request/response timing (not content)
- Configuration values loaded

#### Trace Level (--debug)
- Full LLM prompts (sanitised - no secrets)
- LLM response content
- Token counts and cost estimates
- Internal state transitions
- Detailed timing breakdowns
- Stack traces on warnings (not just errors)

#### Never Logged (Security)
- API keys or tokens
- Full file contents (only paths)
- Environment variables containing secrets
- Git credentials
- User home directory in full paths

### Security: Log Sanitisation

```typescript
// Patterns that are ALWAYS redacted in logs
const REDACTED_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|token|password|credential)[\s]*[=:]\s*["']?[^"'\s]+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI API keys
  /anthropic-[a-zA-Z0-9]{20,}/g,    // Anthropic API keys
  /Bearer\s+[a-zA-Z0-9._-]+/gi,     // Bearer tokens
];

// All log output passes through sanitiser before display
function sanitiseLogOutput(message: string): string {
  let sanitised = message;
  for (const pattern of REDACTED_PATTERNS) {
    sanitised = sanitised.replace(pattern, '[REDACTED]');
  }
  return sanitised;
}
```

### Consola Configuration

```typescript
import { createConsola } from 'consola';

export const logger = createConsola({
  // Default level, overridden by CLI flags
  level: 3, // info

  // Use fancy reporter for TTY, basic for pipes/CI
  fancy: process.stdout.isTTY,

  // Consistent formatting
  formatOptions: {
    date: false,      // Timestamps clutter CLI output
    colors: true,     // Respects --no-color via chalk/supports-color
    compact: false,   // Readable multi-line output
  },

  // Custom reporters can be added for file logging
  reporters: [
    // Default: ConsolaReporter to stderr for diagnostics
  ],
});

// Create tagged loggers for subsystems
export const llmLogger = logger.withTag('llm');
export const cacheLogger = logger.withTag('cache');
export const analysisLogger = logger.withTag('analysis');
```

### Environment Variable Support

```bash
# Set log level via environment (useful for CI/CD)
AGENTLINT_LOG=4 agentlint analyse    # Same as --verbose

# Or use Consola's native variable
CONSOLA_LEVEL=5 agentlint analyse    # Same as --debug

# Disable colors
NO_COLOR=1 agentlint analyse         # Standard no-color env var
```

---

## agentlint doctor Command

### Purpose

Validate environment, configuration, and connectivity before analysis. Inspired by `npm doctor`.

### Command Signature

```bash
agentlint doctor [--fix] [--json]
```

### Checks Performed

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCTOR CHECKS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Category        │ Check                            │ Fix Available?        │
│  ────────────────┼──────────────────────────────────┼────────────────────── │
│  Environment     │ Bun version >= 1.0               │ No (manual upgrade)   │
│                  │ Git available and configured     │ No                    │
│                  │ In a git repository              │ No                    │
│                                                                             │
│  Configuration   │ Config file exists               │ Yes (agentlint init)  │
│                  │ Config file is valid TOML        │ No (show errors)      │
│                  │ Required fields present          │ Yes (add defaults)    │
│                  │ XDG directories accessible       │ Yes (create dirs)     │
│                                                                             │
│  LLM Provider    │ API key configured               │ No (show how-to)      │
│                  │ API endpoint reachable           │ No (network issue)    │
│                  │ API key valid (test call)        │ No (invalid key)      │
│                  │ Model available                  │ No (wrong model ID)   │
│                                                                             │
│  Cache           │ Cache directory writable         │ Yes (create/fix)      │
│                  │ Cache not corrupted              │ Yes (clear cache)     │
│                  │ Cache size reasonable            │ Yes (prune old)       │
│                                                                             │
│  Git Hooks       │ Hooks installed correctly        │ Yes (reinstall)       │
│                  │ Hook scripts executable          │ Yes (chmod +x)        │
│                  │ No conflicting hook managers     │ No (warn only)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example Output

```
$ agentlint doctor

Checking agentlint installation...

✓ Bun version: 1.1.45 (>= 1.0 required)
✓ Git available: 2.43.0
✓ In git repository: /Users/dev/my-project

✓ Config file: .agentlint.toml
✓ Config valid: TOML syntax OK
⚠ Cache size: 847 MB (consider: agentlint cache prune)

✓ LLM provider: anthropic
✓ API key: configured (sk-...redacted)
✓ API endpoint: reachable
✓ Model: claude-sonnet-4-20250514 (available)

✓ Git hooks: pre-commit installed
✓ Git hooks: pre-push installed

───────────────────────────────────────
All checks passed (1 warning)

Suggestions:
  • Run `agentlint cache prune` to free 500 MB of old cache entries
```

### --fix Flag

```bash
$ agentlint doctor --fix

Checking and fixing agentlint installation...

✓ Bun version: 1.1.45 (>= 1.0 required)
✗ Cache directory: permission denied
  → Fixed: chmod 755 ~/.cache/agentlint

✗ Git hooks: pre-commit not executable
  → Fixed: chmod +x .git/hooks/pre-commit

───────────────────────────────────────
Fixed 2 issues. All checks now pass.
```

### --json Flag

```json
{
  "success": true,
  "checks": [
    { "name": "bun_version", "status": "pass", "value": "1.1.45" },
    { "name": "config_exists", "status": "pass", "path": ".agentlint.toml" },
    { "name": "llm_reachable", "status": "pass", "provider": "anthropic" }
  ],
  "warnings": [
    { "name": "cache_size", "message": "Cache is 847 MB", "suggestion": "agentlint cache prune" }
  ],
  "errors": []
}
```

---

## Performance Logging

### Timing Categories

```typescript
// Timing is always captured, only logged at debug level
interface PerformanceMetrics {
  totalMs: number;
  stages: {
    configLoad: number;
    fileDiscovery: number;
    staticAnalysis: number;     // All static analysers combined
    agenticAnalysis: number;    // LLM calls
    resultMerge: number;
    outputFormat: number;
  };
  llm: {
    calls: number;
    totalMs: number;
    tokensIn: number;
    tokensOut: number;
    estimatedCost: number;      // Based on model pricing
  };
  cache: {
    hits: number;
    misses: number;
    bytesSaved: number;
  };
}
```

### Verbose Output Example

```
$ agentlint analyse --verbose

[debug] Loading configuration from .agentlint.toml
[debug] Found 127 files matching include patterns
[debug] Running static analysers...
[debug]   ├─ duplicate-code: 23 files, 145ms
[debug]   ├─ complexity: 127 files, 89ms
[debug]   └─ todo-scanner: 127 files, 12ms
[debug] Running agentic analysers...
[debug]   └─ semantic-analysis: 15 files, 2.3s (claude-sonnet-4-20250514)
[debug] LLM usage: 3 calls, 12,450 tokens in, 1,230 tokens out (~$0.04)
[debug] Cache: 89 hits, 38 misses (saved ~4.2s)

Analysis complete in 2.8s

[... normal output ...]
```

---

## File Logging (Future)

While v1 focuses on terminal output, the architecture supports file logging:

```toml
# .agentlint.toml (future)
[logging]
file = "~/.local/share/agentlint/logs/agentlint.log"
max_size = "10MB"
max_files = 5  # Rotation
level = "debug"
```

Log files would use:
- **Location**: `~/.local/share/agentlint/logs/` (XDG data, ADR-0003)
- **Format**: JSON lines for easy parsing
- **Rotation**: Size-based with configurable retention
- **Sanitisation**: Same redaction rules as terminal output

---

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All logs stored locally; secrets never leave user's machine |
| II. Improvement-Oriented | Yes | Debug logs support iterative diagnosis and improvement |
| III. Causal-First | Yes | Structured logging enables tracing issues to origin |
| IV. Mixed-Methods | Yes | Combines machine-readable JSON with human-readable terminal output |
| V. Language-Agnostic | N/A | Logging infrastructure is language-independent |
| VI. Tool-Agnostic | N/A | Logging applies uniformly across all AI tool adapters |
| VII. Intelligent Tooling | Yes | Logging infrastructure serves all analysis approaches |
| VIII. Compounding Value | Yes | Persistent logs enable historical debugging and pattern detection |
| IX. Agent-Aware | Yes | Log verbosity configurable to avoid overwhelming agent context |

---

## Implementation Notes

### Package Installation

```bash
bun add consola
```

### Testing Strategy

- Unit tests for sanitisation (ensure secrets are redacted)
- Integration tests for doctor checks
- Snapshot tests for log output formatting
- Environment variable handling tests

### Migration Path

None required - this is foundational infrastructure for v1.

---

## References

- [Consola GitHub](https://github.com/unjs/consola)
- [npm doctor documentation](https://docs.npmjs.com/cli/commands/npm-doctor)
- [clig.dev - Output section](https://clig.dev/#output)
- [12 Factor App - Logs](https://12factor.net/logs)
- Design Questions §7.2: Logging & Debugging
