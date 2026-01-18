# EP08: ACT Adapters

> Implement adapter layer for AI Coding Tool abstraction with Claude Code primary and Generalized fallback.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | M |
| **Estimated Duration** | 5 weeks |
| **Target Stories** | 8-10 stories |

## Business Outcome Hypothesis

**If** we implement a clean adapter layer abstracting ACT-specific details,
**Then** agentlint can support multiple AI coding tools without core changes,
**Measured by** adapter interface stability and successful multi-tool analysis.

## Scope Definition

### In Scope

- [ ] Define ACT Adapter interface: `detect()`, `parseConfig()`, `locateLogs()`, `parseLogs()`
- [ ] Implement Claude Code adapter (primary)
  - CLAUDE.md config locations
  - .claude/ directory structure
  - Session log format (~/.claude/projects/)
- [ ] Implement Generalized adapter (fallback)
  - Common patterns (AGENTS.md, etc.)
  - Best-effort parsing for unknown tools
- [ ] Adapter auto-detection based on project files
- [ ] Adapter registration mechanism

### Out of Scope

- Cursor adapter (.cursorrules, .cursor/rules/*.mdc) - Future
- Aider adapter (.aiderrules) - Future
- Copilot CLI adapter - Future
- Tool layer implementation (uses adapters)
- Git SDK tools - Deferred to EP13 (agent can use `git` CLI directly; EP07 has internal git-evidence for causal tracing)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Claude Code adapter detects and parses CLAUDE.md
- Claude Code adapter locates session logs
- Generalized adapter provides fallback detection

**MVP validates:** Adapter interface is correct before adding more adapters

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Adapter Layer (Claude Code, Generalized) |
| **Runtime Scenarios** | All scenarios invoke adapters for data access |
| **Quality Requirements** | QS-4 (new ACT without core changes) |
| **Crosscutting Concepts** | N/A |
| **ADRs** | ADR-0002 (MVP focus) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 2 (Multi-Tool User) |
| **Use Cases** | FR-1.1 (Config Detection), FR-4.1 (Session Discovery) |
| **Requirements** | NFR-3 (Extensibility) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure, interfaces |
| EP02 | Soft | Tool invocation pattern (adapters used by tools) |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| None | — | Adapters are consumed by EP05, EP06 tools |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| File system | Config/log file access | Available |

## Technical Considerations

### Key Decisions

- Adapter interface is minimal: detect, parse config, locate logs, parse logs
- Generalized adapter ensures value even for unknown tools
- Auto-detection prefers specific adapters over generalized

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Claude Code format changes | Low | Medium | Version detection, graceful degradation |
| Unknown ACT formats | High | Low | Generalized adapter provides fallback |

### Spikes Needed

- [ ] Survey ACT config formats (Cursor, Aider, Copilot)

### Constitution Alignment

- **VI. Agent-Agnostic**: Adapter pattern enables multi-tool support
- **VII. Intelligent Tooling**: Tools use adapters, not raw file access

## Acceptance Criteria (High-Level)

### Functional

- [ ] Adapter interface: detect(), parseConfig(), locateLogs(), parseLogs()
- [ ] Claude Code adapter detects CLAUDE.md at all locations
- [ ] Claude Code adapter parses .claude/ directory
- [ ] Claude Code adapter locates session logs
- [ ] Generalized adapter detects AGENTS.md
- [ ] Generalized adapter provides fallback parsing
- [ ] Auto-detection selects appropriate adapter

### Non-Functional

- [ ] Adding new adapter requires no core changes
- [ ] Adapter detection < 1 second

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (adapter interface reference)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 2 (Multi-Tool User)
- **Workflow**: Detect ACT → select adapter → parse configs → locate logs
- **Outcome**: Unified analysis across tools

### Constraints to Encode

From ADRs:
- ADR-0002: Claude Code primary for MVP

From Constitution:
- VI. Agent-Agnostic: Must support adapter pattern

### Key Scenarios to Specify

1. Project with CLAUDE.md → Claude Code adapter selected
2. Project with only AGENTS.md → Generalized adapter
3. Project with multiple ACT configs → all detected

### Tech Stack Notes (for `/speckit.plan`)

- TypeScript interfaces for adapter contract
- File system for config/log access

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-18 | Gap Analysis | Removed git scope - deferred to EP13; agent can use `git` CLI directly, EP07 has internal git-evidence |
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
