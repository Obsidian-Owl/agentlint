# Feature Specification: MCP Config Validation

> **Epic**: EP19
> **Created**: 2026-01-25
> **Status**: Draft
> **Author**: Claude

---

## 1. Overview

Implement static analysis tools for validating Model Context Protocol (MCP) server configurations across multiple AI Coding Tools (ACTs). This epic provides tools that discover MCP configuration files, validate their structure and content, check for common configuration errors, and return structured validation results that enable the agent to provide actionable fix recommendations.

### 1.1 Business Context

MCP (Model Context Protocol) has become the standard for extending AI coding tools with custom capabilities. Configuration errors are a significant source of user frustration—servers fail silently, paths don't resolve, environment variables are missing, and transport settings are incorrect. These issues are preventable through static analysis.

**Business Hypothesis**: If we implement comprehensive MCP config validation tools that detect, parse, and validate MCP configurations across ACTs, then developers can identify and fix configuration issues before runtime failures occur, measured by pre-runtime issue detection rate and reduced time-to-working-config.

### 1.2 Scope

**In Scope:**
- MCP config file discovery across ACT-specific locations
- JSON schema validation for MCP config format
- Transport-specific validation (stdio, HTTP, SSE)
- Path validation (executable existence, resolution)
- Environment variable validation
- Security pattern detection (secrets in config)
- Cross-ACT compatibility analysis
- Structured validation results with file:line references

**Out of Scope:**
- MCP runtime monitoring (EP15: Session Intelligence)
- MCP error pattern analysis during execution (EP15)
- MCP server installation or setup
- Connection testing beyond static validation
- Automatic config repair (recommendation only)

### 1.3 ACT Support Matrix

| ACT | Config Location(s) | Priority | Status |
|-----|-------------------|----------|--------|
| Claude Code | `.mcp.json`, `~/.claude.json` | P1 | Primary |
| OpenCode | `~/.config/opencode/opencode.json`, `opencode.json` | P1 | Primary |
| VS Code Copilot | `.vscode/mcp.json` | P2 | Secondary |
| Cursor | Command Palette → MCP Settings | P2 | Secondary |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | P3 | Future |
| Zed | `settings.json` (context_servers) | P3 | Future |
| Cline | `cline_mcp_settings.json` | P3 | Future |
| Amazon Q | `~/.aws/amazonq/mcp.json`, `.amazonq/mcp.json` | P3 | Future |

---

## 2. User Scenarios & Testing

> User stories are prioritized: P1 (must-have), P2 (should-have), P3 (nice-to-have)

### US-001 [P1]: Discover MCP Configurations

**As a** developer using AI coding tools,
**I want** to discover all MCP configuration files in my project and user directories,
**So that** I know what MCP servers are configured and where.

**Acceptance Criteria:**
- [ ] Given a project directory, when MCP discovery runs, then `.mcp.json` at project root is found
- [ ] Given user-level configs exist, when discovery runs, then `~/.claude.json` MCP section is found (Claude Code)
- [ ] Given OpenCode is used, when discovery runs, then `opencode.json` and `~/.config/opencode/opencode.json` are found
- [ ] Given VS Code Copilot configs exist, when discovery runs, then `.vscode/mcp.json` is found
- [ ] Given multiple ACTs are configured, when discovery runs, then all are discovered with ACT identification
- [ ] Given no MCP configs exist, when discovery runs, then empty result with helpful guidance is returned

**Test Scenarios:**
- Happy path: Project with `.mcp.json` containing 3 server definitions
- Happy path: User has both project and user-level configs
- Edge case: Config file exists but is empty
- Edge case: Config path exists but is a directory (malformed setup)

---

### US-002 [P1]: Validate MCP Config Schema

**As a** developer configuring MCP servers,
**I want** my MCP configuration validated against the expected schema,
**So that** I catch structural errors before runtime.

**Acceptance Criteria:**
- [ ] Given a valid MCP config, when schema validation runs, then no errors are reported
- [ ] Given a config missing required `command` (stdio) or `url` (http), then error with line number is reported
- [ ] Given a config with invalid field types (e.g., non-string env value), then type error is reported
- [ ] Given a config with unknown fields, then warning is reported (not error—forward compatibility)
- [ ] Given a config with both `command` and `url`, then warning about ambiguous transport is reported

