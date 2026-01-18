# Feature Specification: ACT Subagents

> **Epic**: EP08
> **Created**: 2026-01-18
> **Status**: Draft
> **Author**: Claude

---

## 1. Overview

The ACT (AI Coding Tool) Subagents feature implements specialized analysis agents for different AI coding tools using the Claude Agent SDK's native subagent pattern. Rather than hard-coded adapter classes, this feature defines **programmatic subagents** that the main agentlint orchestrator can invoke for ACT-specific analysis.

This architecture:
- Uses SDK's built-in subagent mechanism (not filesystem skills)
- Bundles ACT instructions with agentlint (not in user's `.claude/`)
- Leverages existing EP05/EP06 tools for data access
- Enables future extensibility via `~/.agentlint/` customization

### 1.1 Business Context

This feature supports Constitution Principle VI (Agent-Agnostic) by enabling agentlint to analyze workflows across different AI coding tools without hard-coding tool-specific logic into the main orchestrator. The subagent pattern aligns with Constitution Principle VII (Intelligent Tooling) - the agent decides when to invoke specialists.

### 1.2 Architectural Decision

**Why Subagents, Not Skills?**

| Approach | Location | Mechanism | Verdict |
|----------|----------|-----------|---------|
| Claude Code Skills | `.claude/skills/` | Filesystem, user-owned | **Wrong** - pollutes user's Claude Code config |
| Hard-coded Adapters | `src/adapters/` | Static classes | **Wrong** - not agentic, rigid |
| SDK Subagents | `src/act/` | Programmatic `agents` option | **Correct** - SDK native, shipped with agentlint |

### 1.3 Out of Scope

- **Cursor subagent** - Future epic (when Cursor analysis is needed)
- **Aider subagent** - Future epic
- **Copilot CLI subagent** - Future epic
- **User-extensible subagents** - P3, via `~/.agentlint/act-instructions/`
- **Git SDK tools** - Deferred to EP13

---

## 2. User Scenarios & Testing

### US-001 [P1]: Automatic ACT Detection and Subagent Invocation

**As a** developer using agentlint,
**I want** the orchestrator to automatically detect my AI coding tool and invoke the appropriate specialist,
**So that** I get accurate, tool-specific analysis without manual configuration.

**Acceptance Criteria:**
- [ ] Given a project with CLAUDE.md, when agentlint analyzes, then the `claude-code-analyzer` subagent is available
- [ ] Given a project with only AGENTS.md, when agentlint analyzes, then the `generalized-analyzer` subagent handles it
- [ ] Given the orchestrator with subagents defined, when Claude reasons about the task, then it autonomously invokes the appropriate subagent
- [ ] Given subagent invocation, when analysis completes, then results flow back to the main orchestrator

**Test Scenarios:**
- Happy path: Project with CLAUDE.md triggers claude-code-analyzer
- Fallback: Unknown config uses generalized-analyzer
- Auto-selection: Claude chooses correct subagent based on task

---

### US-002 [P1]: Claude Code Analysis Specialist

**As a** developer using Claude Code,
**I want** a specialized analyst that understands Claude Code's structure,
**So that** I get accurate analysis of my CLAUDE.md files and session logs.

**Acceptance Criteria:**
- [ ] Given the claude-code-analyzer subagent, when invoked, then it understands CLAUDE.md hierarchy (global → project → local)
- [ ] Given the subagent, when analyzing sessions, then it knows session logs are at `~/.claude/projects/`
- [ ] Given the subagent, when analyzing config, then it understands .claude/settings.json structure
- [ ] Given the subagent, when analyzing skills, then it can locate .claude/skills/*/SKILL.md

**Test Scenarios:**
- Config analysis: Subagent analyzes CLAUDE.md with hierarchy awareness
- Session analysis: Subagent locates and analyzes session logs
- Settings analysis: Subagent parses .claude/settings.json correctly

---

### US-003 [P1]: Generalized Analysis Fallback

**As a** developer using an unknown AI coding tool,
**I want** best-effort analysis,
**So that** I still get value even if my specific tool isn't supported.

**Acceptance Criteria:**
- [ ] Given the generalized-analyzer subagent, when invoked, then it provides analysis for AGENTS.md
- [ ] Given unknown config patterns, when analyzing, then it applies reasonable heuristics
- [ ] Given partial tool detection, when reporting, then it suggests which specific subagent might help

**Test Scenarios:**
- AGENTS.md: Generalized analyzer provides useful analysis
- Unknown: Best-effort analysis with clear limitations stated

---

### US-004 [P2]: Subagent Registration in Orchestrator

**As a** maintainer extending agentlint,
**I want** to add new ACT subagents without modifying the orchestrator,
**So that** the system is extensible.

**Acceptance Criteria:**
- [ ] Given a new ACT instructions file, when building subagent config, then it's included in the `agents` option
- [ ] Given subagent definitions, when orchestrator starts, then all subagents are available to Claude
- [ ] Given the `Task` tool, when available, then Claude can invoke any registered subagent

**Test Scenarios:**
- Registration: New subagent definition is picked up
- Invocation: Claude can invoke via Task tool

---

### US-005 [P3]: User-Extensible ACT Instructions

**As a** power user,
**I want** to customize or add ACT analysis instructions,
**So that** I can support tools agentlint doesn't ship with.

**Acceptance Criteria:**
- [ ] Given `~/.agentlint/act-instructions/` directory, when loading, then user instructions are merged with bundled ones
- [ ] Given user instructions override bundled, when there's a naming conflict, then user instructions take precedence
- [ ] Given invalid user instructions, when loading, then warning is logged and bundled defaults used

**Test Scenarios:**
- Custom instructions: User-provided instructions are loaded
- Override: User instructions take precedence over bundled
- Error handling: Invalid instructions gracefully handled

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Define `ACTSubagentDefinition` type matching SDK's `AgentDefinition` | P1 | US-001 |
| FR-002 | Implement `claude-code-analyzer` subagent with bundled instructions | P1 | US-002 |
| FR-003 | Implement `generalized-analyzer` subagent for fallback analysis | P1 | US-003 |
| FR-004 | Create `buildACTSubagents()` function returning `agents` config | P1 | US-004 |
| FR-005 | Integrate subagent config into `Orchestrator` query options | P1 | US-001 |
| FR-006 | Subagents have access to EP05/EP06 MCP tools | P1 | US-002 |
| FR-007 | Load user-extensible instructions from `~/.agentlint/act-instructions/` | P3 | US-005 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Subagent loading performance | Startup time overhead | < 100ms |
| NFR-002 | Instruction bundle size | Total bundled instruction size | < 50KB |
| NFR-003 | Extensibility | Lines to add new ACT subagent | < 100 LOC |
| NFR-004 | Error resilience | Graceful degradation | 100% (bad instructions don't crash) |

---

## 4. Key Entities

### 4.1 Entity Overview

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| `ACTSubagentDefinition` | Type alias for SDK's `AgentDefinition` | description, prompt, tools, model |
| `ACTInstructions` | Bundled instructions for an ACT | name, description, prompt, tools |
| `ACTSubagentRegistry` | Registry of all ACT subagents | subagents, get(), list(), toAgentsOption() |

### 4.2 SDK Integration

The Claude Agent SDK's `AgentDefinition` interface (from `@anthropic-ai/claude-agent-sdk`):

```typescript
interface AgentDefinition {
  /** Natural language description - Claude uses this to decide when to invoke */
  description: string;

  /** The agent's system prompt defining its role and behavior */
  prompt: string;

  /** Array of allowed tool names. Omit to inherit all, use [] to deny all. */
  tools?: string[];

  /** Array of tool names to explicitly disallow (opposite of tools) */
  disallowedTools?: string[];

  /** Model override: 'sonnet' | 'opus' | 'haiku' | 'inherit' */
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';

  /** MCP servers available to this subagent */
  mcpServers?: Array<{ name: string; config: unknown }>;
}
```

**Critical SDK Constraints:**
- The `Task` tool must be in the main agent's `allowedTools` for any subagent invocation
- Subagents CANNOT spawn their own subagents (single-depth)
- Do NOT include `Task` in any subagent's `tools` array

### 4.3 Proposed Structure

```
src/
└── act/
    ├── index.ts                    # Exports buildACTSubagents()
    ├── types.ts                    # ACTSubagentDefinition, ACTInstructions
    ├── registry.ts                 # ACTSubagentRegistry class
    ├── instructions/
    │   ├── claude-code.ts          # Claude Code specialist instructions
    │   └── generalized.ts          # Generalized fallback instructions
    └── loader.ts                   # User instructions loader (~/.agentlint/)
