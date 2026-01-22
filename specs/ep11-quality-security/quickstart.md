# EP11 Quality & Security - Quickstart Guide

This guide shows how to use the debug, testing, evaluation, and security features from EP11.

## Debug Mode

### Environment Variables

```bash
# Enable all agentlint debug output
DEBUG=agentlint:* agentlint analyze .

# Enable specific namespaces
DEBUG=agentlint:tools,agentlint:llm agentlint analyze .

# Available namespaces:
# - agentlint:tools     Tool invocations and timing
# - agentlint:llm       LLM calls and responses
# - agentlint:secrets   Secret detection
# - agentlint:eval      Evaluation framework
# - agentlint:checkpoint Session checkpoints
```

### CLI Flags

```bash
# Verbose mode - tool invocations, timing info
agentlint analyze . --verbose

# Debug specific categories
agentlint analyze . --debug tools,llm

# Write debug output to file
agentlint analyze . --verbose --log-file debug.log

# Quiet mode - errors only
agentlint analyze . --quiet
```

### Programmatic Usage

```typescript
import { createDebugLogger, DEBUG_NAMESPACES } from 'agentlint/debug';

// Create a logger
const logger = createDebugLogger({
  level: 'debug',
  namespaces: [DEBUG_NAMESPACES.TOOLS, DEBUG_NAMESPACES.LLM],
  format: 'pretty',
});

// Create a namespaced child logger
const toolsLogger = logger.child('agentlint:tools');

// Log messages
toolsLogger.debug('Starting file scan', { files: 10 });
toolsLogger.info('Scan complete', { duration: 1234 });

// Time an async operation
const result = await toolsLogger.time('Analysis', async () => {
  return await runAnalysis();
});
```

## Secret Detection

### CLI Usage

```bash
# Automatic secret detection (default)
agentlint analyze .

# Disable secret detection
agentlint analyze . --no-secrets
```

### Detection Output

When secrets are detected, you'll see output like:

```
⚠️  Potential secrets detected:

  [CONFIRMED] src/config.ts:15
    Rule: aws-access-key-id
    Recommendation: Rotate this key and use environment variables

  [LIKELY] .env.example:8
    Rule: generic-api-key
    Recommendation: Review if this is a real key or placeholder

  [NEEDS_REVIEW] scripts/deploy.sh:42
    Rule: private-key
    Recommendation: Manual review required - uncertain classification
```

### Programmatic Usage

```typescript
import { createSecretDetector, createSecretClassifier } from 'agentlint/secrets';

// Create detector with Gitleaks patterns
const detector = await createSecretDetector();
await detector.loadPatterns('gitleaks.toml');

// Scan a file
const result = await detector.scanFile('config.ts', fileContent);

// Classify candidates with LLM
const classifier = createSecretClassifier();
const classified = await classifier.classifyBatch(result.candidates);

// Filter by classification
const confirmed = classified.filter(s =>
  s.classification === 'confirmed' || s.classification === 'likely'
);
```

## Session Recording & Replay

### Enable Session Recording

```bash
# Sessions are automatically recorded to .agentlint/session-state/
agentlint analyze .

# Replay a previous session
agentlint replay <session-id>

# List recorded sessions
agentlint sessions list

# Clean up old sessions (7+ days)
agentlint sessions cleanup
```

### Crash Recovery

If a session is interrupted, agentlint will prompt on next run:

```
Found incomplete session from 2 hours ago (15 findings so far)
Resume? [Y/n]
```

### Programmatic Usage

```typescript
import { createSessionRecorder, createSessionReplayer } from 'agentlint/checkpoint';

// Start recording
const recorder = createSessionRecorder();
recorder.startRecording(sessionId);

// Record checkpoints
await recorder.recordCheckpoint({
  version: '1.0',
  sessionId,
  timestamp: new Date().toISOString(),
  sequence: 1,
  phase: 'analyze',
  trigger: 'tool_complete',
  toolHistory: [...],
  findings: [...],
  metrics: { toolCalls: 5, llmCalls: 2, tokensUsed: 1500, elapsedMs: 3000 },
});

// Stop recording
await recorder.stopRecording();

// Replay later
const replayer = createSessionReplayer();
const checkpoints = await replayer.loadSession(sessionId);
const context = await replayer.restoreFromCheckpoint(checkpoints[5]);
```