**Test Scenarios:**
- Happy path: Well-formed stdio server config
- Happy path: Well-formed HTTP/remote server config
- Error case: Missing `command` field for stdio transport
- Error case: `args` is string instead of array
- Error case: `env` contains non-string values
- Warning case: Unknown field present (may be ACT-specific extension)

---

### US-003 [P1]: Validate Executable Paths

**As a** developer configuring local MCP servers,
**I want** my server executables validated for existence,
**So that** I don't encounter "command not found" errors at runtime.

**Acceptance Criteria:**
- [ ] Given an absolute path command, when validated, then existence check returns true/false with file:line reference
- [ ] Given a relative path command, when validated, then warning about potential resolution issues is reported
- [ ] Given a known executable (npx, node, python, docker), when validated, then PATH resolution is checked
- [ ] Given unexpanded shell variables (~, $HOME), when validated, then warning about non-expansion is reported
- [ ] Given Windows backslash paths, when validated, then cross-platform warning is reported

**Test Scenarios:**
- Happy path: Command is `npx` (in PATH)
- Happy path: Absolute path `/usr/local/bin/my-server`
- Warning case: Relative path `./bin/server`
- Warning case: Path contains `~` (may not expand)
- Error case: Absolute path to non-existent file
- Platform case: Windows path with backslashes

---

### US-004 [P1]: Validate Environment Variables

**As a** developer configuring MCP servers with secrets,
**I want** environment variable configuration validated,
**So that** I know if required variables are set and secrets are handled safely.

**Acceptance Criteria:**
- [ ] Given env vars defined in config, when validated, then type validation passes (all values must be strings)
- [ ] Given env var names matching secret patterns (API_KEY, SECRET, TOKEN), when validated, then security warning is reported
- [ ] Given env vars referencing external variables (`${VAR}`), when validated, then expansion support is noted per ACT

**Test Scenarios:**
- Happy path: Simple env vars with string values
- Security warning: `GITHUB_TOKEN` defined directly in config
- Security warning: `api_key` in config (case-insensitive detection)
- Info case: Config uses `${workspaceFolder}` (expansion support varies)

---

### US-005 [P2]: Validate Transport Configuration

**As a** developer configuring remote MCP servers,
**I want** transport-specific settings validated,
**So that** I catch transport configuration errors before runtime.

**Acceptance Criteria:**
- [ ] Given stdio transport, when validated, then `command` is required and `url` is not expected
- [ ] Given HTTP transport, when validated, then `url` is required and is valid URL format
- [ ] Given SSE transport type, when validated, then deprecation warning is reported
- [ ] Given Docker command without `-i` flag, when validated, then warning about stdin requirement is reported
- [ ] Given HTTP URL with authentication header, when validated, then security info is noted

**Test Scenarios:**
- Happy path: stdio with command and args
- Happy path: HTTP with valid HTTPS URL
- Warning case: SSE type (deprecated)
- Warning case: Docker command missing `-i` flag
- Error case: HTTP transport with invalid URL format

---

### US-006 [P2]: Detect Common Anti-Patterns

**As a** developer maintaining MCP configurations,
**I want** common configuration anti-patterns detected,
**So that** I can avoid known problematic patterns.

**Acceptance Criteria:**
- [ ] Given deprecated npm packages in args, when validated, then migration guidance is provided
- [ ] Given hardcoded localhost URLs, when validated, then environment-specific warning is reported
- [ ] Given duplicate server names across configs, when validated, then conflict warning is reported
- [ ] Given server with very high timeout (>5 min), when validated, then warning is reported
- [ ] Given disabled server, when validated, then info about disabled state is included

**Anti-Patterns to Detect:**
| Pattern | Severity | Guidance |
|---------|----------|----------|
| `@modelcontextprotocol/server-github` npm package | Warning | Use Docker image `ghcr.io/github/github-mcp-server` instead |
| SSE transport type | Warning | Use `streamable-http` for remote servers |
| Secrets in config values | Warning | Use environment variables or secret management |
| Docker without `-i` flag | Error | Add `-i` flag for stdin support |
| Relative paths in command | Warning | Use absolute paths for reliability |
| Shell variable expansion (`~`, `$VAR`) | Warning | Variables may not expand; use absolute paths |

---

### US-007 [P2]: Cross-ACT Compatibility

