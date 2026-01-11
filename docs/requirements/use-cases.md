# agentlint Use Cases

> Derived from Architecture Vision sections 2-3: Core Capabilities and Analysis Areas
> Aligned with North Star continuous improvement model (January 2026)

## Continuous Improvement Loop

Use cases are organised around the continuous improvement cycle:

```
  BASELINE ──▶ CHANGE ──▶ OBSERVE ──▶ UNDERSTAND ──▶ REFINE ──┐
      │                                                        │
      └────────────────────────────────────────────────────────┘
```

| Phase | Use Cases |
|-------|-----------|
| BASELINE | UC-000 |
| OBSERVE | UC-001, UC-002, UC-003 |
| UNDERSTAND | UC-006, UC-008 |
| REFINE | UC-004, UC-005, UC-007 |

---

## Causal Analysis Model

Traditional linters detect issues. agentlint goes further—it traces issues to their origin and recommends preventive changes.

```
DETECT ──▶ TRACE ──▶ UNDERSTAND ──▶ PREVENT
  │          │           │            │
  │          │           │            └── Config changes to stop recurrence
  │          │           └── Why did this happen?
  │          └── Which session/commit introduced this?
  └── What is the issue?
```

**Example: Secret in CLAUDE.md**

| Step | Output |
|------|--------|
| DETECT | "API key found on line 42" |
| TRACE | "Added in session 2024-01-10 when you prompted 'add my database config'" |
| UNDERSTAND | "No credential handling guidance exists in CLAUDE.md" |
| PREVENT | "Add to CLAUDE.md: 'Never hardcode secrets. Always use environment variables.'" |

This transforms agentlint from a **linter** (point-in-time detection) into a **learning system** (causal analysis + prevention).

---

## UC-000: Establish Baseline

**Priority**: P0 (Critical for continuous improvement model)

- **Actor**: Developer
- **Precondition**: First time running agentlint on a project (or explicit baseline reset)
- **Main Flow**:
  1. Developer runs `agentlint baseline`
  2. System scans for AI configurations
  3. System analyses session logs (if available)
  4. System captures repository structure signals
  5. System stores baseline snapshot with timestamp
  6. System reports baseline summary with key metrics
- **Postcondition**: Baseline established for future comparison
- **MVP Scope**: Claude Code config + session log baseline
- **Signals Captured**:
  - Config: presence, length, structure score
  - Sessions: avg tokens/task, avg iterations, tool distribution
  - Repo: type coverage, linter presence, doc completeness

---

## UC-001: Discover AI Configurations

**Priority**: P0

- **Actor**: Developer
- **Precondition**: In a project directory
- **Main Flow**:
  1. Developer runs `agentlint scan`
  2. System scans for known AI config patterns
  3. System validates config file syntax
  4. System reports found configurations with locations and basic stats
- **Postcondition**: Developer knows what AI configs exist
- **MVP Scope**: Claude Code only (CLAUDE.md, .claude/, settings)
- **Future Scope**: Cursor (.cursorrules), Copilot (copilot-instructions.md), Codex (AGENTS.md)

---

## UC-002: Assess Configuration Effectiveness

**Priority**: P0

- **Actor**: Developer
- **Precondition**: AI configurations detected
- **Main Flow**:
  1. Developer runs `agentlint analyse`
  2. System parses configuration files
  3. System extracts metrics:
     - Length (tokens, lines)
     - Structure (sections, hierarchy)
     - Completeness (missing common elements)
     - Security (secrets, sensitive paths)
  4. System applies quality rules
  5. System flags issues for tracing (feeds UC-008)
  6. System reports effectiveness assessment with scores
- **Postcondition**: Developer understands config quality; issues queued for tracing
- **MVP Scope**: Static analysis only (no LLM assessment)

---

## UC-003: Analyse Session Logs

**Priority**: P0

