# Research Findings: Causal Tracing Engine

> **Epic**: EP07
> **Created**: 2026-01-17
> **Status**: Complete

---

## Decision Log

### 1. Chain Storage Strategy

**Decision**: Extend the existing EP06 SQLite database (`~/.agentlint/sessions.db`) with new tables for causal chains.

**Rationale**:
- Chains reference session entries by ID, requiring FK relationships
- Reuses existing database connection and schema management patterns
- Avoids proliferation of separate databases
- Pattern detection queries can JOIN across sessions and chains

**Alternatives Considered**:
- Separate `~/.agentlint/chains.db` database - Rejected: Requires cross-database queries for pattern detection
- JSON files per chain - Rejected: Poor query performance for pattern detection
- In-memory only - Rejected: Conflicts with persistence requirement (Q1)

**References**:
- EP06 `persistence/sessions/fts.ts` for schema patterns
- ADR-0006 for session storage decisions

---

### 2. Evidence Chain Data Model

**Decision**: Separate tables for chains vs evidence items, with 1:N relationship.

**Rationale**:
- Evidence items may be reused across chains (e.g., same session prompt links multiple issues)
- Enables querying evidence independently (e.g., "all evidence from session X")
- Matches entity relationships in spec Section 4.1
- Supports normalization for large datasets

**Schema Design**:
```sql
-- Main chain table
CREATE TABLE causal_chains (
  id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL,
  trigger_summary TEXT,
  gap_summary TEXT,
  mechanism_summary TEXT,
  effect_summary TEXT,
  confidence_overall TEXT CHECK (confidence_overall IN ('high', 'medium', 'low')),
  depth INTEGER DEFAULT 0,
  depth_limit_reached INTEGER DEFAULT 0,
  project_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (issue_id) REFERENCES sessions(session_id) ON DELETE SET NULL
);

-- Individual evidence items
CREATE TABLE evidence_items (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  timestamp TEXT,
  content TEXT,
  file_path TEXT,
  line_number INTEGER,
  sequence INTEGER NOT NULL,
  FOREIGN KEY (chain_id) REFERENCES causal_chains(id) ON DELETE CASCADE
);

-- Confidence breakdown per chain
CREATE TABLE confidence_scores (
  chain_id TEXT PRIMARY KEY,
  specificity INTEGER DEFAULT 0,
  temporal INTEGER DEFAULT 0,
  mechanistic INTEGER DEFAULT 0,
  evidence_quality INTEGER DEFAULT 0,
  reproducibility INTEGER DEFAULT 0,
  alternatives INTEGER DEFAULT 0,
  FOREIGN KEY (chain_id) REFERENCES causal_chains(id) ON DELETE CASCADE
);

-- Pattern aggregation
CREATE TABLE issue_patterns (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  is_systemic INTEGER DEFAULT 0,
  first_occurrence TEXT NOT NULL,
  last_occurrence TEXT NOT NULL,
  project_path TEXT
);

-- Many-to-many: chains to patterns
CREATE TABLE chain_patterns (
  chain_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  PRIMARY KEY (chain_id, pattern_id),
  FOREIGN KEY (chain_id) REFERENCES causal_chains(id) ON DELETE CASCADE,
  FOREIGN KEY (pattern_id) REFERENCES issue_patterns(id) ON DELETE CASCADE
);
```

**References**:
- Spec Section 4: Key Entities
- EP06 `persistence/sessions/fts.ts` for schema conventions

---

### 3. Tool Interface Design

**Decision**: Two primary SDK tools for agent consumption.

**Tools**:

| Tool | Purpose | Key Inputs | Key Outputs |
|------|---------|------------|-------------|
| `trace_issue_origin` | Trace single issue to origin | issue description, issue location | CausalChain JSON |
| `get_issue_patterns` | Find recurring patterns | project path, min frequency | IssuePattern[] JSON |

**Rationale**:
- Matches agent value differentiation (pre-computed chains)
- Clear separation: trace vs pattern query
- Both return structured JSON for agent reasoning

**Tool Details**:

```typescript
// trace_issue_origin
{
  issueDescription: string,  // What the issue is
  issueLocation?: {          // Where it was detected
    file: string,
    line?: number
  },
  searchContext?: {          // Hints for session search
    keywords: string[],
    since?: string,          // ISO-8601
    until?: string           // ISO-8601
  }
}
// Returns: CausalChain with evidence items

// get_issue_patterns
{
  projectPath?: string,      // Filter to project
  minFrequency?: number,     // Default 2
  category?: string,         // Filter by root cause category
  includeResolved?: boolean  // Include resolved patterns
}
// Returns: IssuePattern[] with linked chain summaries
```

