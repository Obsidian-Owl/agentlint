# TUI Startup Fixes Plan

## Context

### Original Request
Fix TUI startup issues causing poor user experience when running `bun run src/cli.ts analyse`.

### Interview Summary
Five distinct issues identified through user report and code analysis:
1. Debug logs leaking to TUI display
2. "Scanning" spinner stuck indefinitely
3. Meaningless "Server started" message shown
4. "thinking..." with no visible content
5. Confusing input field UX during agent processing

### Research Findings
- **Logger architecture**: `src/debug/logger.ts` uses `console.error()` for all output (line 270-272), which bypasses TUI rendering
- **Phase tracking**: `ink-renderer.ts:206-208` only updates phase on `phase_change` chunks; orchestrator never emits these
- **LLM greeting code exists but is unused**: `getWelcomeSystemPrompt()` and `getWelcomeUserPrompt()` in `welcome-prompt.ts:94-154`
- **Welcome flow**: `welcome-flow.ts:68` uses static `formatContextSummary()` instead of LLM
- **Opencode pattern**: Input remains visible but disabled with clear "agent is working" feedback
- **AnalysisPhase type**: Defined as `'idle' | 'scanning' | 'presenting' | 'exploring'` in `src/tui/types.ts:73` - no `'complete'` value
- **Orchestrator cleanup**: `OpencodeOrchestrator.dispose()` method exists for explicit cleanup (line 190-202)

---

## Work Objectives

### Core Objective
Deliver a polished TUI startup experience where users see meaningful, non-confusing output from the moment they launch the application.

### Deliverables
1. Clean TUI output with no leaked debug logs
2. Accurate progress indication (no stuck spinners)
3. Meaningful status messages only
4. LLM-powered contextual greeting on startup
5. Clear input field feedback during agent processing

### Definition of Done
- [ ] No debug logs visible in TUI when running `bun run src/cli.ts analyse`
- [ ] Progress component shows accurate state based on actual agent activity
- [ ] "Server started" and similar internal messages suppressed from TUI
- [ ] Startup shows LLM-generated contextual greeting (or graceful fallback)
- [ ] Input field shows "Agent is working, please wait..." when disabled
- [ ] All existing tests pass
- [ ] Manual verification confirms UX improvements

---

## Guardrails

### Must Have
- [ ] Maintain backward compatibility with `--verbose` flag for debugging
- [ ] Preserve file logging behavior unchanged
- [ ] Keep input field visible (Opencode pattern)
- [ ] Graceful degradation if LLM greeting fails
- [ ] Proper orchestrator cleanup on timeout (no port conflicts or orphaned processes)

### Must NOT Have
- [ ] Complex state machine changes
- [ ] Breaking changes to ITuiRenderer interface
- [ ] New dependencies
- [ ] Changes to core orchestration logic

---

## Task Flow and Dependencies

```
[Issue 1: Debug Logs] ─────────────────────┐
                                           │
[Issue 3: Server Started] ─────────────────┼──► [Issue 2: Scanning Spinner]
                                           │
[Issue 4: LLM Greeting] ──────────────────┬┘
                                          │
[Issue 5: Input UX] ──────────────────────┘
                                          │
                                          ▼
                              [Verification & Testing]
```

