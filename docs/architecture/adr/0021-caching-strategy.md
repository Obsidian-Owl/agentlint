---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0021: Caching Strategy

## Context and Problem Statement

agentlint performs both deterministic static analysis and non-deterministic LLM-powered agentic analysis. Repeated analysis of the same codebase can be expensive (LLM tokens), slow (network latency), and redundant (unchanged files). This ADR establishes a comprehensive caching strategy that:

1. Reduces LLM costs through Anthropic prompt caching (up to 90% savings)
2. Avoids reprocessing unchanged static analysis inputs
3. Supports development reproducibility through optional response caching
4. Maintains cache correctness (stale cache is worse than slow)

**Key Distinction**: This ADR addresses **performance caching**—speeding up repeated analysis. It complements but differs from ADR-0012 (Incremental Analysis Strategy), which addresses **learning/tracking**—detecting what changed for continuous improvement.

## Decision Drivers

- **Static-First principle**: Static analysis caching is fully deterministic and reliable
- **Progressive Value principle**: Tool must work without LLM; caching enhances, not gates
- **Cost control**: LLM calls are expensive; prompt caching saves up to 90%
- **Performance target**: 30-second analysis (ADR-0011) requires intelligent caching
- **Correctness over speed**: Stale cache is unacceptable; invalidation must be precise
- **Local-First principle**: All caches stored locally per ADR-0003
- **Reproducibility**: Development/testing benefits from deterministic cached responses

## Considered Options

1. Multi-Layer Content-Addressed Caching with LLM Prompt Caching
2. Git-Aware Caching (invalidate on commits)
3. Time-Based Expiry (TTL-only)
4. No Caching (always fresh)

## Decision Outcome

