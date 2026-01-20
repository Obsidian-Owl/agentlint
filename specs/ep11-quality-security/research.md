# Research Findings: Quality & Security

> **Epic**: EP11
> **Created**: 2026-01-20

---

## Decision Log

### 1. Debug Logging Approach

**Decision**: Follow Claude Code pattern with namespaced environment variables and CLI flags.

**Rationale**:
- Familiar pattern to developers using Claude Code
- Avoids conflicts with generic `DEBUG` variable (known issue with Django/Flask .env files)
- Namespace filtering allows targeted debugging (`agentlint:tools`, `agentlint:llm`)
- CLI flags (`--verbose`, `--debug`) provide user-friendly alternative

**Alternatives Considered**:
1. **Dedicated logging library (pino)**: High performance but adds dependency, less familiar pattern
2. **tslog**: TypeScript-native but less common in CLI tools
3. **console.debug() only**: Too basic, no namespace filtering

**References**:
- Claude Code CLI reference: `--debug`, `--verbose` flags
- GitHub Issue #11015: DEBUG env var conflicts with .env files
- GitHub Issue #24: Proposal to rename DEBUG to CLAUDE_DEBUG

**Implementation Pattern**:
```typescript
// Namespace-based debug detection
const DEBUG = process.env.DEBUG || '';
const isDebugEnabled = DEBUG.includes('agentlint:') || DEBUG === 'agentlint';

// CLI flag support
program
  .option('--verbose', 'Show tool invocations and timing')
  .option('--debug <categories>', 'Enable debug output for categories (e.g., "tools,llm")')
  .option('--quiet', 'Only show errors and final results')
  .option('--log-file <path>', 'Write debug output to file');
```

---

### 2. Secret Detection Strategy

**Decision**: Hybrid approach using Gitleaks TOML patterns with LLM validation layer.

**Rationale**:
- Gitleaks provides 140+ battle-tested patterns (2B+ downloads)
- TOML parsing is trivial; no Go binary dependency
- LLM validation reduces false positives without exposing actual secrets
- Privacy-preserving: only redacted context reaches LLM

**Alternatives Considered**:
1. **Shell out to Gitleaks binary**: Requires Go installation, complicates distribution
2. **Port detect-secrets (Python)**: Significant effort (~10K lines), Python-specific patterns
3. **Custom patterns only**: Maintenance burden, may miss emerging formats

**References**:
- ADR-0013: Secret Detection Strategy
- Gitleaks GitHub: https://github.com/gitleaks/gitleaks
- arXiv study on secret detection: https://arxiv.org/pdf/2307.00714

**Implementation Pattern**:
```typescript
// Pattern loading
interface GitleaksRule {
  id: string;
  description: string;
  regex: string;
  keywords?: string[];
  entropy?: number;
  secretGroup?: number;
}

// Redacted context for LLM
const redactedContext = context.replace(
  secretValue,
  `[REDACTED:${ruleId}:len=${secretValue.length}]`
);
```

---

### 3. VCR Recording Strategy

**Decision**: Request mismatch detection for cassette staleness in CI.

**Rationale**:
- Simple detection mechanism: fail when request not in cassette
- Avoids noisy failures from minor prompt changes (no hash comparison)
- Clear error message guides developer to run `bun run record`
- Matches existing bun-bagel integration

**Alternatives Considered**:
1. **Prompt hash comparison**: Catches drift but noisy with minor prompt tweaks
2. **Both checks combined**: Most thorough but higher maintenance burden

**References**:
- ADR-0011: Testing Strategy for Agentic Components
- bun-bagel: https://github.com/DRFR0ST/bun-bagel
- Existing VCR infrastructure in tests/integration/recordings/

**Implementation Pattern**:
```typescript
// Strict mode for CI
class VCR {
  private strict: boolean = process.env.CI === 'true';

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const recording = this.findRecording(url, options);
    if (!recording && this.strict) {
      throw new Error(
        `VCR: No recording found for ${options?.method || 'GET'} ${url}\n` +
        `Run 'bun run record' locally and commit the recordings.`
      );
    }
    // ...
  }
}
```

---

### 4. Evaluation Framework

**Decision**: TruLens via Python subprocess for LLM-as-judge evaluation.

**Rationale**:
- TruLens is mature, provides explainable metrics with tracing
- Self-hostable (Local-First compatible)
- Python subprocess isolates dependency from Bun runtime
- Three-tier grading: code-based (fast) → LLM-judge (flexible) → human spot-check (gold standard)

