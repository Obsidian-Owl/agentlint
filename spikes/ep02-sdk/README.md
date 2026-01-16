# EP02 SDK Spike

Validation of Claude Agent SDK patterns before committing to full EP02 implementation.

## Purpose

This spike validates:
1. **T001**: SDK spike setup (this file)
2. **T002**: `query()` function with streaming output
3. **T003**: `tool()` + `createSdkMcpServer()` pattern
4. **T004**: Hook system (`PostToolUse`, `SessionEnd`, `PreCompact`)

## Running the Spike

```bash
# Ensure ANTHROPIC_API_KEY is set
export ANTHROPIC_API_KEY=your-key-here

# Run the validation script
bun run spikes/ep02-sdk/validate-sdk.ts
```

## Files

- `validate-sdk.ts` - Main validation script
- `types.ts` - Type imports validation
- `README.md` - This file

## Expected Outcomes

Each validation should:
- Compile without errors
- Execute successfully (where API key available)
- Demonstrate the pattern works as documented

## Validation Results

### T002: query() with Streaming

**Status**: ✅ VALIDATED

Key findings:
- `query()` function imports and compiles correctly
- Options structure validated:
  - `model`: String (e.g., 'claude-sonnet-4-20250514')
  - `maxTurns`: Number to limit agent loops
  - `settingSources`: **CRITICAL** - Must include `'project'` to load CLAUDE.md
  - `includePartialMessages`: Enables streaming output

**Important**: Without `settingSources: ['project']`, the SDK will NOT load CLAUDE.md files. This was identified in analysis-report.md as E-001 and is now validated.

### T003: tool() + createSdkMcpServer()

**Status**: ✅ VALIDATED

Key findings:
- `tool()` accepts: name, description, schema (zod), handler (async function)
- `tool()` returns SDK-internal object structure (not direct property access)
- Handlers are managed internally by `createSdkMcpServer()`
- `createSdkMcpServer(serverName, toolsArray)` returns `McpSdkServerConfigWithInstance`
- Server has `type: 'sdk'` and `instance` property

**EP02 Implementation Note**: The ToolRegistry should:
1. Store tools in array (SDK objects)
2. Maintain separate name→index map for lookup
3. Pass tool array directly to `createSdkMcpServer()`

See `validate-tools.ts` for comprehensive validation.

### T004: Hook System

**Status**: ✅ VALIDATED

Key findings:
- `PostToolUse` hook fires after each tool invocation, returns `{ continue: boolean }`
- `SessionEnd` hook fires on session completion, returns `void` (informational)
- `PreCompact` hook fires before context compression (~92% threshold), returns `{ continue: boolean }`
- Hook objects can be passed directly to `query()` options
- Hooks integrate with checkpoint pattern for EP02 state management

**EP02 Implementation Note**: The CheckpointHandler should:
1. Use `PostToolUse` for incremental checkpoints after tool calls
2. Use `PreCompact` for mandatory checkpoint before context compression
3. Use `SessionEnd` for final checkpoint and cleanup

See `validate-hooks.ts` for comprehensive validation

## SDK Version

`@anthropic-ai/claude-agent-sdk@0.2.7`
