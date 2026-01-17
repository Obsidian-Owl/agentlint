# Feature Specification: Config Analysis Tools

> **Epic**: EP05
> **Created**: 2026-01-17
> **Status**: Design Complete
> **Author**: Claude

---

## 1. Overview

Implement tools for discovering, parsing, and assessing AI Coding Tool (ACT) configuration files. This epic provides the `parse_config` tool and supporting infrastructure that enables the agent to understand what configurations exist, extract quality signals, and identify potential issues—forming the foundation for causal analysis and recommendations.

### 1.1 Business Context

Config Analysis Tools are the first of the "Core Tools" in agentlint's architecture. They enable the agent to:
- Discover what AI configurations exist in a project (CLAUDE.md, AGENTS.md, etc.)
- Parse markdown and JSON configurations into structured data
- Extract quality signals that correlate with effective configurations
- Identify anti-patterns and potential issues for causal tracing

**Business Hypothesis**: If we implement comprehensive config analysis tools that detect, parse, and assess ACT configurations, then developers can understand what configurations exist and receive quality assessments, measured by >95% config detection accuracy and actionable quality feedback.

### 1.2 Out of Scope

- Secret detection algorithms (EP11: Quality & Security)
- Session log analysis (EP06: Session Analysis Tools)
- Generating recommendations based on assessment (EP10: Recommendation Engine)
- Non-Claude Code ACT adapters beyond basic detection (EP08: ACT Adapters)
- Interactive configuration editing or generation

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Discover AI Configurations

**As a** developer setting up agentlint,
**I want** to discover all AI configuration files in my project,
**So that** I know what configurations exist before running analysis.

**Acceptance Criteria:**
- [ ] Given a project directory, when the agent invokes config discovery, then all CLAUDE.md files are found (root, nested, ~/.claude/)
- [ ] Given a project with AGENTS.md files, when discovery runs, then AGENTS.md files are listed
- [ ] Given a project with .claude/ directory, when discovery runs, then settings.json and commands/ are detected
- [ ] Given a project with no AI configs, when discovery runs, then an empty result is returned with helpful guidance

**Test Scenarios:**
- Happy path: Monorepo with multiple CLAUDE.md files at different levels
- Happy path: Project with both CLAUDE.md and .claude/settings.json
- Edge case: Nested CLAUDE.md in node_modules (should be excluded by default)
- Edge case: Global config at ~/.claude/CLAUDE.md included when requested

---

### US-002 [P1]: Parse Configuration Content

**As a** developer analyzing my AI setup,
**I want** configuration files parsed into structured data,
**So that** the agent can reason about configuration quality.

**Acceptance Criteria:**
- [ ] Given a CLAUDE.md file, when parsed, then markdown structure is extracted (headings, sections, code blocks)
- [ ] Given a .claude/settings.json file, when parsed, then JSON is validated against known schema
- [ ] Given a malformed configuration, when parsed, then partial results are returned with validation warnings
- [ ] Given any parsed config, then position information (line, column) is preserved for causal references

**Test Scenarios:**
- Happy path: Well-structured CLAUDE.md with clear sections
- Happy path: settings.json with all valid fields
- Error case: CLAUDE.md with invalid markdown (unclosed code block)
- Error case: settings.json with unknown fields

---

### US-003 [P1]: Extract Configuration Metrics

**As a** developer optimizing my AI configuration,
**I want** to see metrics about my configuration,
**So that** I can understand if it's the right size and structure.

**Acceptance Criteria:**
- [ ] Given a parsed config, when metrics are extracted, then token count is estimated
- [ ] Given a parsed config, when metrics are extracted, then section count and hierarchy depth are reported
- [ ] Given a parsed config, when metrics are extracted, then code block count and types are identified
- [ ] Given a parsed config, when metrics are extracted, then keyword frequencies are analyzed (MUST, IMPORTANT, etc.)

**Test Scenarios:**
- Happy path: Config with various section depths and code blocks
- Edge case: Very large config (>500 lines) triggers size warning
- Edge case: Config with no headings (flat structure)

---

### US-004 [P2]: Assess Configuration Quality

**As a** developer wanting to improve my AI configuration,
**I want** a quality assessment of my configuration,
**So that** I can identify areas for improvement.

**Acceptance Criteria:**
- [ ] Given a parsed config, when quality is assessed, then a structure score (0-100) is calculated
- [ ] Given a config with anti-patterns (generic rules, linter jobs), when assessed, then anti-patterns are flagged
- [ ] Given a config missing recommended sections, when assessed, then completeness gaps are identified
- [ ] Given configs at multiple levels (global, project), when assessed, then hierarchy conflicts are detected

**Test Scenarios:**
- Happy path: Well-structured config receives high quality score
- Quality issue: Config with "Write clean code" generic rule flagged
- Quality issue: Config with embedded code snippets (should reference files instead)
- Quality issue: Project config contradicts global config