Chosen option: **"Multi-Layer Content-Addressed Caching with LLM Prompt Caching"** because it provides precise invalidation through content hashing, leverages Anthropic's native prompt caching for maximum cost savings, and maintains correctness guarantees. This approach aligns with proven patterns from ESLint, TypeScript, and Turborepo while being tailored to agentlint's hybrid static+agentic architecture.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CACHING ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 1: INPUT FINGERPRINTING                                       │   │
│  │                                                                      │   │
│  │ Before analysis, compute fingerprints for all inputs:               │   │
│  │                                                                      │   │
│  │ ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐ │   │
│  │ │ CONFIG HASH       │  │ SESSION HASH      │  │ CODE HASH         │ │   │
│  │ │                   │  │                   │  │                   │ │   │
│  │ │ SHA-256 of:       │  │ SHA-256 of:       │  │ Merkle tree of:   │ │   │
│  │ │ • CLAUDE.md       │  │ • Session log     │  │ • File paths      │ │   │
│  │ │ • .cursorrules    │  │   metadata        │  │ • File contents   │ │   │
│  │ │ • .agentlint/     │  │ • Session count   │  │ • Git tree hash   │ │   │
│  │ │   config.toml     │  │ • Latest session  │  │   (if available)  │ │   │
│  │ └───────────────────┘  └───────────────────┘  └───────────────────┘ │   │
│  │                                │                                     │   │
│  │                     ┌──────────┴──────────┐                         │   │
│  │                     │ ANALYSIS FINGERPRINT │                         │   │
│  │                     │ = hash(config +       │                         │   │
│  │                     │   sessions + code +   │                         │   │
│  │                     │   agentlint_version)  │                         │   │
│  │                     └──────────┬───────────┘                         │   │
│  └─────────────────────────────────┼───────────────────────────────────┘   │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 2: STATIC ANALYSIS CACHE (Content-Addressed)                  │   │
│  │                                                                      │   │
│  │ Location: ~/.cache/agentlint/static/                                │   │
│  │                                                                      │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Cache Key: SHA-256(file_path + file_content + analyser_version) │ │   │
│  │ │ Cache Val: Serialized static analysis result                    │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │ Per-File Granularity:                                               │   │
│  │ • Changed file → reanalyse only that file                          │   │
│  │ • Unchanged file → use cached result                                │   │
│  │ • New file → analyse and cache                                      │   │
│  │ • Deleted file → remove from cache (optional cleanup)               │   │
│  │                                                                      │   │
│  │ Guaranteed: Same input → Same output (deterministic)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 3: LLM PROMPT CACHING (Anthropic Native)                      │   │
│  │                                                                      │   │
│  │ Leverages Anthropic's prompt caching API for 90% cost reduction:   │   │
│  │                                                                      │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ PROMPT STRUCTURE (Optimized for Caching)                        │ │   │
│  │ │                                                                  │ │   │
│  │ │ ┌─────────────────────────────────┐                             │ │   │
│  │ │ │ 1. TOOLS (rarely change)        │ ← cache_control: ephemeral  │ │   │
│  │ │ │    • readFile, queryGit, etc.   │                             │ │   │
│  │ │ └─────────────────────────────────┘                             │ │   │
│  │ │ ┌─────────────────────────────────┐                             │ │   │
│  │ │ │ 2. SYSTEM PROMPT (stable)       │ ← cache_control: ephemeral  │ │   │
│  │ │ │    • Analysis instructions      │                             │ │   │
│  │ │ │    • Output format spec         │                             │ │   │
│  │ │ └─────────────────────────────────┘                             │ │   │
│  │ │ ┌─────────────────────────────────┐                             │ │   │
│  │ │ │ 3. CONTEXT (project-specific)   │ ← cache_control: ephemeral  │ │   │
│  │ │ │    • Compressed static findings │    (1-hour TTL for repeat)  │ │   │
│  │ │ │    • Project structure summary  │                             │ │   │
│  │ │ └─────────────────────────────────┘                             │ │   │
│  │ │ ┌─────────────────────────────────┐                             │ │   │
│  │ │ │ 4. USER QUERY (varies)          │ ← NOT cached                │ │   │
│  │ │ │    • Specific analysis request  │                             │ │   │
│  │ │ └─────────────────────────────────┘                             │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │ Pricing Impact:                                                     │   │
│  │ • Cache write: 1.25x base (first call)                             │   │
│  │ • Cache read: 0.1x base (subsequent calls) = 90% savings           │   │
│  │ • TTL: 5 minutes default, 1-hour for project context               │   │
│  │ • Break-even: 2 API calls                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 4: RESPONSE CACHE (Development/Testing Only)                 │   │
│  │                                                                      │   │
│  │ Location: ~/.cache/agentlint/responses/                             │   │
│  │ Purpose: Reproducibility during development and testing            │   │
│  │                                                                      │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Cache Key: SHA-256(full_prompt + model_id + temperature)        │ │   │
│  │ │ Cache Val: Complete LLM response (JSON serialized)              │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │ Modes:                                                              │   │
│  │ • OFF (default): No local response caching                         │   │
│  │ • RECORD: Save responses for future replay                         │   │
│  │ • REPLAY: Use cached responses if available                        │   │
│  │ • RECORD_REPLAY: Record new, replay existing                       │   │
│  │                                                                      │   │
│  │ Use Cases:                                                          │   │
│  │ • Development: Iterate on output formatting without API costs      │   │
│  │ • Testing: Deterministic test fixtures                             │   │
│  │ • Offline: Analysis review without network                         │   │
│  │                                                                      │   │
│  │ ⚠️ NOT for production: Responses may become stale                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Details

#### Layer 1: Input Fingerprinting

Every analysis run computes a deterministic fingerprint of all inputs:

```typescript
interface AnalysisFingerprint {
  // Component hashes
  configHash: string;      // SHA-256 of AI config files
  sessionHash: string;     // SHA-256 of session log metadata
  codeHash: string;        // Merkle root of file hashes

  // Version tracking
  agentlintVersion: string;
  analyserVersions: Map<string, string>;  // Per-analyser versions

  // Combined fingerprint
  fingerprint: string;     // SHA-256(all components)
}

function computeAnalysisFingerprint(
  project: ProjectContext
): AnalysisFingerprint {
  // Config files that affect analysis
  const configHash = hashFiles([
    project.claudeMdPath,
    project.cursorrulesPath,
    project.agentlintConfigPath,
  ].filter(exists));

  // Session log metadata (not full content—too large)
  const sessionHash = hashSessionMetadata(project.sessionLogDir);

  // Code files using Merkle tree for efficiency
  const codeHash = computeMerkleRoot(project.sourceFiles);

  return {
    configHash,
    sessionHash,
    codeHash,
    agentlintVersion: VERSION,
    analyserVersions: getAnalyserVersions(),
    fingerprint: hash([configHash, sessionHash, codeHash, VERSION]),
  };
}
```

