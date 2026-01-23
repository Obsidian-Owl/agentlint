# Feature Specification: Skills Effectiveness Analysis

> **Epic**: EP14
> **Created**: 2026-01-23
> **Status**: Draft
> **Author**: Claude Code

---

## 1. Overview

EP14 implements Skills Effectiveness Analysis—the ability to measure whether Skills are actually being invoked, identify missed opportunities where Skills could have been used but weren't, and suggest improvements to skill descriptions for better auto-discovery. This is a core differentiator for agentlint's strategic pivot from "config linting" to "effectiveness measurement."

### 1.1 Business Context

The January 2026 strategic review identified that users need to know: "Are my Skills actually being invoked? What patterns are hurting me?" Session logs contain `tool_use` entries where `name === "Skill"`, providing the signal needed to answer these questions.

**Strategic Value:**
- Skills are a key lever for effective AI-assisted development
- Low skill invocation rates suggest discovery/description mismatches
- agentlint can uniquely measure whether Skills work in practice, not just whether they exist

**Constitution Alignment:**
- **Principle II (Improvement-Oriented)**: Skills effectiveness tracking compounds value over time
- **Principle III (Causal-First)**: Traces non-invocation to discovery/description issues
- **Principle VIII (Compounding Value)**: Better descriptions improve future sessions

### 1.2 Out of Scope