---

### US-005 [P2]: Detect Agent Skills

**As a** developer using Claude Code skills,
**I want** SKILL.md files detected and analyzed,
**So that** my custom skills are included in configuration analysis.

**Acceptance Criteria:**
- [ ] Given a .claude/skills/ directory, when scanned, then all SKILL.md files are discovered (including nested skill folders)
- [ ] Given a SKILL.md file, when parsed, then YAML frontmatter is extracted (name, description required; allowed-tools, model, user-invocable optional)
- [ ] Given a SKILL.md file, when parsed, then markdown content sections are extracted (instructions, examples, guidelines)
- [ ] Given a skill folder with scripts/ or references/ subdirectories, when scanned, then bundled files are catalogued
- [ ] Given multiple skills, when analyzed, then skill coverage and potential description overlap is assessed

**Test Scenarios:**
- Happy path: Project with 3 custom skills in .claude/skills/ with proper frontmatter
- Happy path: Skill with bundled scripts in scripts/ subdirectory
- Edge case: Skill with missing required `name` or `description` frontmatter fields
- Edge case: Skill with `user-invocable: false` (still detected but flagged)
- Edge case: Skills with overlapping descriptions (ambiguous auto-invocation)

---

### US-006 [P3]: Analyze Configuration Hierarchy

**As a** developer with configs at multiple levels,
**I want** to understand how configurations combine,
**So that** I can avoid conflicts and understand effective configuration.

**Acceptance Criteria:**
- [ ] Given global (~/.claude/CLAUDE.md) and project configs, when analyzed, then hierarchy is mapped
- [ ] Given overlapping guidance, when analyzed, then potential conflicts are identified
- [ ] Given the hierarchy, when analyzed, then effective configuration is computed

**Test Scenarios:**
- Happy path: Global config + project config with no conflicts
- Conflict case: Global says "use TypeScript", project says "use JavaScript"
- Edge case: Nested project configs (monorepo root + package-level)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Implement `parse_config` tool using SDK `tool()` with Zod schema | P1 | US-002 |
| FR-002 | Detect CLAUDE.md files at project root, nested directories, and ~/.claude/ | P1 | US-001 |
| FR-003 | Detect AGENTS.md files in project directories | P1 | US-001 |
| FR-004 | Detect .claude/ directory structure (settings.json, commands/) | P1 | US-001 |
| FR-005 | Parse markdown using mdast (unified/remark ecosystem) per ADR-0007 | P1 | US-002 |
| FR-006 | Parse JSON settings with Zod schema validation | P1 | US-002 |
| FR-007 | Extract metrics: token count, section count, heading depth, code blocks | P1 | US-003 |
| FR-008 | Preserve AST position information (line, column) for causal references | P1 | US-002 |
| FR-009 | Calculate structure quality score (0-100) based on research thresholds | P2 | US-004 |
| FR-010 | Detect anti-patterns: generic rules, linter jobs, instruction overload | P2 | US-004 |
| FR-011 | Detect emphasis markers (MUST, IMPORTANT, CRITICAL) and frequency | P1 | US-003 |
| FR-012 | Detect SKILL.md files in .claude/skills/ directories (project and user-level) | P2 | US-005 |
| FR-013 | Parse SKILL.md frontmatter (name, description required; allowed-tools, model, user-invocable optional) and content sections | P2 | US-005 |
| FR-014 | Identify configuration hierarchy (global → project → local) | P2 | US-006 |
| FR-015 | Detect conflicting guidance across configuration levels | P3 | US-006 |
| FR-016 | Support glob patterns for excluding directories (node_modules, .git) | P1 | US-001 |
| FR-017 | Return structured output optimized for agent consumption (poka-yoke) | P1 | All |
| FR-018 | Parse YAML frontmatter using remark-frontmatter plugin, expose as structured metadata | P2 | US-002 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Config detection performance | Time to scan typical project | < 5 seconds |
| NFR-002 | Config detection accuracy | Detection rate on test corpus | > 95% |
| NFR-003 | Parse reliability | Success rate on valid configs | > 99% |
| NFR-004 | Memory efficiency | Peak memory during parsing | < 50MB |
| NFR-005 | Error recoverability | Partial results on parse errors | Always return what was parsed |

---

## 4. Key Entities

> Define the core domain entities this feature introduces or modifies

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| `ConfigFile` | A discovered configuration file | path, type, size, lastModified |
| `ParsedConfig` | Parsed configuration content | ast, metrics, warnings, positions |
| `ConfigMetrics` | Extracted quality signals | tokenCount, sectionCount, depth, codeBlocks |
| `QualityAssessment` | Quality evaluation result | score, issues, recommendations |
| `ConfigHierarchy` | Configuration inheritance tree | global, project, local, conflicts |
| `EffectiveConfig` | Merged configuration from all levels | sections, codeBlocks, aggregateMetrics, fileCount |
| `Skill` | Parsed SKILL.md content | name, description, allowedTools, model, userInvocable, bundledFiles |