Issues 1, 3, 4, 5 can be implemented in parallel. Issue 2 depends on Issue 3 being resolved first (to understand what chunks ARE emitted vs. what's missing).

---

## Detailed TODOs

### TODO-1: Suppress Debug Logs from TUI Output
**File**: `src/debug/logger.ts`
**Lines**: 267-273 (outputToConsole method)

**Problem**: Logger writes to `console.error()` which appears in terminal alongside TUI.

**Solution**: When TUI is active, suppress console output. Add a TUI-awareness flag.

**Changes**:
1. Add static flag `DebugLogger.tuiActive: boolean = false` (line ~88)
2. Add static methods `DebugLogger.setTuiActive(active: boolean)` and `DebugLogger.isTuiActive(): boolean`
3. Modify `outputToConsole()` (line 267-273) to check `tuiActive` flag:
   ```typescript
   private outputToConsole(entry: LogEntry, format: 'pretty' | 'json'): void {
     // Suppress console output when TUI is active (log to file only)
     if (DebugLogger.tuiActive) {
       return;
     }
     // ... existing code
   }
   ```
4. In `ink-renderer.ts`:
   - Call `DebugLogger.setTuiActive(true)` in `start()` method (after line 113)
   - Call `DebugLogger.setTuiActive(false)` in `stop()` method (at start of method)

5. **Add documentation comment** explaining the static flag:
   ```typescript
   /**
    * Process-global flag indicating TUI is active.
    * When true, console output is suppressed (file logging continues).
    *
    * NOTE: This is process-global state. Test isolation should use
    * beforeEach/afterEach to reset: DebugLogger.setTuiActive(false)
    */
   private static tuiActive = false;
   ```

**Acceptance Criteria**:
- [ ] `bun run src/cli.ts analyse` shows no "INFO [agentlint:*]" messages
- [ ] `--verbose` flag still works for non-TUI commands
- [ ] File logging continues unaffected

**Risk**: Low - isolated change to logger output gating

---

### TODO-2: Remove "Server started" Status Chunk
**File**: `src/opencode/orchestrator.ts`
**Line**: 109

**Problem**: `yield this.createChunk('status', 'normal', 'Server started')` renders meaningless message to TUI.

**Solution**: Remove or change to debug-level chunk.

**Changes**:
1. Change line 109 from:
   ```typescript
   yield this.createChunk('status', 'normal', 'Server started');
   ```
   to:
   ```typescript
   // Server started - no user-facing output needed (logged by server.ts)
   ```

**Acceptance Criteria**:
- [ ] No "Server started" message in TUI output
- [ ] Server lifecycle still logged to debug log file

**Risk**: None - removing noise, not functionality

---

### TODO-3: Fix Scanning Spinner State Management
**File**: `src/tui/renderers/ink-renderer.ts`
**Lines**: 81, 239-258

**Problem**: `currentPhase` starts as 'scanning' and only changes on `phase_change` chunks that never arrive. The Progress component shows based on `analysisPhase === 'scanning' && isStreaming`.

**Solution**: Derive phase from actual agent activity (tool calls, text streaming) rather than waiting for explicit phase changes.

**Type Constraint**: `AnalysisPhase` is defined as `'idle' | 'scanning' | 'presenting' | 'exploring'` in `src/tui/types.ts:73`. The `'complete'` value does NOT exist. We must use `'presenting'` for the completion state.

**Changes**:
1. Change `currentPhase` initial value (line 81) from `'scanning'` to `'idle'`:
   ```typescript
   private currentPhase: AnalysisPhase = 'idle';
   ```

2. Add phase derivation logic in `renderChunk()` (after line 258):
   ```typescript
   // Derive analysis phase from agent activity
   if (chunk.type === 'tool_start' || chunk.type === 'tool_result') {
     if (this.currentPhase === 'idle') {
       this.currentPhase = 'scanning';  // Active work in progress
     }
   } else if (chunk.type === 'text' && this.currentPhase === 'idle') {
     this.currentPhase = 'scanning';  // Active work in progress
   } else if (chunk.type === 'error') {
     // Error chunks don't change phase - let completion handle it
     // This prevents error-during-scan from causing stuck states
   }
   ```

3. In `renderComplete()` (line 271-275), set phase to `'presenting'` (the valid completion state):
   ```typescript
   renderComplete(_result: unknown): void {
     this.isStreaming = false;
     this.currentPhase = 'presenting';  // Use 'presenting' as completion state per AnalysisPhase type
     this.agentState = { phase: 'complete' };
     this.rerender();
   }
   ```

4. In `App.tsx`, update the Progress condition (line 261-265) to show for 'scanning' phase:
   ```tsx
   {analysisPhase === 'scanning' && isStreaming && (
     <Box marginBottom={1}>
       <Progress phase={analysisPhase} isActive={true} elapsedMs={elapsedMs} />
     </Box>
   )}
   ```

**Acceptance Criteria**:
- [ ] No "Scanning" spinner on startup before agent does anything
- [ ] Progress shows "Scanning" when agent is calling tools or streaming
- [ ] Progress disappears when agent completes (phase becomes 'presenting')
- [ ] Error chunks don't cause phase inconsistencies

**Risk**: Medium - touches state management; needs careful testing

---

### TODO-4: Wire LLM-Powered Welcome Greeting
**File**: `src/cli/commands/welcome-flow.ts`
**Lines**: 59-77

**Problem**: Uses static `formatContextSummary()` instead of existing LLM prompt functions.

**Solution**: Call orchestrator with welcome prompts, with fallback to static message. **Must properly clean up orchestrator on timeout to prevent port conflicts and resource leaks.**

**Architecture Note**: This implementation creates a short-lived orchestrator for the greeting. A future optimization could share the orchestrator instance with the main analysis flow, but that requires more significant refactoring. This is acceptable for now as the greeting is a bounded 5-second operation.

**Changes**:
1. Add imports at top of file:
   ```typescript
   import { getWelcomeSystemPrompt, getWelcomeUserPrompt } from '../../tui/welcome/welcome-prompt';
   import { OpencodeOrchestrator } from '../../opencode/orchestrator';
   import { createToolRegistry } from '../../orchestration/tool-registry';
   ```

2. Add optional orchestrator parameter to `WelcomeFlowOptions`:
   ```typescript
   export interface WelcomeFlowOptions {
     projectPath?: string;
     gitTimeout?: number;
     useStaticGreeting?: boolean;  // New: skip LLM for testing
   }
   ```

3. After line 59 (context loaded), add LLM greeting attempt:
   ```typescript
   let welcomeMessage: string;

   if (options.useStaticGreeting) {
     welcomeMessage = formatContextSummary(context);
   } else {
     try {
       // Attempt LLM-powered greeting (with short timeout)
       welcomeMessage = await generateLlmGreeting(context);
     } catch (error) {
       // Fallback to static greeting on any error
       welcomeMessage = formatContextSummary(context);
     }
   }
   ```

4. Add helper function at end of file with **proper cleanup on timeout**:
   ```typescript
   async function generateLlmGreeting(context: WelcomeContext): Promise<string> {
     const toolRegistry = createToolRegistry();
     const orchestrator = new OpencodeOrchestrator(
       { cwd: context.projectPath ?? process.cwd() },
       toolRegistry
     );

     const systemPrompt = getWelcomeSystemPrompt();
     const userPrompt = getWelcomeUserPrompt(context);
     const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

     let greeting = '';
     let timedOut = false;

     const timeoutId = setTimeout(() => {
       timedOut = true;
     }, 5000);

     try {
       for await (const chunk of orchestrator.run(fullPrompt)) {
         if (timedOut) {
           break;  // Exit loop cleanly on timeout
         }
         if (chunk.type === 'text') {
           greeting += chunk.content;
         }
       }

       if (timedOut) {
         throw new Error('Greeting timeout');
       }

       return greeting.trim() || formatContextSummary(context);
     } finally {
       clearTimeout(timeoutId);
       // CRITICAL: Always dispose orchestrator to prevent port conflicts
       // and resource leaks, whether we completed normally or timed out
       orchestrator.dispose();
     }
   }
   ```

**Why this approach**:
- `orchestrator.dispose()` handles cleanup: stops server, clears sessions, resets state
- `finally` block ensures cleanup runs on success, timeout, OR any other error
- No orphaned processes or port conflicts on subsequent runs
- The `Promise.race()` pattern from the original plan would leave the stream running in the background

**Acceptance Criteria**:
- [ ] Startup shows personalized LLM greeting based on context
- [ ] Falls back to static message if LLM fails or times out (5s)
- [ ] `useStaticGreeting: true` option bypasses LLM for tests
- [ ] No visible delay beyond 5 seconds
- [ ] No port conflicts on next run after timeout
- [ ] No orphaned processes after timeout

**Risk**: Medium - adds orchestrator call; needs timeout handling and proper cleanup

---

### TODO-5: Improve Input Field UX During Agent Work
**File**: `src/tui/components/InputField.tsx`
**Lines**: 93-101

**Problem**: Input shows static placeholder when disabled; unclear that agent is working.

**Solution**: Show dynamic placeholder indicating agent status.

**Changes**:
1. Add new prop to InputFieldProps (in `src/tui/types.ts`):
   ```typescript
   export interface InputFieldProps {
     // ... existing props
     disabledPlaceholder?: string;  // Placeholder when disabled
   }
   ```

2. Update InputField component (line 44-45):
   ```typescript
   export function InputField({
     value,
     onChange,
     onSubmit,
     disabled = false,
     placeholder = '',
     disabledPlaceholder = 'Agent is working, please wait...',
   }: InputFieldProps): React.ReactElement {
   ```

3. Update placeholder logic (line 93):
   ```typescript
   const showPlaceholder = value.length === 0;
   const displayPlaceholder = disabled ? disabledPlaceholder : placeholder;
   ```

4. Update render (line 100):
   ```typescript
   {showPlaceholder ? <Text dimColor>{displayPlaceholder}</Text> : <Text>{value}</Text>}
   ```

5. In `App.tsx` (line 384-390), pass the disabled placeholder:
   ```tsx
   <InputField
     value={inputValue}
     onChange={handleInputChange}
     onSubmit={handleInputSubmit}
     disabled={isStreaming}
     placeholder="Type your question or press q to quit..."
     disabledPlaceholder="Agent is working, please wait..."
   />
   ```

**Acceptance Criteria**:
- [ ] When agent is working, input shows "Agent is working, please wait..."
- [ ] When idle, input shows normal placeholder
- [ ] Cursor indicator hidden when disabled (already working)

**Risk**: Low - cosmetic change only

---

### TODO-6: Verification and Testing

**Manual Verification Steps**:
1. Run `bun run src/cli.ts analyse` from project root
2. Verify: No "INFO [agentlint:*]" messages visible
3. Verify: No "Server started" message visible
4. Verify: No stuck "Scanning" spinner
5. Verify: Progress shows "Scanning" when agent works
6. Verify: Input shows "Agent is working..." during processing
7. Verify: Contextual greeting appears (or static fallback)
8. Run `bun run test` - all tests pass
9. **NEW**: Test timeout scenario - kill greeting mid-stream, verify next run doesn't have port conflict

**New Test Cases**:
1. `src/debug/__tests__/logger.test.ts`: Add test for TUI suppression flag
   - Include test isolation: `beforeEach(() => DebugLogger.setTuiActive(false))`
2. `src/tui/components/__tests__/InputField.test.tsx`: Add test for disabled placeholder
3. `src/cli/commands/__tests__/welcome-flow.test.ts`: Add test for LLM fallback
4. `src/cli/commands/__tests__/welcome-flow.test.ts`: Add test for orchestrator cleanup on timeout

**Acceptance Criteria**:
- [ ] All existing tests pass: `bun run test`
- [ ] Manual verification complete for all 5 issues
- [ ] New tests added for changed behavior
- [ ] Timeout cleanup verified (no port conflicts)

---

## Commit Strategy

**Commit 1**: "fix(debug): suppress console logging when TUI is active"
- Files: `src/debug/logger.ts`, `src/tui/renderers/ink-renderer.ts`
- Tests: logger TUI suppression test

**Commit 2**: "fix(orchestrator): remove user-facing 'Server started' message"
- Files: `src/opencode/orchestrator.ts`

**Commit 3**: "fix(tui): derive analysis phase from agent activity"
- Files: `src/tui/renderers/ink-renderer.ts`, `src/tui/components/App.tsx`

**Commit 4**: "feat(welcome): add LLM-powered contextual greeting with proper cleanup"
- Files: `src/cli/commands/welcome-flow.ts`, `src/tui/welcome/welcome-prompt.ts`
- Tests: welcome-flow fallback test, cleanup test

**Commit 5**: "fix(tui): show 'Agent is working' placeholder when disabled"
- Files: `src/tui/components/InputField.tsx`, `src/tui/types.ts`, `src/tui/components/App.tsx`
- Tests: InputField disabled placeholder test

---

## Success Criteria

| Metric | Target | Verification |
|--------|--------|--------------|
| Debug log visibility | 0 leaked logs | Manual run |
| Stuck spinner | 0 occurrences | Manual run |
| Internal messages shown | 0 messages | Manual run |
| LLM greeting | Works or falls back gracefully | Manual run |
| Input UX clarity | Clear feedback always | Manual run |
| Test suite | 100% pass | `bun run test` |
| Port conflicts after timeout | 0 occurrences | Kill test + re-run |

---

## Risk Identification and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM greeting timeout delays startup | Medium | Medium | 5-second timeout with static fallback |
| Phase derivation incorrect for edge cases | Low | Medium | Comprehensive testing; keep existing phase_change support; handle error chunks explicitly |
| Logger suppression breaks debugging | Low | High | TUI-only suppression; file logging unchanged; --verbose still works |
| Test failures from changed behavior | Medium | Low | Run full test suite before each commit |
| Port conflicts on timeout | Medium | High | **Mitigated**: Use `orchestrator.dispose()` in finally block |
| Orphaned processes on timeout | Medium | High | **Mitigated**: Proper cleanup in finally block |
| Static flag causes test pollution | Low | Medium | **Mitigated**: Document, add beforeEach reset in tests |

---

## Notes

- All file paths are relative to `/Users/dmccarthy/Projects/agentlint/`
- Estimated implementation time: 2-3 hours
- No breaking changes to public APIs
- Follows existing code patterns and conventions
- `AnalysisPhase` type constraint: only `'idle' | 'scanning' | 'presenting' | 'exploring'` are valid values
- Orchestrator cleanup pattern: always use `dispose()` in finally blocks when orchestrator lifecycle is bounded
