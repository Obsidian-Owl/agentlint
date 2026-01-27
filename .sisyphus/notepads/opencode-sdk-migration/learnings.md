# Learnings - Opencode SDK Migration

*Conventions, patterns, and wisdom discovered during migration*

---

## T01: Add Opencode SDK Dependency

### Completed
- ✓ Added `@opencode-ai/sdk@^1.1.36` to package.json dependencies
- ✓ Ran `bun install` successfully
- ✓ Created `src/opencode/` module directory
- ✓ Created `src/opencode/index.ts` with module exports
- ✓ Created placeholder implementations for `server.ts` and `client.ts`
- ✓ TypeScript compilation passes with zero errors
- ✓ Opencode SDK can be imported successfully
- ✓ Atomic commit created: `feat(opencode): add Opencode SDK dependency`

### Key Findings

#### Version Resolution
- Initial attempt with `@opencode-ai/sdk@^0.1.0` failed (version doesn't exist)
- Used wildcard `*` to discover available versions
- Resolved to `@opencode-ai/sdk@1.1.36` (latest available)
- Updated package.json to use `^1.1.36` for semantic versioning

#### Module Structure
- Created placeholder stub files for `server.ts` and `client.ts` to allow `index.ts` imports
- Stub methods return rejected promises instead of throwing to satisfy ESLint `require-await` rule
- Generator method `subscribe()` yields rejected promise to satisfy `require-yield` rule
- This approach allows T02 and T03 to implement actual functionality without breaking imports

#### Code Quality
- Pre-commit hooks enforce TypeScript, ESLint, and Prettier checks
- All checks passed on first commit attempt after fixing ESLint errors
- No type errors in agentlint code (external SDK has unrelated type issues in node_modules)

### Blockers Resolved
- None - task completed successfully

### Next Steps (T02/T03)
- Implement `OpencodeServerManager` in `src/opencode/server.ts`
- Implement `OpencodeClient` in `src/opencode/client.ts`
- Both can now be imported from `src/opencode/index.ts`

### Commit Hash
- `52da22c` - feat(opencode): add Opencode SDK dependency

---

## T02a: Create IServerManager Interface & OpencodeServerManager Skeleton

### Completed
- ✓ Added `OpencodeServerConfig` interface with optional fields (port, healthCheckUrl, healthCheckIntervalMs, maxRetries)
- ✓ Extended `IServerManager` interface with `getPort(): number` method
- ✓ Created `OpencodeServerManager` class implementing `IServerManager`
- ✓ Added constructor accepting `OpencodeServerConfig` with sensible defaults
- ✓ All methods throw "Not implemented - will be added in T02b-c" errors
- ✓ Added JSDoc comments for public API documentation
- ✓ TypeScript compilation passes with zero errors
- ✓ Both interface and class exported from `src/opencode/index.ts`

### Key Findings

#### ESLint Strictness
- ESLint flags unused class fields even when they're intentionally stored for future use
- Solution: Use `void this.config;` in constructor to satisfy linter while preserving field for T02b-c
- This pattern allows skeleton implementation without breaking linter checks

#### Config Pattern
- Stored config as `private readonly` field to prevent accidental mutation
- Constructor merges provided config with sensible defaults (port 3000, health check interval 5000ms)
- Config will be accessed in T02b-c when implementing actual start/stop logic

#### Method Signatures
- All async methods properly typed with `Promise<void>`
- `isRunning()` and `getPort()` are synchronous (no I/O)
- Error messages reference specific follow-up tasks (T02b-c) for clarity

### Blockers Resolved
- None - task completed successfully

### Next Steps (T02b-c)
- Implement `start()` - spawn Opencode server process
- Implement `stop()` - gracefully terminate server
- Implement `isRunning()` - check process status
- Implement `getPort()` - return configured port

### Commit Hash
- (pending - will be created after verification)

## Opencode SDK API Research (Librarian)

**Source**: Official docs, GitHub examples, TypeScript definitions

### Key Findings

**1. Server + Client Creation**:
```typescript
import { createOpencode } from "@opencode-ai/sdk"
const { client, server } = await createOpencode({ port: 4096 })
server.close() // cleanup
```

**2. Session Management**:
```typescript
const session = await client.session.create({ body: { title: "..." } })
const sessionId = session.data.id
```

**3. Prompting**:
```typescript
const result = await client.session.prompt({
  path: { id: sessionId },
  body: { parts: [{ type: "text", text: "..." }] }
})
const text = result.data.parts?.filter(p => p.type === "text").map(p => p.text).join("\n")
```

**4. Event Streaming**:
```typescript
const events = await client.event.subscribe()
for await (const event of events.stream) {
  if (event.type === "message.part.updated") {
    // Handle event
  }
}
```

**5. Response Pattern**: All methods return `{ data, error }` - check error first

**6. Server Lifecycle**: SDK manages server internally via `createOpencode()`, no need for manual child_process spawning

### Impact on T02/T03

- **T02 (Server)**: Can use `createOpencodeServer()` instead of manual spawn
- **T03 (Client)**: Use `createOpencodeClient({ baseUrl })` for connection
- Both are simpler than originally planned


## T02 & T03: Server Lifecycle Manager and Client Wrapper

### Completed
- ✓ Created `src/opencode/server.ts` with `OpencodeServerManager` class
- ✓ Created `src/opencode/client.ts` with `AgentlintOpencodeClient` class
- ✓ Both use actual Opencode SDK API (`createOpencodeServer`, `createOpencodeClient`)
- ✓ Fixed TypeScript errors (renamed class to avoid SDK type conflict)
- ✓ Fixed ESLint errors (proper error stringification, sync stop method)
- ✓ All tests passing (4146 pass), typecheck clean
- ✓ Atomic commit created: `feat(opencode): implement server lifecycle manager and client wrapper`

### Key Findings

#### Class Naming Conflict (T03)
- **Problem**: Class name `OpencodeClient` conflicted with SDK's `OpencodeClient` type import
- **Solution**: Renamed to `AgentlintOpencodeClient` to avoid collision
- **Pattern**: When wrapping SDK types, use project-specific prefix to avoid naming conflicts

#### Error Handling Pattern
- **Problem**: ESLint error `@typescript-eslint/no-base-to-string` when using `String(result.error)`
- **Solution**: Check for `message` property first, then stringify: 
  ```typescript
  const errorMsg: string = 'message' in result.error 
    ? String(result.error.message) 
    : JSON.stringify(result.error);
  ```
- **Pattern**: Always type-check error objects before stringification

#### Sync vs Async Methods
- **Problem**: ESLint error `@typescript-eslint/require-await` on `stop()` method
- **Solution**: Changed from `async stop(): Promise<void>` to `stop(): void`
- **Rationale**: `close()` is synchronous, no need for async wrapper
- **Pattern**: Only use `async` when actually awaiting something

#### Type Assertions
- **Problem**: `ensureConnected()` assertion type `this & { client: SDKClient }` caused intersection errors
- **Solution**: Changed to simple `void` return, rely on null checks in methods
- **Pattern**: Avoid complex type assertions when simple null checks suffice

### Implementation Details

#### Server (T02)
- Uses `createOpencodeServer({ port, hostname, timeout })` from SDK
- Returns `{ url: string; close(): void }` - simpler than child_process approach
- `stop()` is synchronous (just calls `close()`)
- `getPort()` parses port from server URL
- `getUrl()` returns full server URL

#### Client (T03)
- Uses `createOpencodeClient({ baseUrl })` from SDK
- Health check via `fetch('/health')` before marking connected
- Session creation: `client.session.create({ body: { title } })`
- Prompting: `client.session.prompt({ path: { id }, body: { parts } })`
- Event subscription: `client.event.subscribe()` returns `{ stream: AsyncIterable }`
- All SDK methods return `{ data, error }` - check error first

### Blockers Resolved
- None - both tasks completed successfully

### Next Steps (Wave 2)
- T04: Create MCP server skeleton
- T05: Create tool definition adapter
- T06: Create streaming adapter (SSE → StreamChunk) - CRITICAL PATH
- T07: Create hybrid session manager

### Commit Hash
- `9333f21` - feat(opencode): implement server lifecycle manager and client wrapper

