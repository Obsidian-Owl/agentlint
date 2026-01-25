# Data Model: MCP Config Validation

> **Epic**: EP19
> **Created**: 2026-01-25
> **Status**: Design Complete

---

## Entities

### McpConfigFile

A discovered MCP configuration file.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | Absolute path to the file |
| relativePath | string | Yes | Path relative to project root |
| act | McpAct | Yes | Which ACT uses this config location |
| scope | McpScope | Yes | project, user, or enterprise |
| exists | boolean | Yes | Whether the file actually exists |
| parseError | ParseError? | No | Parse error if JSON/JSONC invalid |
| format | McpFormat | Yes | Standard mcpServers or ACT-specific |

**Relationships**:
- `McpConfigFile` --1:N--> `McpServerConfig`

### McpServerConfig

A single MCP server definition extracted from a config file.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Server name (key in mcpServers object) |
| source | McpConfigFile | Yes | Parent config file reference |
| position | Position | Yes | Location in source file (line:column) |
| transport | McpTransport | Yes | Inferred transport type |
| command | string? | No | Command for stdio transport |
| args | string[]? | No | Arguments for command |
| url | string? | No | URL for HTTP transport |
| headers | Record<string, string>? | No | HTTP headers |
| env | Record<string, string>? | No | Environment variables |
| timeout | number? | No | Timeout in milliseconds |
| disabled | boolean? | No | Whether server is disabled |
| rawConfig | Record<string, unknown> | Yes | Original config object |
| unknownFields | string[] | Yes | Fields not in standard schema |

### McpValidationIssue

A single validation finding with full context.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| code | McpIssueCode | Yes | Structured issue code (MCP001-MCP022) |
| severity | IssueSeverity | Yes | error, warning, or info |
| message | string | Yes | Human-readable description |
| file | string | Yes | Absolute file path |
| line | number | Yes | Line number (1-indexed) |
| column | number | Yes | Column number (1-indexed) |
| serverName | string? | No | Related server name |
| field | string? | No | Related field name |
| value | string? | No | The problematic value |
| context | Record<string, unknown>? | No | Additional context for agent |
| fix | string? | No | Suggested fix (if deterministic) |

### McpValidationResult

Validation outcome for a single server.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| serverName | string | Yes | Server being validated |
| configFile | string | Yes | Source config file path |
| issues | McpValidationIssue[] | Yes | All issues for this server |
| context | McpServerContext | Yes | Extracted context for agent reasoning |

### McpServerContext

Rich context extracted for agent reasoning.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| transport | McpTransport | Yes | Detected transport type |
| commandType | CommandType? | No | npx, node, docker, absolute, relative, etc. |
| packageName | string? | No | Extracted npm package name (for npx) |
| pathInfo | PathInfo? | No | Path analysis results |
| envVars | EnvVarInfo[] | Yes | Environment variable details |
| variableRefs | VariableRef[] | Yes | Detected ${VAR} patterns |
| unknownFields | string[] | Yes | Non-standard fields |
| isDisabled | boolean | Yes | Whether server is disabled |

### McpConfigInventory

Aggregated view of all MCP configs.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| files | McpConfigFile[] | Yes | All discovered config files |
| servers | McpServerConfig[] | Yes | All server definitions |
| issues | McpValidationIssue[] | Yes | All validation issues |
| summary | InventorySummary | Yes | Aggregate statistics |

---

## Enumerations

### McpAct

AI Coding Tool that uses this config.

```typescript
type McpAct =
  | 'claude-code'    // .mcp.json, ~/.claude.json
  | 'opencode'       // opencode.json, ~/.config/opencode/opencode.json
  | 'vscode-copilot' // .vscode/mcp.json
  | 'cursor'         // mcp.json via command palette
  | 'windsurf'       // ~/.codeium/windsurf/mcp_config.json
  | 'zed'            // settings.json context_servers
  | 'cline'          // cline_mcp_settings.json
  | 'amazon-q'       // ~/.aws/amazonq/mcp.json
  | 'unknown';
```

### McpScope

Configuration scope level.

```typescript
type McpScope =
  | 'project'    // In project directory
  | 'user'       // In user home (~/.claude.json, etc.)
  | 'enterprise' // Managed/system level
  | 'unknown';
```

### McpFormat

Configuration format variant.

```typescript
type McpFormat =
  | 'standard'       // { mcpServers: { ... } }
  | 'opencode'       // { mcp: { ... } } with array command
  | 'vscode-copilot' // .vscode/mcp.json format
  | 'unknown';
```

