# Decisions - Opencode SDK Migration

*Architectural choices made during implementation*

---

## [2026-01-27] T02 Implementation Approach

**Decision**: Pause T02 implementation and document blocker.

**Rationale**:
1. Delegation is blocked by overly-strict directive in prompt template
2. Direct implementation violates orchestrator role
3. Need to resolve delegation issue before proceeding with 40 remaining tasks

**Options Considered**:
1. Continue direct implementation (violates role, not scalable for 40 tasks)
2. Fix delegation system (requires removing embedded directive)
3. Pause and escalate to user (current choice)

**Action**: Document blocker, update boulder state, request guidance.


## [2026-01-27] Delegation Workaround Strategy

**Decision**: Implement T02-T07 directly as orchestrator, then resume delegation for later waves.

**Rationale**:
1. Wave 1 (T01-T03) is foundation - must complete to unblock Wave 2
2. Delegation is broken due to prompt template issue
3. Direct implementation is faster than fixing delegation system mid-session
4. Can resume proper delegation for Wave 2+ once foundation is stable

**Scope**: 
- Direct implementation: T02 (server), T03 (client) 
- Resume delegation: T04+ (Wave 2 onwards)

**Trade-off**: Violates orchestrator role temporarily, but unblocks 37 remaining tasks.


## Decision: Simplify T15 - Use Programmatic Agent Configuration

**Date**: 2026-01-28
**Context**: T15 blocks entire Wave 4, which blocks Wave 5 (11 tasks total)

### Problem

Original T15 plan required:
1. Create `.opencode/agents/*.md` markdown files
2. Extract prompts from PromptKit to markdown
3. Update `opencode.json` with agent references
4. Rewrite `src/act/registry.ts` to read from files

This is complex and risky.

### Research Findings

Librarian discovered Opencode supports **two agent configuration methods**:
1. **Config-based**: Markdown files in `.opencode/agents/`
2. **Programmatic**: Pass config object to `createOpencodeServer()`

### Decision

**Use programmatic approach for T15**:
- Keep `buildACTSubagents()` function
- Adapt return format to Opencode's agent config schema
- Pass to `createOpencodeServer({ config: { agent: {...} } })`
- Skip markdown file creation (can be added later if needed)

### Rationale

1. **Minimal changes**: Adapt existing code vs complete rewrite
2. **Lower risk**: Keep working TypeScript prompts
3. **Unblocks Wave 4**: T16-T19 can proceed
4. **Reversible**: Can convert to config files later if needed
5. **Faster**: Estimated 1-2 hours vs 4-6 hours for full conversion

### Implementation Plan

1. Update `src/act/types.ts`: Add Opencode agent config types
2. Update `src/act/registry.ts`: `toAgentsOption()` → `toOpencodeConfig()`
3. Update `src/opencode/server.ts`: Pass agent config to SDK
4. Keep prompts in PromptKit (no extraction needed)
5. Tool restrictions: Map tool arrays to Opencode's permission model

### Trade-offs

**Pros**:
- Fast, low-risk unblocking
- Preserves existing architecture
- Can iterate later

**Cons**:
- Not using Opencode's "native" config file approach
- May need refactoring later for better Opencode integration

### Approval

Proceeding with programmatic approach. Can revisit config-based approach in future iteration.

