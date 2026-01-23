# EP20: User Customization System

> Interactive project initialization and custom skill registration for personalized agentlint experience.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | L |
| **Estimated Duration** | 5-6 weeks |
| **Target Stories** | 12-15 stories |

## Business Outcome Hypothesis

**If** we implement project objectives configuration and custom skill registration,
**Then** users can personalize agentlint analysis to their specific workflow goals and extend its capabilities,
**Measured by** objectives adoption rate, custom skill usage, and recommendation relevance improvement.

## Research Summary

### Can agentlint use custom AGENTS.md or Skills hierarchies?

**YES** - but the SDK doesn't auto-discover from custom directories. The application must:
1. Discover files from `.agentlint/` manually
2. Parse them into SDK-compatible format
3. Inject via the `agents` option in QueryOptions

### Key SDK Findings

| Aspect | Finding |
|--------|---------|
| **Agent discovery** | NOT automatic - SDK requires explicit `agents` option |
| **Skill discovery** | Only from `.claude/skills/` and `~/.claude/skills/` (hardcoded) |
| **Custom paths** | NOT supported by SDK - applications must implement own loading |
| **Injection mechanism** | `agents` option in QueryOptions accepts `Record<string, AgentDefinition>` |

### Why This Works for agentlint

agentlint already has the patterns:
- `ACTSubagentRegistry.toAgentsOption()` converts agents to SDK format
- `discoverSkills()` in `src/tools/config/skills.ts` discovers SKILL.md files
- `systemPromptAppend` config injects custom context into agent prompts
- Config loading from `~/.agentlint/config.json` already exists

## Scope Definition

### In Scope