**References**:
- EP06 `search-sessions-tool.ts` for tool pattern
- ADR-0005 for tool definition conventions

---

### 4. Session Search Integration

**Decision**: Use existing `searchSessions()` from EP06 for evidence collection.

**Rationale**:
- FTS5 index already optimized for session search
- BM25 ranking provides relevance scoring
- Field-specific search (role, content, tool_name) enables targeted queries
- Avoids reimplementing search logic

**Integration Pattern**:
```typescript
// In chain-builder.ts
import { searchSessions } from '../sessions/search';

function findSessionEvidence(keywords: string[], since?: string): EvidenceItem[] {
  const query = keywords.join(' OR ');
  const result = searchSessions({
    query,
    since,
    limit: 20
  });

  return result.results.map(r => ({
    type: 'SessionMatch',
    source: r.sessionId,
    timestamp: r.timestamp,
    content: r.contentSnippet,
    filePath: r.filePath,
    lineNumber: r.lineNumber
  }));
}
```

**References**:
- EP06 `src/tools/sessions/search.ts`
- Clarification Q3: Indexed sessions only

---

### 5. Confidence Scoring Algorithm

**Decision**: 6-factor checklist with binary scoring, mapped to categorical confidence.

**Factors** (per spec US-006):
1. **Specificity**: Issue clearly links to specific prompt/action
2. **Temporal**: Timing supports causal relationship
3. **Mechanistic**: Plausible mechanism explains causation
4. **Evidence Quality**: Evidence is direct, not inferred
5. **Reproducibility**: Pattern seen multiple times
6. **Alternatives**: Alternative causes considered and ruled out

**Scoring**:
- Each factor: 0 (not met) or 1 (met)
- Total: 0-6
- Mapping: high (5-6), medium (3-4), low (0-2)

**Implementation**:
```typescript
interface ConfidenceFactors {
  specificity: boolean;
  temporal: boolean;
  mechanistic: boolean;
  evidenceQuality: boolean;
  reproducibility: boolean;
  alternatives: boolean;
}

function computeConfidence(factors: ConfidenceFactors): 'high' | 'medium' | 'low' {
  const score = Object.values(factors).filter(v => v).length;
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}
```

**References**:
- Spec US-006 acceptance criteria
- NFR-CT-004: High-confidence accuracy ≥80%

---

### 6. Pattern Detection Algorithm

**Decision**: Cluster chains by root cause category, threshold at 3+ occurrences for "systemic".

**Algorithm**:
1. Query all chains for project (or global)
2. Extract gap summaries and mechanism summaries
3. Cluster by semantic similarity (future: LLM embedding; v1: exact match on category)
4. Count occurrences per cluster
5. Mark as systemic if frequency ≥ 3

**v1 Simplification**:
- Category is manually assigned during chain creation
- Categories: `missing_config`, `missing_example`, `missing_guidance`, `terminology_gap`, `context_loss`, `other`
- Semantic clustering deferred to future enhancement

**References**:
- Spec FR-CT-010 through FR-CT-012
- Constitution VIII: Compounding Value

---

### 7. Git Correlation (P2 Feature)

**Decision**: Optional git blame/pickaxe integration for commit correlation.

**Implementation**:
```typescript
interface GitEvidence {
  type: 'GitCorrelation';
  commitHash: string;
  author: string;
  date: string;
  message: string;
  lineIntroduced?: number;
}

async function findGitEvidence(filePath: string, line: number): Promise<GitEvidence | null> {
  try {
    // git blame for the specific line
    const blame = await execAsync(`git blame -L ${line},${line} --porcelain ${filePath}`);
    // Parse output for commit hash, author, date
    return parseBlameOutput(blame);
  } catch {
    return null; // Graceful fallback if git unavailable
  }
}
```

**Rationale**:
- P2 priority per spec FR-CT-004
- Falls back gracefully (per spec edge case handling)
- Adds temporal evidence when sessions don't cover full history

**References**:
- Spec FR-CT-004
- EP08 will provide fuller git integration

---

## Open Items

All technical unknowns have been resolved through clarification and research:

| Item | Status | Resolution |
|------|--------|------------|
| Persistence strategy | ✅ Resolved | Extend EP06 database |
| Chain depth limit | ✅ Resolved | Max 5 steps |
| Pattern source | ✅ Resolved | Indexed sessions only |
| Tool interface | ✅ Resolved | Two tools: trace + patterns |
| Confidence scoring | ✅ Resolved | 6-factor checklist |

---

## Next Steps

1. Create data-model.md with Zod schemas
2. Create contracts/types.ts with TypeScript definitions
3. Create quickstart.md with usage examples