**Git Integration** (when available):

```typescript
// Use git tree hash for efficient code fingerprinting
async function computeCodeHashWithGit(
  projectPath: string
): Promise<string> {
  try {
    // Git tree hash changes when any tracked file changes
    const { stdout } = await exec('git rev-parse HEAD:.');
    return `git:${stdout.trim()}`;
  } catch {
    // Fallback to file-based Merkle tree
    return computeMerkleRoot(await glob('**/*', { cwd: projectPath }));
  }
}
```

#### Layer 2: Static Analysis Cache

Per-file content-addressed caching for deterministic static analysis:

```typescript
interface StaticCacheEntry {
  key: string;           // SHA-256(path + content + analyserVersion)
  filePath: string;
  analyser: string;
  result: StaticAnalysisResult;
  createdAt: Date;
}

class StaticAnalysisCache {
  private cacheDir: string;  // ~/.cache/agentlint/static/

  async get(
    filePath: string,
    content: string,
    analyser: string
  ): Promise<StaticAnalysisResult | null> {
    const key = this.computeKey(filePath, content, analyser);
    const cachePath = path.join(this.cacheDir, `${key}.json`);

    if (await exists(cachePath)) {
      const entry = await readJSON<StaticCacheEntry>(cachePath);
      return entry.result;
    }

    return null;  // Cache miss
  }

  async set(
    filePath: string,
    content: string,
    analyser: string,
    result: StaticAnalysisResult
  ): Promise<void> {
    const key = this.computeKey(filePath, content, analyser);
    const entry: StaticCacheEntry = {
      key,
      filePath,
      analyser,
      result,
      createdAt: new Date(),
    };

    const cachePath = path.join(this.cacheDir, `${key}.json`);
    await writeJSON(cachePath, entry);
  }

  private computeKey(
    filePath: string,
    content: string,
    analyser: string
  ): string {
    const analyserVersion = getAnalyserVersion(analyser);
    return hash([filePath, content, analyser, analyserVersion]);
  }
}
```

**Cache Invalidation Rules**:

| Change | Cache Impact | Rationale |
|--------|--------------|-----------|
| File content modified | Reanalyse that file only | Content-addressed key changes |
| File deleted | Stale entry ignored | No lookup for deleted files |
| Analyser version bumped | All entries for that analyser invalidated | Version in key |
| agentlint version bumped | All entries invalidated | Global version in key |
| New file added | Analyse and cache | No prior entry exists |

#### Layer 3: LLM Prompt Caching

Leverage Anthropic's native prompt caching for dramatic cost reduction:

```typescript
import { anthropic } from '@ai-sdk/anthropic';

interface PromptCacheConfig {
  // TTL for different prompt sections
  toolsTTL: '5m' | '1h';       // Tools rarely change
  systemTTL: '5m' | '1h';      // System prompt stable
  contextTTL: '5m' | '1h';     // Project context may vary

  // Minimum tokens for caching (model-specific)
  minTokens: number;           // 1024 for Sonnet, 4096 for Opus/Haiku
}

const DEFAULT_PROMPT_CACHE_CONFIG: PromptCacheConfig = {
  toolsTTL: '1h',     // Tools almost never change
  systemTTL: '1h',    // System prompt stable across sessions
  contextTTL: '5m',   // Project context may change more often
  minTokens: 1024,    // Claude Sonnet 4 minimum
};

async function runAgenticAnalysisWithCaching(
  context: AnalysisContext,
  config: PromptCacheConfig = DEFAULT_PROMPT_CACHE_CONFIG
): Promise<AgenticResult> {
  const model = anthropic('claude-sonnet-4-20250514');

  const result = await generateText({
    model,
    tools: [
      // Tool definitions with cache control on last tool
      ...ANALYSIS_TOOLS.slice(0, -1),
      {
        ...ANALYSIS_TOOLS.at(-1)!,
        cache_control: { type: 'ephemeral', ttl: config.toolsTTL },
      },
    ],
    system: [
      // System instructions (stable)
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral', ttl: config.systemTTL },
      },
      // Project context (compressed static findings)
      {
        type: 'text',
        text: compressContext(context.staticFindings),
        cache_control: { type: 'ephemeral', ttl: config.contextTTL },
      },
    ],
    messages: [
      // User query (not cached - varies per request)
      { role: 'user', content: context.analysisPrompt },
    ],
  });

  // Log cache performance for monitoring
  logCacheMetrics({
    cacheCreationTokens: result.usage.cache_creation_input_tokens,
    cacheReadTokens: result.usage.cache_read_input_tokens,
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
  });

  return parseAgenticResult(result);
}
```