- **Actor**: Developer
- **Precondition**: Claude Code session logs exist (~/.claude/projects/)
- **Main Flow**:
  1. Developer runs `agentlint analyse --sessions`
  2. System locates session log files
  3. System parses JSONL session data
  4. System extracts statistics:
     - **Efficiency**: tokens per task, input/output ratio
     - **Iteration**: turns per task, retry frequency
     - **Tool usage**: distribution across read/write/bash/search
     - **Errors**: error frequency, common error types
     - **Patterns**: high-cost sessions, confusion signals
  5. System indexes sessions for tracing (supports UC-008)
  6. System aggregates across sessions (daily, weekly, all-time)
  7. System reports session patterns with visualisations
- **Postcondition**: Developer understands usage patterns; sessions indexed for correlation
- **MVP Scope**: Statistical analysis only (no LLM summarisation)

---

## UC-004: Get Improvement Recommendations

**Priority**: P1

- **Actor**: Developer
- **Precondition**: Analysis complete (UC-002, UC-003) and tracing complete (UC-008)
- **Main Flow**:
  1. Developer runs `agentlint recommend`
  2. System loads analysis results and traced issues
  3. System generates three types of recommendations:
     - **Symptomatic**: Fix immediate issues ("remove the secret")
     - **Preventive**: Stop recurrence ("add credential guidance to CLAUDE.md")
     - **Systemic**: Address root patterns ("add pre-commit hook for secret scanning")
  4. System categorises recommendations:
     - Config improvements: length, structure, modularity
     - Missing guidance: gaps that led to session problems
     - Tooling adoption: type system, linter, formatter gaps
     - Documentation gaps: README, architecture docs, llms.txt
     - Session insights: patterns traced to config gaps
  5. System prioritises recommendations by impact
  6. System outputs actionable suggestions with rationale and origin trace
- **Postcondition**: Developer has prioritised actions with clear cause-effect understanding
- **MVP Scope**: Rule-based recommendations (no LLM generation)
- **Key Differentiator**: Recommendations explain WHY (traced origin) not just WHAT

---

## UC-005: Generate Configuration

**Priority**: Future (Phase 4)

- **Actor**: Developer
- **Precondition**: Recommendations reviewed
- **Main Flow**:
  1. Developer runs `agentlint generate`
  2. System analyses repository structure
  3. System generates recommended config content based on traced issues
  4. System writes or proposes changes
- **Postcondition**: Config files created or updated with preventive guidance
- **MVP Scope**: Deferred

---

## UC-006: Compare to Baseline

**Priority**: P0 (Critical for continuous improvement model)

- **Actor**: Developer
- **Precondition**: Baseline exists (UC-000), changes have been made
- **Main Flow**:
  1. Developer runs `agentlint compare` or `agentlint analyse --compare`
  2. System runs current analysis
  3. System loads most recent baseline
  4. System calculates deltas:
     - Improved metrics (↑ with magnitude)
     - Regressed metrics (↓ with magnitude)
     - Unchanged metrics (→)
  5. System correlates changes with git history
  6. System identifies which config changes led to which improvements
  7. System reports comparison with trend indicators and causal insights
- **Postcondition**: Developer sees what improved/regressed and understands why
- **MVP Scope**: Quantitative comparison with git correlation
- **Key Metrics Compared**:
  - Config quality score delta
  - Session efficiency delta (tokens, iterations)
  - Tooling adoption changes
  - Issue count delta (new issues, resolved issues)

---

## UC-007: Validate Configuration Quality

**Priority**: P1

- **Actor**: Developer (especially The Context Engineer persona)
- **Precondition**: CLAUDE.md or other config exists
- **Main Flow**:
  1. Developer runs `agentlint lint` or `agentlint validate`
  2. System checks config against best practices:
     - **Length**: Not too long (context bloat), not too short (missing guidance)
     - **Structure**: Clear sections, progressive disclosure
     - **Security**: No secrets, API keys, credentials
     - **Clarity**: Instruction keywords (MUST, IMPORTANT) used appropriately
     - **Modularity**: References to sub-files where appropriate
     - **Preventive guidance**: Does config address common AI failure modes?
  3. System flags issues for tracing (feeds UC-008)
  4. System reports violations with severity (error, warning, info)
  5. System suggests specific fixes
