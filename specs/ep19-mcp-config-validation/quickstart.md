# Quickstart: MCP Config Validation

> **Epic**: EP19
> **Status**: Design Complete

---

## Overview

The MCP Config Validation tools help you discover and validate Model Context Protocol (MCP) server configurations across multiple AI Coding Tools (ACTs).

**Supported ACTs** (P1):
- Claude Code (`.mcp.json`, `~/.claude.json`)
- OpenCode (`opencode.json`, `~/.config/opencode/opencode.json`)
- VS Code Copilot (`.vscode/mcp.json`)

---

## Tools

### get_mcp_configs

Discovers MCP configuration files in the project and user directories.

**Input:**
```typescript
{
  cwd: "/path/to/project",      // Required: project directory
  includeUser: true,            // Optional: include user-level configs
  acts: ["claude-code"]         // Optional: filter to specific ACTs
}
```

**Output:**
```typescript
{
  files: [
    {
      path: "/path/to/project/.mcp.json",
      relativePath: ".mcp.json",
      act: "claude-code",
      scope: "project",
      exists: true,
      format: "standard"
    },
    {
      path: "/Users/me/.claude.json",
      relativePath: "~/.claude.json",
      act: "claude-code",
      scope: "user",
      exists: true,
      format: "standard"
    }
  ],
  summary: {
    totalFiles: 2,
    existingFiles: 2,
    byAct: { "claude-code": 2 },
    byScope: { "project": 1, "user": 1 }
  },
  guidance: []
}
```

### validate_mcp_config

Validates an MCP configuration file and returns structured findings.

**Input:**
```typescript
{
  filePath: "/path/to/project/.mcp.json",  // Required: absolute path
  act: "claude-code"                        // Optional: override ACT
}
```

**Output:**
```typescript
{
  file: { /* McpConfigFile */ },
  servers: [
    {
      serverName: "my-server",
      configFile: "/path/to/project/.mcp.json",
      issues: [
        {
          code: "MCP010",
          severity: "warning",
          message: "Relative path './bin/server' may not resolve correctly",
          file: "/path/to/project/.mcp.json",
          line: 4,
          column: 15,
          serverName: "my-server",
          field: "command",
          value: "./bin/server"
        }
      ],
      context: {
        transport: "stdio",
        commandType: "relative",
        pathInfo: {
          original: "./bin/server",
          isAbsolute: false,
          isRelative: true,
          hasShellVar: false,
          shellVars: [],
          exists: null,
          inPath: null,
          windowsBackslash: false
        },
        envVars: [],
        variableRefs: [],
        unknownFields: [],
        isDisabled: false
      }
    }
  ],
  issues: [ /* all issues flattened */ ],
  summary: {
    serverCount: 1,
    errorCount: 0,
    warningCount: 1,
    infoCount: 0
  }
}
```

---

## Common Validation Issues

### Errors (require attention)

| Code | Description | Example |
|------|-------------|---------|
| MCP001 | Missing required field | No `command` or `url` |
| MCP002 | Invalid field type | `args: "single-string"` instead of array |
| MCP003 | Executable not found | Absolute path doesn't exist |
| MCP004 | Invalid URL format | `url: "not-a-url"` |
| MCP005 | Docker missing -i flag | `command: "docker"` without `-i` in args |

### Warnings (potential issues)

| Code | Description | Example |
|------|-------------|---------|
| MCP010 | Relative path | `command: "./bin/server"` |
| MCP011 | Shell variable | `command: "~/bin/server"` |
| MCP012 | Deprecated transport | `type: "sse"` |
| MCP013 | Deprecated package | `@modelcontextprotocol/server-github` |
| MCP014 | Sensitive data | `env: { "API_KEY": "sk-..." }` |

### Info (context for agent)

| Code | Description | Example |
|------|-------------|---------|
| MCP016 | Unknown field | ACT-specific extension |
| MCP020 | Server disabled | `disabled: true` |
| MCP023 | Variable reference | `${workspaceFolder}` detected |
| MCP024 | Package extracted | `npx -y @scope/package` |

---

## Agent Workflow

The validation tools provide **data for agent reasoning**. The agent can:

1. **Discover configs** with `get_mcp_configs`
2. **Validate each config** with `validate_mcp_config`
3. **Investigate issues** using other tools:
   - `Read` to examine config files
   - `Bash` to check if executables are in PATH
   - `Bash` to verify environment variables are set
   - `WebFetch` to check if npm packages exist
4. **Reason about severity** based on context
5. **Recommend fixes** to the user

Example agent reasoning:
```
Tool returned MCP003 (executable not found) for /usr/local/bin/my-server.
Let me verify this with Bash: ls -la /usr/local/bin/my-server
Result: File not found.
Recommendation: The executable at /usr/local/bin/my-server does not exist.
Either install it or update the command path in .mcp.json line 4.
```

---

## Configuration Examples

### Valid stdio server

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

### Valid HTTP server

```json
{
  "mcpServers": {
    "remote-api": {
      "type": "streamable-http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:API_TOKEN}"
      }
    }
  }
}
```

### OpenCode format

```json
{
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "enabled": true,
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Discovery Locations

### Claude Code

| Scope | Location |
|-------|----------|
| Project | `.mcp.json` |
| User | `~/.claude.json` |

### OpenCode

| Scope | Location |
|-------|----------|
| Project | `opencode.json` |
| User | `~/.config/opencode/opencode.json` |

### VS Code Copilot

| Scope | Location |
|-------|----------|
| Project | `.vscode/mcp.json` |
