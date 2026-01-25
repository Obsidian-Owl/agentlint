# Implementation Plan: MCP Config Validation

> **Epic**: EP19
> **Spec**: specs/ep19-mcp-config-validation/spec.md
> **Created**: 2026-01-25
> **Status**: Design Complete
> **Author**: Claude

---

## Summary

**Primary Requirement**: Implement static analysis tools for validating MCP server configurations across multiple ACTs (Claude Code, OpenCode, VS Code Copilot). Tools provide rich context and data for agent reasoning about configuration issues.

**Technical Approach**: Extend the existing EP05 config analysis infrastructure with MCP-specific discovery, parsing, and validation. Use `jsonc-parser` for JSONC support with position tracking. Follow the established tool pattern from `src/tools/config/`.

**Key Design Principle**: Tools provide data for agent reasoning—not judgments. The agent has access to Read, WebFetch, Bash, WebSearch to investigate further when needed.

---

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language/Version** | TypeScript 5.x |
| **Primary Dependencies** | Zod, jsonc-parser, Claude Agent SDK |
| **Storage** | In-memory only (no persistence) |
| **Testing Framework** | Bun test runner |
| **Target Platform** | CLI, Node.js/Bun |
| **Project Type** | CLI Tool with agentic orchestration |
| **Performance Goals** | < 2s discovery (NFR-001), < 500ms validation (NFR-002) |
| **Constraints** | Local-first, static analysis only |
| **Scale/Scope** | Single developer, multiple ACTs |

---

## Constitution Check

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✓ | All validation local; no network calls; no data transmission |
| II | Improvement-Oriented | ✓ | Validation results enable tracking config quality over time |
| III | Causal-First | ✓ | Issues include file:line:column for precise location |
| IV | Mixed-Methods | ✓ | Quantitative (schema, paths) + qualitative (patterns, context) |
| V | Language-Agnostic | ✓ | MCP config is language-independent JSON |
| VI | Agent-Agnostic | ✓ | Supports Claude Code, OpenCode, VS Code, extensible to future ACTs |
| VII | Intelligent Tooling | ✓ | Tools return data; agent reasons about issues |
| VIII | Compounding Value | ✓ | Validation findings feed into recommendations over time |
| IX | Agent-Aware | ✓ | Structured output with rich context for agent consumption |

**Gate Status**: [x] All principles pass

---

## Project Structure

### Documentation Structure

```
specs/ep19-mcp-config-validation/
├── spec.md           # Feature specification (complete)
├── plan.md           # This file
├── research.md       # Research findings (to be generated)
├── data-model.md     # Entity definitions (to be generated)
├── quickstart.md     # Usage guide (to be generated)
├── contracts/        # API definitions
│   └── interfaces.ts # TypeScript interfaces
└── checklists/
    ├── requirements.md  # Spec quality (complete)
    └── design.md        # Design quality (to be generated)
```

### Source Code Structure (Proposed)

```
src/tools/
├── config/                       # Existing EP05 config tools
│   ├── index.ts                  # Add MCP exports
│   ├── types.ts                  # Add MCP types
│   ├── discovery.ts              # Existing (already finds .mcp.json)
│   └── mcp/                      # NEW: MCP-specific module
│       ├── index.ts              # Module exports
│       ├── types.ts              # MCP-specific types
│       ├── schemas.ts            # Zod schemas for MCP configs
│       ├── discovery.ts          # Multi-ACT MCP discovery
│       ├── parser.ts             # JSONC parsing with positions
│       ├── validators/           # Validation logic
│       │   ├── index.ts          # Validator exports
│       │   ├── schema.ts         # Schema validation
│       │   ├── path.ts           # Path/executable validation
│       │   ├── env.ts            # Environment variable validation
│       │   ├── transport.ts      # Transport-specific validation
│       │   └── patterns.ts       # Anti-pattern detection
│       ├── get-mcp-configs-tool.ts   # Discovery tool definition
│       └── validate-mcp-config-tool.ts # Validation tool definition
```

---

## Complexity Tracking

> No constitution violations—no entries needed

| Principle | Violation | Justification | Mitigation |
|-----------|-----------|---------------|------------|

---

## Key Design Decisions

| Decision | Choice | Rationale | Reference |
|----------|--------|-----------|-----------|
| JSON parser | `jsonc-parser` | JSONC support + position tracking in one package | Clarification Q1 |
| Tool integration | Extend EP05 config module | Reuse discovery, follow established patterns | EP05 architecture |
| ACT discovery | Multi-ACT with priority | Support Claude Code, OpenCode, VS Code with clear priorities | Spec §1.3 |
| Validation approach | Data for agent reasoning | Tools return facts; agent judges severity | Constitution VII |
| Schema validation | Zod with passthrough | Allow unknown fields, report as info | Clarification Q5 |
| Path validation | No deep resolution | Check PATH, report data; agent investigates | Clarification Q2 |
| Error codes | Structured taxonomy | MCP001-MCP022 for programmatic handling | Spec §4.2 |