- **Postcondition**: Developer knows config issues; issues queued for origin tracing
- **MVP Scope**: Static rules based on Anthropic's published best practices
- **Rules Based On**:
  - Anthropic's CLAUDE.md documentation
  - Context engineering best practices
  - Common anti-patterns from community
  - Traced patterns from session analysis

---

## UC-008: Trace Issue Origins

**Priority**: P1 (Critical for causal analysis model)

- **Actor**: Developer (or triggered automatically after UC-002, UC-003, UC-007)
- **Precondition**: Issues detected from analysis or validation
- **Main Flow**:
  1. Developer runs `agentlint trace` or system traces automatically
  2. For each detected issue, system searches for origin:
     - **Session logs**: Which session introduced this? What prompt led to it?
     - **Git history**: When was this content added? By AI or human?
     - **Config gaps**: What guidance was missing that allowed this?
  3. System identifies the causal chain:
     - Trigger: What action/prompt initiated the issue
     - Context: What was missing from CLAUDE.md or docs
     - Pattern: Is this a recurring issue type?
  4. System generates preventive recommendation:
     - Config change to prevent recurrence
     - Documentation to add
     - Tooling to enable (pre-commit hooks, linters)
  5. System links issue → origin → prevention in output
- **Postcondition**: Developer understands WHY issues occurred and HOW to prevent them
- **MVP Scope**: Session log correlation + git history; rule-based causal inference
- **Examples**:

| Issue | Traced Origin | Prevention |
|-------|--------------|------------|
| Secret in config | Session: "add my API config" | Add: "Use env vars for credentials" |
| 500-line function | Session: 12 iterations, no size guidance | Add: "Max 50 lines per function" |
| High token cost | AI requested same file 12× | Create llms.txt index |
| 15 iterations | "Not what I meant" ×8 | Add domain glossary + examples |
| Deprecated API used | AI found old example in docs | Update docs; add deprecated patterns list |

---

## Use Case Dependencies

```
UC-000 (Baseline)
    │
    ├──▶ UC-001 (Discover) ──▶ UC-002 (Assess Config) ──┐
    │                                                    │
    │                                                    ├──▶ UC-008 (Trace) ──▶ UC-004 (Recommend)
    │                                                    │         ▲
    ├──▶ UC-003 (Analyse Sessions) ──────────────────────┤         │
    │                                                    │         │
    │                                              UC-007 (Validate)┘
    │
    └──▶ UC-006 (Compare) ◀── [after changes made]
```

**Key insight**: UC-008 (Trace) is the bridge between detection (UC-002, UC-003, UC-007) and prevention (UC-004). Without tracing, recommendations are symptomatic. With tracing, recommendations are preventive.

---

## MVP Scope Summary

| Use Case | MVP | Phase | Priority |
|----------|-----|-------|----------|
| UC-000: Establish Baseline | ✅ | 1 | P0 |
| UC-001: Discover Configs | ✅ | 1 | P0 |
| UC-002: Assess Config | ✅ | 1 | P0 |
| UC-003: Analyse Sessions | ✅ | 1 | P0 |
| UC-004: Recommend (Preventive) | ✅ | 1 | P1 |
| UC-005: Generate Config | ❌ | 4 | - |
| UC-006: Compare to Baseline | ✅ | 1 | P0 |
| UC-007: Validate Config | ✅ | 1 | P1 |
| UC-008: Trace Issue Origins | ✅ | 1 | P1 |

---

## Recommendation Types

Understanding the three levels of recommendations:

| Type | Focus | Example | Value |
|------|-------|---------|-------|
| **Symptomatic** | Fix immediate issue | "Remove API key from line 42" | Low (fixes symptom) |
| **Preventive** | Stop recurrence | "Add to CLAUDE.md: 'Use env vars for credentials'" | High (prevents future issues) |
| **Systemic** | Address root patterns | "Add pre-commit hook for secret scanning" | Highest (catches all variants) |

agentlint prioritises **preventive** recommendations because they compound value over time—each one makes future AI sessions better.