- Skill creation/editing (users do this manually)
- Cross-project skill comparison (future EP12 integration)
- Real-time skill invocation monitoring
- Non-Claude-Code ACT adapters (future EP08 expansion)
- Skills quality analysis beyond effectiveness (already covered by ADR-0017's config parser)

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: View Skills Invocation Summary

**As a** developer using Skills in my projects,
**I want** to see which Skills are being invoked and how often,
**So that** I can understand whether my Skills are providing value.

**Acceptance Criteria:**
- [ ] Given `.claude/skills/` contains Skills, when I run skills analysis, then I see a list of all defined Skills with invocation counts
- [ ] Given session logs exist for the last 30 days, when I run analysis, then each Skill shows invocation count with trend (30/60/90 day comparison if data exists)
- [ ] Given a Skill has zero invocations, then it is highlighted as "unused"
- [ ] Given analysis runs, then I see total sessions analyzed and total Skill invocations

**Test Scenarios:**
- Happy path: Project with 4 Skills, analyze 50 sessions, see per-skill breakdown
- Empty: Project with no Skills, graceful message about no Skills found
- No sessions: Project with Skills but no session logs, explain no data available
- Partial data: Some Skills invoked, some never, show mixed results

---

### US-002 [P1]: Detect Missed Skill Opportunities

**As a** developer who wants to maximize Skill usage,
**I want** to identify sessions where a Skill could have been invoked but wasn't,
**So that** I can understand why Skills aren't being discovered.

**Acceptance Criteria:**
- [ ] Given a Skill with scope patterns (e.g., `src/api/*`), when a session touches files matching that pattern without invoking the Skill, then it's flagged as a missed opportunity
- [ ] Given missed opportunities are detected, then the output shows: session ID, files touched, matching Skill, user prompt snippet
- [ ] Given a session invoked the Skill, then it's not counted as a missed opportunity (even if other files also touched)
- [ ] Given analysis runs, then I see missed opportunity rate per Skill (e.g., "8 of 12 relevant sessions didn't invoke api-design")

**Test Scenarios:**
- Happy path: Skill scoped to `tests/**`, 10 sessions wrote test files, 3 invoked Skill, show 70% missed
- No scope: Skill has no file patterns, no missed opportunity detection (graceful skip)
- All invoked: Skill always invoked when relevant files touched, 0% missed
- Complex patterns: Skill with multiple globs, verify pattern matching correctness

---

### US-003 [P1]: Analyze Description Mismatch

**As a** developer whose Skills aren't being auto-discovered,
**I want** to understand why the model isn't finding my Skills,
**So that** I can improve skill descriptions to match how I phrase requests.

**Acceptance Criteria:**
- [ ] Given a Skill with low invocation rate, when missed sessions are analyzed, then user prompts from those sessions are extracted
- [ ] Given user prompts and Skill description, when semantic comparison runs, then mismatch patterns are identified
- [ ] Given mismatches are found, then I see: Skill description, user phrases that should have triggered it, specific mismatch explanation
- [ ] Given analysis identifies mismatches, then improved description suggestions are provided

**Test Scenarios:**
- Happy path: Skill description "Guide for testing with Playwright", user says "add tests", detect keyword mismatch
- Good match: Skill description matches user phrasing, no mismatch flagged
- Multiple patterns: Skill missed in 5 sessions with different user phrasings, aggregate common patterns
- Semantic similarity: User says "write unit tests", Skill mentions "testing", detect partial match

---

### US-004 [P2]: Suggest Improved Skill Descriptions

**As a** developer wanting to improve Skill discovery,
**I want** concrete suggestions for better skill descriptions,
**So that** the model can auto-discover my Skills more reliably.

**Acceptance Criteria:**
- [ ] Given a Skill with missed opportunities, when suggestions are generated, then they incorporate actual user phrasing patterns
- [ ] Given suggestions are made, then they follow Agent Skills spec best practices (action verbs, "Use when" triggers)
- [ ] Given current description, then suggested improvement shows diff-style comparison
- [ ] Given multiple missed patterns, then suggestions address the most common patterns first

**Test Scenarios:**
- Happy path: Generate improved description incorporating user's actual phrases
- Already good: Skill with high invocation rate, suggest "no changes needed"
- Multiple issues: Description missing action verbs AND trigger phrases, suggest both improvements
- Length constraint: Ensure suggestions stay within 1024 char limit per spec

---

### US-005 [P2]: Query Skills Invocation Data

**As a** developer investigating specific Skill behavior,
**I want** to query invocation data by Skill, session, or date range,
**So that** I can drill down into specific patterns.

**Acceptance Criteria:**
- [ ] Given a Skill name, when I query invocations, then I see all invocation events with context (session, timestamp, user prompt)
- [ ] Given a date range, when I query, then results are filtered to that period
- [ ] Given a session ID, when I query, then I see all Skills invoked in that session
- [ ] Given query runs, then results are sorted by timestamp (most recent first)

**Test Scenarios:**
- By skill: Query "code-review" Skill, get all invocations
- By date: Query last 7 days, filter correctly
- By session: Query specific session, see Skills used
- Combined: Query specific Skill in specific date range

---

### US-006 [P2]: Skills Effectiveness in Main Analysis Flow

**As a** user running `agentlint analyse`,
**I want** Skills effectiveness to be part of the standard analysis,
**So that** I don't need to run a separate command for this insight.

**Acceptance Criteria:**
- [ ] Given Skills exist in the project, when `agentlint analyse` runs, then Skills effectiveness is included in findings
- [ ] Given analysis runs with `--skills` flag, then focus is on Skills analysis (skip other analyses)
- [ ] Given Skills effectiveness issues are found, then they become recommendations in the main flow
- [ ] Given baseline exists, then Skills metrics are compared to baseline for trend analysis

**Test Scenarios:**
- Integration: Run full analysis, verify Skills findings appear
- Flag filter: Run with `--skills`, verify only Skills analysis runs
- Baseline comparison: Run twice, verify delta calculation works
- No Skills: Run on project without Skills, no errors (graceful skip)

---

### US-007 [P3]: CLI Skills Command

**As a** user wanting standalone Skills analysis,
**I want** a dedicated `agentlint skills` command,
**So that** I can quickly check Skills effectiveness without full analysis.

**Acceptance Criteria:**
- [ ] Given `agentlint skills` command, when run, then Skills summary is displayed
- [ ] Given `agentlint skills --detail <skill-name>`, when run, then detailed analysis for that Skill is shown
- [ ] Given `agentlint skills --suggest`, when run, then description suggestions are generated
- [ ] Given command runs, then output is formatted for CLI readability

**Test Scenarios:**
- Summary: Run `agentlint skills`, see overview
- Detail: Run with skill name, see deep analysis
- Suggest: Run with suggest flag, see improvements
- Help: Run `agentlint skills --help`, see usage

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Detect Skill invocations from session logs via `tool_use.name === "Skill"` | P1 | US-001 |
| FR-002 | Extract skill command from `input.skill` or `input.command` field | P1 | US-001 |
| FR-003 | Build per-skill invocation index with context (session, timestamp, user prompt) | P1 | US-001, US-005 |
| FR-004 | Store invocation data in SQLite for efficient querying | P1 | US-005 |
| FR-005 | Enumerate skills from `.claude/skills/` directory | P1 | US-001 |
| FR-006 | Parse skill frontmatter (name, description, file patterns as hints) | P1 | US-002 |
| FR-007 | Implement `getSkillInventoryTool` to list skills and metadata | P1 | US-001 |
| FR-008 | Implement `getSkillInvocationsTool` for querying invocation data | P1 | US-005 |
| FR-009 | Implement `getSessionSummariesTool` for session context (prompts, files, skills used) | P1 | US-002, US-003 |
| FR-010 | Implement `indexSkillInvocationsTool` to build/update invocation database | P1 | US-001 |
| FR-011 | Provide session summaries with user prompts for agent-driven mismatch analysis | P1 | US-003 |
| FR-012 | Include file patterns in skill inventory as hints (not programmatic rules) | P2 | US-002 |
| FR-013 | Integrate Skills tools into main `agentlint analyse` flow | P2 | US-006 |
| FR-014 | Add `--skills` flag to focus analysis | P2 | US-006 |
| FR-015 | Add `agentlint skills` CLI command | P3 | US-007 |
| FR-016 | Store Skills invocation counts in baselines for temporal comparison | P2 | US-006 |

**Note on Agent-Driven Design**: Per Constitution Principle VII and C2, missed opportunity detection, description mismatch analysis, and suggestion generation are **agent reasoning tasks**, not programmatic tool functions. Tools provide data; the agent reasons about effectiveness.

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Skill invocation indexing | Sessions/second | > 100 sessions/sec |
| NFR-002 | Skill query performance | Query time | < 500ms for 90-day range |
| NFR-003 | Description mismatch analysis | Per-skill time | < 2 seconds |
| NFR-004 | Memory usage during indexing | Peak memory | < 200MB for 1000 sessions |
| NFR-005 | Storage efficiency | Index size | < 10% of raw log size |
| NFR-006 | Test coverage | Code coverage | > 80% |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| SkillInvocation | A single invocation of a Skill from session logs | skillName, sessionId, timestamp, userPromptSnippet |
| SkillInventoryItem | A Skill defined in `.claude/skills/` | name, description, filePatterns (hints), path |
| SessionSummary | Summarized session for agent analysis | sessionId, firstUserPrompt, filesOperated, skillsInvoked, timestamp |

**Agent-Generated Outputs** (not stored entities):
- Missed opportunities (agent reasons about when skills should have been used)
- Description mismatches (agent compares descriptions to user phrasing)
- Improvement suggestions (agent generates based on patterns)
- Effectiveness assessments (agent judges what "low" means contextually)

### 4.1 Entity Relationships

```
SkillInventoryItem --1:N--> SkillInvocation (skill can have many invocations)
Session --1:1--> SessionSummary (summarized for agent consumption)
```

### 4.2 Database Schema

Per ADR-0006 session log processing architecture, extend SQLite with:

```sql
CREATE TABLE skill_invocations (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  context_tokens INTEGER,
  user_prompt_snippet TEXT,
  file_path TEXT,           -- Source JSONL file for reference
  line_number INTEGER,      -- Line in JSONL for causal tracing
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_skill_invocations_skill ON skill_invocations(skill_name);
CREATE INDEX idx_skill_invocations_session ON skill_invocations(session_id);
CREATE INDEX idx_skill_invocations_timestamp ON skill_invocations(timestamp);

CREATE TABLE missed_opportunities (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  files_matched TEXT,       -- JSON array of matched file paths
  user_prompt_snippet TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_missed_skill ON missed_opportunities(skill_name);
CREATE INDEX idx_missed_session ON missed_opportunities(session_id);
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: Tools provide skill inventory, invocation data, and session summaries
- [ ] **Functional**: Agent can reason about missed opportunities using provided data
- [ ] **Functional**: Agent can analyze description mismatches and suggest improvements
- [ ] **Quality**: All user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80% for new code
- [ ] **Performance**: All NFR timing targets met
- [ ] **Constitution**: Tools provide capabilities; agent decides orchestration (Principle VII)
- [ ] **Constitution**: Recommendations are preventive (enable better descriptions), not just symptomatic (report low rates)

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| No `.claude/skills/` directory | Graceful message: "No Skills found in this project" | P1 |
| No session logs | Graceful message: "No session logs found. Run some Claude Code sessions first." | P1 |
| Skill without file patterns | Skip missed opportunity detection for that skill, note in output | P1 |
| Malformed skill SKILL.md | Log warning, continue with other skills | P1 |
| Session log parse error | Use existing EP06 error handling, skip malformed entries | P1 |
| Skill name with special characters | Handle Unicode and special chars in skill names | P2 |
| Very large session logs (>100MB) | Stream processing, don't load entire file in memory (use EP06 patterns) | P1 |
| Skill description empty | Flag as "missing description", suggest adding one | P2 |
| Circular file patterns (e.g., `**/*`) | Warn that pattern is too broad for meaningful analysis | P2 |
| API rate limit during mismatch analysis | Retry with backoff, fail gracefully with partial results | P2 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP06 (Session Analysis Tools) | Internal | Complete | Cannot parse session logs |
| EP02 (Orchestration Core) | Internal | Complete | Cannot register tools |
| EP11 (Quality & Security) | Internal | Complete | Cannot debug/evaluate |
| ADR-0017 (Agent Skills Integration) | Internal | Accepted | Follow skill parsing patterns |
| ADR-0006 (Session Log Processing) | Internal | Accepted | Follow SQLite FTS5 patterns |
| Claude Code session logs | External | Required | No data to analyze |
| `.claude/skills/` directory | External | Optional | Graceful degradation |

### 7.2 Assumptions

- Claude Code logs Skill invocations as `tool_use` with `name: "Skill"`
- Skill command is available in `input.skill` or `input.command`
- File operations are logged as Read/Write/Edit tool calls with file paths
- Session logs follow existing JSONL format per EP06 parsing
- Users have been using Claude Code for at least some sessions (otherwise no data)
- LLM semantic comparison is acceptable for description mismatch analysis

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should semantic comparison use local embeddings or LLM calls? — **RESOLVED: LLM calls**
- [x] **Q2**: How should we handle Skills with no file patterns (generic skills)? — **RESOLVED: Agent-driven analysis (no file pattern matching)**
- [x] **Q3**: Should missed opportunity detection run on historical data or just new sessions? — **RESOLVED: Agent decides scope based on context**
- [x] **Q4**: What's the minimum session count before reporting trends? — **RESOLVED: Agent judges data sufficiency contextually**
- [x] **Q5**: Should we integrate with EP17 TUI in this epic or defer? — **RESOLVED: Defer TUI to EP17**

---

## 9. References

- [Epic Definition](../../docs/planning/epics/EP14-skills-effectiveness.md)
- [ADR-0017: Agent Skills Integration Strategy](../../docs/architecture/adr/0017-agent-skills-integration-strategy.md)
- [ADR-0006: Session Log Processing Architecture](../../docs/architecture/adr/0006-session-log-processing-architecture.md)
- [Strategic Review (Jan 2026)](../../docs/review/agentlint-strategic-review-jan26.md)
- [Constitution](../../.specify/memory/constitution.md)

---

## 10. Technical Design Notes

**Design Philosophy (per Constitution):**

Tools provide **data access capabilities**. The agent decides **when and how** to use them. Per Constitution Principle VII (Intelligent Tooling) and the ADR Implementation Notes, we do NOT prescribe agent orchestration—we provide capabilities the agent can leverage.

### 10.1 Core Principle: Agent-Driven Analysis

The agent reasons about skills effectiveness; tools provide data.

| Capability | Tool Provides | Agent Decides |
|------------|---------------|---------------|
| Invocation tracking | Raw invocation data | Whether rates are "low" |
| Missed opportunities | Session + skill context | Whether skill SHOULD have been used |
| Description quality | Description + user prompts | Why discovery failed, what to improve |
| Trend analysis | Historical data | Whether enough data for meaningful trends |

**No rigid rules.** File patterns are hints for the agent, not programmatic triggers.

### 10.2 Data Access Tools

```typescript
import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-code-sdk';

/**
 * Get skill inventory from project.
 * Provides: skill definitions, descriptions, file pattern hints
 * Agent uses for: understanding what skills exist and their purpose
 */
export const getSkillInventoryTool = tool({
  name: 'get_skill_inventory',
  description: 'Enumerate skills from .claude/skills/ directory with their descriptions and metadata.',
  parameters: z.object({
    projectPath: z.string().optional().describe('Project path (defaults to cwd)'),
  }),
  execute: async (input) => {
    // Returns: Array<{ name, description, filePatterns (hints), path }>
  },
});

/**
 * Get skill invocation data from session logs.
 * Provides: when skills were invoked, in which sessions, with what context
 * Agent uses for: counting invocations, understanding usage patterns
 */
export const getSkillInvocationsTool = tool({
  name: 'get_skill_invocations',
  description: 'Query skill invocation events from indexed session logs.',
  parameters: z.object({
    skillName: z.string().optional().describe('Filter by skill name'),
    sessionId: z.string().optional().describe('Filter by session ID'),
    since: z.string().optional().describe('Start date (ISO-8601)'),
    until: z.string().optional().describe('End date (ISO-8601)'),
    limit: z.number().default(100).describe('Maximum results'),
  }),
  execute: async (input) => {
    // Returns: Array<{ skillName, sessionId, timestamp, userPromptSnippet }>
  },
});

/**
 * Get session summaries for analysis.
 * Provides: session overview with user prompts, files touched, skills used
 * Agent uses for: reasoning about missed opportunities, understanding user intent
 */
export const getSessionSummariesTool = tool({
  name: 'get_session_summaries',
  description: 'Get summarized session data for skills analysis. Includes user prompts, files operated, and skills invoked.',
  parameters: z.object({
    since: z.string().optional().describe('Start date (ISO-8601)'),
    until: z.string().optional().describe('End date (ISO-8601)'),
    projectPath: z.string().optional().describe('Filter by project'),
    limit: z.number().default(50).describe('Maximum sessions'),
  }),
  execute: async (input) => {
    // Returns: Array<{ sessionId, firstUserPrompt, filesOperated, skillsInvoked, timestamp }>
  },
});

/**
 * Index new session logs for skill invocations.
 * Provides: builds/updates the invocation database
 * Agent uses for: ensuring data is current before analysis
 */
export const indexSkillInvocationsTool = tool({
  name: 'index_skill_invocations',
  description: 'Index session logs to extract skill invocation data. Run before analysis to ensure data is current.',
  parameters: z.object({
    projectPath: z.string().optional().describe('Project path'),
    force: z.boolean().default(false).describe('Force re-index even if already indexed'),
  }),
  execute: async (input) => {
    // Returns: { sessionsIndexed, invocationsFound, newSinceLastIndex }
  },
});
```

### 10.3 Skill Invocation Detection (Static Tool Logic)

```typescript
/**
 * Detect Skill invocations in session logs.
 * Per strategic review: `tool_use.name === "Skill"`
 *
 * This is deterministic extraction—the tool finds invocations,
 * the agent reasons about their meaning.
 */
function isSkillInvocation(block: ContentBlock): boolean {
  return block.type === 'tool_use' && block.name === 'Skill';
}

function extractSkillCommand(block: ContentBlock): string | null {
  if (!isSkillInvocation(block)) return null;
  const input = block.input as Record<string, unknown> | undefined;
  return (input?.skill as string) || (input?.command as string) || null;
}

function extractUserPromptContext(entries: SessionEntry[], invocationIndex: number): string {
  // Look backwards from invocation to find the triggering user prompt
  for (let i = invocationIndex - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.message?.role === 'user' && entry.message.content) {
      const textBlocks = entry.message.content.filter(b => b.type === 'text');
      if (textBlocks.length > 0) {
        return (textBlocks[0].text || '').slice(0, 200);
      }
    }
  }
  return '';
}
```

### 10.4 Skill Inventory Discovery (Static Tool Logic)

```typescript
import { glob } from 'glob';
import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';