**Prompt Caching Best Practices** (from Anthropic docs):

1. **Order matters**: Cache prefixes process as `tools → system → messages`
2. **Put stable content first**: Tools and system prompt at beginning
3. **Use up to 4 breakpoints**: Separate content that updates at different rates
4. **Monitor cache metrics**: Track `cache_read_input_tokens` for hit rate
5. **1-hour TTL for repeated analysis**: When same project analyzed within hour

**Cost Model**:

| Scenario | Tokens | Cost (Sonnet 4) |
|----------|--------|-----------------|
| First call (cache write) | 100K | $0.375 (1.25x) |
| Subsequent call (cache hit) | 100K | $0.030 (0.1x) |
| Savings per cached call | - | $0.345 (92%) |

#### Layer 4: Response Cache (Development Only)

For development and testing reproducibility:

```typescript
type ResponseCacheMode = 'off' | 'record' | 'replay' | 'record_replay';

interface ResponseCacheConfig {
  mode: ResponseCacheMode;
  cacheDir: string;           // ~/.cache/agentlint/responses/
  maxAgeMs?: number;          // Optional staleness check
}

class ResponseCache {
  constructor(private config: ResponseCacheConfig) {}

  async getOrFetch<T>(
    key: ResponseCacheKey,
    fetcher: () => Promise<T>
  ): Promise<T> {
    if (this.config.mode === 'off') {
      return fetcher();
    }

    const cacheKey = this.computeKey(key);
    const cachePath = path.join(this.config.cacheDir, `${cacheKey}.json`);

    // Try replay
    if (this.config.mode === 'replay' || this.config.mode === 'record_replay') {
      if (await exists(cachePath)) {
        const cached = await readJSON<CachedResponse<T>>(cachePath);

        // Check staleness if configured
        if (this.config.maxAgeMs) {
          const age = Date.now() - cached.timestamp;
          if (age > this.config.maxAgeMs) {
            console.warn(`Cache stale (${age}ms > ${this.config.maxAgeMs}ms)`);
            // Continue to fetch if record_replay, else return stale
            if (this.config.mode === 'replay') {
              return cached.response;
            }
          } else {
            return cached.response;
          }
        } else {
          return cached.response;
        }
      }
    }

    // Fetch fresh
    if (this.config.mode === 'replay') {
      throw new Error(`Cache miss in replay mode: ${cacheKey}`);
    }

    const response = await fetcher();

    // Record if configured
    if (this.config.mode === 'record' || this.config.mode === 'record_replay') {
      await writeJSON(cachePath, {
        key,
        response,
        timestamp: Date.now(),
      });
    }

    return response;
  }

  private computeKey(key: ResponseCacheKey): string {
    return hash([
      key.prompt,
      key.modelId,
      key.temperature?.toString() ?? '0',
    ]);
  }
}

interface ResponseCacheKey {
  prompt: string;
  modelId: string;
  temperature?: number;
}
```

**Configuration**:

```toml
# .agentlint/config.toml

[cache]
# Static analysis cache (always recommended)
static_enabled = true
static_dir = "~/.cache/agentlint/static"

# LLM prompt caching (automatic via Anthropic API)
prompt_cache_ttl = "1h"  # "5m" or "1h"

# Response cache (development only)
response_mode = "off"  # "off" | "record" | "replay" | "record_replay"
response_dir = "~/.cache/agentlint/responses"
response_max_age_hours = 24  # Optional staleness warning
```

**CLI Flags**:

```bash
# Normal analysis (static cache + prompt caching enabled)
agentlint analyse

# Development: record responses for replay
agentlint analyse --cache-responses=record

# Testing: replay recorded responses (no API calls)
agentlint analyse --cache-responses=replay

# Clear all caches
agentlint cache clear

# Show cache statistics
agentlint cache stats
```

### Storage Layout

Per ADR-0003, caches use XDG-compliant paths:

```
~/.cache/agentlint/                    # $XDG_CACHE_HOME/agentlint
├── static/                            # Layer 2: Static analysis cache
│   ├── abc123def456.json              # Content-addressed entries
│   ├── def789ghi012.json
│   └── ...
├── responses/                         # Layer 4: Response cache (dev only)
│   ├── prompt-hash-1.json
│   ├── prompt-hash-2.json
│   └── ...
└── cache-meta.json                    # Cache statistics and metadata
```

**Cache Size Management**:

```typescript
interface CacheCleanupConfig {
  maxSizeMB: number;          // Default: 500MB
  maxAgedays: number;         // Default: 30 days
  cleanupIntervalHours: number; // Default: 24 hours
}

async function cleanupCache(config: CacheCleanupConfig): Promise<void> {
  const cacheDir = getCacheDir();

  // Remove entries older than maxAge
  const entries = await glob('**/*.json', { cwd: cacheDir });
  for (const entry of entries) {
    const stat = await fs.stat(path.join(cacheDir, entry));
    const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
    if (ageDays > config.maxAgedays) {
      await fs.unlink(path.join(cacheDir, entry));
    }
  }

  // If still over size limit, remove oldest entries
  const currentSize = await calculateDirSize(cacheDir);
  if (currentSize > config.maxSizeMB * 1024 * 1024) {
    await evictOldestEntries(cacheDir, config.maxSizeMB);
  }
}
```

### Cache Consistency with Reproducibility (ADR-0015)

The caching strategy integrates with reproducibility metadata:

```typescript
interface CachedAnalysisResult {
  // Result data
  static: StaticFindings;
  agentic: AgenticFindings;

  // Reproducibility metadata (ADR-0015)
  metadata: ReproducibilityMetadata;

  // Cache metadata
  cacheInfo: {
    fingerprint: AnalysisFingerprint;
    staticCacheHits: number;
    staticCacheMisses: number;
    promptCacheTokensSaved: number;
    responseCacheHit: boolean;
  };
}
```

### Consequences

**Good:**
- 90% LLM cost reduction through Anthropic prompt caching
- Sub-second static analysis for unchanged files
- Development/testing reproducibility via response caching
- Precise invalidation through content-addressing (no stale results)
- Storage-efficient with automatic cleanup
- Transparent cache metrics for debugging

**Bad:**
- Initial cache population adds latency (first run slower)
- Response cache requires discipline (easy to use stale data)
- Cache storage uses disk space (mitigated by cleanup)
- Prompt caching requires minimum token threshold (1024-4096)

**Neutral:**
- Adds complexity to analysis pipeline
- Requires monitoring cache hit rates for optimization
- Response cache is explicitly dev-only (not production)

## Pros and Cons of Options

### Option 1: Multi-Layer Content-Addressed Caching with LLM Prompt Caching

Full caching at all layers: input fingerprinting, static analysis, LLM prompts, and responses.

- Good: Maximum cost and performance optimization
- Good: Precise invalidation through content hashing
- Good: Leverages Anthropic's native prompt caching
- Good: Development reproducibility
- Good: Aligns with proven patterns (ESLint, Turborepo)
- Neutral: Multiple cache layers to understand
- Bad: Most complex implementation
- Bad: Requires careful management of response cache

### Option 2: Git-Aware Caching

Invalidate caches based on Git commits rather than content hashes.

