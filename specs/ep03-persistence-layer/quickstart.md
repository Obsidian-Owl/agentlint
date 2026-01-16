# Quickstart: EP03 Persistence Layer

> Getting started with agentlint's local storage capabilities

---

## Overview

The Persistence Layer provides local storage for:
- **Baselines** - Point-in-time analysis snapshots
- **Learnings** - Project and global insights
- **Sessions** - Checkpoint state for crash recovery

All data is stored locally (Constitution Principle I: Local-First).

---

## Installation

The persistence layer is part of the agentlint core package:

```bash
# No additional installation needed
# Persistence is available after agentlint install
```

---

## Basic Usage

### Saving a Baseline

```typescript
import { BaselineStorage } from '@agentlint/persistence';

// After running analysis
const baseline = await BaselineStorage.save({
  id: crypto.randomUUID(),
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  projectPath: process.cwd(),
  actType: 'claude-code',
  configPath: 'CLAUDE.md',
  gitCommit: await getGitHead(),
  metrics: calculateMetrics(findings),
  findings: findings,
  label: null,
  notes: null,
});

console.log(`Baseline saved: ${baseline.id}`);
```

### Querying Baselines

```typescript
// Get the latest baseline
const latest = await BaselineStorage.getLatest();

// Query by date range
const recent = await BaselineStorage.query({
  after: '2026-01-01T00:00:00Z',
  limit: 10,
  order: 'desc',
});

// Query by label
const labeled = await BaselineStorage.query({
  label: 'before-refactor',
});
```

### Comparing Baselines

```typescript
// Load two baselines for comparison
const before = await BaselineStorage.load(beforeId);
const after = await BaselineStorage.getLatest();

const delta = {
  findingsDelta: after.metrics.findingsCount - before.metrics.findingsCount,
  criticalDelta: after.metrics.criticalCount - before.metrics.criticalCount,
  // ...
};

console.log(`Findings changed by: ${delta.findingsDelta}`);
```

---

### Saving Learnings

```typescript
import { LearningStorage } from '@agentlint/persistence';

// Save a project-local learning
const learningId = await LearningStorage.save({
  title: 'API Error Handling Pattern',
  content: `
## Summary
Always use exponential backoff with jitter for API calls.

## Example
\`\`\`typescript
async function fetchWithRetry(url: string) {
  // implementation...
}
\`\`\`
  `,
  category: 'patterns',
  scope: 'project',
  tags: ['api', 'error-handling', 'resilience'],
});
```

### Querying Learnings

```typescript
// List all learnings (project + global)
const allLearnings = await LearningStorage.listAll();

// Filter by category
const patterns = await LearningStorage.query({
  category: 'patterns',
  limit: 10,
});

// Filter by tag
const apiRelated = await LearningStorage.query({
  tag: 'api',
});
```

---

### Session Checkpointing

```typescript
import { SessionStorage } from '@agentlint/persistence';

// Save session state (called by CheckpointHandler)
await SessionStorage.save(sessionState, {
  atomic: true,  // Use temp file + rename
});

// Load session on resume
const restored = await SessionStorage.load(sessionId);
if (restored) {
  console.log(`Resuming from phase: ${restored.phase}`);
}
```

### Crash Recovery

```typescript
// Check for incomplete sessions on startup
const incomplete = await SessionStorage.findIncomplete();

if (incomplete.length > 0) {
  const session = incomplete[0];
  console.log(`Found incomplete session from ${session.lastCheckpointAt}`);

  // Prompt user to resume
  const shouldResume = await promptUser('Resume this session?');
  if (shouldResume) {
    const state = await SessionStorage.load(session.sessionId);
    // Continue analysis from state...
  }
}
```

---

## Common Patterns

### 1. Before/After Analysis

```typescript
// Before making changes
const beforeBaseline = await BaselineStorage.save({...});

// ... user makes changes ...

// After running new analysis
const afterBaseline = await BaselineStorage.save({...});

// Compare
const improvement = calculateImprovement(beforeBaseline, afterBaseline);
```

### 2. Global Learning Promotion

```typescript
// Start as project learning
const localId = await LearningStorage.save({
  scope: 'project',
  // ...
});

// Later: promote to global
// (This requires EP12 implementation)
```

### 3. Session Resume Flow

```typescript
async function main() {
  // Check for crashed session
  const incomplete = await SessionStorage.findIncomplete();

  if (incomplete.length > 0) {
    // Resume or discard
  } else {
    // Start fresh analysis
  }
}
```

---

## Directory Structure

After using the persistence layer, you'll see:

```
your-project/
└── .agentlint/
    ├── baselines/
    │   ├── 2026-01-16T14-30-00-abc123.json
    │   └── latest.json → (symlink)
    ├── baselines.db
    ├── sessions/
    │   └── session-xyz-state.json
    ├── learnings/
    │   └── 2026-01-16-api-patterns-def456.md
    └── learnings.db

~/.agentlint/
├── learnings/
│   └── 2026-01-15-global-pattern-ghi789.md
└── learnings.db
```

---

## API Reference

See `contracts/interfaces.ts` for full type definitions:

- `BaselineStorage` - Baseline CRUD operations
- `LearningStorage` - Learning CRUD operations
- `SessionStorage` - Session state operations

---

## Next Steps

- Run `/dev.tasks` to generate implementation tasks
- See `data-model.md` for entity definitions
- See `research.md` for design decisions
