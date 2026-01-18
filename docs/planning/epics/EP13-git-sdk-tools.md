# EP13: Git SDK Tools (Deferred)

> Standalone SDK tools for git operations - currently deferred due to low value-add over direct CLI usage.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Enabler |
| **Priority** | P3-Low |
| **Size** | S |
| **Estimated Duration** | 2 weeks |
| **Target Stories** | 3-5 stories |
| **Status** | Deferred |

## Deferral Rationale

This epic was extracted from EP08 (ACT Adapters) during gap analysis on 2026-01-18.

### Why Deferred

1. **Low value-add**: The agent can use `git` CLI directly via Bash with full access to all flags, formats, and capabilities. Wrapping git commands provides minimal benefit.

2. **EP07 sufficiency**: The Causal Tracing Engine (EP07) already implements `GitEvidenceCollector` with blame and pickaxe for internal evidence collection. This serves the primary use case (causal tracing).

3. **No truncation benefit**: Direct CLI usage gives the agent full output fidelity without middleware translation.

4. **Agent intelligence**: Claude can parse git output directly - it doesn't require pre-structured responses.

### Conditions for Activation

Consider implementing this epic if:
- User feedback indicates structured git output would significantly improve agent performance
- A specific use case emerges where CLI access is insufficient
- Batch git operations across many files become a bottleneck

## Original Scope (from ADR-0015)

### Planned SDK Tools

| Tool | Description | Value-Add Assessment |
|------|-------------|---------------------|
| `git_blame` | Line-by-line authorship for a file | Low - `git blame --porcelain` via Bash |
| `git_pickaxe` | Search git history for string addition/removal | Low - `git log -S` via Bash |
| `git_log` | Query commit history with filtering | Low - `git log --format` via Bash |
| `git_diff` | Show changes between refs | Low - `git diff` via Bash |
| `git_show` | Show file content at specific ref | Low - `git show` via Bash |

### What EP07 Already Provides

The `GitEvidenceCollector` class (`src/tools/causal/git-evidence.ts`) provides:
- `collectBlameEvidence(position)` - Git blame for specific line
- `collectPickaxeEvidence(searchTerm, options)` - Git log -S search
- `collectEvidence(options)` - Combined blame + pickaxe

These are **internal** to the causal tracing engine and produce `EvidenceItem` objects for chain building. They are NOT exposed as standalone SDK tools.

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Integration Layer (Git) |
| **Runtime Scenarios** | Causal tracing (already served by EP07) |
| **Quality Requirements** | N/A |
| **Crosscutting Concepts** | N/A |
| **ADRs** | ADR-0015 (Git Integration Strategy) |

## Architectural Notes

Git belongs in the **Integration Layer**, not the Adapter Layer:

```
┌─────────────────────────────────────────────┐
│ ADAPTER LAYER                               │  ← ACT-specific (Claude Code, etc.)
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ INTEGRATION LAYER                           │  ← Git belongs HERE
│ Filesystem │ Git │ SQLite │ Anthropic API   │
└─────────────────────────────────────────────┘
```

EP08's original inclusion of git was architecturally incorrect.

## If Implemented

### Scope

- [ ] `git_blame` SDK tool with structured output
- [ ] `git_pickaxe` SDK tool with structured output
- [ ] `git_log` SDK tool with filtering options
- [ ] Error handling and graceful degradation
- [ ] Tool registration in `ToolRegistry`

### Dependencies

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure |
| EP02 | Hard | SDK tool pattern |
| EP07 | Soft | Reuse `GitEvidenceCollector` internals |

### Constitution Alignment

- **III. Causal-First**: Git history enables origin tracing (already served by EP07)
- **VII. Intelligent Tooling**: Agent decides when to use git tools

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Gap Analysis | Created as deferral from EP08; documented rationale |
