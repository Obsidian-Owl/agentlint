# EP05: Config Analysis Tools

> Implement tools for ACT configuration detection, parsing, and quality assessment.

## Classification

| Attribute | Value |
|-----------|-------|
| **Type** | Business |
| **Priority** | P1-High |
| **Size** | L |
| **Estimated Duration** | 6 weeks |
| **Target Stories** | 10-12 stories |

## Business Outcome Hypothesis

**If** we implement comprehensive config analysis tools that detect, parse, and assess ACT configurations,
**Then** developers can understand what configurations exist and receive quality assessments,
**Measured by** >95% config detection accuracy and actionable quality feedback.

## Scope Definition

### In Scope

- [ ] Implement `parse_config` tool with Zod schemas
- [ ] Detect CLAUDE.md files (root, nested, global `~/.claude/`)
- [ ] Detect AGENTS.md files
- [ ] Detect `.claude/` directory structure (settings.json, commands/)
- [ ] Detect Agent Skills (SKILL.md files per ADR-0017)
- [ ] Parse markdown structure (sections, headings, code blocks)
- [ ] Parse JSON settings with schema validation
- [ ] Extract configuration metrics (length, sections, keywords)
- [ ] Identify configuration hierarchy (global → project → local)
- [ ] Assess configuration quality (length, structure, completeness)
- [ ] Detect instruction emphasis patterns (MUST, IMPORTANT)
- [ ] Check for conflicting guidance across config files

### Out of Scope

- Secret detection (EP11)
- Session log analysis (EP06)
- Recommendations based on assessment (EP10)
- Non-Claude Code adapters (EP08)

### Minimum Viable Product (MVP)

The minimum deliverable that proves the hypothesis:

- Detect and parse CLAUDE.md from project root
- Extract basic metrics (token count, section count)
- Provide quality score based on length and structure

**MVP validates:** Config detection and parsing works before adding advanced assessment

## Arc42 Traceability

| Source | References |
|--------|------------|
| **Building Blocks** | Tool Layer (Discovery, Extraction) |
| **Runtime Scenarios** | 6.1 Full Analysis (parse_config invocation) |
| **Quality Requirements** | QS-5 (<10s static analysis) |
| **Crosscutting Concepts** | 8.3 Error Handling (file not found, parse errors) |
| **ADRs** | ADR-0005 (Tool Definition), ADR-0007 (Config Parser), ADR-0017 (Agent Skills) |

## Requirements Traceability

| Source | References |
|--------|------------|
| **Personas** | Persona 1 (Optimizer), Persona 4 (Context Engineer) |
| **Use Cases** | UC-001 (Discover Configs), UC-002 (Assess Config), UC-007 (Validate Config) |
| **Requirements** | FR-1 (ACT Configuration Analysis) |

## Dependencies

### Blocked By (Cannot Start Without)

| Epic | Dependency Type | What's Needed |
|------|-----------------|---------------|
| EP01 | Hard | Project structure, Zod dependency |
| EP02 | Hard | Tool registration mechanism, SDK tool() integration |
| EP03 | Soft | Storage for config cache (optional for MVP) |

### Blocks (Other Epics Waiting On This)

| Epic | Dependency Type | What This Provides |
|------|-----------------|-------------------|
| EP07 | Soft | Config data for causal analysis |
| EP10 | Soft | Config assessment for recommendations |
| EP11 | Soft | Config files for secret scanning |

### External Dependencies

| System/Team | Dependency | Status |
|-------------|------------|--------|
| File system | Read access to config files | Available |

## Technical Considerations

### Key Decisions

- Use Zod for schema validation (consistent with ADR-0005)
- Parse markdown using unified/remark ecosystem
- Return structured output for agent consumption
- Include poka-yoke descriptions for agent comprehension

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Non-standard CLAUDE.md formats | Medium | Low | Graceful degradation, warn on parse issues |
| Large config files slow parsing | Low | Low | Streaming parser if needed |

### Spikes Needed

- [ ] Survey CLAUDE.md structures in public repos
- [ ] Test markdown parser with edge cases

### Constitution Alignment

- **VI. Agent-Agnostic**: Adapter-aware detection (Claude Code primary)
- **V. Language-Agnostic**: Config analysis independent of project language
- **VII. Intelligent Tooling**: Rich tool descriptions for agent

## Acceptance Criteria (High-Level)

### Functional

- [ ] Detect CLAUDE.md at project root, nested dirs, and ~/.claude/
- [ ] Detect AGENTS.md files
- [ ] Detect .claude/settings.json and validate schema
- [ ] Detect SKILL.md files in .claude/commands/
- [ ] Parse markdown structure (headings, sections, code blocks)
- [ ] Extract metrics: token count, section count, keyword frequency
- [ ] Identify config hierarchy and conflicts
- [ ] Assess quality: length warnings, structure score, completeness

### Non-Functional

- [ ] Config detection < 5 seconds for typical project
- [ ] >95% detection accuracy on test corpus

### Definition of Done

- [ ] All acceptance criteria pass
- [ ] Code reviewed and merged
- [ ] Tests written and passing (unit, integration)
- [ ] Documentation updated (tool reference)
- [ ] Deployed to staging environment
- [ ] Product owner sign-off

## Speckit Handoff Notes

> Guidance for `/speckit.specify` phase

### Primary Focus

- **Persona**: Persona 4 (Context Engineer)
- **Workflow**: Scan project → detect configs → parse → assess quality
- **Outcome**: Clear understanding of configuration landscape

### Constraints to Encode

From ADRs:
- ADR-0005: Use SDK tool() with Zod schemas
- ADR-0007: Custom parser with Zod validation
- ADR-0017: Detect and analyze SKILL.md

From Constitution:
- VI. Agent-Agnostic: Support adapter pattern
- V. Language-Agnostic: No language-specific logic

### Key Scenarios to Specify

1. Detect all configs in a monorepo
2. Parse CLAUDE.md with non-standard structure
3. Identify conflicting guidance across files
4. Assess config with missing sections

### Tech Stack Notes (for `/speckit.plan`)

- Zod for schema validation
- unified/remark for markdown parsing
- glob for file discovery

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-01-15 | Arc42 Decomposer | Initial creation from Arc42 |