```

### 4.4 Entity Relationships

```
Orchestrator --uses--> ACTSubagentRegistry
ACTSubagentRegistry --contains--> ACTInstructions[]
ACTInstructions --produces--> AgentDefinition (SDK type)
AgentDefinition --passed to--> query({ options: { agents: {...} } })
```

### 4.5 Integration with Orchestrator

```typescript
// In orchestrator.ts - modified run() method
import { buildACTSubagents } from '../act';

for await (const message of query({
  prompt: task,
  options: {
    model: this.config.model,
    mcpServers: { agentlint: mcpServer },
    // CRITICAL: 'Task' must be included for subagent invocation
    allowedTools: [...builtinTools, 'Task'],
    // EP08 integration - provides ACT analyzer subagents
    agents: buildACTSubagents(),
  },
})) {
  // Process streaming messages
  // Check for subagent invocation: message.message?.content with tool_use name === 'Task'
}
```

**How invocation works:**
1. Claude sees the task and registered subagents' descriptions
2. Claude autonomously decides to delegate via the `Task` tool
3. Subagent runs with its own prompt and restricted tools
4. Results flow back to main orchestrator

---

## 5. Success Criteria

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80%, no critical bugs
- [ ] **Integration**: Orchestrator invokes subagents via SDK's Task tool
- [ ] **Extensibility**: New ACT subagent can be added with < 100 LOC
- [ ] **Constitution**: Aligns with Principles VI (Agent-Agnostic), VII (Intelligent Tooling), IX (Agent-Aware)

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| No ACT configs detected in project | Use generalized-analyzer, report findings | P1 |
| Subagent instructions file missing | Log warning, use default instructions | P1 |
| User instructions malformed | Log warning, skip user instructions, use bundled | P2 |
| Subagent exceeds context window | SDK handles compaction; subagent continues | P1 |
| Subagent invocation fails | Error propagates to orchestrator, logged | P1 |
| Multiple ACT types in one project | Claude decides which subagent(s) to invoke | P2 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP02 (Orchestration Core) | Internal | Complete | Orchestrator provides integration point |
| EP05 (Config Analysis Tools) | Internal | Complete | Subagents use discover_configs, parse_config |
| EP06 (Session Analysis Tools) | Internal | Complete | Subagents use search_sessions, get_session_stats |
| Claude Agent SDK | External | Available | Provides `agents` option and `AgentDefinition` type |

### 7.2 Assumptions

- SDK's `AgentDefinition` interface is stable (per documentation)
- `Task` tool is available by including it in `allowedTools`
- Subagents can access MCP tools registered on the main orchestrator
- Subagent prompts are bundled as TypeScript string constants (no external files)
- User extensibility via `~/.agentlint/` is P3 and can be deferred

---

## 8. Open Questions

- [x] **Q1**: Should subagents be defined programmatically or via filesystem? — **Resolved**: Programmatically via SDK's `agents` option
- [x] **Q2**: Where should ACT instructions live? — **Resolved**: Bundled in `src/act/instructions/`, user-extensible via `~/.agentlint/act-instructions/`
- [x] **Q3**: How do subagents access tools? — **Resolved**: Via `tools` array in `AgentDefinition`, referencing MCP tools from ToolRegistry
- [x] **Q4**: Should subagents have different models? — **Resolved**: Inherit from main orchestrator. Simpler, consistent behavior.
- [x] **Q5**: How should we handle subagent depth limits? — **Resolved**: Single depth only (main → subagent). Aligns with SDK design where subagents cannot spawn subagents.

---

## 9. References

- [EP08 Epic](../../docs/planning/epics/EP08-act-adapters.md)
- [Claude Agent SDK - Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Claude Agent SDK - Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [ADR-0002: Agentic Framework Strategy](../../docs/architecture/adr/0002-agentic-framework-strategy.md)
- [Constitution Principle VI: Agent-Agnostic](../../.specify/memory/constitution.md)
- [Constitution Principle VII: Intelligent Tooling](../../.specify/memory/constitution.md)
- [EP02 Orchestrator](../../src/orchestration/orchestrator.ts)

---

## Clarifications

> This section is populated by /dev.clarify

<!-- Clarifications will be added here -->