- [ ] Interactive `agentlint init` command (like Claude's /init)
  - Multi-step wizard for project objectives
  - Focus area selection (security, context efficiency, skills adoption, etc.)
  - Constraints configuration
- [ ] Objectives file format (`.agentlint/objectives.md` with YAML frontmatter)
- [ ] Custom skill registry
  - Discover skills from `.agentlint/skills/*/SKILL.md`
  - Discover global skills from `~/.agentlint/skills/*/SKILL.md`
  - Convert to AgentDefinition format
- [ ] TUI integration
  - InitWizardDialog (4-step wizard)
  - SettingsDialog (Objectives | Skills | Permissions tabs)
  - CommandPalette (Ctrl+K)
  - SkillBrowser
- [ ] Objectives injection into agent context via `systemPromptAppend`
- [ ] CLI commands: `agentlint init`, `agentlint objectives`, `agentlint skills list`

### Out of Scope

- Modifying `.claude/` directory structure
- Auto-creating Claude Code skills
- Remote skill repositories
- Real-time skill editing (edit-reload flow required)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- `agentlint init` creates `.agentlint/objectives.md`
- Objectives loaded and injected into agent context
- Basic skill discovery from `.agentlint/skills/`

**MVP validates:** User customization improves analysis relevance without polluting ACT configs

## Directory Structure

```
.agentlint/                          # Project-level (gitignored)
├── objectives.md                    # [NEW] Project objectives
└── skills/                          # [NEW] User-defined skills
    └── {skill-name}/
        └── SKILL.md

~/.agentlint/                        # Global (user preferences)
├── config.json                      # [EXISTING]
├── objectives.md                    # [NEW] Global objectives
└── skills/                          # [NEW] Global skills
    └── {skill-name}/
        └── SKILL.md
```

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | CLI Layer, Orchestration Layer |
| **Runtime Scenarios** | First-run initialization, Analysis with objectives |
| **Quality Requirements** | Extensibility, Usability |
| **Crosscutting Concepts** | 8.1 Configuration, 8.4 Extensibility |
| **ADRs** | (new ADR may be needed) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 1 (Solo Developer), Persona 2 (Team Lead) |
| **Use Cases** | Personalized analysis, Workflow customization |
| **Requirements** | NFR-1 (Usability), NFR-6 (Extensibility) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP02 | Hard | `systemPromptAppend` injection for objectives |
| EP17 | Soft | TUI dialog system for InitWizardDialog, SettingsDialog |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| None | — | Standalone enhancement |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| None | — | — |

## Technical Considerations

### Key Decisions

- All customization in `.agentlint/` (never touch `.claude/`)
- User skills are agentlint-specific, not Claude Code skills
- Precedence: Project > Global > Built-in
- Name conflicts: Built-in subagents always win
- TUI dialogs follow OpenCode patterns (InitDialogCmp, ShouldShowInitDialog)

### Objectives File Format

```markdown
---
version: "1.0.0"
createdAt: "2026-01-23T10:30:00Z"
updatedAt: "2026-01-23T10:30:00Z"
---

# Project Objectives

## Primary Goals
- Improve security practices in CI/CD pipelines
- Reduce context window exhaustion

## Focus Areas
- Credential handling
- Session duration optimization

## Constraints
- Must remain compatible with existing .claude/ setup
```

### Custom Skill Format

```markdown
---
name: security-focus
description: Analyzes security-related configuration gaps
allowed_tools: [discover_configs, parse_config]
---

## Instructions
Focus on credential exposure, permission settings, missing security rules...
```

### Implementation Phases

| Phase | Duration | Deliverables | Dependency |
|-------|----------|--------------|------------|
| **Phase 1: Core** | 2 weeks | `src/customization/` module, CLI commands, objectives loading | EP02 |
| **Phase 2: TUI** | 2-3 weeks | InitWizardDialog, SettingsDialog, CommandPalette | EP17 Phase 1 |
| **Phase 3: Integration** | 1 week | Skills injection, status bar, testing | Phase 1 + 2 |

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TUI dependency delay (EP17) | Medium | Medium | Phase 1 CLI-only works independently |
| Skill format confusion with Claude skills | Low | Medium | Clear documentation, different directory |
| Objectives format changes | Low | Low | Version field in frontmatter |

### Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| I. Local-First | All stored locally in `.agentlint/` |
| II. Improvement-Oriented | Objectives compound value across sessions |
| VIII. Compounding Value | Global skills transfer across projects |
| IX. Agent-Aware | Objectives serve agent cognitive needs |

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/customization/index.ts` | Module exports |
| `src/customization/types.ts` | Objectives, Skill types |
| `src/customization/objectives.ts` | Load/save/format objectives |
| `src/customization/skill-registry.ts` | User skill discovery and conversion |
| `src/customization/init.ts` | shouldShowInitDialog(), markInitialized() |
| `src/cli/commands/init.ts` | CLI init command |
| `src/cli/commands/objectives.ts` | CLI objectives view/edit |
| `src/cli/components/InitWizardDialog.tsx` | TUI init wizard (4-step) |
| `src/cli/components/SettingsDialog.tsx` | TUI settings panel |
| `src/cli/components/CommandPalette.tsx` | TUI command palette |
| `src/cli/components/SkillBrowser.tsx` | TUI skill management |

### Modified Files

| File | Change |
|------|--------|
| `src/orchestration/orchestrator.ts` | Load objectives into `systemPromptAppend` |
| `src/act/index.ts` | Merge user skills into `buildACTSubagents()` |
| `src/persistence/common/directories.ts` | Add path helpers |
| `src/cli/components/App.tsx` | Add dialog visibility flags, command palette |
| `src/cli/components/StatusBar.tsx` | Show objectives/skills status |

## Acceptance Criteria (High-Level)

### Functional

- [ ] `agentlint init` runs interactive wizard
- [ ] Wizard creates `.agentlint/objectives.md` with valid format
- [ ] `agentlint init --reconfigure` updates existing objectives
- [ ] `agentlint objectives` displays current objectives
- [ ] `agentlint objectives --edit` opens $EDITOR
- [ ] `agentlint skills list` shows discovered skills
- [ ] Objectives appear in agent context during analysis
- [ ] Custom skills discovered from `.agentlint/skills/`
- [ ] Global skills discovered from `~/.agentlint/skills/`
- [ ] Project skills override global skills with same name
- [ ] Built-in subagents take precedence over user skills
- [ ] TUI shows init wizard on first run
- [ ] TUI settings accessible via Ctrl+,
- [ ] Command palette accessible via Ctrl+K

### Non-Functional

- [ ] Init wizard completes in < 2 minutes
- [ ] Skill discovery < 500ms
- [ ] `.claude/` directory unchanged by any operation

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (CLI help, README)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Verification

1. **Init flow**: Run `agentlint init`, verify `.agentlint/objectives.md` created
2. **Objectives loading**: Run `agentlint analyse`, verify objectives appear in agent context
3. **Skill discovery**: Create `.agentlint/skills/test/SKILL.md`, verify it's discovered
4. **Skill invocation**: Verify user skill can be invoked by agent
5. **Isolation**: Verify `.claude/` directory is unchanged

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 1 (Solo Developer wanting customization)
- **Workflow**: Init → Configure → Analyse with personalized context
- **Outcome**: Relevant recommendations aligned with user goals

### Constraints to Encode

From Constitution:
- I. Local-First: All customization local
- IX. Agent-Aware: Objectives serve agent cognition

From Research:
- SDK requires explicit injection (no auto-discovery)
- Isolation from `.claude/` directory

### Key Scenarios to Specify

1. First run triggers init wizard
2. User adds custom security-focused skill
3. Analysis uses objectives to prioritize findings
4. User reconfigures objectives mid-project
5. Global skill overridden by project skill

### Tech Stack Notes (for `/speckit.plan`)

- YAML frontmatter parsing (gray-matter or similar)
- Ink components for TUI dialogs
- Commander.js for CLI commands
- Zod schemas for objectives/skill validation

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-23 | Research Agent | Initial creation from SDK research |