### 4.1 Entity Relationships

```
ConfigFile --1:1--> ParsedConfig
ParsedConfig --1:1--> ConfigMetrics
ParsedConfig --1:1--> QualityAssessment
ConfigFile --N:1--> ConfigHierarchy
ConfigHierarchy --1:1--> EffectiveConfig
ConfigHierarchy --1:N--> Conflict
```

---

## 5. Success Criteria

> How do we know this feature is successful? Define measurable outcomes.

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80% for config analysis tools
- [ ] **Performance**: Config detection < 5 seconds (NFR-001)
- [ ] **Accuracy**: >95% detection rate on test corpus (NFR-002)
- [ ] **MVP Gate**: `parse_config` tool produces meaningful output that agent can reason about
- [ ] **Integration**: Tool integrates with orchestration layer (EP02) via SDK `tool()` pattern

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Config file not found at expected path | Return error with suggestion to check path | P1 |
| Malformed markdown (unclosed code block) | Parse what's possible, return warnings | P1 |
| Invalid JSON in settings.json | Return parse error with line number | P1 |
| Very large config (>1000 lines) | Process with memory efficiency, warn about size | P1 |
| Circular symlinks in config directories | Detect and skip with warning | P2 |
| Binary file with .md extension | Detect and skip with warning | P2 |
| Config in unsupported encoding | Attempt UTF-8, warn if issues | P2 |
| Empty configuration file | Return empty parsed result, not error | P1 |
| Config with only comments | Parse as empty sections, preserve comments | P2 |
| Permission denied on config file | Return error with clear message | P1 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP01 Project Foundation | Internal | Complete | Cannot start - need Zod, project structure |
| EP02 Orchestration Core | Internal | Complete | Cannot register tools with SDK |
| EP03 Persistence Layer | Internal | Complete | Cannot cache config data (soft dependency) |
| unified/remark | External | Available | Markdown parsing - core functionality |
| remark-frontmatter | External | Available | YAML frontmatter parsing in markdown |
| Zod | External | Available | Schema validation - already in project |
| glob | External | Available | File discovery patterns |

### 7.2 Assumptions

- CLAUDE.md files follow markdown syntax (may have non-standard elements)
- .claude/settings.json follows documented schema (may have unknown fields)
- Users have read access to all configuration files
- Global config location is ~/.claude/ on all platforms
- remark/unified ecosystem handles all markdown edge cases we'll encounter

---

## 8. Open Questions

> Questions that need resolution before implementation

- [x] **Q1**: Should we parse .cursorrules files in MVP or defer to EP08? — **RESOLVED: Defer to EP08 (ACT Adapters)**
- [x] **Q2**: What's the threshold for "instruction overload" anti-pattern? — **RESOLVED: >200 instructions per ADR-0007**
- [x] **Q3**: Should config caching use EP03 persistence or in-memory only? — **RESOLVED: In-memory only. Config parsing is fast (<5s), no persistence overhead needed.**
- [x] **Q4**: How to handle frontmatter in CLAUDE.md (some users add YAML)? — **RESOLVED: Parse with remark-frontmatter plugin, extract YAML metadata into structured data.**
- [x] **Q5**: What exclusion patterns should be default (node_modules, .git)? — **RESOLVED: Both excluded by default**

---

## 9. References

