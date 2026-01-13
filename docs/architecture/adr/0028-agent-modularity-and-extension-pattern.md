---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0028: Agent Modularity and Extension Pattern

## Context and Problem Statement

agentlint has established multiple adapter and analyzer interfaces:
- **ADR-0018**: AIToolAdapter for AI coding assistant support (Claude Code, Cursor, etc.)
- **ADR-0019**: LanguageAnalyzer for programming language analysis (TS, Python, Go)

The CCA (Confucius Code Agent) research introduces a more structured decomposition with **Perception/Reasoning/Action** extensions using typed callbacks. This pattern offers:
- Clear functional categories for components
- Callback-based lifecycle hooks
- Shared run context for state management
- Ablation study capability (enable/disable components to measure contribution)

This ADR evaluates whether agentlint should:
1. Adopt the P/R/A pattern from CCA
2. Support runtime plugins or remain compiled-only
3. Define testing strategies for modular components

### Prior ADR Influences

| ADR | Influence |
|-----|-----------|
| ADR-0011 | Subagent pattern - orchestrator + workers |
| ADR-0013 | Testing strategy - 4-layer pyramid |
| ADR-0018 | AIToolAdapter - compiled adapters, no plugins |
| ADR-0019 | LanguageAnalyzer - layered analysis interface |
| ADR-0027 | Working memory - hierarchical context |

## Decision Drivers

- **Simplicity**: Avoid over-engineering; YAGNI principle
- **Existing patterns work**: AIToolAdapter and LanguageAnalyzer are clean Strategy patterns
- **ADR-0018 precedent**: Already decided on compiled-in adapters (no runtime plugins)
- **Scope difference**: agentlint is an analysis tool, not a general-purpose AI engineer
- **Testing needs**: Components must be testable in isolation
- **Maintainability**: Core team maintains all code; no third-party plugins

## Considered Options

### Component Decomposition
1. **Adopt P/R/A as organizing principle** - Formalize CCA-style extensions
2. **Keep current adapter pattern** - AIToolAdapter + LanguageAnalyzer unchanged
3. **Full CCA-style extension system** - Callback registry, run context, lifecycle hooks

### Extensibility
1. **Compiled-in only** - All components in agentlint binary
2. **Future plugin architecture** - Design for future plugin support
3. **MCP-based extensions** - Components as MCP servers

### Testing Strategy
1. **Interface contracts + mocks** - Test via interfaces, mock dependencies
2. **Full ablation testing** - Systematically disable components
3. **Integration-only** - Test assembled system

## Decision Outcome

Chosen options:
- **Component Decomposition**: Keep current adapter pattern
- **Extensibility**: Compiled-in only
- **Testing Strategy**: Interface contracts + mocks

### Rationale

**Keep current adapter pattern** because:
- ADR-0018 and ADR-0019 already define clean, focused interfaces
- Implicit P/R/A separation already exists:
  - Perception: `AIToolAdapter.parseSessionLogs()`, `LanguageAnalyzer.analyze()`
  - Reasoning: Analysis agents (ADR-0006), causal tracing (ADR-0007)
  - Action: Report generation (ADR-0020), recommendations (ADR-0012)
- Adding explicit P/R/A interfaces would layer abstraction on abstraction
- agentlint's scope (analysis tool) doesn't require CCA's flexibility (general-purpose AI engineer)
- No evidence that formalization would improve outcomes for our use case

**Compiled-in only** because:
- ADR-0018 already established this for AI tool adapters
- Security: No untrusted code execution
- Simplicity: No plugin discovery, loading, versioning complexity
- Performance: No runtime overhead from dynamic dispatch
- Maintainability: Core team owns and tests all code

**Interface contracts + mocks** because:
- Aligns with ADR-0013 testing pyramid (unit → component → integration → eval)
- Each interface (AIToolAdapter, LanguageAnalyzer) defines testable contract
- Mocking enables isolation without full system setup
- Golden datasets validate perception accuracy
- LLM eval validates reasoning quality

---

## Detailed Design

