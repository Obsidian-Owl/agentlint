# agentlint Strategic Review: Pre-Alpha Assessment

**Date:** January 23, 2026  
**Status:** Strategic Pivot Required

---

## Executive Summary

agentlint's current approach—linting configuration files for formatting and completeness—is undifferentiated and misses what users actually need. Research validates that agentlint CAN measure what matters: **whether Skills, Agents, and practices are actually working**.

**The pivot:** From "Is your CLAUDE.md well-formatted?" to "Are your Skills being invoked? Is your context efficient? What patterns are causing problems?"

Session logs contain all the signals needed. The architecture supports this. What's required is reframing what we measure.

---

## Part 1: Validated Research Findings

### Q1: Can We Detect Skills Invocation from Logs?

**YES.** Claude Code logs include `tool_use` entries. Skills are invoked via a "Skill" tool:

```json
{
  "message": {
    "content": [
      { "type": "tool_use", "name": "Skill", "input": { "command": "pdf" } }
    ]
  }
}
```

We can reliably detect: which Skills were invoked, when, and in what context.

### Q2: What Signals Are Observable in Session Logs?

| Signal | Detection Method | Insight |
|--------|------------------|---------|
| **Skills invocation** | `tool_use.name == "Skill"` | Which Skills used, frequency |
| **Subagent delegation** | `tool_use.name == "Task"` | Agent orchestration patterns |
| **MCP tool usage** | `tool_use.name.startsWith("mcp__")` | External tool integration |
| **Token usage** | `usage` object | Cost and context efficiency |
| **Compression events** | System messages | Context overflow frequency |
| **Tool errors** | `is_error: true` | Recovery patterns |
| **File operations** | Read/Write/Edit calls | Which files touched, re-read ratios |

### Q3: How Different Are Log Formats Across ACTs?

**Significantly different—adapters required.**

| ACT | Format | Location |
|-----|--------|----------|
| Claude Code | JSONL | `~/.claude/projects/<project>/<session>.jsonl` |
| Cursor | SQLite | `%APPDATA%/Cursor/User/workspaceStorage/<hash>/state.vscdb` |
| OpenCode | JSON files | `~/.local/share/opencode/storage/message/{sessionID}/` |
| Codex | JSONL | `~/.codex/sessions/` |

**Recommendation:** Start with Claude Code (richest logs, largest user base), add adapters later.

### Q4: What Does "Effective ACT Usage" Actually Mean?

Based on research, effective users:

1. **Configure appropriately** — Relevant Skills, good CLAUDE.md, appropriate permissions
2. **Invoke effectively** — Skills triggered when relevant (auto-discovery working)
3. **Manage context** — Low compression events, efficient token usage
4. **Delegate well** — Subagents used for isolation and parallelism
5. **Recover cleanly** — Errors lead to fixes, not loops

**agentlint's opportunity:** Measure these dimensions from observable log data.

---

## Part 2: The Full ACT Feature Landscape

Skills are ONE effectiveness lever. The complete picture:

### Configuration Features (Static Analysis)

