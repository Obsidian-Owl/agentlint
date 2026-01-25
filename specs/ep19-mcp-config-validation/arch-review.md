# Architecture Review Report

> Feature: EP19 - MCP Config Validation
> Branch: ep19-mcp-config-validation
> Reviewed: 2026-01-25

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Violations | 0 | ✓ |
| Drift | 1 | ⚠️ |
| Enhancements | 4 | ℹ️ |

**Overall**: PASS (documentation updates needed)

---

## Changes Analyzed

| File | Category | Arc42 Section |
|------|----------|---------------|
| `src/tools/config/mcp/` | New module | §5.3 Config Analysis Tools |
| `src/tools/config/mcp/get-mcp-configs-tool.ts` | New tool | §5 Tool Layer |
| `src/tools/config/mcp/validate-mcp-config-tool.ts` | New tool | §5 Tool Layer |
| `src/tools/config/mcp/validators/*.ts` | New validators | §5.3 (internal) |
| `src/tools/config/mcp/discovery.ts` | New discovery | §5.3 Config Discovery |
| `src/tools/config/mcp/parser.ts` | New parser | §5.3 Config Parsing |
| `src/tools/config/mcp/schemas.ts` | New schemas | §5.3 Schema Validation |
| `src/tools/config/mcp/types.ts` | New types | §8.1 Domain Model |
| `src/tools/index.ts` | Modified | §5 Tool Registration |

---

## Findings

### Drift

**D1: New MCP Config module not documented in Arc42 §5**
- Location: `src/tools/config/mcp/`
- Issue: The entire MCP config validation module is new and undocumented in the building blocks view
- Impact: Low - follows existing EP05 Config Analysis patterns
- Recommendation: Add "Level 3: MCP Config Validation Tools (EP19)" section to §5 Building Blocks

---

### Enhancements

**E1: Tool Definition Pattern Compliance (ADR-0005)**
- Location: `src/tools/config/mcp/get-mcp-configs-tool.ts`, `validate-mcp-config-tool.ts`
- Alignment: ✓ Follows ADR-0005 precisely
  - Rich tool descriptions with usage guidance
  - Zod schema with `.describe()` for all parameters
  - Returns `_rawData` for programmatic access alongside human-readable text
  - Structured error handling with `isError: true`
- Quality: Excellent - exemplary tool definitions

**E2: Tool/Agent Boundary Compliance (ADR-0019)**
- Location: `src/tools/config/mcp/validators/`
- Alignment: ✓ Tools provide DATA, not judgment
  - `validatePath()` returns facts: path exists, is executable, is in PATH
  - `validateEnv()` returns facts: variable references found, sensitive patterns detected
  - `validateTransport()` returns facts: URL format, Docker flags present
  - Agent interprets severity and provides fix recommendations
- Quality: Strong adherence to Constitution Principle VII

**E3: Type System Following Domain Model (§8.1)**
- Location: `src/tools/config/mcp/types.ts`
- Alignment: ✓ Types follow established patterns
  - `McpValidationIssue` with Position tracking (matches ParseWarning pattern)
  - `McpServerConfig` structured entity
  - `GetMcpConfigsResult` / `ValidateMcpConfigResult` as tool return types
  - Zod schemas for runtime validation
- Quality: Consistent with EP05/EP06/EP07 type patterns

**E4: Tool Registration Pattern**
- Location: `src/tools/index.ts`
- Alignment: ✓ Follows established registration pattern
  - `MCP_CONFIG_TOOLS` array for bulk registration
  - `registerMcpConfigTools()` function
  - Registered in `registerAllTools()` (now 40 tools total)
- Quality: Clean, consistent with existing patterns

---

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | ✓ | All validation runs locally; no external services |
| II. Improvement-Oriented | ✓ | Enables proactive config issue detection |
| III. Causal-First | ✓ | Issues have position tracking for tracing |
| IV. Mixed-Methods | ✓ | Static validators + agent reasoning for recommendations |
| V. Language-Agnostic | ✓ | Validates JSON configs regardless of project language |
| VI. Agent-Agnostic | ✓ | Supports Claude Code, OpenCode, VS Code Copilot, etc. |
| VII. Intelligent Tooling | ✓ | Tools provide data; agent provides judgment |
| VIII. Compounding Value | ✓ | Issue codes enable pattern tracking over time |
| IX. Agent-Aware | ✓ | Rich descriptions, structured output, `_rawData` pattern |

---

## Recommendations

### Required Updates

1. **Add EP19 to Arc42 §5 Building Blocks**
   - Add "Level 3: MCP Config Validation Tools (EP19)" section
   - Document module structure, tool definitions, validator responsibilities
   - Include performance characteristics

### Suggested Updates

2. **Update Arc42 §5 Tool Layer Summary**
   - Add MCP Config tools to the Tool Layer table
   - Current lists EP05-EP15 tools; add EP19

3. **Consider ADR for Multi-ACT Config Strategy**
   - Document decision to support multiple ACT config formats
   - Record config location detection approach

---

## Architecture Debt

| Item | Severity | Effort |
|------|----------|--------|
| Add EP19 to §5 Building Blocks | Low | 30 min |
| Update Tool Layer summary table | Low | 10 min |

---

## Wiring Verification

✓ **Entry Point Chain Verified**:
```
analyse.ts → registerAllTools() → registerMcpConfigTools() → MCP_CONFIG_TOOLS
                                                          ↓
                                           [getMcpConfigsTool, validateMcpConfigTool]
```

✓ **Dead Code Removed**:
- `getPropertyPosition` (superseded by `getPositionAtPath`)
- `getNodeAtPath` (redundant wrapper)
- `getSchemaForFormat` (validation uses format-aware field checking)

---

## Merge Status

**APPROVED** - All architectural requirements met.

Documentation updates recommended but not blocking:
- Add EP19 section to §5 Building Blocks (follow-up PR)
