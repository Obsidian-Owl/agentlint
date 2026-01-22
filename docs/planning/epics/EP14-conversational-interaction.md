# EP14: Conversational Interaction Model

> Implement guided conversation, Ink UI migration, permission service, and session continuity per ADR-0021.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | L |
| **Estimated Duration** | 7 weeks |
| **Target Stories** | 18-24 stories |

## Business Outcome Hypothesis

**If** we implement a conversational interaction model with proper Ink UI, permission management, and session continuity,
**Then** users can collaborate with the agent during analysis rather than just observing batch execution,
**Measured by** user engagement depth, session resume rate, and investigation completion rate.

## Scope Definition

### In Scope

- [ ] **Phase 0: Ink Migration** - Replace imperative TerminalRenderer with proper Ink rendering
  - InkRenderer implementing IStreamRenderer
  - StreamView component for real-time streaming
  - ToolSpinner component for tool execution
  - Activate existing unused Ink components (App, Progress, FindingsList, Summary)

- [ ] **Phase 1: Permission Service** - Decoupled permission handling (Opencode pattern)
  - Three permission levels: Allow once, Allow for session, Deny
  - Session-persistent permissions
  - Rule-based auto-allow/deny
  - Auto-approval mode for CI/batch

- [ ] **Phase 2: Ink Dialog Components** - Interactive dialogs
  - PermissionDialog with diff preview
  - QuestionDialog for AskUserQuestion
  - SelectInput for keyboard navigation
  - DiffPreview for syntax-highlighted diffs

- [ ] **Phase 3: canUseTool Integration** - Wire services into SDK callback
  - Refactor can-use-tool.ts to use PermissionService
  - Route dialogs through Ink components
  - Session permission caching

- [ ] **Phase 4: Conversational Prompting** - Agent behavior changes
  - Conversational system prompt for interactive mode
  - Batch system prompt for CI mode
  - --interactive / --batch CLI flags

- [ ] **Phase 5: Session Continuity** - Conversation persistence
  - SQLite-based session storage
  - ConversationSession and ConversationTurn types
  - --resume flag for continuation
  - `agentlint session` subcommand (list, show)

- [ ] **Phase 6: Integration Verification & Cleanup** - Ensure complete integration and remove dead code
  - **Dead Code Removal**:
    - Delete `TerminalRenderer` after InkRenderer verified working
    - Delete `question-presenter.ts` after QuestionDialog integrated
    - Remove any orphaned type definitions
    - Remove unused imports across modified files
  - **Test Cleanup**:
    - Delete tests for removed modules (terminal-renderer.test.ts, etc.)
    - Verify all new components have corresponding tests
    - Remove any test fixtures for deprecated functionality
  - **Integration Verification Checklist**:
    - [ ] InkRenderer is wired into `createRenderer()` for terminal mode
    - [ ] PermissionService is instantiated in CLI entry point
    - [ ] PermissionDialog is rendered via App.tsx overlay
    - [ ] QuestionDialog is rendered via App.tsx overlay
    - [ ] canUseTool callback uses PermissionService (not hardcoded logic)
    - [ ] Session store is initialized on startup
    - [ ] `--resume` flag reads from session store
    - [ ] `--batch` flag bypasses all interactive prompts
    - [ ] All new CLI flags are documented in --help
  - **Export Verification**:
    - All new modules exported from their index.ts
    - No circular dependencies introduced
    - Public API surface documented
  - **End-to-End Smoke Tests**:
    - `agentlint analyse <dir>` renders with Ink
    - Permission dialog appears for write tools
    - AskUserQuestion shows QuestionDialog
    - `--resume` restores previous session
    - `--batch` runs without prompts

### Out of Scope

- Full TUI like Opencode (keeping CLI-first approach)
- Multi-user session sharing
- Cloud session sync
- Voice/audio interaction

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Permission dialogs working with "allow for session" persistence
- AskUserQuestion routed to Ink QuestionDialog
- Basic session save/resume