- Good: Simpler mental model (commit = new analysis)
- Good: Works well with Git-based workflows
- Good: Natural integration with ADR-0012 change detection
- Neutral: Requires Git
- Bad: Over-invalidates (any commit invalidates even unchanged files)
- Bad: Doesn't work for non-Git repos
- Bad: Misses uncommitted changes

### Option 3: Time-Based Expiry

Cache entries expire after fixed TTL.

- Good: Simple to implement
- Good: Guaranteed freshness after TTL
- Good: No content hashing overhead
- Neutral: TTL tuning required
- Bad: May serve stale results within TTL
- Bad: May evict valid caches after TTL
- Bad: Not content-aware (wasteful reprocessing)

### Option 4: No Caching

Always process fresh.

- Good: Simplest implementation
- Good: Always correct
- Good: No cache management
- Bad: Slowest performance
- Bad: Highest LLM costs
- Bad: Poor user experience for large codebases
- Bad: Violates 30-second target (ADR-0011)

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All caches stored locally in XDG paths |
| II. Improvement-Oriented | Yes | Faster analysis enables more frequent improvement cycles |
| III. Causal-First | N/A | Caching doesn't affect causal tracing |
| IV. Mixed-Methods | Yes | Both static (deterministic) and agentic (prompt) caching |
| V. Language-Agnostic | Yes | Caching works regardless of target language |
| VI. Tool-Agnostic | Yes | Prompt caching works with any LLM provider supporting it |
| VII. Static-First | Yes | Static analysis caching is core; prompt caching enhances agentic |
| VIII. Progressive Value | Yes | Static caching works without LLM; prompt caching optional |
| IX. Agent-Aware | Yes | Compressed context in prompts aids agent efficiency |

## More Information

