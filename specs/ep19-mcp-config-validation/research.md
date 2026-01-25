# Research Findings: MCP Config Validation

> **Epic**: EP19
> **Created**: 2026-01-25

---

## Decision Log

### D1: JSON Parser Selection

**Decision**: Use `jsonc-parser` for JSONC parsing with position tracking

**Rationale**:
- Single package provides both JSONC support and AST with positions
- Used by VS Code for settings.json parsing (battle-tested)
- Provides `parseTree()` for position-aware parsing
- MIT licensed, actively maintained

**Alternatives Considered**:
- `comment-json`: Good JSONC support but weaker position tracking
- `json5` + `json-source-map`: Two packages needed
- Standard `JSON.parse`: No JSONC support, no positions

**References**:
- [jsonc-parser npm](https://www.npmjs.com/package/jsonc-parser)
- [VS Code JSON language service](https://github.com/microsoft/vscode-json-languageservice)

### D2: ACT Discovery Strategy

**Decision**: Check known locations for each ACT with priority ordering

**Rationale**:
- Each ACT has documented config locations
- Priority: Claude Code (P1), OpenCode (P1), VS Code (P2)
- User-level and project-level configs both supported
- Extensible to future ACTs

**Known Locations**:

| ACT | Project | User |
|-----|---------|------|
| Claude Code | `.mcp.json` | `~/.claude.json` |
| OpenCode | `opencode.json` | `~/.config/opencode/opencode.json` |
| VS Code Copilot | `.vscode/mcp.json` | (settings.json) |
| Cursor | `mcp.json` | (via Command Palette) |
| Windsurf | - | `~/.codeium/windsurf/mcp_config.json` |
| Amazon Q | `.amazonq/mcp.json` | `~/.aws/amazonq/mcp.json` |

### D3: Schema Validation Approach

**Decision**: Use Zod with `.passthrough()` for forward compatibility

**Rationale**:
- Zod provides type-safe validation
- `.passthrough()` allows unknown fields (ACT extensions)
- Report unknown fields as info, not errors
- Agent can reason about whether unknown fields are problematic

**Implementation**:
```typescript
const McpServerConfigSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  // ... standard fields
}).passthrough();  // Allow unknown fields
```

### D4: Path Validation Depth

**Decision**: Check PATH for known executables, report data for others

**Rationale**:
- Fast: Only local checks (no network)
- Known executables: npx, node, python, docker, bun, deno
- For these, check if they exist in PATH
- For absolute paths, check file existence
- For relative paths and shell vars, report as context
- Agent can investigate further with Bash if needed

**Not Doing**:
- npm registry lookups (slow, needs network)
- Package resolution (npx -y packages)
- Symlink following beyond basic existence

### D5: Sensitive Data Detection

**Decision**: Pattern-based detection with case-insensitive matching

**Rationale**:
- Common patterns cover most secrets
- False positives acceptable (agent reasons about context)
- No value inspection (just name patterns)
- User may intentionally have dev-only values

**Patterns**:
```typescript
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key$/i,        // API_KEY, not KEYBOARD
  /token/i,
  /credential/i,
  /auth/i,
  /private/i,
];
```

### D6: OpenCode Format Differences

**Decision**: Support OpenCode's `mcp` key and array commands

**Rationale**:
- OpenCode uses `mcp` instead of `mcpServers`
- OpenCode uses `command: ["npx", "-y", "..."]` (array)
- OpenCode uses `environment` instead of `env`
- OpenCode uses `enabled` instead of `disabled`

**Schema Normalization**:
```typescript
// OpenCode format
{
  "mcp": {
    "server": {
      "type": "local",
      "command": ["npx", "-y", "@scope/pkg"],
      "enabled": true,
      "environment": { "KEY": "value" }
    }
  }
}

// Normalized internally to standard format for validation
{
  command: "npx",
  args: ["-y", "@scope/pkg"],
  env: { "KEY": "value" },
  disabled: false
}
```

---

## MCP Configuration Research

### Transport Types

| Transport | Status | Use Case |
|-----------|--------|----------|
| stdio | Standard | Local servers, subprocess |
| streamable-http | Recommended | Remote servers, modern |
| http | Standard | Remote servers |
| sse | **Deprecated** | Legacy only |
| remote | Variant | Some ACTs |

**Key Finding**: SSE transport is deprecated as of MCP spec updates. Tools should warn when `type: "sse"` is found and suggest `streamable-http`.

### Common Configuration Issues

From research of GitHub issues and community discussions:

| Issue | Frequency | Detection |
|-------|-----------|-----------|
| Relative paths | High | Path analysis |
| Shell var expansion (~) | High | Pattern matching |
| Missing executables | High | PATH/existence check |
| Wrong env var type | Medium | Type validation |
| SSE deprecated | Medium | Type field check |
| Docker without -i | Low | Args inspection |
| Secrets in config | Medium | Name pattern match |

### Deprecated Packages

| Package | Deprecated | Replacement |
|---------|------------|-------------|
| `@modelcontextprotocol/server-github` | April 2025 | Docker: `ghcr.io/github/github-mcp-server` |

### Known Documentation Bugs

**Claude Code**: Documentation incorrectly states `~/.claude/settings.json` for user MCP config. The correct location is `~/.claude.json`. This was confirmed in [GitHub Issue #4976](https://github.com/anthropics/claude-code/issues/4976).

---

## Implementation Notes

### Position Tracking with jsonc-parser

```typescript
import { parseTree, Node } from 'jsonc-parser';

const tree = parseTree(content);
// tree has offset, length for each node
// Convert offset to line:column using source string

function offsetToPosition(content: string, offset: number): Point {
  let line = 1;
  let column = 1;
  for (let i = 0; i < offset; i++) {
    if (content[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column, offset };
}
```

### Package Name Extraction

For npx commands, extract the package name from args:

```typescript
function extractPackageName(command: string, args: string[]): string | undefined {
  if (command !== 'npx' && command !== 'bunx') return undefined;

  // Skip flags like -y, --yes, -p, etc.
  const packageArg = args.find(arg =>
    !arg.startsWith('-') && arg !== 'npx' && arg !== 'bunx'
  );

  return packageArg;
}

// Example: ["npx", "-y", "@modelcontextprotocol/server-github"]
// Returns: "@modelcontextprotocol/server-github"
```

### Variable Reference Detection

```typescript
const VARIABLE_PATTERNS = [
  /\$\{([^}]+)\}/g,           // ${VAR}, ${env:VAR}
  /\$([A-Z_][A-Z0-9_]*)/g,    // $VAR
  /~(?=\/|$)/g,               // ~ home directory
];

function detectVariableRefs(value: string): VariableRef[] {
  const refs: VariableRef[] = [];

  for (const pattern of VARIABLE_PATTERNS) {
    let match;
    while ((match = pattern.exec(value)) !== null) {
      refs.push({
        pattern: match[0],
        varName: match[1] || match[0],
        // position filled by caller
      });
    }
  }

  return refs;
}
```

---

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [OpenCode MCP Servers](https://opencode.ai/docs/mcp-servers/)
- [VS Code MCP Servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [MCP Transport Comparison](https://mcpcat.io/guides/comparing-stdio-sse-streamablehttp/)
- [jsonc-parser](https://www.npmjs.com/package/jsonc-parser)
