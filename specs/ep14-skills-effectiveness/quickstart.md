# Quickstart: Skills Effectiveness Analysis

> **Epic**: EP14
> **Created**: 2026-01-24

---

## Installation

Skills effectiveness tools are built into agentlint. No additional installation required.

```bash
# Ensure agentlint is installed
agentlint --version

# Index session logs (if not already indexed)
agentlint scan
```

---

## Basic Usage

### 1. Analyze Skills Effectiveness

Run the main analysis command with skills focus:

```bash
agentlint analyse --skills
```

The agent will:
1. Discover skills from `.claude/skills/`
2. Index skill invocations from session logs
3. Analyze invocation patterns
4. Identify potential missed opportunities
5. Suggest description improvements

### 2. Standalone Skills Command

For quick skills-only analysis:

```bash
agentlint skills
```

Options:
```bash
agentlint skills                    # Summary of all skills
agentlint skills --detail api-design # Deep dive on specific skill
agentlint skills --suggest          # Get description improvement suggestions
```

---

## Common Patterns

### Check If Skills Are Being Used

```
User: "Are my Skills being invoked?"

Agent will:
- Query skill inventory (get_skill_inventory)
- Query invocations (get_skill_invocations)
- Report: "code-review: 12 invocations, api-design: 0 invocations"
- Reason about whether counts are appropriate given session activity
```

### Find Missed Opportunities

```
User: "Why isn't my api-design skill being used?"

Agent will:
- Get skill description and file patterns (get_skill_inventory)
- Get session summaries (get_session_summaries)
- Identify sessions with API work but no skill invocation
- Analyze user prompts vs skill description
- Suggest why discovery might be failing
```

### Improve Skill Descriptions

```
User: "Help me improve my skill descriptions"

Agent will:
- Query invocation data for all skills
- Get session summaries for low-invocation skills
- Compare user phrasing to skill descriptions
- Suggest description changes incorporating actual user language
```

---

## Tool Reference

### get_skill_inventory

Enumerates skills from `.claude/skills/` directory.

```
Parameters:
  projectPath?: string  - Project path (defaults to cwd)

Returns:
  skills: Array<{name, description, path, filePatterns}>
  skillCount: number
```

### get_skill_invocations

Queries skill invocation data from indexed sessions.

```
Parameters:
  skillName?: string    - Filter by skill
  sessionId?: string    - Filter by session
  since?: string        - Start date (ISO-8601)
  until?: string        - End date (ISO-8601)
  limit?: number        - Max results (default: 100)

Returns:
  invocations: Array<{skillName, sessionId, timestamp, userPromptSnippet}>
  totalCount: number
```

### get_session_summaries

Gets session context for missed opportunity analysis.

```
Parameters:
  since?: string        - Start date (ISO-8601)
  until?: string        - End date (ISO-8601)
  projectPath?: string  - Filter by project
  limit?: number        - Max sessions (default: 50)

Returns:
  sessions: Array<{sessionId, firstUserPrompt, filesOperated, skillsInvoked}>
  totalSessions: number
```

### index_skill_invocations

Builds/updates the skill invocation database.

```
Parameters:
  projectPath?: string  - Project path
  force?: boolean       - Force re-index

Returns:
  sessionsIndexed: number
  invocationsFound: number
  newSinceLastIndex: number
```

---

## Data Flow

```
Session Logs (.jsonl)
        │
        ▼
┌───────────────────┐
│ index_skill_      │  Extracts tool_use.name === "Skill"
│ invocations       │  entries and stores in SQLite
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ skill_invocations │  Database table
│ table             │
└───────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                   Agent Reasoning                          │
│                                                           │
│  Tools provide data:           Agent provides judgment:   │
│  - Invocation counts           - "This is low"            │
│  - Session summaries           - "This was missed"        │
│  - Skill descriptions          - "Description should say" │
└───────────────────────────────────────────────────────────┘
```

---

## Key Principles

1. **Tools return data, agent reasons**
   - Tools don't say "low invocation rate"
   - Agent interprets counts in context

2. **File patterns are hints**
   - `filePatterns` in skills aren't matching rules
   - Agent uses them as context clues

3. **No hardcoded thresholds**
   - No magic numbers like "< 30% is bad"
   - Agent judges appropriateness contextually

4. **Semantic analysis uses LLM**
   - Description-phrasing comparison is agent reasoning
   - Not keyword matching or embeddings
