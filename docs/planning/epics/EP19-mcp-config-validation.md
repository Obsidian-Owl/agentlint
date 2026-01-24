# EP19: MCP Config Validation

## Business Outcome Hypothesis

**If** we provide static analysis tools for MCP configuration validation,
**Then** users can ensure their MCP servers are correctly configured before runtime issues occur,
**Measured by** configuration issue detection accuracy and user resolution of config problems.

## Classification

* **Type**: Business
* **Priority**: P2-Medium
* **Size**: S
* **Dependencies**: EP05 (Config Analysis Tools)
* **Related**: EP15 (Session Intelligence) handles MCP runtime quality signals

## Scope Clarification

This epic focuses on **static analysis** of MCP configuration files. It answers:
- Is the MCP config syntactically valid?
- Are the configured servers accessible?
- Are there missing or misconfigured settings?

**Runtime MCP analysis** (Is the MCP server being used well? What are the error patterns?) is handled by EP15: Session Intelligence.

## In Scope

### Static Config Analysis
* MCP configuration file discovery (`.mcp.json`, settings locations)
* JSON schema validation for MCP config format
* Server inventory extraction (configured server list)
* Required field validation (command, args, env)
* Path validation (do referenced executables exist?)
* Environment variable validation (are required env vars set?)

### Configuration Comparison
* Compare configured servers with EP15's usage data
* Identify unused servers (configured but never called)
* Agent reasons about whether unused servers indicate issues

## Out of Scope

* MCP runtime monitoring (EP15)
* MCP error pattern analysis (EP15)
* MCP server installation/setup
* MCP server creation or modification
* Connection testing (beyond basic validation)

## Key Deliverables

### Phase 1: Config Discovery & Parsing

1. **MCP Config Discovery**
   - Find `.mcp.json` in project root
   - Find MCP settings in Claude Code settings
   - Handle multiple config sources with precedence

2. **Config Parser**
   - Parse MCP configuration JSON
   - Extract server definitions
   - Handle both simple and complex server configs

3. **Schema Validation**
   - Validate against MCP config schema
   - Report missing required fields
   - Report invalid field types

### Phase 2: Deep Validation

1. **Path Validator**
   - Check if `command` executables exist
   - Validate relative vs. absolute paths
   - Report missing executables

2. **Environment Validator**
   - Check if required environment variables are set
   - Validate environment variable references in config
   - Report missing or empty required vars

3. **Server Inventory Tool**
   - `getMcpConfigTool` - Get parsed MCP server inventory
   - Returns structured data for agent consumption
   - Includes validation status per server

### Phase 3: Integration

1. **CLI Integration**
   - Add MCP config validation to `agentlint analyse`
   - Add `--mcp-config` flag for focused validation
   - Agent presents findings with fix recommendations

2. **Usage Comparison Integration**
   - Query EP15's MCP usage data
   - Compare configured vs. used servers
   - Agent reasons about unused/misconfigured servers

## Technical Approach

### MCP Config Structure

```typescript
interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

interface McpServerValidation {
  serverName: string;
  config: McpServerConfig;
  validation: {
    schemaValid: boolean;
    commandExists: boolean;
    envVarsSet: boolean;
    errors: string[];
    warnings: string[];
  };
}
```

### Config Discovery

```typescript
const MCP_CONFIG_PATHS = [
  '.mcp.json',  // Project root
  '.claude/mcp.json',  // Claude-specific
  // Claude Code settings location varies by platform
];

async function discoverMcpConfig(projectPath: string): Promise<McpConfig | null> {
  for (const configPath of MCP_CONFIG_PATHS) {
    const fullPath = path.join(projectPath, configPath);
    if (await fileExists(fullPath)) {
      return parseMcpConfig(await readFile(fullPath));
    }
  }
  return null;
}
```

### Validation Logic

```typescript
async function validateMcpServer(
  serverName: string,
  config: McpServerConfig
): Promise<McpServerValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Schema validation
  const schemaValid = validateSchema(config);
  if (!schemaValid) {
    errors.push('Config does not match MCP schema');
  }

  // Command validation
  const commandExists = await executableExists(config.command);
  if (!commandExists) {
    errors.push(`Command not found: ${config.command}`);
  }

  // Environment validation
  const envVarsSet = validateEnvVars(config.env || {});
  if (!envVarsSet.valid) {
    errors.push(`Missing env vars: ${envVarsSet.missing.join(', ')}`);
  }

  // Disabled warning
  if (config.disabled) {
    warnings.push('Server is disabled in config');
  }

  return {
    serverName,
    config,
    validation: {
      schemaValid,
      commandExists,
      envVarsSet: envVarsSet.valid,
      errors,
      warnings,
    },
  };
}
```

## Success Criteria

- [ ] MCP config discovery works across supported locations
- [ ] Schema validation catches malformed configs
- [ ] Path validation identifies missing executables
- [ ] Environment validation catches missing required vars
- [ ] Server inventory tool returns structured validation data
- [ ] Agent can provide fix recommendations for config issues

## Constitution Alignment

| Principle | Alignment |
|-----------|-----------|
| III. Causal-First | Config issues traced to specific fields/values |
| V. Language-Agnostic | MCP config format is language-independent |
| VII. Intelligent Tooling | Tool validates; agent reasons about fixes |

## Related Documents

- [EP15: Session Intelligence](./EP15-session-intelligence.md) (MCP runtime analysis)
- [EP05: Config Analysis Tools](./EP05-config-analysis.md)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
