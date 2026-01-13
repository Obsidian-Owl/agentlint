# Caching Implementation Guide

Implementation details for the multi-layer caching system. See [ADR-0021](../architecture/adr/0021-caching-strategy.md) for decision rationale.

## Response Cache Class

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

## Cache Metrics Dashboard

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

## Cache Warming

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

## Integration with ADR-0012 Change Detection

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
