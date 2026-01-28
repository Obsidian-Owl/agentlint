## T17: TUI & CLI Integration Verification

### Completed

- ✓ Verified TUI independence from SDK types (removed `PermissionResult` dependency)
- ✓ Moved `PermissionResult` and `IOrchestrator` to `src/orchestration/types.ts` and `interfaces.ts`
- ✓ Refactored `createOrchestrator` factory into `src/orchestration/index.ts` to support dual implementations
- ✓ Added `--opencode` flag to CLI `analyse` command
- ✓ Verified `OpencodeOrchestrator` implements the shared interface
- ✓ Tests passing (including TUI unit tests)

### Key Findings

#### Interface Separation

- Created `src/orchestration/interfaces.ts` to host `IOrchestrator` to resolve circular dependencies between `config.ts`, `types.ts`, and `orchestrator.ts`.
- This clean separation allows `OpencodeOrchestrator` and `Orchestrator` to coexist without tight coupling.

#### TUI Architecture

- The TUI was already well-abstracted, only requiring one type definition move (`PermissionResult`).
- This validates the event-driven architecture (StreamChunks) as an effective abstraction layer.

#### Factory Pattern

- Moving the factory to `index.ts` allows the consumer (CLI) to remain agnostic of the implementation details while enabling runtime switching via configuration.

### Next Steps

- T18: Permission Handler Migration