### Existing Interface Landscape

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AGENTLINT COMPONENT INTERFACES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PERCEPTION LAYER (Input Processing)                                  │   │
│  │                                                                      │   │
│  │  AIToolAdapter (ADR-0018)      LanguageAnalyzer (ADR-0019)          │   │
│  │  ├─ detect()                   ├─ analyze()                          │   │
│  │  ├─ parseConfig()              ├─ extractMetrics()                   │   │
│  │  ├─ parseSessionLogs()         └─ detectPatterns()                   │   │
│  │  ├─ getAgentProfile()                                                │   │
│  │  └─ formatRecommendation()     SessionParser                        │   │
│  │                                ├─ parseJSONL()                       │   │
│  │                                └─ extractEvents()                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ REASONING LAYER (Analysis & Assessment)                              │   │
│  │                                                                      │   │
│  │  AnalysisAgent (ADR-0006)      CausalTracer (ADR-0007)              │   │
│  │  ├─ assessQuality()            ├─ detectIssue()                      │   │
│  │  ├─ synthesizeFindings()       ├─ traceOrigin()                      │   │
│  │  └─ generateRecommendations()  └─ buildCausalChain()                 │   │
│  │                                                                      │   │
│  │  WorkingMemoryManager (ADR-0027)                                     │   │
│  │  ├─ buildAgentContext()                                              │   │
│  │  ├─ maybeCompress()                                                  │   │
│  │  └─ persistToProjectMemory()                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ACTION LAYER (Output & Effects)                                      │   │
│  │                                                                      │   │
│  │  ReportGenerator (ADR-0020)    RecommendationManager (ADR-0012)     │   │
│  │  ├─ formatTerminal()           ├─ proposeRecommendation()            │   │
│  │  ├─ formatJSON()               ├─ trackAdoption()                    │   │
│  │  ├─ formatSARIF()              └─ measureEffectiveness()             │   │
│  │  └─ formatJUnit()                                                    │   │
│  │                                                                      │   │
│  │  HindsightManager (ADR-0026)   BaselineWriter                       │   │
│  │  ├─ extractCandidates()        ├─ saveBaseline()                     │   │
│  │  ├─ confirmNote()              └─ compareBaselines()                 │   │
│  │  └─ exportMarkdown()                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  KEY: Implicit P/R/A categorization - no explicit interface needed         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Not Full P/R/A Formalization

| Aspect | CCA Approach | agentlint Current | Delta |
|--------|--------------|-------------------|-------|
| **Scope** | General-purpose AI engineer | Analysis-only tool | Lower complexity needs |
| **Extension count** | Dozens of extensions | ~10 component types | Manageable without registry |
| **Runtime flexibility** | Dynamic callback composition | Static call graph | Simpler testing |
| **State sharing** | Run context object | Explicit parameters | More traceable |
| **Ablation need** | Research-oriented | Production-oriented | Less experimental |

### Compiled-In Architecture

```typescript
// All components are statically imported
import { ClaudeCodeAdapter } from './adapters/claude-code';
import { CursorAdapter } from './adapters/cursor';
import { TypeScriptAnalyzer } from './analyzers/typescript';
import { PythonAnalyzer } from './analyzers/python';

// Factory creates instances - no dynamic loading
export class ComponentFactory {
  private readonly adapters: Map<AIToolId, AIToolAdapter> = new Map([
    ['claude-code', new ClaudeCodeAdapter()],
    ['cursor', new CursorAdapter()],
    // New adapters added here by core team
  ]);

  private readonly analyzers: Map<string, LanguageAnalyzer> = new Map([
    ['typescript', new TypeScriptAnalyzer()],
    ['python', new PythonAnalyzer()],
    // New analyzers added here by core team
  ]);

  // No plugin loading, no eval(), no dynamic import()
}
```

### Why No Plugins

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPILED-IN vs PLUGIN COMPARISON                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Concern          │ Compiled-In             │ Plugin Architecture           │
│  ─────────────────┼─────────────────────────┼─────────────────────────────  │
│  Security         │ ✅ No untrusted code    │ ⚠️  Arbitrary code execution  │
│  Complexity       │ ✅ Simple static imports│ ❌ Discovery, loading, deps   │
│  Versioning       │ ✅ Single version       │ ❌ Plugin compat matrix       │
│  Testing          │ ✅ Full coverage        │ ⚠️  Plugin authors may skip   │
│  Performance      │ ✅ No dynamic dispatch  │ ⚠️  Runtime overhead          │
│  Type Safety      │ ✅ Compile-time checks  │ ⚠️  Runtime type validation   │
│  Debugging        │ ✅ Full stack traces    │ ⚠️  Plugin boundaries         │
│  Updates          │ ⚠️  Requires release    │ ✅ Independent updates        │
│  Community        │ ⚠️  Core team only      │ ✅ Community contributions    │
│                                                                             │
│  DECISION: Compiled-in wins for security, simplicity, and quality control  │
│                                                                             │
│  Future: If community demand is high, consider MCP-based extensions        │
│          (already planned for ADR-0020 output modes)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Testing Strategy