---

## Architecture Integration

### Tool Layer Position

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER (EP02)                    │
│   Master Agent Loop • Context Management • Tool Selection        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                       TOOL LAYER (EP05+)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 CONFIG ANALYSIS (EP05)                    │   │
│  │  discover_configs • parse_config • analyze_hierarchy      │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MCP CONFIG VALIDATION (EP19) ← NEW           │   │
│  │  get_mcp_configs • validate_mcp_config                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               SESSION ANALYSIS (EP06)                     │   │
│  │  search_sessions • get_session_stats • index_sessions     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Registration Flow

```typescript
// src/tools/config/mcp/index.ts
export { getMcpConfigsTool } from './get-mcp-configs-tool';
export { validateMcpConfigTool } from './validate-mcp-config-tool';

// src/tools/config/index.ts - add to exports
export * from './mcp';

// Registration happens in orchestrator setup
registry.registerMany([getMcpConfigsTool, validateMcpConfigTool]);
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
**Goal**: JSONC parsing with position tracking, MCP types

Tasks:
- Add `jsonc-parser` dependency
- Create MCP-specific type definitions
- Create Zod schemas for MCP config formats
- Implement JSONC parser wrapper with position extraction

Files:
- `src/tools/config/mcp/types.ts`
- `src/tools/config/mcp/schemas.ts`
- `src/tools/config/mcp/parser.ts`

### Phase 2: Multi-ACT Discovery
**Goal**: Discover MCP configs across Claude Code, OpenCode, VS Code

Tasks:
- Extend config discovery for ACT-specific locations
- Implement user-level config detection (~/.claude.json, etc.)
- Add ACT identification to discovered configs
- Handle platform-specific paths

Files:
- `src/tools/config/mcp/discovery.ts`
- `src/tools/config/mcp/get-mcp-configs-tool.ts`

### Phase 3: Validation Logic
**Goal**: Schema, path, env, transport validation

Tasks:
- Implement schema validation with position tracking
- Implement path existence checking
- Implement environment variable pattern detection
- Implement transport-specific validation
- Implement anti-pattern detection

Files:
- `src/tools/config/mcp/validators/schema.ts`
- `src/tools/config/mcp/validators/path.ts`
- `src/tools/config/mcp/validators/env.ts`
- `src/tools/config/mcp/validators/transport.ts`
- `src/tools/config/mcp/validators/patterns.ts`
- `src/tools/config/mcp/validators/index.ts`

### Phase 4: Tool Integration
**Goal**: Complete SDK tools with rich output

Tasks:
- Implement `validate_mcp_config` tool definition
- Create aggregation logic for multi-file results
- Add comprehensive test coverage
- Document tool usage

Files:
- `src/tools/config/mcp/validate-mcp-config-tool.ts`
- `src/tools/config/mcp/index.ts`
- Tests in `__tests__/tools/config/mcp/`

---

## Tool Design (Agent-First)

### get_mcp_configs Tool

**Purpose**: Discover MCP configuration files across ACT-specific locations.

**Returns data for agent reasoning**:
```typescript
interface GetMcpConfigsResult {
  files: McpConfigFile[];        // What configs exist
  summary: {
    totalFiles: number;
    byAct: Record<string, number>;
    byScope: Record<string, number>;
  };
  guidance: string[];            // Helpful context if no configs found
}
```

The agent decides if the discovered configs are sufficient or if investigation is needed.

### validate_mcp_config Tool

**Purpose**: Validate an MCP configuration file and return structured findings.

**Returns data for agent reasoning**:
```typescript
interface ValidateMcpConfigResult {
  file: McpConfigFile;
  servers: McpServerValidation[];  // Per-server validation data
  issues: McpValidationIssue[];    // All detected issues with positions
  context: {
    hasSecrets: boolean;           // Agent decides if this is a problem
    hasRelativePaths: boolean;     // Agent decides if this needs investigation
    unknownFields: string[];       // Agent decides if these are ACT extensions
    variableRefs: string[];        // Agent can check if vars are set
  };
}
```

The agent:
- Reasons about which issues are actually problems
- Can use Read to examine config files
- Can use Bash to check PATH, env vars
- Can use WebFetch to verify packages exist
- Decides what to recommend to the user

---

## References

- **Spec**: [spec.md](./spec.md)
- **Epic**: [EP19 MCP Config Validation](../../docs/planning/epics/EP19-mcp-config-validation.md)
- **EP05**: [Config Analysis Tools](../ep05-config-analysis/plan.md) (pattern reference)
- **Constitution**: [Constitution](../../.specify/memory/constitution.md)
- **ADRs**: ADR-0005 (Tool Pattern), ADR-0007 (Config Parser), ADR-0019 (Agent-First Tools)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-25 | Claude | Initial plan |