**As a** developer using multiple AI coding tools,
**I want** to understand if my MCP config works across ACTs,
**So that** I can share configs between tools when possible.

**Acceptance Criteria:**
- [ ] Given a config, when ACT compatibility is checked, then supported ACTs are listed
- [ ] Given ACT-specific fields, when validated, then portability warnings are reported
- [ ] Given different config file locations, when validated, then location precedence is explained per ACT

**Test Scenarios:**
- Happy path: Standard config compatible with Claude Code, OpenCode, VS Code
- Warning case: Config uses Cursor-specific fields
- Info case: Config location only discovered by one ACT

---

### US-008 [P3]: Aggregate Validation Report

**As a** developer maintaining multiple MCP servers,
**I want** a consolidated validation report across all discovered configs,
**So that** I can see all issues at once.

**Acceptance Criteria:**
- [ ] Given multiple config files, when validation runs, then all are validated and results aggregated
- [ ] Given validation results, when reported, then each issue includes file:line:column reference
- [ ] Given validation results, when reported, then severity levels (error, warning, info) are distinguished
- [ ] Given validation results, when reported, then per-server status is summarized

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | User Story |
|----|-------------|----------|------------|
| FR-001 | Implement `get_mcp_configs` tool to discover MCP config files across ACT locations | P1 | US-001 |
| FR-002 | Detect `.mcp.json` at project root (Claude Code standard) | P1 | US-001 |
| FR-003 | Detect `~/.claude.json` user-level MCP config (Claude Code) | P1 | US-001 |
| FR-004 | Detect OpenCode config locations (`opencode.json`, `~/.config/opencode/opencode.json`) | P1 | US-001 |
| FR-005 | Detect VS Code Copilot MCP config (`.vscode/mcp.json`) | P2 | US-001 |
| FR-006 | Implement `validate_mcp_config` tool with Zod schema validation | P1 | US-002 |
| FR-007 | Validate required fields per transport type (command for stdio, url for http) | P1 | US-002 |
| FR-008 | Validate field types (args as array, env values as strings, timeout as positive integer) | P1 | US-002 |
| FR-009 | Validate executable paths exist for stdio transport commands | P1 | US-003 |
| FR-010 | Detect relative paths and shell variables in command with warnings | P1 | US-003 |
| FR-011 | Detect known executables (npx, node, python, docker, bun, deno) and verify PATH availability | P1 | US-003 |
| FR-012 | Detect sensitive environment variable names (key, secret, token, password, credential) | P1 | US-004 |
| FR-013 | Validate HTTP/HTTPS URL format for remote transports | P2 | US-005 |
| FR-014 | Detect deprecated SSE transport and recommend streamable-http | P2 | US-005 |
| FR-015 | Detect Docker commands missing `-i` flag | P2 | US-005 |
| FR-016 | Detect deprecated npm packages and provide migration guidance | P2 | US-006 |
| FR-017 | Return structured validation results with file path, line, column, severity, message | P1 | All |
| FR-018 | Aggregate validation results across multiple config files | P2 | US-008 |
| FR-019 | Identify which ACTs would recognize each config file | P2 | US-007 |
| FR-020 | Parse JSON/JSONC with position tracking for accurate line:column references | P1 | All |
| FR-021 | Detect variable reference patterns (`${VAR}`, `${env:VAR}`, `${workspaceFolder}`) and report with ACT expansion notes | P2 | US-004 |
| FR-022 | Extract package names from npx/bunx args for agent context (e.g., `npx -y @scope/package` → `@scope/package`) | P2 | US-003 |

### 3.2 Non-Functional Requirements

| ID | Requirement | Metric | Target |
|----|-------------|--------|--------|
| NFR-001 | Config discovery performance | Time to scan project + user directories | < 2 seconds |
| NFR-002 | Validation performance | Time to validate single config | < 500ms |
| NFR-003 | Memory efficiency | Peak memory during validation | < 20MB |
| NFR-004 | Parse reliability | Success rate on valid JSON | 100% |
| NFR-005 | Error messages | Include actionable context | Always include file:line reference |

---

## 4. Key Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| `McpConfigFile` | A discovered MCP config file | path, act, scope (project/user), exists, parseError |
| `McpServerConfig` | A single server definition | name, transport, command?, url?, args?, env?, timeout?, disabled? |
| `McpValidationResult` | Validation outcome for one server | serverName, valid, errors[], warnings[], info[] |
| `McpValidationIssue` | A single validation issue | severity, code, message, file, line, column, fix? |
| `McpConfigInventory` | All discovered configs | files[], servers[], validationSummary |

