# Requirements Quality Checklist: EP19 MCP Config Validation

> Generated: 2026-01-25
> Status: Clarification Complete

## Requirement Completeness

- [x] All P1 user stories have acceptance criteria defined
- [x] All acceptance criteria are testable (Given/When/Then format)
- [x] Edge cases are documented with expected behavior
- [x] Error handling scenarios are specified
- [x] Non-functional requirements have measurable targets

## Clarity & Specificity

- [x] User stories describe outcomes, not implementation (tool capabilities, not agent behavior)
- [x] Requirements avoid ambiguous terms ("fast", "efficient") without metrics
- [x] Technical terms are defined or referenced (MCP, ACT, stdio, etc.)
- [x] Examples are provided for complex scenarios (config formats, validation rules)
- [x] Open questions resolved (5/5 clarified on 2026-01-25)

## Consistency

- [x] Requirements don't contradict each other
- [x] Terminology is consistent throughout (ACT, config, server, transport)
- [x] Priority levels (P1/P2/P3) are consistently applied
- [x] User story numbering is sequential and unique

## Testability

- [x] Each functional requirement maps to specific test scenarios
- [x] Acceptance criteria can be verified without human judgment
- [x] Performance targets are quantifiable (NFR-001: <2s, NFR-002: <500ms)
- [x] Success criteria are measurable

## Dependencies & Assumptions

- [x] Internal dependencies are identified (EP01, EP02, EP05)
- [x] External dependencies are listed with status
- [x] Assumptions are explicitly stated
- [x] Risks from dependencies are assessed

## Constitution Alignment

- [x] **III. Causal-First**: Issues traced to file:line:column references
- [x] **V. Language-Agnostic**: MCP config is language-independent
- [x] **VII. Intelligent Tooling**: Tools provide data, agent provides judgment
- [x] **IX. Agent-Aware**: Structured output optimized for agent consumption

## Tool/Agent Boundary Check

Per Constitution Principle VII, verify requirements describe tool capabilities, not agent orchestration:

| Requirement | ✓ Tool Capability | ✗ Agent Orchestration |
|-------------|-------------------|----------------------|
| FR-001: Discover MCP configs | Returns config file list | — |
| FR-006: Validate schema | Returns validation data | — |
| FR-009: Validate paths | Returns existence status | — |
| FR-012: Detect sensitive vars | Returns matching patterns | — |
| FR-017: Return structured results | Data with positions | — |
| FR-021: Detect variable refs | Returns pattern matches | — |
| FR-022: Extract package names | Returns extracted data | — |

All requirements describe what tools return, not when/how agent uses them.

**Key Design Principle** (clarified 2026-01-25): Tools provide rich context and data for agent reasoning. The agent has access to Read, WebFetch, Bash, WebSearch to investigate further when needed. Tools should NOT make judgments—they provide the data that enables judgment.

## Resolved Questions

| Question | Resolution | Rationale |
|----------|------------|-----------|
| Q1: JSONC Support | Full support | OpenCode uses JSONC; use `jsonc-parser` |
| Q2: npx resolution | No deep resolution | Tool reports data; agent can investigate via npm if needed |
| Q3: Env var refs | Detect and document | Report patterns; agent reasons about expansion |
| Q4: Connection testing | No (static only) | Agent can use WebFetch if investigation warranted |
| Q5: ACT extensions | Passthrough with info | Allow unknown fields; agent judges if problematic |

## Requirements Updates from Clarification

| Change | Detail |
|--------|--------|
| Added dependency | `jsonc-parser` for JSONC support |
| MCP016 severity | Changed Warning → Info (unknown fields) |
| Added FR-021 | Variable reference pattern detection |
| Added FR-022 | Package name extraction from npx args |

## Recommendations

1. ~~Resolve Q4 first~~ — Done (static analysis only; agent can test if needed)
2. Consider adding FR for config diff (comparing project vs user configs) — Future enhancement
3. Add explicit error codes documentation — Done (Appendix has MCP001-MCP022)
4. Consider test fixtures for each ACT config format — Implementation detail

## Sign-off

- [ ] Product Owner reviewed
- [ ] Technical Lead reviewed
- [x] Constitution compliance verified (Tool/Agent boundary clean)