Aligned with ADR-0013 (Testing Strategy):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MODULAR COMPONENT TESTING                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: UNIT TESTS (Pure Functions)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Parser functions (regex, TOML, JSONL)                             │   │
│  │ • Metric calculations (complexity, coverage)                        │   │
│  │ • Data transformations (normalization, filtering)                   │   │
│  │                                                                      │   │
│  │ Tools: Bun test, fast execution, no I/O                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 2: COMPONENT TESTS (Interface Contracts)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • AIToolAdapter implementations                                     │   │
│  │   - Mock file system with sample configs/logs                       │   │
│  │   - Verify detection, parsing, profile generation                   │   │
│  │                                                                      │   │
│  │ • LanguageAnalyzer implementations                                  │   │
│  │   - Sample code files per language                                  │   │
│  │   - Verify metric extraction, pattern detection                     │   │
│  │                                                                      │   │
│  │ • ReportGenerator implementations                                   │   │
│  │   - Sample findings input                                           │   │
│  │   - Snapshot tests for output formats                               │   │
│  │                                                                      │   │
│  │ Tools: Bun test, mocked dependencies, golden files                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 3: INTEGRATION TESTS (Component Combinations)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Adapter + Analyzer + Report flow                                  │   │
│  │ • Full analysis of sample projects                                  │   │
│  │ • Golden dataset: known-good analysis results                       │   │
│  │                                                                      │   │
│  │ Tools: Bun test, real file I/O, SQLite                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  LAYER 4: AGENT EVALUATION (LLM Quality)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Reasoning quality (do recommendations make sense?)                │   │
│  │ • Causal accuracy (are traced origins correct?)                     │   │
│  │ • Hallucination detection (did agent invent findings?)              │   │
│  │                                                                      │   │
│  │ Tools: EvalKit, real LLM calls, ~$5-10 per CI run                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Interface Contract Testing Pattern

```typescript
import { describe, test, expect, mock } from 'bun:test';
import type { AIToolAdapter, DetectionResult } from '../types';
import { ClaudeCodeAdapter } from './claude-code';

describe('ClaudeCodeAdapter', () => {
  // Test the interface contract, not implementation details

  describe('detect()', () => {
    test('returns high confidence when CLAUDE.md exists', async () => {
      const fs = mock.module('fs', {
        existsSync: (path: string) => path.endsWith('CLAUDE.md'),
      });

      const adapter: AIToolAdapter = new ClaudeCodeAdapter();
      const result: DetectionResult = await adapter.detect('/project');

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.evidence).toContain('CLAUDE.md');
    });

    test('returns zero confidence when no markers found', async () => {
      const fs = mock.module('fs', {
        existsSync: () => false,
      });

      const adapter: AIToolAdapter = new ClaudeCodeAdapter();
      const result: DetectionResult = await adapter.detect('/project');

      expect(result.confidence).toBe(0);
    });
  });

  describe('parseConfig()', () => {
    test('extracts rules from CLAUDE.md', async () => {
      // Golden file test
      const config = await adapter.parseConfig('/fixtures/claude-code-project');

      expect(config.rules).toHaveLength(5);
      expect(config.rules[0].source).toBe('CLAUDE.md');
    });
  });

  // Additional contract tests...
});
```

### Future Extensibility Path

If community demand for extensibility grows, the recommended path is:

1. **MCP-based extensions** (already planned in ADR-0020)
   - Components can expose tools via MCP protocol
   - Users run extension as separate MCP server
   - agentlint connects to it like any MCP client
   - No code loading in agentlint process

2. **Contribution workflow**
   - Community contributes adapters/analyzers via PR
   - Core team reviews for quality and security
   - Merged contributions become compiled-in
   - This preserves quality control while enabling community input

---

## Consequences

### Positive
- No new abstraction layers added
- Existing interfaces remain stable
- Testing strategy clearly defined
- Security maintained (no plugins)
- Complexity controlled

### Negative
- Community cannot add extensions without core team review
- New AI tools/languages require release cycle

### Neutral
- Implicit P/R/A categorization documented but not enforced
- MCP extensibility deferred to future if needed

---

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | ✅ | No external plugin repositories |
| II. Improvement-Oriented | ✅ | Interface testing enables quality iteration |
| III. Causal-First | ✅ | Component boundaries don't affect tracing |
| IV. Mixed-Methods | ✅ | Both static (unit) and eval (LLM) testing |
| V. Language-Agnostic | ✅ | LanguageAnalyzer pattern unchanged |
| VI. Tool-Agnostic | ✅ | AIToolAdapter pattern unchanged |
| VII. Static-First | ✅ | Most testing is static (no LLM) |
| VIII. Progressive Value | ✅ | Works without any extensions |

---

## References

### Research Papers
- [Confucius Code Agent (CCA)](https://arxiv.org/html/2512.10398v1) - Extension system inspiration
- [AI Agent Architecture Survey](https://arxiv.org/html/2404.11584v1) - P/R/A patterns

### Industry Resources
- [AI Agent Architecture Patterns 2025](https://www.leanware.co/insights/ai-agent-architecture) - Best practices
- [VoltAgent Framework](https://voltagent.dev/) - TypeScript agent patterns
- [Modular Architecture Benefits](https://vfunction.com/blog/modular-software/) - Testing advantages

### Related ADRs
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md)
- [ADR-0013: Testing Strategy](./0013-testing-strategy.md)
- [ADR-0018: AI Tool Adapter Architecture](./0018-ai-tool-adapter-architecture.md)
- [ADR-0019: Language Ecosystem Support](./0019-language-ecosystem-support.md)

### Design Questions
- [Section 12.5: Extension/Modularity Pattern](../../design-questions.md#125-extensionmodularity-pattern)
