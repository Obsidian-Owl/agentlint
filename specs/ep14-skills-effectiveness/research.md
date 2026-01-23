# Research Findings: Skills Effectiveness Analysis

> **Epic**: EP14
> **Created**: 2026-01-24

---

## Decision Log

### 1. Skill Invocation Detection Pattern

**Decision**: Use `tool_use.name === "Skill"` to identify skill invocations in session logs

**Rationale**:
- Claude Code logs Skill tool invocations as standard tool_use entries
- The skill command is in `input.skill` or `input.command`
- Pattern matches strategic review findings
- Deterministic extraction—no semantic matching needed

**Alternatives Considered**:
- Regex matching on user prompts → Too fragile, misses auto-invocations
- Looking for slash commands in user messages → Misses model-initiated invocations
- Tracking file patterns → Not reliable (skill may apply without file operation)

**References**:
- [Strategic Review Jan 2026](../../docs/review/agentlint-strategic-review-jan26.md)
- Session log structure from ADR-0006

---

### 2. Skill Inventory Source

**Decision**: Use existing `src/tools/config/skills.ts` for skill discovery

**Rationale**:
- Already implements SKILL.md parsing per ADR-0017
- Handles frontmatter extraction (name, description)
- Returns structured data suitable for tool output
- Tested and working code

**Alternatives Considered**:
- New skill discovery implementation → Duplicates existing code
- Direct file system access → Loses validation/warnings

**References**:
- [ADR-0017: Agent Skills Integration Strategy](../../docs/architecture/adr/0017-agent-skills-integration-strategy.md)
- `src/tools/config/skills.ts:63-106` (discoverSkills function)

---

### 3. Session Summary Scope

**Decision**: Include first user prompt, files operated, and skills invoked per session

**Rationale**:
- First user prompt captures original intent
- Files operated provides context for pattern matching (as hints)
- Skills invoked enables gap analysis
- Minimal data footprint for context window efficiency

**Alternatives Considered**:
- Full session transcripts → Context window explosion
- Only skill invocations → Insufficient for missed opportunity reasoning
- All user prompts → Redundant for intent analysis

**References**:
- Constitution Principle VII: Context window economics
- Spec US-002: Missed opportunity detection needs user intent + context

---

### 4. Database Extension Strategy

**Decision**: Extend existing `sessions.db` with `skill_invocations` table

**Rationale**:
- Consistent with ADR-0006 session log processing architecture
- Single database file (`.agentlint/sessions.db`)
- Can join with existing `sessions` table for context
- Uses established indexing patterns

**Alternatives Considered**:
- Separate `skills.db` file → Complicates queries, violates ADR-0006 pattern
- In-memory only → Loses persistence between runs
- JSON file storage → Poor query performance

**References**:
- [ADR-0006: Session Log Processing Architecture](../../docs/architecture/adr/0006-session-log-processing-architecture.md)

---

### 5. Tool Output Format

**Decision**: Use `_rawData` pattern with formatted text + structured data

**Rationale**:
- Matches existing tool patterns in codebase
- Formatted text for human readability
- `_rawData` for agent's structured access
- Enables both display and programmatic use

**Alternatives Considered**:
- JSON only → Poor human experience in CLI
- Text only → Agent loses structure
- Two separate tools → Redundant, violates consolidation principle

**References**:
- `src/tools/sessions/get-session-stats-tool.ts:36-129` (formatToolOutput pattern)
- CLAUDE.md: "Use `_rawData` pattern for machine-readable data"

---

### 6. Semantic Analysis Approach

**Decision**: Agent performs semantic analysis using LLM reasoning, not tool logic

**Rationale**:
- Constitution Principle VII: Agent reasoning for judgment tasks
- Description-phrasing comparison requires semantic understanding
- No hardcoded similarity thresholds
- Agent can explain WHY phrases don't match

**Alternatives Considered**:
- Local embeddings + cosine similarity → Adds dependency, still needs threshold
- Keyword matching → Too brittle
- Regex patterns → Misses semantic similarity

**References**:
- Spec clarification C1: "LLM calls for semantic analysis"
- Constitution Principle VII: "Agent reasoning provides deep understanding"

---

### 7. File Pattern Handling

**Decision**: File patterns are hints for agent reasoning, not programmatic triggers

**Rationale**:
- Constitution Principle VII: Agent decides relevance
- Patterns may be too broad (`**/*`) or too specific
- Agent can weigh patterns against actual context
- No false positive/negative from pattern matching

**Alternatives Considered**:
- Programmatic glob matching → Creates false detection logic
- Ignore patterns entirely → Loses useful signal
- Weighted pattern scoring → Still hardcodes thresholds

**References**:
- Spec clarification C2: "Agent-driven analysis"
- Spec 10.1: "File patterns are hints for the agent, not programmatic rules"

---

## Technical Validations

### Existing Code Reuse

| Component | Existing Implementation | Reuse Strategy |
|-----------|------------------------|----------------|
| Skill discovery | `src/tools/config/skills.ts` | Import `discoverSkills()` |
| Session parsing | `src/tools/sessions/parser.ts` | Extend with Skill detection |
| Session indexing | `src/tools/sessions/indexer.ts` | Add skill_invocations extraction |
| Database helpers | `src/persistence/common/database.ts` | Use existing patterns |
| Tool patterns | `src/tools/sessions/*-tool.ts` | Follow exact structure |

### Performance Validation

Based on existing session indexing benchmarks:

| Metric | Target | Evidence |
|--------|--------|----------|
| Indexing speed | > 100 sessions/sec | Existing indexer achieves 150+ |
| Query time | < 500ms | FTS5 queries return in ~20ms |
| Memory usage | < 200MB | Stream processing pattern works |

---

## Unresolved Items

None. All open questions from spec have been resolved:
- C1: Semantic comparison → LLM calls
- C2: Generic skills → Agent-driven analysis
- C3: Historical scope → Agent decides
- C4: Minimum sessions → Agent judges
- C5: EP17 TUI → Deferred
