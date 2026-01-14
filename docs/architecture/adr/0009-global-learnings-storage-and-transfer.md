---
status: accepted
date: 2026-01-14
decision-makers: [Project Lead]
consulted: []
informed: []
---

# ADR-0009: Global Learnings Storage and Transfer

## Context and Problem Statement

Global learnings enable agentlint's compounding value across projects (Constitution Principle VIII). When users discover a pattern that improves their AI coding workflow, they should be able to promote it from a project-specific insight to a global learning that informs analysis in all future projects. We need a storage format that:

- Supports semantic search to find relevant learnings at session start
- Allows human curation and editing
- Validates learnings for generalizability before promotion
- Runs entirely on the user's machine (Local-First, Constitution Principle I)

## Decision Drivers

- **Quality Validation**: Learnings must be validated for generalizability before becoming global
- **Semantic Search**: Retrieve learnings relevant to current project/task via similarity matching
- **Human Editability**: Users should easily read, edit, and curate their learnings
- **Local-First**: No cloud services; all processing on user's machine
- **Consistency**: Follow patterns established in ADR-0006 (sessions) and ADR-0008 (baselines)

## Considered Options

1. Markdown + sqlite-vec (semantic search)
2. JSON + sqlite-vec (semantic search)
3. Markdown + FTS5 only (keyword search)
4. Knowledge graph (cognee-style)

## Decision Outcome

**Chosen option: "Markdown + sqlite-vec"** because it provides the best balance of human editability (markdown with YAML frontmatter), semantic retrieval (local embeddings + vector search), and quality validation (LLM generalizability check). This follows the pattern from ADR-0008 while adding semantic capabilities for more relevant retrieval.

### Consequences

**Good:**
- Human-readable markdown files that users can edit in any text editor
- YAML frontmatter captures structured metadata (tags, origin, validation status)
- Semantic search finds relevant learnings based on meaning, not just keywords
- LLM validation ensures learnings are genuinely generalizable
- Fully local—no API calls except to user's configured LLM

**Bad:**
- Requires embedding model (~50MB cached locally via Transformers.js)
- sqlite-vec extension adds dependency complexity
- First embedding generation is slow (~1s per learning)

**Neutral:**
- Embeddings regenerated if model changes
- Users can bypass validation with `--force` if needed

## Pros and Cons of Options

### Option 1: Markdown + sqlite-vec

Store learnings as markdown files with YAML frontmatter in `~/.agentlint/learnings/`. Use Transformers.js for local embedding generation and sqlite-vec for vector similarity search.

- Good: Human-readable and editable markdown format
- Good: YAML frontmatter for structured metadata
- Good: Semantic search finds relevant learnings by meaning
- Good: Fully local—no external API calls for embeddings
- Good: LLM validates generalizability before promotion
- Neutral: ~50MB model cache for Transformers.js
- Bad: sqlite-vec extension adds native dependency
- Bad: First-run embedding generation takes time

### Option 2: JSON + sqlite-vec

Store learnings as JSON files with semantic search capabilities.

- Good: Machine-parseable structured format
- Good: Same semantic search benefits as Option 1
- Good: Easier programmatic manipulation
- Neutral: Can be pretty-printed for readability
- Bad: JSON not human-friendly for editing
- Bad: No natural place for freeform notes/context

### Option 3: Markdown + FTS5 only

Store learnings as markdown files, use SQLite FTS5 for keyword search.

- Good: Simpler implementation—no embedding model needed
- Good: Human-readable markdown format
- Good: FTS5 already proven in ADR-0006
- Good: Zero additional dependencies
- Neutral: BM25 ranking provides relevance
- Bad: Keyword search misses semantic relationships
- Bad: "api error handling" won't find "exception management" learning

### Option 4: Knowledge graph (cognee-style)

Build a full knowledge graph with entity extraction and relationship tracking.

- Good: Rich semantic relationships between learnings
- Good: Graph traversal enables sophisticated queries
- Good: Entity extraction surfaces connections
- Neutral: Industry-standard approach for knowledge management
- Bad: Cloud-focused architecture conflicts with Local-First
- Bad: Overkill complexity for cross-project learnings
- Bad: Requires graph database infrastructure

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | Transformers.js runs locally; no cloud calls for embeddings |
| II. Improvement-Oriented | Yes | Learnings capture improvement patterns |
| III. Causal-First | Yes | Learning origin tracked (project, session, timestamp) |
| IV. Mixed-Methods | Yes | Combines quantitative (usage count) and qualitative (insight text) |
| V. Language-Agnostic | Yes | Learnings work across programming languages |
| VI. Agent-Agnostic | Yes | Learnings apply to any ACT analysis |
| VII. Intelligent Tooling | Yes | Agent can search learnings semantically |
| VIII. Compounding Value | Yes | Core mechanism for cross-project value transfer |
| IX. Agent-Aware | Yes | Markdown + frontmatter optimized for agent consumption |

## More Information

### Related Documents

