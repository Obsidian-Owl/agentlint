# VCR Recording Patterns

> Patterns for recording and replaying LLM API responses in integration tests. Based on ADR-0011.

## Overview

VCR (Video Cassette Recorder) testing records real API responses and replays them deterministically in CI. This gives high-fidelity testing without live LLM calls on every commit.

## When to Use VCR

Use VCR integration tests when:
- Testing code that calls LLM APIs
- Testing tool invocation chains
- Testing session management flows
- Testing streaming response handling

## Recording Infrastructure

### VCR Class

```typescript
// tests/lib/vcr.ts
import { mock, clearMocks } from 'bun-bagel';

interface Recording {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

class VCR {
  private recordings: Map<string, Recording[]> = new Map();
  private strict: boolean = process.env.CI === 'true';

  async load(cassettePath: string): Promise<void> {
    const file = Bun.file(cassettePath);
    if (await file.exists()) {
      const data = await file.json();
      this.recordings = new Map(Object.entries(data));
    }
  }

  async save(cassettePath: string): Promise<void> {
    const data = Object.fromEntries(this.recordings);
    await Bun.write(cassettePath, JSON.stringify(data, null, 2));
  }

  setupMocks(): void {
    for (const [url, recordings] of this.recordings) {
      let index = 0;
      mock(url, () => {
        const recording = recordings[index++];
        return {
          status: recording.response.status,
          headers: new Headers(recording.response.headers),
          data: recording.response.body,
        };
      });
    }
  }

  cleanup(): void {
    clearMocks();
  }
}

export const vcr = new VCR();
```

### Test Usage

```typescript
// tests/integration/agent/analysis.test.ts
import { describe, it, beforeAll, afterAll, expect } from 'bun:test';
import { vcr } from '../../lib/vcr';

describe('Agent Analysis Flow', () => {
  beforeAll(async () => {
    await vcr.load('tests/integration/recordings/analyse-flow.json');
    vcr.setupMocks();
  });

  afterAll(() => {
    vcr.cleanup();
  });

  it('completes analysis with expected phases', async () => {
    const result = await orchestrator.run(task);
    expect(result.phases).toContain('config-analysis');
  });
});
```

## Recording Workflow

### 1. Create New Recording

```bash
# Set record mode and run test
VCR_MODE=record bun test tests/integration/agent/analysis.test.ts
```

### 2. Review Recording

Check the generated JSON for:
- No secrets or API keys
- Reasonable response content
- Expected request/response pairs

### 3. Commit Together

Always commit code changes WITH their recordings:

```bash
git add tests/integration/agent/analysis.test.ts
git add tests/integration/recordings/analysis.json
git commit -m "test(integration): add analysis flow tests"
```

## Strict Mode (CI)

In CI, VCR runs in strict mode:

```typescript
if (this.strict && !recording) {
  throw new Error(
    `VCR: No recording found for ${method} ${url}\n` +
    `Run 'bun run record' locally and commit the recordings.`
  );
}
```

If recordings are missing, CI fails with a clear message.

## Recording Maintenance

### When to Re-record

Re-record when:
- Prompts change significantly
- API response format changes
- Adding new test scenarios

### Refresh Script

```bash
# Re-record all integration tests
bun run record

# Re-record specific test
VCR_MODE=record bun test tests/integration/agent/analysis.test.ts
```

## Directory Structure

```
tests/
├── integration/
│   ├── recordings/           # VCR cassettes
│   │   ├── analyse-flow.json
│   │   └── baseline-comparison.json
│   ├── agent/
│   │   └── analysis.test.ts
│   └── sessions/
│       └── management.test.ts
└── lib/
    └── vcr.ts               # VCR infrastructure
```

## Best Practices

1. **One cassette per test file** - Keeps recordings manageable
2. **Review before commit** - Check for secrets, sanity
3. **Re-record intentionally** - Not on every run
4. **Descriptive cassette names** - Match test file names
5. **Version control** - Recordings are code artifacts
