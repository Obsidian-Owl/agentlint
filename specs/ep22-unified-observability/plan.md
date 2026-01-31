# Implementation Plan: EP22 Unified Observability Architecture

**Branch**: `ep22-unified-observability` | **Date**: 2026-01-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/ep22-unified-observability/spec.md`

## Summary

Unify agentlint's disconnected observability systems (local debug logging + HoneyHive telemetry) into a coherent OpenTelemetry-based architecture with shared trace IDs. This enables seamless debugging where a single trace ID correlates local log files, HoneyHive UI traces, and checkpoint replay files.

**Technical Approach**:
- Use official `@opentelemetry/*` packages for trace/span management
- Generate UUID v7 trace IDs at session start
- Propagate trace context via AsyncLocalStorage
- Support dual export: Vercel proxy (default) + optional user OTLP endpoint
- 100% sampling rate for alpha phase

## Technical Context

**Language/Version**: TypeScript 5.x (Bun runtime)
**Primary Dependencies**: `@opentelemetry/api`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/exporter-trace-otlp-http`, existing debug logger
**Storage**: Local JSONL logs (`~/.agentlint/logs/`), optional HoneyHive cloud
**Testing**: Bun test, VCR for API mocking
**Target Platform**: CLI (Bun/Node.js)
**Project Type**: CLI Tool with agentic orchestration
**Performance Goals**: <5% latency overhead from observability
**Constraints**: No secrets in CLI binary (proxy pattern), graceful degradation on failure
**Scale/Scope**: Single developer usage, ~100 tool calls per session max

## Constitution Check

*GATE: Must pass before Phase 1 research. Re-check after Phase 2 design.*

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Local-First | ✅ Pass | Local logging always on by default. Remote telemetry opt-in only. No secrets in CLI. |
| II | Improvement-Oriented | ✅ Pass | Observability enables understanding of analysis effectiveness over time |
| III | Causal-First | ✅ Pass | Trace hierarchy enables tracing issues to origin span/operation |
| IV | Mixed-Methods | ✅ Pass | Combines structured spans with semantic log messages |
| V | Language-Agnostic | ✅ Pass | Observability infrastructure is language-independent |
| VI | Agent-Agnostic | ✅ Pass | OTel standard works across any agent framework |
| VII | Intelligent Tooling | ✅ Pass | Observability provides data; agent/developer interprets meaning |
| VIII | Compounding Value | ✅ Pass | Historical traces enable trend analysis and pattern discovery |
| IX | Agent-Aware | ✅ Pass | GenAI semantic conventions designed for agent cognition |

**Gate Result**: All principles pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/ep22-unified-observability/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 1 output - technical decisions
├── data-model.md        # Phase 2 output - trace context schemas
├── quickstart.md        # Phase 2 output - usage guide
├── contracts/           # Phase 2 output - TypeScript interfaces
│   └── interfaces.ts
└── checklists/
    └── requirements.md  # Requirements validation (complete)
```

### Source Code (repository root)

```text
src/
├── observability/           # NEW: Core observability module
│   ├── index.ts            # Public exports
│   ├── trace-context.ts    # UUID v7 generation, AsyncLocalStorage propagation
│   ├── span-factory.ts     # GenAI-compliant span creation
│   ├── exporters/
│   │   ├── local-exporter.ts    # JSONL file exporter
│   │   └── otlp-exporter.ts     # HoneyHive/user OTLP export
│   └── instrumentation/
│       ├── orchestrator.ts  # Orchestrator span hooks
│       ├── streaming.ts     # SSE stream span hooks
│       └── tui.ts           # TUI state span events
├── debug/                   # EXISTING: Modify to use trace context
│   ├── logger.ts           # Add trace_id/span_id injection
│   └── namespaces.ts       # Add OBSERVABILITY namespace
├── opencode/               # EXISTING: Add instrumentation hooks
│   ├── orchestrator.ts
│   └── streaming.ts
└── tui/                    # EXISTING: Add state logging
    └── renderers/
        └── ink-renderer.ts

tests/
├── unit/
│   └── observability/
│       ├── trace-context.test.ts
│       ├── span-factory.test.ts
│       └── exporters.test.ts
└── integration/
    └── observability/
        └── e2e-trace.test.ts
```

**Structure Decision**: New `src/observability/` module for core trace management. Existing modules (`debug/`, `opencode/`, `tui/`) modified to consume trace context. This keeps observability concerns isolated while allowing gradual instrumentation.

## Complexity Tracking

> No violations - table left empty

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 1: Research Findings

See [research.md](./research.md) for detailed technical decisions.

### Key Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| OTel Packages | Official `@opentelemetry/*` | Standard compliance, HoneyHive compatibility |
| Trace ID Format | UUID v7 | Time-sortable, W3C compatible |
| Context Propagation | AsyncLocalStorage | Node.js native, zero overhead |
| Export Architecture | Dual-path (proxy + user OTLP) | Flexibility for both maintainers and power users |
| Sample Rate | 1.0 (100%) | Full visibility for alpha debugging |
| Log Correlation | Auto-inject trace_id/span_id | Unified debugging surface |

## Phase 2: Design Artifacts ✅

All design artifacts created:

| Artifact | Description | Status |
|----------|-------------|--------|
| [data-model.md](./data-model.md) | Trace context schemas, span attributes, storage formats | ✅ Complete |
| [contracts/interfaces.ts](./contracts/interfaces.ts) | TypeScript interfaces for all observability types | ✅ Complete |
| [quickstart.md](./quickstart.md) | Usage guide for local debugging and remote telemetry | ✅ Complete |

### Design Highlights

**Data Model**:
- W3C Trace Context compatible trace IDs
- GenAI semantic conventions for session/tool/LLM/stream spans
- JSONL log format with auto-injected trace context
- OTLP export format for HoneyHive and custom endpoints

**TypeScript Contracts**:
- 25+ interfaces covering all observability entities
- Tracer interface for span creation
- Exporter interfaces for local and OTLP export
- Configuration types with sensible defaults

**Quickstart Guide**:
- Local debugging workflows (filtering by trace ID, namespace)
- Remote telemetry opt-in process
- Common debugging scenarios with examples
- Troubleshooting guide

## Implementation Phases

### Phase 1: Local Observability Foundation (Week 1-2)
- Add OpenTelemetry SDK dependencies
- Implement UUID v7 trace ID generation
- Create TraceContextProvider using AsyncLocalStorage
- Modify DebugLogger to auto-inject trace_id/span_id
- Create TracingSpanFactory for consistent span creation
- Write unit tests for core observability

### Phase 2: Span Instrumentation (Week 2-3)
- Instrument orchestrator with session/tool/LLM spans
- Instrument StreamAdapter with SSE stream span
- Instrument InkRenderer with TUI state span events
- Add GenAI semantic convention attributes
- Write integration tests

### Phase 3: Remote Export (Week 3-4)
- Implement OTLP exporter for HoneyHive (via proxy)
- Add optional user OTLP endpoint support
- Add consent flow for first-time opt-in
- Verify trace correlation between local and HoneyHive
- Write E2E tests

### Phase 4: Checkpoint Integration (Week 4)
- Add trace context to checkpoint schema
- Implement replay correlation logic
- Test end-to-end replay trace linkage

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OTel package size bloat | Low | Medium | Audit imports, use tree-shaking |
| Performance overhead | Low | High | Benchmark each instrumentation point |
| HoneyHive API changes | Low | Medium | Proxy absorbs schema changes |
| AsyncLocalStorage edge cases | Medium | Low | Comprehensive test coverage |

## Next Steps

1. ✅ Spec complete
2. ✅ Clarifications resolved
3. ✅ Plan created
4. ✅ Design artifacts created
5. ✅ Tasks generated
6. ✅ Tasks analyzed and updated (added refactoring phase)
7. ✅ HoneyHive/OTel gap analysis complete (see `analysis-honeyhive-gaps.md`)
8. ✅ Design artifacts updated with full GenAI semantic conventions
9. ✅ **Final cross-validation: Opencode SDK integration + multi-provider support** (see `analysis-final-gaps.md`)
   - Added 10 new tasks for SDK integration gaps (T025h-T025q)
   - **86 total tasks, 63 MVP**
10. ⬜ Create Linear issues (`/dev.taskstolinear`)
11. ⬜ Begin implementation
