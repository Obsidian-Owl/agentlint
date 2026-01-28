# Problems - Opencode SDK Migration

*Unresolved blockers requiring attention*

---

## [2026-01-27] T02 Delegation Blocker

**Problem**: Cannot delegate T02 (or any multi-method task) due to overly-strict single-task directive embedded in prompt template.

**Root Cause**: Muscle memory keeps typing `<system-reminder>[SYSTEM DIRECTIVE...]` at start of every prompt parameter, which instructs subagents to refuse any task with multiple steps/methods.

**Impact**: 
- 12+ failed delegation attempts
- ~15k tokens wasted on refusals
- Cannot complete plan-level tasks (T02-T24) which are appropriately scoped for 3-4 week project

**Attempted Solutions**:
1. Tried removing directive manually (kept retyping it)
2. Created clean prompt in /tmp file (still typed directive when delegating)
3. Attempted micro-decomposition (would create 150+ tasks from 24-task plan)

**Decision**: Implement T02 directly without delegation to unblock progress.

**Future Fix**: Need to either:
- Remove directive from prompt template entirely
- Create macro/snippet that doesn't include it
- Use different delegation pattern for plan-level tasks


## [2026-01-27] T03 SDK API Unknown

**Problem**: Opencode SDK API structure is unknown. Plan appendix has examples but actual SDK types don't match.

**Evidence**:
- `session.create({ title })` → SDK expects different Options type
- `session.prompt()` → Returns different structure than assumed
- `event.subscribe()` → Event types don't have sessionId property

**Impact**: Cannot implement T03 without understanding actual SDK API.

**Action Required**: Research actual Opencode SDK API before implementing T02/T03.

**Blocker Status**: CRITICAL - blocks Wave 1 completion


## T15 Blocker - Opencode Agent Config Format Unknown

**Date**: 2026-01-28
**Task**: T15 - Convert ACT Subagents to Config
**Status**: BLOCKED

### Problem

T15 requires converting ACT subagents to Opencode config-based agent definitions, but:
1. Plan references "Appendix A.4 for Opencode agent config format" which doesn't exist
2. No documentation found on Opencode agent configuration format
3. Current ACT system uses PromptKit with complex prompt specs
4. Unclear how to map SDK agent definitions to Opencode config format

### Impact

- T15 blocks T16 (Migrate Orchestrator)
- T16 blocks T17-T19 (TUI, Permissions, Prompts)
- Entire Wave 4 is blocked

### Options

1. **Research Opencode agent format** - Use librarian to find documentation
2. **Skip T15 temporarily** - Move to Wave 5 tasks that don't depend on it
3. **Simplify approach** - Keep ACT subagents in code, just update to use Opencode client

### Recommendation

Research Opencode agent configuration format using librarian agent before proceeding with T15.

