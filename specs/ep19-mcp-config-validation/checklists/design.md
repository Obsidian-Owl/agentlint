# Design Quality Checklist: EP19 MCP Config Validation

> Generated: 2026-01-25
> Status: Design Complete

## Architecture Alignment

- [x] Follows established tool patterns from EP05
- [x] Integrates with existing config discovery infrastructure
- [x] Uses SDK `tool()` pattern for tool definitions
- [x] Uses Zod for schema validation
- [x] Position tracking for file:line:column references

## Tool/Agent Boundary (Constitution VII)

Per the agent-first design principle, tools provide data, agent provides judgment.

| Tool | Provides Data | Does NOT Judge |
|------|---------------|----------------|
| get_mcp_configs | File locations, ACT mappings | Whether configs are "complete" |
| validate_mcp_config | Issues with positions, context | Whether issues are "serious" |

- [x] No tool returns judgments ("low", "bad", "insufficient")
- [x] No tool encodes thresholds (if X > 5 then Y)
- [x] No tool prescribes when to use other tools
- [x] Tool descriptions explain capabilities, not orchestration
- [x] Context fields enable agent to investigate further

## Data Model Quality

- [x] Entities map to spec §4 Key Entities
- [x] All fields have clear types and descriptions
- [x] Relationships are documented
- [x] Enumerations cover all documented cases
- [x] Position types compatible with mdast/EP05

## Issue Code Taxonomy

- [x] Codes follow MCP0XX pattern from spec §4.2
- [x] Error codes (001-009) for definite problems
- [x] Warning codes (010-019) for potential issues
- [x] Info codes (020-029) for context
- [x] Each code has clear triggering condition

## Validation Rules

- [x] Schema validation covers required fields
- [x] Type validation for all config fields
- [x] Path validation for command field
- [x] Sensitive data detection patterns documented
- [x] Transport-specific rules documented
- [x] ACT-specific schema variants defined

## Performance Considerations

- [x] Discovery NFR-001 (<2s) achievable with fast-glob
- [x] Validation NFR-002 (<500ms) achievable with jsonc-parser
- [x] No network calls in validation (static analysis)
- [x] Memory efficient (in-memory only, no persistence)

## Testing Strategy

### Tool-Level Tests (Unit/Integration)
- [ ] Discovery finds configs at all documented locations
- [ ] Parser handles JSONC with comments
- [ ] Position tracking is accurate (line:column)
- [ ] All issue codes trigger correctly
- [ ] ACT-specific schemas validate correctly

### Agent-Level Tests (Evaluations)
- [ ] Agent reasons correctly about MCP003 (missing executable)
- [ ] Agent uses Bash to verify PATH when appropriate
- [ ] Agent provides actionable recommendations

## Dependencies

- [x] `jsonc-parser` identified for JSONC support
- [x] Existing EP05 infrastructure reusable
- [x] No new external service dependencies

## Documentation

- [x] plan.md covers technical approach
- [x] data-model.md defines all entities
- [x] contracts/interfaces.ts provides TypeScript types
- [x] quickstart.md explains tool usage
- [x] Issue codes documented in spec and data model

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| ACT config formats may change | Use passthrough schemas, report unknown fields as info |
| User configs in unexpected locations | Document known locations, agent can search if needed |
| JSONC parsing edge cases | Use battle-tested jsonc-parser library |

## Sign-off

- [ ] Architecture review complete
- [x] Constitution compliance verified
- [x] Tool/Agent boundary clean
- [ ] Ready for task generation