- [Epic: EP05 Config Analysis Tools](../../docs/planning/epics/EP05-config-analysis.md)
- [ADR-0005: Tool Definition and Invocation Pattern](../../docs/architecture/adr/0005-tool-definition-and-invocation-pattern.md)
- [ADR-0007: Configuration Parser Design](../../docs/architecture/adr/0007-configuration-parser-design.md)
- [Arc42 §5: Building Blocks - Tool Layer](../../docs/architecture/arc42/05-building-blocks.md)
- [Use Cases: UC-001, UC-002, UC-007](../../docs/requirements/use-cases.md)
- [mdast - Markdown AST](https://github.com/syntax-tree/mdast)
- [remark - Unified markdown processor](https://unifiedjs.com/explore/package/remark/)

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-17

#### Research Findings: AI Coding Agent Configuration Landscape

Based on web research, the AI coding agent configuration ecosystem has evolved significantly:

**CLAUDE.md (Claude Code)**
- No required format—plain markdown, human-readable ([Anthropic Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices))
- File locations: project root, nested dirs, ~/.claude/CLAUDE.md global
- Key sections: WHAT (tech stack, structure), WHY (purpose), HOW (verification, tests)
- Best practice: Keep concise (<200 instructions), avoid stuffing, use file:line references instead of code snippets ([HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md))
- Settings complement: .claude/settings.json for technical behavior

**AGENTS.md (Open Standard)**
- Adopted by 20,000+ GitHub repositories ([InfoQ](https://www.infoq.com/news/2025/08/agents-md/))
- Supported by: OpenAI Codex, Google Jules, Cursor, Aider, Gemini CLI ([agents.md](https://agents.md/))
- Format: Plain markdown, no required structure, README for AI agents
- File discovery: Nearest file in directory tree takes precedence
- Common sections: Build & Test, Architecture, Security, Git Workflows, Conventions

**Cursor Rules**
- Legacy .cursorrules deprecated, migrated to .cursor/rules/*.mdc ([Cursor Docs](https://cursor.com/docs/context/rules))
- Rule types: User Rules (global), Project Rules (version-controlled)
- Best practice: Keep under 500 lines, split into focused .mdc files
- Token economy: Rules in "Always Apply" mode loaded every conversation

**Frontmatter Handling**
- YAML frontmatter widely used for metadata ([Jekyll](https://jekyllrb.com/docs/front-matter/))
- remark-frontmatter plugin handles syntax, stores in file.data.matter ([remark-frontmatter](https://github.com/remarkjs/remark-frontmatter))
- Recommended: Use YAML for highest portability

#### Q3: Config Caching Strategy

**Question**: Should config caching use EP03 persistence or in-memory only?

**Answer**: In-memory only

**Rationale**:
- Config parsing is fast (<5 seconds per NFR-001)
- No need for persistence overhead
- Avoids cache invalidation complexity (configs change frequently during development)
- Memory-efficient parsing already required (NFR-004: <50MB)
- If metrics need historical tracking, that's baseline storage (EP09), not config caching

**Updated**: No requirement changes needed—in-memory is implicit in current design.

#### Q4: YAML Frontmatter Handling

**Question**: How to handle frontmatter in CLAUDE.md (some users add YAML)?

**Answer**: Parse with remark-frontmatter plugin

**Rationale**:
- Industry standard approach in unified/remark ecosystem
- remark-frontmatter extracts YAML into `file.data.matter` automatically
- Preserves AST position information for the frontmatter block
- Gracefully handles files without frontmatter
- Already using remark ecosystem per ADR-0007

**Updated**: Added FR-018 for frontmatter parsing.

### Requirements Updates

Added new requirement based on clarifications:

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-018 | Parse YAML frontmatter using remark-frontmatter plugin, expose as structured metadata | P2 | US-002 |

### Additional Research Insights

**Quality Thresholds (from ADR-0007 research)**:
- Claude Code: <60 lines recommended, 300 max
- Cursor: <100 lines per .mdc file, 500 max total
- Generic: <80 lines, 300 max
- Token weight: <3k lightweight, 3k-15k medium, >25k problematic

**Anti-patterns to detect**:
1. Generic rules ("Write clean code") - wastes tokens
2. Linter jobs - belong in ESLint/Prettier, not config
3. Instruction overload - >150-200 instructions unreliable
4. Embedded secrets - API keys, passwords
5. Code snippets - use file:line references instead (snippets go stale)

#### Research Findings: SKILL.md Format (Claude Code Skills)

Based on research from [Claude Code Docs](https://code.claude.com/docs/en/skills) and [Anthropic Skills Repository](https://github.com/anthropics/skills):

**File Structure**:
- SKILL.md file with YAML frontmatter + markdown content
- Frontmatter: HOW the skill runs (permissions, model, metadata)
- Content: WHAT Claude should do (instructions, examples, guidelines)

**Required Frontmatter Fields**:
- `name`: Human-friendly name (max 64 characters)
- `description`: When to invoke the skill (max 200 characters) - critical for auto-discovery

**Optional Frontmatter Fields**:
- `allowed-tools`: Comma-separated list (e.g., "Read, Grep, Bash(npm:*)")
- `model`: Specific model to use (e.g., "claude-sonnet-4-20250514")
- `user-invocable`: Boolean, hides from slash menu if false
- `disable-model-invocation`: Boolean, blocks programmatic invocation

**Skill Locations** (scanned in order):
1. User settings: `~/.config/claude/skills/`
2. Project settings: `.claude/skills/`
3. Plugin-provided skills
4. Built-in skills

**Folder Structure**:
```
.claude/skills/my-skill/
├── SKILL.md           # Required: frontmatter + instructions
├── scripts/           # Optional: helper scripts
├── references/        # Optional: detailed specs
└── assets/            # Optional: templates, data
```

**Best Practices**:
- Keep SKILL.md focused (<500 lines)
- Put detailed docs in separate reference files
- Include example inputs/outputs
- Information lives in SKILL.md OR references, not both

**Updated Requirements**: FR-012 and FR-013 now have detailed format knowledge for SKILL.md parsing.