### 4.1 Entity Relationships

```
McpConfigFile --1:N--> McpServerConfig
McpServerConfig --1:1--> McpValidationResult
McpValidationResult --1:N--> McpValidationIssue
McpConfigFile[] --aggregates--> McpConfigInventory
```

### 4.2 Validation Issue Codes

| Code | Severity | Description |
|------|----------|-------------|
| `MCP001` | Error | Missing required field (command or url) |
| `MCP002` | Error | Invalid field type |
| `MCP003` | Error | Executable not found |
| `MCP004` | Error | Invalid URL format |
| `MCP005` | Error | Docker missing -i flag |
| `MCP010` | Warning | Relative path in command |
| `MCP011` | Warning | Shell variable may not expand |
| `MCP012` | Warning | Deprecated transport (SSE) |
| `MCP013` | Warning | Deprecated package |
| `MCP014` | Warning | Sensitive data in config |
| `MCP015` | Warning | Ambiguous transport (both command and url) |
| `MCP016` | Info | Unknown field (may be ACT-specific extension) |
| `MCP017` | Warning | High timeout value |
| `MCP020` | Info | Server is disabled |
| `MCP021` | Info | ACT-specific config location |
| `MCP022` | Info | Cross-ACT compatibility note |
| `MCP023` | Info | Variable reference detected |
| `MCP024` | Info | Package name extracted |

---

## 5. Success Criteria

- [ ] **Functional**: All P1 user stories pass acceptance criteria
- [ ] **Quality**: Test coverage > 80% for MCP validation tools
- [ ] **Performance**: Config discovery < 2 seconds (NFR-001)
- [ ] **Accuracy**: All documented validation rules correctly implemented
- [ ] **MVP Gate**: `get_mcp_configs` and `validate_mcp_config` tools produce meaningful output
- [ ] **Integration**: Tools integrate with orchestration layer (EP02) via SDK `tool()` pattern

---

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior | Priority |
|----------|-------------------|----------|
| Config file not found at expected path | Return discovery result with exists=false | P1 |
| Malformed JSON (parse error) | Return parseError with line/column, skip validation | P1 |
| Config file is empty | Return empty servers list, not error | P1 |
| Config file is not readable (permissions) | Return error with clear message | P1 |
| Symlink to config file | Follow symlink, note in result | P2 |
| Very large config (>100 servers) | Process all, warn about size | P2 |
| Config with JSON comments (JSONC) | Attempt parse, warn if fails | P2 |
| Config path contains special characters | Handle via proper path escaping | P2 |
| Platform-specific paths (~, %APPDATA%) | Expand based on current platform | P1 |
| Config in unsupported encoding | Attempt UTF-8, return encoding error if fails | P2 |

---

## 7. Dependencies & Assumptions

### 7.1 Dependencies

| Dependency | Type | Status | Impact if Missing |
|------------|------|--------|-------------------|
| EP01 Project Foundation | Internal | Complete | Cannot start - need Zod, project structure |
| EP02 Orchestration Core | Internal | Complete | Cannot register tools with SDK |
| EP05 Config Analysis Tools | Internal | Complete | Integration point for config analysis |
| Zod | External | Available | Schema validation - core functionality |
| jsonc-parser | External | Available | JSONC support with position tracking |

### 7.2 Assumptions

- MCP config follows the standard `mcpServers` structure
- User has read access to configuration files
- Platform-specific paths resolve correctly on the running platform
- JSON is the config format (JSONC support is best-effort)
- ACT-specific config locations are as documented (may change)

---

## 8. Open Questions

- [x] **Q1**: Should we support JSONC (JSON with comments)? — **RESOLVED: Full support** using JSONC parser
- [x] **Q2**: Should path validation resolve `npx` packages? — **RESOLVED: No deep resolution**. Tool reports what's configured; agent can investigate if needed
- [x] **Q3**: How to handle env var references (`${VAR}`)? — **RESOLVED: Detect and document**. Report patterns found with ACT-specific notes
- [x] **Q4**: Should we test HTTP URL reachability? — **RESOLVED: No connection testing**. Static analysis only; agent can test URLs via WebFetch if needed
- [x] **Q5**: How to handle ACT-specific schema extensions? — **RESOLVED: Passthrough with info**. Allow unknown fields, report as info