**MVP validates:** Users can have interactive conversations with the agent

### Definition of Done (Epic-Level Gate)

**The epic is NOT complete until Phase 6 passes.** Specifically:
- [ ] All Phase 6 integration checklist items verified
- [ ] All deprecated modules deleted (not just deprecated)
- [ ] All end-to-end smoke tests pass
- [ ] Zero compiler warnings about unused exports
- [ ] Code review confirms no "TODO: wire this up" comments remain

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | CLI Layer, Orchestration Layer |
| **Runtime Scenarios** | Interactive Analysis, Session Resume |
| **Quality Requirements** | Usability, Interactivity |
| **Crosscutting Concepts** | 8.1 UX Design, 8.7 State Management |
| **ADRs** | ADR-0021 (Conversational Interaction Model) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | All (improved interaction model) |
| **Use Cases** | UC-001 (Analysis), UC-002 (Investigation) |
| **Requirements** | Constitution Principle V (User Agency) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP02 | Hard | Orchestration with canUseTool callback |
| EP04 | Hard | Existing Ink components (unused but available) |
| EP11 | Hard | Debug infrastructure for development |

### Enables (Other Epics That Need This)

| Epic | What It Enables |
|------|-----------------|
| EP12 | Session context for global learning promotion |
| Future | Multi-turn collaborative analysis workflows |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Ink rendering breaks streaming | Medium | High | Keep TerminalRenderer as fallback until Phase 6 verification |
| Session storage corruption | Low | High | Use atomic writes, validate on load |
| Permission prompts too frequent | Medium | Medium | Generous auto-allow rules, session persistence |
| **Unhooked features** (built but not integrated) | **High** | **High** | Phase 6 checklist, integration tests, code review gates |
| Dead code accumulation | Medium | Medium | Phase 6 explicit deletion tasks, no deprecation comments |
| Circular dependencies | Low | Medium | Export verification in Phase 6, dependency graph check |

## Success Criteria

1. **Interactive Mode**: User can select options via keyboard in permission/question dialogs
2. **Permission Persistence**: "Allow for session" remembered across tool calls
3. **Session Resume**: Interrupted session can be resumed with `--resume`
4. **Ink Integration**: Existing Ink components (Progress, FindingsList) actually used
5. **CI Compatibility**: `--batch` mode works without any prompts
6. **Zero Dead Code**: No deprecated modules remain (TerminalRenderer, question-presenter deleted)
7. **Complete Integration**: Every new component is wired into production code path (verified by checklist)
8. **Test Coverage**: All new modules have unit tests; integration tests verify end-to-end flows
9. **No Orphan Exports**: Every exported symbol is imported somewhere or documented as public API

## Technical Notes

### Current State Discovery

The Ink components built in EP04 are **not integrated** into the production rendering path:
- `TerminalRenderer` (imperative ora + marked-terminal) is used
- `App.tsx`, `Progress.tsx`, `FindingsList.tsx`, `Summary.tsx` exist but are unused
- `question-presenter.ts` uses Node.js readline, not Ink

This epic properly activates the Ink UI investment.

### Lessons Learned: Integration Failures

**Problem**: EP04 built Ink components that were never wired into production. This pattern has repeated across the project where features are "complete" but not actually used.

**Root Causes**:
1. No integration verification step in epic definition
2. "Working in isolation" confused with "working in production"
3. No explicit deletion of replaced code (old code remained as fallback forever)

**Mitigations in EP14**:
1. **Phase 6 is mandatory** - cannot mark epic complete without it
2. **Explicit deletion tasks** - old modules MUST be deleted, not deprecated
3. **Integration checklist** - each wire-up point has a checkbox
4. **End-to-end smoke tests** - verify actual user flows, not unit behavior

### Reference Architecture

Opencode (opencode-ai/opencode) patterns:
- `internal/permission/` - Permission service with pub/sub
- `internal/tui/components/dialog/` - Bubble Tea dialog components
- `internal/session/` - Session management with history