- Design Decisions: [DD-008](../design-decisions.md#dd-008-global-learnings-storage-and-transfer)
- Prior Decisions: [ADR-0006 - Session Log Processing](./0006-session-log-processing-architecture.md), [ADR-0008 - Baseline Storage](./0008-baseline-storage-format-and-strategy.md)

### Research Sources

- [sqlite-vec - Vector search SQLite extension](https://github.com/asg017/sqlite-vec)
- [Transformers.js - Server-side inference in Node.js](https://huggingface.co/docs/transformers.js/en/tutorials/node)
- [Human Knowledge Markdown](https://github.com/digitalreplica/human-knowledge-markdown)
- [Simon Willison - sqlite-vec announcement](https://simonwillison.net/2024/May/3/sqlite-vec/)
- [How to use sqlite-vec for vector embeddings](https://dev.to/stephenc222/how-to-use-sqlite-vec-to-store-and-query-vector-embeddings-58mf)

### Implementation Notes

#### 1. Storage Layout

```
~/.agentlint/
├── learnings/
│   ├── 2026-01-14-api-error-handling-abc123.md    # Individual learning files
│   ├── 2026-01-15-test-isolation-def456.md
│   └── ...
├── learnings.db                                    # SQLite with sqlite-vec
└── models/                                         # Cached Transformers.js models
    └── gte-small/                                  # ~50MB embedding model
```

#### 2. Learning Markdown Schema

```markdown
---
id: abc123-def456-...
version: "1.0"
created_at: "2026-01-14T10:30:00Z"
updated_at: "2026-01-14T10:30:00Z"

# Origin tracking
origin:
  project: "/path/to/original/project"
  session_id: "session-uuid"
  promoted_at: "2026-01-14T10:35:00Z"

# Classification
tags:
  - error-handling
  - api
  - resilience
category: "patterns"  # patterns | anti-patterns | tools | workflows

# Validation
validation:
  status: "validated"  # pending | validated | rejected
  generalizability_score: 0.85
  validated_at: "2026-01-14T10:35:00Z"
  validator_rationale: "Applies to any project using external APIs"

# Usage tracking
usage:
  times_retrieved: 12
  times_applied: 8
  last_retrieved: "2026-01-20T14:00:00Z"
---

# API Error Handling Pattern

## Learning

When making external API calls, always implement exponential backoff with jitter
to avoid thundering herd problems during service recovery.

## Context

Discovered while analyzing Claude Code sessions where repeated API failures
caused cascading timeouts. Adding backoff reduced error rates by 60%.

## Example

```typescript
async function fetchWithBackoff(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (e) {
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      const jitter = delay * 0.1 * Math.random();
      await sleep(delay + jitter);
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Applicability

- Any project making HTTP/API calls
- Particularly valuable for rate-limited services
- Not applicable for real-time/low-latency requirements
```

#### 3. SQLite Schema with sqlite-vec

```sql
-- Enable sqlite-vec extension
-- (loaded via Database.loadExtension in Bun)

-- Learning metadata for fast queries
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Classification
  category TEXT NOT NULL,
  tags TEXT,  -- JSON array

  -- Validation
  validation_status TEXT NOT NULL DEFAULT 'pending',
  generalizability_score REAL,

  -- Usage tracking
  times_retrieved INTEGER DEFAULT 0,
  times_applied INTEGER DEFAULT 0,
  last_retrieved TEXT,

  -- Origin
  origin_project TEXT,
  origin_session_id TEXT
);

-- Vector table for semantic search
CREATE VIRTUAL TABLE learning_embeddings USING vec0(
  learning_id TEXT PRIMARY KEY,
  embedding float[384]  -- gte-small produces 384 dimensions
);

-- Index for common queries
CREATE INDEX idx_learnings_category ON learnings(category);
CREATE INDEX idx_learnings_validation ON learnings(validation_status);
CREATE INDEX idx_learnings_retrieved ON learnings(last_retrieved);
```

#### 4. Embedding Pipeline

```typescript
import { pipeline, env } from '@huggingface/transformers';

// Configure local model cache
env.cacheDir = path.join(os.homedir(), '.agentlint', 'models');

class EmbeddingService {
  private static instance: EmbeddingService;
  private embedder: Pipeline | null = null;

  static async getInstance(): Promise<EmbeddingService> {
    if (!this.instance) {
      this.instance = new EmbeddingService();
      await this.instance.initialize();
    }
    return this.instance;
  }

  private async initialize() {
    // Use gte-small: good quality, 384 dimensions, ~50MB
    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/gte-small',
      { quantized: true }  // Smaller model, faster inference
    );
  }

  async embed(text: string): Promise<number[]> {
    if (!this.embedder) throw new Error('Embedding service not initialized');

    const result = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(result.data);
  }

  async embedLearning(learning: Learning): Promise<number[]> {
    // Combine title + learning + context for embedding
    const text = [
      learning.title,
      learning.content,
      learning.tags?.join(' '),
    ].filter(Boolean).join('\n\n');

    return this.embed(text);
  }
}
```

#### 5. Semantic Search

```typescript
async function searchLearnings(
  db: Database,
  query: string,
  options: { limit?: number; category?: string; minScore?: number } = {}
): Promise<SearchResult[]> {
  const { limit = 5, category, minScore = 0.5 } = options;

  // Get embedding for query
  const embedder = await EmbeddingService.getInstance();
  const queryEmbedding = await embedder.embed(query);

  // Vector similarity search
  let sql = `
    SELECT
      l.*,
      e.distance
    FROM learning_embeddings e
    JOIN learnings l ON l.id = e.learning_id
    WHERE e.embedding MATCH ?
      AND l.validation_status = 'validated'
  `;

  const params: unknown[] = [JSON.stringify(queryEmbedding)];

  if (category) {
    sql += ` AND l.category = ?`;
    params.push(category);
  }

  sql += ` ORDER BY e.distance LIMIT ?`;
  params.push(limit);

  const results = db.query(sql).all(...params);

  // Convert distance to similarity score (1 - distance for cosine)
  return results
    .map(r => ({
      ...r,
      similarityScore: 1 - r.distance,
    }))
    .filter(r => r.similarityScore >= minScore);
}
```

#### 6. Validation Criteria (Agent Guidance)

When the agent considers promoting a learning to global status, it should evaluate:

**Generalizability** (score 0.0-1.0):
- Does this apply across different projects, not just the original context?
- Is it language/framework-agnostic where appropriate?
- Would a developer on a different project find this useful?

**Actionability**:
- Does it provide clear, specific guidance?
- Can a developer act on this immediately?
- Is the recommendation concrete, not abstract?

**Non-obviousness**:
- Does this add value beyond common knowledge?
- Is this insight earned through experience?
- Would this prevent a mistake that's easy to make?

**Promotion threshold**: Generalizability score > 0.7 recommended.

The agent decides whether to promote based on these criteria. The `store_learning` tool records the agent's validation reasoning in the learning's metadata.

#### 7. Tool Integration

```typescript
export const storeLearningTool = tool(
  "store_learning",
  "Save an insight as a learning. Use --global to promote to cross-project learning.",
  {
    title: z.string().describe("Short title for the learning"),
    content: z.string().describe("The learning content in markdown"),
    tags: z.array(z.string()).optional().describe("Categorization tags"),
    global: z.boolean().optional().default(false).describe("Promote to global learning"),
  },
  async (args, context) => {
    const learning = createLearning(args, context.projectPath);

    if (args.global) {
      // Validate before promoting to global
      const validation = await validateLearningForPromotion(learning, context.agent);

      if (validation.status !== 'validated') {
        return {
          promoted: false,
          reason: validation.rationale,
          suggestion: validation.revision_suggestion,
        };
      }

      learning.validation = validation;
      await saveGlobalLearning(learning);
      return { promoted: true, id: learning.id };
    }

    // Store as project-local learning
    await saveProjectLearning(learning, context.projectPath);
    return { stored: true, id: learning.id, scope: 'project' };
  }
);

export const searchLearningsTool = tool(
  "list_learnings",
  "Search for relevant learnings based on the current context",
  {
    query: z.string().optional().describe("Semantic search query"),
    category: z.string().optional().describe("Filter by category"),
    limit: z.number().optional().default(5).describe("Max results"),
  },
  async (args) => {
    if (args.query) {
      return await searchLearnings(db, args.query, args);
    }
    return await listRecentLearnings(db, args.limit);
  }
);
```

#### 8. Semantic Search Implementation

The `list_learnings` tool supports semantic search via sqlite-vec:

```typescript
async function searchLearnings(
  db: Database,
  query: string,
  options: { limit?: number; category?: string; minScore?: number } = {}
): Promise<SearchResult[]> {
  const { limit = 5, category, minScore = 0.5 } = options;

  // Get embedding for query
  const embedder = await EmbeddingService.getInstance();
  const queryEmbedding = await embedder.embed(query);

  // Vector similarity search
  let sql = `
    SELECT
      l.*,
      e.distance
    FROM learning_embeddings e
    JOIN learnings l ON l.id = e.learning_id
    WHERE e.embedding MATCH ?
      AND l.validation_status = 'validated'
  `;

  const params: unknown[] = [JSON.stringify(queryEmbedding)];

  if (category) {
    sql += ` AND l.category = ?`;
    params.push(category);
  }

  sql += ` ORDER BY e.distance LIMIT ?`;
  params.push(limit);

  const results = db.query(sql).all(...params);

  // Convert distance to similarity score (1 - distance for cosine)
  // Update retrieval stats for returned learnings
  return results
    .map(r => ({
      ...r,
      similarityScore: 1 - r.distance,
    }))
    .filter(r => r.similarityScore >= minScore);
}
```

The agent decides when to search for learnings and how to apply them to the current context.