### McpTransport

Transport protocol type.

```typescript
type McpTransport =
  | 'stdio'           // Local subprocess via stdin/stdout
  | 'http'            // HTTP transport
  | 'streamable-http' // Modern HTTP standard
  | 'sse'             // Legacy Server-Sent Events (deprecated)
  | 'remote'          // Generic remote
  | 'unknown';
```

### CommandType

Classification of command field.

```typescript
type CommandType =
  | 'npx'       // npx package runner
  | 'bunx'      // bun package runner
  | 'node'      // Direct node execution
  | 'python'    // Python execution
  | 'docker'    // Docker container
  | 'absolute'  // Absolute path
  | 'relative'  // Relative path (./bin, etc.)
  | 'shell'     // Shell command
  | 'unknown';
```

### McpIssueCode

Structured issue codes (from Spec §4.2).

```typescript
type McpIssueCode =
  // Errors (MCP001-MCP009)
  | 'MCP001' // Missing required field (command or url)
  | 'MCP002' // Invalid field type
  | 'MCP003' // Executable not found
  | 'MCP004' // Invalid URL format
  | 'MCP005' // Docker missing -i flag
  // Warnings (MCP010-MCP019)
  | 'MCP010' // Relative path in command
  | 'MCP011' // Shell variable may not expand
  | 'MCP012' // Deprecated transport (SSE)
  | 'MCP013' // Deprecated package
  | 'MCP014' // Sensitive data in config
  | 'MCP015' // Ambiguous transport (both command and url)
  | 'MCP016' // Unknown field (may be ACT-specific)
  | 'MCP017' // High timeout value
  // Info (MCP020-MCP029)
  | 'MCP020' // Server is disabled
  | 'MCP021' // ACT-specific config location
  | 'MCP022' // Cross-ACT compatibility note
  | 'MCP023' // Variable reference detected
  | 'MCP024'; // Package name extracted
```

### IssueSeverity

```typescript
type IssueSeverity = 'error' | 'warning' | 'info';
```

---

## Supporting Types

### Position

Location in source file (compatible with mdast).

```typescript
interface Position {
  start: Point;
  end: Point;
}

interface Point {
  line: number;   // 1-indexed
  column: number; // 1-indexed
  offset?: number; // Character offset from file start
}
```

### ParseError

JSON/JSONC parse error.

```typescript
interface ParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
}
```

### PathInfo

Path analysis for command field.

```typescript
interface PathInfo {
  original: string;           // Original command value
  isAbsolute: boolean;        // Is absolute path
  isRelative: boolean;        // Is relative path (starts with ./)
  hasShellVar: boolean;       // Contains ~ or $VAR
  shellVars: string[];        // Detected shell variables
  exists: boolean | null;     // null if can't check (not absolute)
  inPath: boolean | null;     // null if not a known executable
  windowsBackslash: boolean;  // Contains Windows backslashes
}
```

### EnvVarInfo

Environment variable analysis.

```typescript
interface EnvVarInfo {
  name: string;
  value: string;
  isSensitive: boolean;     // Matches secret patterns
  hasVariableRef: boolean;  // Value contains ${...}
  position: Position;
}
```

### VariableRef

Detected variable reference pattern.

```typescript
interface VariableRef {
  pattern: string;          // Full pattern: ${VAR}, ${env:VAR}, etc.
  varName: string;          // Extracted variable name
  location: 'command' | 'args' | 'env' | 'url';
  position: Position;
  actSupport: string[];     // Which ACTs support this pattern
}
```

### InventorySummary

Aggregate statistics for inventory.

```typescript
interface InventorySummary {
  totalFiles: number;
  totalServers: number;
  totalIssues: number;
  issuesByCode: Record<McpIssueCode, number>;
  issuesBySeverity: Record<IssueSeverity, number>;
  serversByAct: Record<McpAct, number>;
  serversByTransport: Record<McpTransport, number>;
}
```

---

## Entity Relationships

```
McpConfigFile --1:N--> McpServerConfig
    │
    └──1:1--> ParseError (optional)

McpServerConfig --1:1--> McpValidationResult
    │
    └──1:1--> McpServerContext

McpValidationResult --1:N--> McpValidationIssue

McpConfigFile[] --aggregates--> McpConfigInventory
```

---

## Validation Rules

### Schema Validation (MCP001, MCP002)

