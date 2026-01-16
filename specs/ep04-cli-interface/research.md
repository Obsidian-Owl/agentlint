# Research Findings: CLI Interface & Commands

> **Epic**: EP04
> **Created**: 2026-01-16
> **Author**: Claude

---

## Decision Log

### 1. CLI Framework: Ink + Commander.js

**Decision**: Use Ink v4/v5 + Commander.js v12+ for CLI implementation

**Rationale**:
- Same architecture used by Claude Code (proven for agentic CLIs)
- Ink provides React component model for terminal UI with Flexbox layouts via Yoga
- Commander.js has 238M+ weekly downloads, mature TypeScript support
- Clear separation of concerns: Commander for parsing, Ink for rendering

**Alternatives Considered**:
- oclif: Heavier enterprise framework, more abstraction than needed
- Citty: Minimal but no streaming UI components
- Commander.js standalone: Would require building all streaming UI from scratch

**References**:
- [ADR-0003: CLI Framework and Command Structure](../../docs/architecture/adr/0003-cli-framework-and-command-structure.md)
- [Ink GitHub Repository](https://github.com/vadimdemedes/ink)
- [Commander.js GitHub](https://github.com/tj/commander.js)

### 2. Bun Compatibility

**Decision**: Target Bun runtime with Node.js fallback awareness

**Rationale**:
- Recent (2025) tutorials show Ink working with Bun via `bun run`
- Historical issues with `yoga-layout-prebuilt` in older Bun versions (< 1.0) are resolved
- TypeScript runs directly in Bun without compilation step
- Known `useInput` bug in Bun - mitigated by flags-only interface (no interactive input)

**Risks & Mitigations**:
| Risk | Mitigation |
|------|------------|
| useInput bug | Use flags instead of interactive prompts (FR-017) |
| yoga-layout issues | Test on Bun 1.1+; document Node.js fallback |
| Rendering differences | Integration tests on both runtimes |

**References**:
- [Bun Ink Issue #2034](https://github.com/oven-sh/bun/issues/2034)
- [Building a Coding CLI with React Ink](https://ivanleo.com/blog/migrating-to-react-ink)

### 3. UI Components: @inkjs/ui

**Decision**: Use @inkjs/ui for standard components, custom CausalTree for tree visualization

**Rationale**:
- @inkjs/ui provides battle-tested Spinner, ProgressBar, StatusMessage, Badge
- All components support theming via ThemeProvider + extendTheme
- Custom CausalTree component needed for causal chain visualization (core differentiator)

**Available Components from @inkjs/ui**:
| Component | Use Case |
|-----------|----------|
| Spinner | Indeterminate progress during analysis phases |
| ProgressBar | Known-length operations (file processing) |
| StatusMessage | Findings display (success/error/warning/info variants) |
| Badge | Severity indicators |
| TextInput | Not used (Bun compatibility) |
| Select | Not used (Bun compatibility) |

**Custom Component Needed**:
- CausalTree: ASCII tree with box-drawing characters (├──, └──, │)
- Example output:
  ```
  Issue: API key exposed
  ├── Detected: sessions/2026-01-14.jsonl:1247
  ├── Origin Trace
  │   ├── Session: User pasted credentials
  │   ├── Config Gap: No credential guidance
  │   └── Root Cause: Missing security instructions
  └── Recommendation: Add credential handling section
  ```

**References**:
- [@inkjs/ui npm](https://www.npmjs.com/package/@inkjs/ui)
- [ADR-0004: Output Format and Rendering](../../docs/architecture/adr/0004-output-format-and-rendering.md)

### 4. Output Mode Detection

**Decision**: Auto-detect output mode based on TTY and flags

**Rationale**:
- Non-TTY (piped) contexts should default to JSON for scripting
- Flags override auto-detection
- Respects accessibility standards (NO_COLOR)

**Detection Logic**:
```typescript
function getOutputMode(options: CLIOptions): OutputMode {
  if (options.json) return 'json';
  if (options.markdown) return 'markdown';
  if (options.plain) return 'plain';
  if (!process.stdout.isTTY) return 'json'; // Piped output
  if (process.env.NO_COLOR) return 'plain'; // Accessibility
  return 'terminal'; // Rich Ink rendering
}
```

**References**:
- [NO_COLOR Standard](https://no-color.org/)
- [CLI UX Best Practices](https://clig.dev/)

### 5. JSON Streaming Format

**Decision**: Use JSON Lines (NDJSON) for streaming JSON output

**Rationale**:
- One object per line allows `jq` to process incrementally
- Compatible with streaming contexts (CI logs, pipes)
- Each line is independently parseable

**Format Example**:
```json
{"type":"progress","phase":"config","percent":25}
{"type":"finding","severity":"high","id":"F001","description":"..."}
{"type":"progress","phase":"sessions","percent":50}
{"type":"complete","findingsCount":5,"duration":1234}
```

**References**:
- [Tips on Adding JSON Output to Your CLI App](https://blog.kellybrazil.com/2021/12/03/tips-on-adding-json-output-to-your-cli-app/)
- [ADR-0004 Implementation Notes](../../docs/architecture/adr/0004-output-format-and-rendering.md)

### 6. Exit Code Strategy

**Decision**: Exit 0 on success (even with findings), Exit 1 on error, --fail-on-findings for CI

**Rationale**:
- Follows Unix conventions (0 = success, non-zero = error)
- Findings are informational, not errors
- CI pipelines can opt-in to failure on findings via flag
- Predictable behavior for scripting

**Exit Code Table**:
| Scenario | Exit Code | Flag |
|----------|-----------|------|
| Success, no findings | 0 | - |
| Success, findings present | 0 | - |
| Success, findings present | 1 | --fail-on-findings |
| Error during execution | 1 | - |
| Invalid command/flag | 1 | - |

**References**:
- [spec.md NFR-003](./spec.md)

### 7. Command Structure

**Decision**: Verb-based commands at top level (git-like pattern)

**Rationale**:
- Familiar to developers (matches git, npm, docker patterns)
- Clear action-oriented naming
- Supports subcommands where needed (learn add, learn list, learn promote)

**Command Hierarchy**:
```
agentlint
├── scan         # Discover AI configurations
├── analyse      # Run full analysis
├── baseline     # Capture current state
├── compare      # Compare against baseline
├── recommend    # Generate recommendations
├── trace        # Trace issue to origin
├── validate     # Validate configurations
└── learn        # Manage learnings (subcommands)
    ├── list     # List stored learnings
    ├── add      # Add new learning
    └── promote  # Promote to global scope
```

**References**:
- [ADR-0003 Command Structure](../../docs/architecture/adr/0003-cli-framework-and-command-structure.md)

### 8. Color Accessibility

**Decision**: Use ANSI 4-bit colors only, respect NO_COLOR

**Rationale**:
- 16 ANSI colors work across all terminal color schemes
- Users can customize terminal palette
- NO_COLOR environment variable is accessibility standard
- Maximum compatibility with screen readers and high-contrast modes

**Color Usage**:
| Semantic | ANSI Color |
|----------|------------|
| Error/Critical | Red |
| Warning/High | Yellow |
| Success/Info | Green |
| Medium | Cyan |
| Low | Blue |
| Neutral/Text | Default |

**References**:
- [Building a More Accessible GitHub CLI](https://github.blog/engineering/user-experience/building-a-more-accessible-github-cli/)
- [NO_COLOR Standard](https://no-color.org/)

---

## Dependency Versions

| Package | Version | Purpose |
|---------|---------|---------|
| ink | ^5.0.0 | React terminal renderer |
| @inkjs/ui | ^2.0.0 | UI components (Spinner, StatusMessage, etc.) |
| commander | ^12.0.0 | Argument parsing |
| chalk | ^5.0.0 | Color support (ESM) |

**Installation Command**:
```bash
bun add ink @inkjs/ui commander chalk
```

---

## Open Items Resolved

All technical unknowns from Phase 0 have been resolved:

| Unknown | Resolution |
|---------|------------|
| Bun/Ink compatibility | Works in Bun 1.1+; useInput bug mitigated by flags-only design |
| Component availability | @inkjs/ui provides needed components; custom CausalTree required |
| JSON streaming format | JSON Lines (one object per line) |
| Exit code behavior | Standard Unix (0/1) + --fail-on-findings flag |