### Related Documents
- [ADR-0003: Local Storage Strategy](./0003-local-storage-strategy.md) - XDG cache paths, SQLite storage
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - 30-second performance target
- [ADR-0012: Incremental Analysis Strategy](./0012-incremental-analysis-strategy.md) - Change detection (learning, not caching)
- [ADR-0015: Reproducibility and Determinism](./0015-reproducibility-and-determinism.md) - Metadata tracking
- Design Questions: [Section 6.2 - Caching Strategy](../../design-questions.md#62-caching-strategy)

### Research Sources

**LLM Prompt Caching:**
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) - Official documentation
- [Anthropic Token Saving Updates](https://www.anthropic.com/news/token-saving-updates) - 90% cost reduction
- [ngrok: Prompt Caching Guide](https://ngrok.com/blog/prompt-caching/) - Implementation patterns
- [Spring AI Anthropic Caching](https://spring.io/blog/2025/10/27/spring-ai-anthropic-prompt-caching-blog/) - Framework integration
- [PromptHub: Multi-Provider Caching](https://www.prompthub.us/blog/prompt-caching-with-openai-anthropic-and-google-models) - Cross-provider patterns

**Semantic Caching:**
- [GPTCache GitHub](https://github.com/zilliztech/GPTCache) - Semantic cache framework
- [Redis Semantic Caching](https://redis.io/blog/what-is-semantic-caching/) - Vector similarity caching
- [arXiv: GPT Semantic Cache Paper](https://arxiv.org/html/2411.05276v2) - Academic research
- [Multi-Level Cache Strategies](https://www.javacodegeeks.com/2025/10/composable-multi-level-cache-strategies-for-llm-backed-apis.html) - Layered approach

**Response Caching for Development:**
- [Agno LLM Response Caching](https://www.agno.com/blog/llm-response-caching-in-agno) - Development reproducibility
- [AutoGen LLM Caching](https://microsoft.github.io/autogen/0.2/docs/topics/llm-caching/) - Testing patterns
- [LiteLLM Caching](https://docs.litellm.ai/docs/proxy/caching) - Proxy-level caching
- [Helicone LLM Caching](https://docs.helicone.ai/features/advanced-usage/caching) - Observability integration

**Static Analysis Caching:**
- [ESLint Caching Guide](https://www.tomsquest.com/blog/2024/06/cache-jest-eslint-prettier-typescript-ci/) - --cache flag patterns
- [TypeScript Incremental Compilation](https://syskool.com/optimizing-build-times-and-incremental-compilation-in-typescript/) - Content-based caching
- [Turborepo Caching](https://turborepo.com/blog/turbo-1-4-0) - Content-addressed approach
- [Nx Build Caching](https://nx.dev/recipes/tips-n-tricks/eslint) - Monorepo patterns

**Cache Invalidation Patterns:**
- [Cache Invalidation Strategies](https://medium.com/@rajesh.sgr/patterns-strategies-for-cache-invalidation-4d93d03616bb) - Best practices
- [Design Gurus: Cache Invalidation](https://www.designgurus.io/blog/cache-invalidation-strategies) - System design patterns

### Implementation Notes

#### 1. Cache Metrics Dashboard

```typescript
interface CacheMetrics {
  static: {
    hits: number;
    misses: number;
    hitRate: number;
    sizeBytes: number;
    entryCount: number;
  };
  prompt: {
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    costSavings: number;       // Estimated $ saved
  };
  response: {
    hits: number;
    misses: number;
    mode: ResponseCacheMode;
  };
}

// CLI: agentlint cache stats
async function displayCacheStats(): Promise<void> {
  const metrics = await collectCacheMetrics();

  console.log(chalk.bold('Cache Statistics'));
  console.log('');
  console.log(chalk.cyan('Static Analysis Cache:'));
  console.log(`  Hit rate: ${(metrics.static.hitRate * 100).toFixed(1)}%`);
  console.log(`  Entries: ${metrics.static.entryCount}`);
  console.log(`  Size: ${formatBytes(metrics.static.sizeBytes)}`);
  console.log('');
  console.log(chalk.cyan('LLM Prompt Cache (this session):'));
  console.log(`  Tokens read from cache: ${metrics.prompt.cacheReadTokens}`);
  console.log(`  Tokens written to cache: ${metrics.prompt.cacheCreationTokens}`);
  console.log(`  Estimated savings: $${metrics.prompt.costSavings.toFixed(4)}`);
}
```

#### 2. Cache Warming

For CI/CD or first-run optimization:

```typescript
// Pre-warm static cache for all files
async function warmStaticCache(projectPath: string): Promise<void> {
  const files = await glob('**/*', {
    cwd: projectPath,
    ignore: ['node_modules/**', '.git/**'],
  });

  const cache = new StaticAnalysisCache();

  for (const file of files) {
    const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
    for (const analyser of getStaticAnalysers()) {
      if (analyser.canAnalyse(file)) {
        const result = await analyser.analyse(file, content);
        await cache.set(file, content, analyser.name, result);
      }
    }
  }
}
```

#### 3. Integration with ADR-0012 Change Detection

```typescript
// ADR-0012 detects what changed; ADR-0021 caches analysis
async function runIncrementalAnalysis(
  changeManifest: ChangeManifest
): Promise<AnalysisResult> {
  const cache = new StaticAnalysisCache();
  const results: StaticResult[] = [];

  // Only analyse changed files; use cache for unchanged
  for (const file of changeManifest.filesChanged) {
    const content = await fs.readFile(file, 'utf-8');
    const cached = await cache.get(file, content, 'all');

    if (cached) {
      results.push(cached);  // Cache hit
    } else {
      const fresh = await runStaticAnalysis(file, content);
      await cache.set(file, content, 'all', fresh);
      results.push(fresh);
    }
  }

  // For unchanged files, use cached results
  for (const file of changeManifest.filesUnchanged) {
    const content = await fs.readFile(file, 'utf-8');
    const cached = await cache.get(file, content, 'all');
    if (cached) results.push(cached);
  }

  return { static: results };
}
```

### Follow-Up Decisions

This ADR surfaces the need for:

1. **Cache Warming Strategy**: Should CI/CD pre-warm caches? How to share caches across CI runs?
2. **Semantic Caching Evaluation**: For future, consider GPTCache-style similarity caching for near-miss queries
3. **Cache Sharding for Large Teams**: If multiple developers share cache, how to shard/isolate?