---

## 9. References

- [Epic: EP19 MCP Config Validation](../../docs/planning/epics/EP19-mcp-config-validation.md)
- [EP05: Config Analysis Tools](../ep05-config-analysis/spec.md)
- [EP15: Session Intelligence](../../docs/planning/epics/EP15-session-intelligence.md) (MCP runtime analysis)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [OpenCode MCP Servers Documentation](https://opencode.ai/docs/mcp-servers/)
- [VS Code MCP Servers Documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [MCP Transport Protocols Comparison](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/)
- [Constitution](../../.specify/memory/constitution.md)

---

## 10. Research Summary

### 10.1 MCP Configuration Basics

MCP configurations use a standardized JSON format with `mcpServers` as the root container:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",      // Required for stdio
      "args": ["arg1", "arg2"],     // Optional
      "env": { "KEY": "value" },    // Optional
      "timeout": 60000              // Optional, ms
    }
  }
}
```

For HTTP/remote servers:
```json
{
  "mcpServers": {
    "server-name": {
      "type": "http",               // or "streamable-http"
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer token" }
    }
  }
}
```

### 10.2 Transport Types

| Transport | Description | Use Case |
|-----------|-------------|----------|
| **stdio** | Subprocess via stdin/stdout | Local servers, highest performance |
| **Streamable HTTP** | Modern HTTP standard | Remote servers, multi-client |
| **SSE** | Legacy, deprecated | Backward compatibility only |

### 10.3 ACT Config Discovery Locations

**Claude Code:**
- Project: `.mcp.json`
- User: `~/.claude.json` (NOT `~/.claude/settings.json` - known documentation bug)
- CLI: `claude mcp add`

**OpenCode:**
- Project: `opencode.json`
- User: `~/.config/opencode/opencode.json`
- Supports JSONC

**VS Code Copilot:**
- Project: `.vscode/mcp.json`
- Settings UI available

**Cursor:**
- Command Palette: "View: Open MCP Settings"
- 40 tool limit

### 10.4 Common Configuration Issues

| Issue | Frequency | Detection Method |
|-------|-----------|------------------|
| Path resolution (relative paths, ~) | High | Static path analysis |
| Missing executables | High | Filesystem check |
| Environment variable issues | Medium | Pattern matching + expansion check |
| Schema violations | Medium | Zod validation |
| Deprecated transports (SSE) | Medium | Type field check |
| Security (secrets in config) | Medium | Name pattern matching |
| Docker without -i flag | Low | Args analysis |

### 10.5 Config Hierarchy & Precedence

General precedence (highest to lowest):
```
Enterprise/Managed → CLI flags → Project → User → Defaults
```

Same server name at multiple levels: higher precedence wins completely.
Different server names: union of all servers.

---

## Appendix A: Zod Schemas

```typescript
// Core MCP config schemas for validation

const McpServerConfigSchema = z.object({
  // Stdio transport
  command: z.string().optional(),
  args: z.array(z.string()).optional(),

  // HTTP transport
  type: z.enum(['stdio', 'http', 'sse', 'streamable-http', 'remote']).optional(),
  url: z.string().url().optional(),
  headers: z.record(z.string()).optional(),

  // Common
  env: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
  disabled: z.boolean().optional(),
}).refine(
  (data) => data.command || data.url,
  { message: "Either 'command' (stdio) or 'url' (http) is required" }
);

const McpConfigSchema = z.object({
  mcpServers: z.record(McpServerConfigSchema),
});

