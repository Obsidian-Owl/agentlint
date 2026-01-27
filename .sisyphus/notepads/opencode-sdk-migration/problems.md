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