```typescript
// Required fields by transport
if (!config.command && !config.url) {
  issue(MCP001, "Either 'command' or 'url' is required");
}

// Type validation
if (config.args && !Array.isArray(config.args)) {
  issue(MCP002, "'args' must be an array");
}
if (config.env && typeof config.env !== 'object') {
  issue(MCP002, "'env' must be an object");
}
for (const [key, value] of Object.entries(config.env || {})) {
  if (typeof value !== 'string') {
    issue(MCP002, `'env.${key}' must be a string`);
  }
}
if (config.timeout !== undefined) {
  if (!Number.isInteger(config.timeout) || config.timeout <= 0) {
    issue(MCP002, "'timeout' must be a positive integer");
  }
}
```

### Path Validation (MCP003, MCP010, MCP011)

```typescript
// Absolute path existence
if (path.isAbsolute(command)) {
  const exists = fs.existsSync(command);
  context.pathInfo = { ...context.pathInfo, exists };
  if (!exists) {
    issue(MCP003, `Executable not found: ${command}`);
  }
}

// Relative path warning
if (command.startsWith('./') || command.startsWith('../')) {
  issue(MCP010, `Relative path '${command}' may not resolve correctly`);
}

// Shell variable detection
const shellVarPattern = /[~$]/;
if (shellVarPattern.test(command)) {
  const vars = extractShellVars(command);
  issue(MCP011, `Shell variables may not expand: ${vars.join(', ')}`);
}
```

### Sensitive Data Detection (MCP014)

```typescript
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key$/i,          // API_KEY, not KEYBOARD
  /token/i,
  /credential/i,
  /auth/i,
  /private/i,
];

for (const [name, value] of Object.entries(config.env || {})) {
  if (SENSITIVE_PATTERNS.some(p => p.test(name))) {
    issue(MCP014, `Sensitive env var '${name}' in config`, {
      field: `env.${name}`,
      context: { pattern: 'name matches sensitive pattern' }
    });
  }
}
```

### Transport Validation (MCP005, MCP012, MCP015)

```typescript
// SSE deprecation
if (config.type === 'sse') {
  issue(MCP012, "SSE transport is deprecated; use 'streamable-http'");
}

// Docker without -i
if (command === 'docker' && !args?.includes('-i')) {
  issue(MCP005, "Docker MCP servers require '-i' flag for stdin");
}

// Ambiguous transport
if (config.command && config.url) {
  issue(MCP015, "Config has both 'command' and 'url'");
}
```

---

## ACT-Specific Schemas

### Standard (Claude Code, VS Code)

```typescript
const StandardMcpConfigSchema = z.object({
  mcpServers: z.record(z.object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    type: z.enum(['stdio', 'http', 'sse', 'streamable-http', 'remote']).optional(),
    url: z.string().url().optional(),
    headers: z.record(z.string()).optional(),
    env: z.record(z.string()).optional(),
    timeout: z.number().int().positive().optional(),
    disabled: z.boolean().optional(),
  }).passthrough())  // Allow unknown fields
});
```

### OpenCode

```typescript
const OpenCodeMcpConfigSchema = z.object({
  mcp: z.record(z.object({
    type: z.enum(['local', 'remote']).optional(),
    command: z.array(z.string()).optional(),  // Note: array, not string
    enabled: z.boolean().optional(),
    environment: z.record(z.string()).optional(),  // Note: 'environment', not 'env'
  }).passthrough())
});
```

---

## Tool Input/Output Types

### GetMcpConfigsInput

```typescript
interface GetMcpConfigsInput {
  cwd: string;              // Project directory
  includeUser?: boolean;    // Include user-level configs (default: true)
  acts?: McpAct[];          // Filter to specific ACTs (default: all)
}
```

### GetMcpConfigsResult

```typescript
interface GetMcpConfigsResult {
  files: McpConfigFile[];
  summary: {
    totalFiles: number;
    existingFiles: number;
    byAct: Record<McpAct, number>;
    byScope: Record<McpScope, number>;
  };
  guidance: string[];       // Helpful context if no/few configs found
}
```

### ValidateMcpConfigInput

```typescript
interface ValidateMcpConfigInput {
  filePath: string;         // Absolute path to config file
  act?: McpAct;             // Override ACT detection
}
```

### ValidateMcpConfigResult

```typescript
interface ValidateMcpConfigResult {
  file: McpConfigFile;
  servers: McpValidationResult[];
  issues: McpValidationIssue[];
  summary: {
    serverCount: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}
```