**Alternatives Considered**:
1. **LLM-as-judge only**: Meta-circularity concern (LLM judging LLM)
2. **Human review rubrics only**: Expensive, doesn't scale
3. **Benchmark suite only**: Doesn't capture real-world diversity

**References**:
- ADR-0012: Evaluation Framework for Analysis Quality
- TruLens documentation: https://www.trulens.org/
- Anthropic: Demystifying Evals for AI Agents

**Implementation Pattern**:
```typescript
// Bun → TruLens orchestration
async function runTruLensEvals(): Promise<EvalResults> {
  const result = await $`python tests/evals/run.py`.json();
  return {
    actionability: result.actionability,
    causalAccuracy: result.causalAccuracy,
    overallScore: result.overall,
  };
}

// Release gate
if (results.overallScore < 0.7) {
  process.exit(1);
}
```

---

### 5. Session Checkpoint Retention

**Decision**: Configurable retention with 7-day default, max 365 days.

**Rationale**:
- 7 days matches typical debugging/investigation window
- Configurable via `~/.agentlint/config.json` for user control
- Special value `0` means never delete (for dogfooding/development)
- Cleanup runs on startup (non-blocking)

**Alternatives Considered**:
1. **Fixed 7 days**: Less flexible for different use cases
2. **Fixed 30 days**: Higher disk usage by default
3. **No retention limit**: Unbounded growth

**References**:
- Spec clarification C2
- Existing checkpoint.ts in EP02

**Implementation Pattern**:
```json
// ~/.agentlint/config.json
{
  "checkpoint": {
    "retentionDays": 30
  }
}
```

```typescript
// Cleanup on startup
async function cleanupOldCheckpoints(retentionDays: number): Promise<void> {
  if (retentionDays === 0) return; // Never delete
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  // Delete checkpoints older than cutoff...
}
```

---

### 6. Golden Dataset Location

**Decision**: Version in codebase at `tests/evals/golden/`.

**Rationale**:
- Ensures test/code alignment (golden data matches code version)
- Simpler CI (no external fetch required)
- Per ADR-0011 structure
- Git LFS option if dataset exceeds 50MB

**Alternatives Considered**:
1. **Separate repository**: Independent versioning but adds complexity
2. **External storage (S3/GCS)**: For very large datasets

**References**:
- Spec clarification C3
- ADR-0011 test directory structure

**Implementation Pattern**:
```
tests/evals/golden/
├── claude-md/              # CLAUDE.md examples
│   ├── high-quality/       # Good examples (95%+ expected)
│   ├── low-quality/        # Anti-pattern examples
│   └── edge-cases/         # Challenging scenarios
├── sessions/               # Session log fixtures (dogfooded)
│   └── dogfood-*.json      # Anonymized agentlint sessions
└── manifest.json           # Metadata and expected properties
```

---

### 7. Entropy Calculation

**Decision**: Shannon entropy for secret candidate scoring.

**Rationale**:
- Standard algorithm for measuring randomness
- High entropy (> 4.0) indicates likely real secret
- Low entropy (< 3.0) indicates likely placeholder/template
- Medium range (3.0-4.0) requires context review

**References**:
- ADR-0013 implementation notes
- Information theory standard formula

**Implementation Pattern**:
```typescript
function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}
```

---

### 8. Existing Codebase Patterns

**Findings**: The codebase already has patterns we should follow:

| Pattern | Location | Reuse in EP11 |
|---------|----------|---------------|
| Checkpoint handler | `src/orchestration/checkpoint.ts` | Extend for session recording |
| Config loading | `src/orchestration/config.ts` | Add debug/retention settings |
| Tool definitions | `src/tools/*/` | Secret validation tool pattern |
| VCR recordings | `tests/integration/recordings/` | Extend for E2E tests |
| Test fixtures | `tests/lib/fixtures.ts` | Pattern for golden dataset |

**Key Existing Types**:
```typescript
// From orchestration/types.ts
type VerbosityLevel = 'quiet' | 'normal' | 'verbose' | 'debug';

// From checkpoint.ts
interface CheckpointEvent {
  trigger: CheckpointTrigger;
  sequence: number;
  sessionId: string;
  state: SessionState;
  timestamp: string;
  metadata?: CheckpointMetadata;
}
```

---

## Unresolved Items

None - all technical unknowns resolved during research phase.

---

## Next Steps

Proceed to Phase 2: Design & Contracts

1. Create data-model.md with entity definitions
2. Create contracts/ with TypeScript interfaces
3. Create quickstart.md with usage guide
