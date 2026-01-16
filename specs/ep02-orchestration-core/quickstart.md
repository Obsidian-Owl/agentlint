# Quickstart: EP02 Orchestration Core

> A guide to using the agentlint orchestration layer

---

## Installation

EP02 adds orchestration capabilities to the agentlint CLI. After EP02 is implemented:

```bash
# Install agentlint (includes orchestration)
curl -fsSL https://agentlint.dev/install.sh | bash

# Or via npm
npm install -g @agentlint/cli
```

**Prerequisites**:
- Node.js 22+ or Bun
- Anthropic API key (`ANTHROPIC_API_KEY` environment variable)

---

## Basic Usage

### Running an Analysis

```typescript
import { Orchestrator } from '@agentlint/orchestration';

// Create orchestrator with default config
const orchestrator = new Orchestrator();

// Run analysis task
for await (const chunk of orchestrator.run('Analyze my CLAUDE.md for quality')) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.content);
  } else if (chunk.type === 'finding') {
    console.log('\n[Finding]', chunk.content);
  }
}
```

### CLI Usage (after EP04)

```bash
# Analyze current project
agentlint analyze

# Analyze with verbose output
agentlint analyze --verbose

# Resume interrupted session
agentlint analyze --resume <session-id>
```

---

## Configuration

### Global Config

Create `~/.agentlint/config.json`:

```json
{
  "model": "claude-sonnet-4-20250514",
  "checkpoint": {
    "intervalMs": 60000
  },
  "verbosity": "normal"
}
```

### Programmatic Config

```typescript
const orchestrator = new Orchestrator({
  model: 'claude-opus-4-20250514',  // Use Opus for complex analysis
  checkpointIntervalMs: 30000,       // Checkpoint every 30s
  verbosity: 'verbose',              // Show agent reasoning
  systemPromptAppend: `
    Focus on security-related configuration gaps.
    Prioritize findings related to secret management.
  `
});
```

---

## Common Patterns

### Registering Custom Tools

```typescript
import { Orchestrator, ToolRegistry, tool } from '@agentlint/orchestration';
import { z } from 'zod';

// Define a custom tool
const myTool = tool(
  'my_custom_analyzer',
  'Analyzes project for custom patterns',
  {
    pattern: z.string().describe('The pattern to search for'),
    directory: z.string().optional().describe('Directory to search')
  },
  async ({ pattern, directory }) => {
    // Tool implementation
    const results = await searchForPattern(pattern, directory);
    return {
      content: [{ type: 'text', text: JSON.stringify(results) }]
    };
  }
);

// Register with orchestrator
const orchestrator = new Orchestrator();
orchestrator.toolRegistry.register(myTool);
```

### Handling Checkpoints

```typescript
import { Orchestrator, CheckpointHandler } from '@agentlint/orchestration';

// Custom checkpoint handler
const checkpointHandler: CheckpointHandler = {
  async onCheckpoint(event) {
    console.log(`Checkpoint ${event.sequence}: ${event.trigger}`);
    // Save to custom storage
    await myStorage.save(event.sessionId, event.state);
  }
};

const orchestrator = new Orchestrator();
orchestrator.onCheckpoint(checkpointHandler);
```

### Resuming Sessions

```typescript
import { Orchestrator } from '@agentlint/orchestration';

const orchestrator = new Orchestrator();

// Check for interrupted sessions
const sessions = await orchestrator.listSessions();
if (sessions.length > 0) {
  const lastSession = sessions[0];
  console.log(`Found interrupted session: ${lastSession.id}`);
  console.log(`Phase: ${lastSession.phase}, Findings: ${lastSession.findings.length}`);

  // Resume
  for await (const chunk of orchestrator.resume(lastSession.id)) {
    // Handle resumed output
  }
}
```

### Streaming with Verbosity Filter

```typescript
import { Orchestrator, filterByVerbosity } from '@agentlint/orchestration';

const orchestrator = new Orchestrator({ verbosity: 'debug' });

for await (const chunk of orchestrator.run('Analyze project')) {
  // Filter to only show 'normal' level and above
  const filtered = filterByVerbosity([chunk], 'normal');
  for (const c of filtered) {
    console.log(`[${c.type}] ${c.content}`);
  }
}
```

---

## Verbosity Levels

| Level | What You See |
|-------|--------------|
| `quiet` | Errors only |
| `normal` | Progress indicators, results, findings |
| `verbose` | Agent reasoning, tool invocations |
| `debug` | All events including internal state, context compression |

---

## Stream Chunk Types

| Type | Description |
|------|-------------|
| `text` | Agent reasoning/response text |
| `tool_start` | Tool invocation beginning |
| `tool_result` | Tool execution result |
| `finding` | New finding detected |
| `phase_change` | Analysis phase transition |
| `checkpoint` | Checkpoint saved |
| `error` | Error occurred |
| `status` | Status update |

---

## Error Handling

```typescript
import {
  Orchestrator,
  OrchestrationError,
  SessionResumeError,
  ApiKeyError
} from '@agentlint/orchestration';

try {
  const orchestrator = new Orchestrator();
  for await (const chunk of orchestrator.run('Analyze')) {
    // Handle chunks
  }
} catch (error) {
  if (error instanceof ApiKeyError) {
    console.error('API key invalid. Session saved for resume.');
  } else if (error instanceof SessionResumeError) {
    console.error('Could not resume session:', error.message);
  } else if (error instanceof OrchestrationError) {
    console.error('Orchestration failed:', error.message);
  }
  process.exit(error.code ?? 1);
}
```

---

## Integration with EP03 (Persistence)

After EP03 is implemented, checkpoints automatically persist to SQLite:

```typescript
import { Orchestrator } from '@agentlint/orchestration';
import { PersistenceLayer } from '@agentlint/persistence';

// EP03 provides persistence
const persistence = new PersistenceLayer();

const orchestrator = new Orchestrator();
orchestrator.usePersistence(persistence);

// Sessions now persist to ~/.agentlint/data.db
// Baselines tracked automatically
// Learnings accumulated across sessions
```

---

## Next Steps

- **EP03**: Adds SQLite persistence, baselines, learnings
- **EP04**: Adds CLI interface with Ink/Commander.js
- **EP05**: Adds CLAUDE.md config analysis tools
- **EP06**: Adds session log analysis tools