interface SkillInventoryItem {
  name: string;
  description: string;
  filePatterns: string[];  // Hints for agent, not programmatic rules
  path: string;
}

async function discoverSkills(projectPath: string): Promise<SkillInventoryItem[]> {
  const skillDirs = await glob('.claude/skills/*/SKILL.md', { cwd: projectPath });
  const skills: SkillInventoryItem[] = [];

  for (const skillPath of skillDirs) {
    const content = await Bun.file(path.join(projectPath, skillPath)).text();
    const parsed = await parseSkillMd(content);
    if (parsed) {
      skills.push({ ...parsed, path: skillPath });
    }
  }

  return skills;
}

async function parseSkillMd(content: string): Promise<Omit<SkillInventoryItem, 'path'> | null> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml']);

  const tree = processor.parse(content);
  const frontmatterNode = tree.children.find(n => n.type === 'yaml');
  if (!frontmatterNode) return null;

  const frontmatter = parseYaml(frontmatterNode.value);

  return {
    name: frontmatter.name || '',
    description: frontmatter.description || '',
    filePatterns: frontmatter.filePatterns || [],
  };
}
```

### 10.5 What the Agent Does (NOT in code)

The agent, using its reasoning capabilities, will:

1. **Assess invocation rates**: "Skill X was invoked 3 times in 47 sessions—is that low?"
2. **Identify missed opportunities**: "This session asked about testing but didn't use the testing skill—why?"
3. **Analyze description mismatches**: "The skill says 'Playwright testing' but users say 'add tests'—semantic gap"
4. **Suggest improvements**: "Consider changing description to include 'add tests', 'write unit tests'"
5. **Judge data sufficiency**: "Only 5 sessions—not enough for meaningful trend analysis"

**These are agent reasoning tasks, not tool logic.**

### 10.6 Database Schema

```sql
-- Skill invocations indexed from session logs
CREATE TABLE skill_invocations (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  user_prompt_snippet TEXT,
  file_path TEXT,           -- Source JSONL for causal tracing
  line_number INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_skill_invocations_skill ON skill_invocations(skill_name);
CREATE INDEX idx_skill_invocations_session ON skill_invocations(session_id);
CREATE INDEX idx_skill_invocations_timestamp ON skill_invocations(timestamp);
```

**Note**: No `missed_opportunities` table. Missed opportunities are identified by agent reasoning over session summaries, not by programmatic detection.

### 10.7 Module Structure

```
src/skills/
├── index.ts              # Module entry, tool exports
├── types.ts              # TypeScript interfaces
├── schemas.ts            # Zod validation schemas
├── discovery.ts          # Skill inventory discovery (static)
├── detection.ts          # Invocation detection from logs (static)
├── storage/
│   ├── index.ts          # Storage module entry
│   ├── schema.ts         # SQLite schema definitions
│   └── queries.ts        # SQL query helpers
└── tools/
    ├── index.ts          # Tool exports
    ├── get-skill-inventory-tool.ts
    ├── get-skill-invocations-tool.ts
    ├── get-session-summaries-tool.ts
    └── index-skill-invocations-tool.ts
```

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-23

**C1: Semantic comparison method (Q1)**
**Q:** Should semantic comparison for description mismatch analysis use local embeddings or LLM calls?
**A:** LLM calls. Per Constitution Principle VII, agent reasoning provides deep understanding for semantic analysis. The mismatch analysis is a perfect case for agent reasoning—judging why phrasing differs semantically.

**Updated:** FR-011 uses agent reasoning, not programmatic comparison.

---

**C2: Generic skills handling (Q2)**
**Q:** How should we handle Skills with no file patterns (generic skills)?
**A:** Agent-driven analysis. The agent reasons about whether a skill should have been used based on session context and user intent—not programmatic file pattern matching. File patterns become hints for the agent, not rigid rules.

**Updated:**
- Removed `detectMissedOpportunities()` function from spec
- Removed `missed_opportunities` table from schema
- Tools provide data; agent identifies missed opportunities via reasoning

---

**C3: Historical vs incremental analysis (Q3)**
**Q:** Should missed opportunity detection run on historical data or just new sessions?
**A:** Agent decides scope based on context. If user asks "analyze last 90 days," agent uses 90-day range. If user asks "why isn't my skill being used?", agent decides what scope is relevant.

**Updated:** No fixed time ranges specified. Tool parameters allow flexible date filtering; agent chooses.

---

**C4: Minimum session count for trends (Q4)**
**Q:** What's the minimum session count before reporting trends?
**A:** Agent judges data sufficiency contextually. With 3 sessions, agent explains "insufficient data." With 50 sessions across 90 days, agent reports trends. No hardcoded threshold.

**Updated:** Removed from spec. Agent reasoning handles this.

---

**C5: EP17 TUI integration (Q5)**
**Q:** Should we integrate with EP17 TUI in this epic or defer?
**A:** Defer TUI to EP17. EP14 delivers tools and CLI. TUI integration happens when EP17 TUI architecture is ready.

**Updated:** Success criteria updated to remove EP17 dependency.