## Evaluation Framework

### Running Evaluations

```bash
# Run all golden scenarios
agentlint eval run

# Run specific scenarios
agentlint eval run --filter "difficulty:hard"
agentlint eval run --filter "tag:typescript"

# Check release gate
agentlint eval gate  # Exits non-zero if < 70% pass rate
```

### Golden Dataset Location

Golden scenarios are stored in `tests/evals/golden/`:

```
tests/evals/golden/
├── manifest.json           # Dataset manifest
├── public-repo/            # Scenarios from public repos
│   ├── typescript-basic.json
│   └── python-ml.json
├── dogfood/                # From internal testing
│   └── agentlint-self.json
└── production-failure/     # From bug reports
    └── missed-detection.json
```

### Creating a Golden Scenario

```json
{
  "id": "ts-unused-exports",
  "version": "1.0",
  "source": "public-repo",
  "input": {
    "claudeMd": "# Project\n\nTypescript project with barrel exports...",
    "projectType": "typescript",
    "sessionLogs": "Optional session log excerpt..."
  },
  "expectedProperties": {
    "shouldDetect": ["unused-export", "circular-dependency"],
    "shouldNotDetect": ["secret-leak"],
    "recommendationTypes": ["preventive", "systemic"]
  },
  "rubricWeights": {
    "actionability": 0.4,
    "causalAccuracy": 0.3,
    "relevance": 0.3
  },
  "metadata": {
    "addedAt": "2024-01-15",
    "sourceUrl": "https://github.com/example/repo",
    "difficulty": "medium",
    "tags": ["typescript", "exports", "dependencies"]
  }
}
```

### Programmatic Usage

```typescript
import {
  createEvaluationRunner,
  EVAL_THRESHOLDS
} from 'agentlint/eval';

// Create runner
const runner = createEvaluationRunner();

// Load golden dataset
const scenarios = await runner.loadGoldenDataset('tests/evals/golden');

// Evaluate all scenarios
const summary = await runner.evaluateAll(scenarios, async (input) => {
  // Your analysis function
  return await agentlint.analyze(input);
});

// Check results
console.log(`Pass rate: ${(summary.passRate * 100).toFixed(1)}%`);
console.log(`Average scores:`, summary.averageScores);

// Check release gate (70% threshold)
if (runner.checkReleaseGate(summary)) {
  console.log('✅ Release gate passed');
} else {
  console.log('❌ Release gate failed');
  process.exit(1);
}
```

## Outcome Tracking

### Enable Feedback Collection

```bash
# Enable feedback prompts (opt-in)
agentlint config set collectFeedback true
```

### Feedback Flow

After analysis, if feedback is enabled:

```
Would you like to provide feedback on recommendations?

[1] "Add type annotations to api.ts"
    ( ) Will implement
    ( ) Maybe later
    ( ) Not relevant
    ( ) Already done
    ( ) Skip

[2] "Enable strict null checks"
    ...
```

### View Outcome Metrics

```bash
agentlint metrics outcomes

Recommendation Outcomes:
  Total tracked: 45
  Implemented: 28 (62%)
  Helped: 24 (86% of implemented)

  By type:
    Symptomatic: 15 tracked, 80% implementation, 75% success
    Preventive:  20 tracked, 55% implementation, 90% success
    Systemic:    10 tracked, 50% implementation, 100% success
```

## Configuration

All EP11 features can be configured in `~/.agentlint/config.json`:

```json
{
  "debug": {
    "level": "info",
    "namespaces": [],
    "output": "console",
    "format": "pretty"
  },
  "secrets": {
    "enabled": true,
    "patternsPath": "gitleaks.toml"
  },
  "checkpoint": {
    "intervalMs": 60000,
    "retentionDays": 7
  },
  "outcomes": {
    "collectFeedback": false,
    "maxPromptsPerSession": 3,
    "followUpDelayDays": 7
  }
}
```

## VCR Testing (For Development)

When writing tests that involve LLM calls:

```typescript
import { withVCR } from 'agentlint/testing';

describe('Analysis', () => {
  it('detects configuration issues', async () => {
    await withVCR('analysis-config-issues', async () => {
      const result = await analyze(testInput);
      expect(result.findings).toHaveLength(3);
    });
  });
});
```

Cassettes are stored in `tests/fixtures/vcr/` and replayed in CI for deterministic tests.