// OpenCode-specific schema
const OpenCodeMcpConfigSchema = z.object({
  mcp: z.record(z.object({
    type: z.enum(['local', 'remote']).optional(),
    command: z.array(z.string()).optional(), // Note: array in OpenCode
    enabled: z.boolean().optional(),
    environment: z.record(z.string()).optional(),
  })),
});
```

---

## Appendix B: Validation Rules Detail

### Path Validation Rules

1. **Absolute paths**: Check file exists
2. **Known executables** (npx, node, python, docker, bun, deno): Check in PATH
3. **Relative paths**: Warn about resolution uncertainty
4. **Shell variables** (~, $HOME, ${VAR}): Warn about expansion
5. **Windows paths**: Info about cross-platform compatibility

### Security Pattern Detection

Regex patterns for sensitive env var names:
```typescript
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key$/i,          // API_KEY, but not KEYBOARD
  /token/i,
  /credential/i,
  /auth/i,
  /private/i,
];
```

### Deprecated Package Detection

```typescript
const DEPRECATED_PACKAGES = {
  '@modelcontextprotocol/server-github': {
    replacement: 'ghcr.io/github/github-mcp-server',
    reason: 'NPM package deprecated after April 2025',
  },
};
```

---

## Clarifications

> This section is populated by /dev.clarify

### Session 2026-01-25

#### Design Philosophy: Data for Agent Reasoning

**Critical clarification**: agentlint is an agentic system. The MCP validation tools should provide **rich context and data** that enables the agent to reason about whether issues actually exist—not make judgments themselves.

The agent has access to additional tools (Read, WebFetch, Bash, etc.) and can:
- Read files to check if paths exist
- Test URLs via WebFetch to verify connectivity
- Use WebSearch to research package deprecation status
- Run commands to verify PATH availability

**Tool responsibility**: Provide structured data with full context (file paths, line numbers, detected patterns, ACT-specific notes).

**Agent responsibility**: Reason about whether the data indicates an actual problem, investigate further if needed, and recommend fixes.

This aligns with Constitution Principle VII: Tools provide data and capabilities; the agent provides judgment.

#### Q1: JSONC Support

**Question**: Should we support JSONC (JSON with comments)?

**Answer**: Full support

**Rationale**: OpenCode explicitly supports JSONC. Use a JSONC parser dependency to fully support comments in all config files. This ensures we can parse configs that users have documented with comments.

**Updated**: Added external dependency for JSONC parser (e.g., `jsonc-parser` or `comment-json`).

#### Q2: npx Package Resolution

**Question**: Should path validation attempt to resolve `npx` packages?

**Answer**: No deep resolution

**Rationale**:
- Tool should verify `npx` is in PATH (fast, local check)
- Tool should extract and report the package name from args (e.g., `@modelcontextprotocol/server-github`)
- Tool should NOT query npm registry or local cache
- If the agent wants to verify package existence, it can use WebFetch to check npmjs.com or run `npm view`

**Updated**: FR-011 clarified to check PATH availability only. Package name extraction added for agent context.

#### Q3: Environment Variable References

**Question**: How to handle `${VAR}` or `${workspaceFolder}` references?

**Answer**: Detect and document

**Rationale**:
- Tool should detect variable reference patterns using regex
- Tool should report as info with ACT-specific expansion support notes
- Tool should NOT attempt expansion (behavior varies by ACT)
- Agent can check if referenced env vars are set via Bash if needed

**Updated**: FR-012 scope clarified. Added pattern detection for variable references.

#### Q4: HTTP URL Connection Testing

**Question**: Should we validate that HTTP URLs are actually reachable?

**Answer**: No connection testing (static analysis only)

**Rationale**:
- This epic focuses on static analysis per scope definition
- Connection testing crosses into runtime checking (EP15 territory)
- Agent can test URL reachability via WebFetch if the config data suggests investigation is warranted
- Tool should validate URL format (syntax) but not connectivity

**Updated**: Out of Scope section already covers this. No changes needed.

#### Q5: ACT-Specific Schema Extensions

**Question**: How to handle unknown fields in config schema?

**Answer**: Passthrough with info

**Rationale**:
- Different ACTs may add custom fields (e.g., Cursor's tool limits, Cline's `alwaysAllow`)
- Tool should allow unknown fields to maintain forward compatibility
- Tool should report unknown fields as info-level notes
- Agent can reason about whether unknown fields indicate ACT-specific config or potential typos

**Updated**: MCP016 warning changed to info. Schema validation uses `.passthrough()` in Zod.

### Requirements Updates

Based on clarifications, the following changes apply:

| Change | Section | Detail |
|--------|---------|--------|
| Add JSONC parser dependency | 7.1 Dependencies | `jsonc-parser` or `comment-json` |
| MCP016 severity change | 4.2 Issue Codes | Warning → Info |
| Package name extraction | FR-011 | Extract package name from npx args for agent context |
| Variable pattern detection | New FR-021 | Detect `${VAR}`, `${env:VAR}`, `${workspaceFolder}` patterns |