| Feature | Files | What agentlint Can Assess |
|---------|-------|---------------------------|
| **Rules** | CLAUDE.md, AGENTS.md | Presence, structure, coverage |
| **Skills** | .claude/skills/*/SKILL.md | Inventory, descriptions, quality |
| **Agents** | .claude/agents/*.md | Definitions, tool restrictions |
| **Hooks** | settings.json hooks config | Lifecycle automation setup |
| **MCPs** | mcp config | External tool configuration |
| **Permissions** | permission config | Security and friction setup |

### Runtime Features (Log Analysis)

| Feature | Log Signal | What agentlint Can Measure |
|---------|------------|----------------------------|
| **Skills invocation** | Skill tool calls | Frequency, coverage, missed opportunities |
| **Subagent delegation** | Task tool calls | Orchestration patterns, context savings |
| **MCP usage** | mcp__* tool calls | Integration health, error rates |
| **Permission prompts** | Permission events | Friction patterns, optimization opportunities |
| **Context efficiency** | Token usage, compression | Overflow frequency, efficiency trends |

### Quality Indicators (Derived Patterns)

| Indicator | How to Detect | What It Suggests |
|-----------|---------------|------------------|
| High compression frequency | >3 per session | Context management issues |
| High file re-read ratio | >2.0x | Context loss, agent forgetting |
| Low Skill invocation rate | <30% when Skills exist | Discovery/description mismatch |
| Circular tool patterns | Same call 3+ times | Agent stuck in retry loop |
| Instruction drift | Patterns contradict rules | Rules being ignored (use hooks instead) |

---

## Part 3: What agentlint Should Measure

### 1. Skills Effectiveness

```
Skills Analysis (last 30 days)
==============================
Defined: 4 Skills
Invoked: 17 of 47 sessions (36%)

Per-Skill Breakdown:
  code-review    12 invocations  ████████████
  testing         3 invocations  ███
  deployment      2 invocations  ██
  api-design      0 invocations  

Missed Opportunities:
  • api-design: 0 invocations, but 8 sessions touched src/api/*
  • testing: 3 invocations, but 12 sessions wrote test files

Discovery Issue Detected:
  "testing" description: "Guide for testing with Playwright"
  User phrases in test sessions: "add tests", "write unit tests"
  → Description doesn't match how you phrase requests
```

### 2. Context Efficiency

```
Context Patterns (last 30 days)
===============================
Total sessions: 47
Compression events: 3.2 per session (HIGH)
File re-reads: 2.4x average

Correlation Analysis:
  Sessions WITH Skills:     1.1 compression/session (-66%)
  Sessions WITH subagents:  0.8 compression/session (-75%)
  
Recommendation: Increase Skill and subagent usage
```

### 3. Subagent Delegation

```
Subagent Usage (last 30 days)
=============================
Task invocations: 34 total
  Explore (read-only):  18
  Plan (architecture):   8
  code-reviewer:         6
  test-runner:           2

Context Impact:
  WITH delegation:    28K avg tokens, 0.8 compression/session
  WITHOUT delegation: 52K avg tokens, 3.2 compression/session
  
Insight: Delegation reduces main context pressure by ~46%
```

### 4. MCP Integration Health

```
MCP Tool Usage
==============
Configured: 3 servers
  mcp__playwright  23 calls, 34% error rate (HIGH)
  mcp__github      45 calls, 2% error rate
  mcp__postgres     0 calls (configured but unused)

Issues:
  • playwright: High error rate suggests connection problems
  • postgres: Never used—misconfigured or unnecessary?
```

### 5. Permission Friction

```
Permission Patterns
===================
Total prompts: 156 across 47 sessions

High-frequency approvals (candidates for auto-allow):
  "npm test"      34 approvals
  "grep *"        28 approvals
  "git status"    12 approvals

Suggested permission config:
  bash:
    "npm test": "allow"
    "grep *": "allow"
    "git status *": "allow"
```

### 6. Symptom Patterns (Not "Failures")

```
Session Pattern Analysis
========================

HIGH COMPRESSION (18 sessions)
  >3 compression events per session
  Correlates with: Low Skill usage, no subagent delegation

CIRCULAR TOOL CALLS (7 sessions)
  Same tool called 3+ times with identical input
  Indicates: Agent stuck in retry loop

INSTRUCTION DRIFT (12 sessions)
  Patterns contradicting CLAUDE.md rules
  Note: Agents often ignore rules—consider hooks for enforcement
```

---

## Part 4: The UX Pivot

### Problem with Current Approach

CLI commands like `agentlint explain session-47` assume users:
- Know what "sessions" are
- Know where to find session IDs
- Understand agentlint's data model

If users knew this, they wouldn't need agentlint.

### Agent-Led Discovery

When the user runs `agentlint`, the agent should lead:

```
$ agentlint

Scanning your ACT environment...

Found:
  • Claude Code sessions: 47 (last 30 days)
  • Skills: 4 defined, 36% invocation rate
  • Subagents: 2 custom
  • MCP servers: 3 configured (1 unused, 1 high error rate)

Observations:
  ⚠ Skills invocation rate is low (36%)
  ⚠ High compression frequency (3.2/session)
  ⚠ MCP server "postgres" configured but never used

What would you like to explore?
  [1] Why aren't my Skills being invoked more?
  [2] What's causing high context compression?
  [3] Analyze my subagent delegation patterns
  [4] Check MCP integration health
  [5] Show me the full summary

> 1

Your "testing" Skill has description:
  "Guide for testing with Playwright"

But in 12 sessions where tests were written, you said:
  "add tests for the auth module"
  "write unit tests"
  "create test coverage"

The description doesn't match your phrasing. The model couldn't 
auto-discover the Skill.

Would you like me to:
  [a] Suggest improved descriptions
  [b] Show which sessions missed Skill opportunities
  [c] Explain how Skill auto-discovery works
```

The agent discovers, presents, and guides. No expertise required.

---

## Part 5: Implementation Priority

### Phase 1: Prove Value (Pre-Alpha MVP)

| Priority | Feature | Why |
|----------|---------|-----|
| **P0** | Skills effectiveness analysis | Core differentiator, validates pivot |
| **P0** | Agent-led exploration UI | Addresses UX problem |
| **P1** | Context efficiency metrics | Compression, re-reads, token patterns |
| **P1** | Basic pattern detection | Circular calls, instruction drift |

### Phase 2: Expand Coverage

| Priority | Feature | Why |
|----------|---------|-----|
| **P2** | Subagent delegation analysis | Context management insight |
| **P2** | MCP integration health | External tool effectiveness |
| **P2** | Permission friction analysis | Actionable optimization |
| **P2** | Before/after measurement | Validates improvements |

### Phase 3: Multi-ACT Support

| Priority | Feature | Why |
|----------|---------|-----|
| **P3** | Cursor adapter | Second largest user base |
| **P3** | OpenCode adapter | Growing adoption |
| **P3** | Codex adapter | Enterprise interest |

---

## Part 6: What Changes

### Keep (Foundation Is Solid)

- Session log parsing and indexing
- Baseline and temporal tracking
- Config file discovery
- EP14 conversational model (enhance, don't replace)

### Pivot

| From | To |
|------|-----|
| Config file formatting scores | Skills effectiveness metrics |
| Missing sections detection | Invocation pattern analysis |
| Generic recommendations | Practice adoption guidance |
| Static point-in-time checks | Longitudinal pattern trends |
| CLI expertise required | Agent-led discovery |

### Add

- Skills invocation detection from logs
- Subagent delegation tracking
- MCP usage analysis
- Permission friction detection
- Symptom pattern recognition

### Deprioritize

- Config formatting rules
- Section completeness scoring
- Generic anti-pattern detection
- Static validation only

---

## Part 7: Success Criteria

### Pre-Alpha MVP Success

1. **Skills Analysis Works**: Can show invocation rates, missed opportunities
2. **Agent Leads**: User runs `agentlint`, agent presents findings and guides
3. **Patterns Detected**: Identifies compression, re-reads, circular calls
4. **Actionable Output**: Recommendations user can act on immediately

### Validation Questions

- Do users find Skills effectiveness insights valuable?
- Does agent-led exploration reduce friction?
- Are detected patterns accurate and actionable?
- Does before/after measurement show improvement?

---

## Summary

**The pivot is not about adding features—it's about measuring what matters.**

Current agentlint asks: "Is your CLAUDE.md well-formatted?"

Users need to know: "Are my Skills actually being invoked? Is my context efficient? What patterns are hurting me?"

The logs contain this information. The architecture supports extracting it. The opportunity is reframing what agentlint measures and how it presents value.

**Next step:** Implement Phase 1 (Skills effectiveness + agent-led exploration) to validate the pivot.
