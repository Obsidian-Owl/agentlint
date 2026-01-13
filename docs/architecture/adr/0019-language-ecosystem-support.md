---
status: accepted
date: 2026-01-13
decision-makers: [CTO, Architecture Lead]
consulted: [Development Team]
informed: [All Contributors]
---

# ADR-0019: Language Ecosystem Support

## Context and Problem Statement

agentlint must analyze projects across multiple programming languages to extract code quality signals that affect AI coding assistant effectiveness. The constitution mandates Language-Agnostic operation (Principle V): core analysis must work regardless of programming language, with language-specific features as opt-in enhancements.

The CTO clarified that agentlint should be treated as a **"deep research" capability** - comprehensive analysis that runs in parallel with LLM phases, taking as long as needed for thorough results. This shifts the design from "fast surface metrics" to "full static analysis with intelligent parallelization."

### Deep Research Agentic Pattern Research

Research into how major AI providers implement "deep research" reveals common architectural patterns:

| Provider | Architecture | Key Features |
|----------|-------------|--------------|
| **OpenAI Deep Research** | Interactive Clarification | Asks follow-up questions before starting, multi-step planning, autonomously browses dozens of sources |
| **Google Gemini Deep Research** | Autonomous Planning | Creates research plan, async task manager for graceful error recovery, no user interaction during execution |
| **Claude Research Mode** | Lead Agent + Parallel Sub-agents | Orchestrator coordinates parallel sub-agents, each explores specific part of problem space, structured synthesis |

**Common Pattern**: **Orchestrator-Worker** architecture with:
1. Planning phase (break complex query into sub-tasks)
2. Parallel exploration (multiple workers investigating simultaneously)
3. Graceful error handling (failures don't stop entire research)
4. Structured synthesis (combine findings into coherent output)

This aligns with ADR-0011's orchestrator-worker pattern for agentic analysis, but specifically for language analysis, we adopt a **layered approach** where static analysis layers run in parallel with (not sequentially before) LLM analysis phases.

MVP languages are: TypeScript/JavaScript, Python, and Go.

## Decision Drivers

- **Language-Agnostic (V)**: Core analysis works without language-specific tooling
- **Comprehensive analysis**: Multiple analysis approaches run in parallel based on available tools
- **Compounding Value (VIII)**: Language patterns compound across sessions into richer recommendations
- **Deep Research Philosophy**: Comprehensive analysis running in parallel with LLM phases
- **Parallelization**: Language analysis should leverage ADR-0011's worker pool architecture
- **Maintainability**: Language analyzers follow same adapter pattern as AI tools (ADR-0018)

## Considered Options

### Parsing Strategy
1. Layered Approach (regex → tree-sitter → external tools)
2. Tree-sitter Primary (WASM-based for all languages)
3. External Tools Primary (invoke tsc, pylint, golangci-lint)

### Analysis Structure
1. Language Analyzer Interface (per-language implementations)
2. Single Universal Analyzer (one analyzer, language branching)
3. Separate Modules (no shared interface)

### Metrics Scope
1. Core Quality Signals (type coverage, complexity, imports)
2. Full Static Analysis (all metrics + linting + security)
3. Minimal Surface (file counts, line counts only)

## Decision Outcome

### Parsing Strategy: Layered Approach

Chosen because:
- Progressive enhancement: each layer adds depth without blocking
- Graceful degradation: works even if tree-sitter or external tools unavailable
- Parallelization: layers can run concurrently
- Fast analyses complete first; agent incorporates results as available

**Layer Architecture**:

> **Note**: Layers run in PARALLEL (not sequentially). The vertical layout is for readability only. See ADR-0011 for parallelization architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                    LAYERED ANALYSIS PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 1: Surface Metrics (Fast, No Dependencies)              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • File counts by extension                              │   │
│  │ • Line counts (code, comment, blank)                    │   │
│  │ • Import/require patterns (regex)                       │   │
│  │ • Function detection (regex heuristics)                 │   │
│  │ • Documentation presence (README, JSDoc, docstrings)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │ Always runs                        │
│                           ▼                                    │
│  LAYER 2: AST Analysis (tree-sitter WASM)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Function/class structure                              │   │
│  │ • Cyclomatic complexity                                 │   │
│  │ • Export/import graph                                   │   │
│  │ • Type annotation presence                              │   │
│  │ • Dead code detection                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │ Runs if tree-sitter available      │
│                           ▼                                    │
│  LAYER 3: Deep Analysis (External Tools)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Type coverage (type-coverage for TS)                  │   │
│  │ • Linting issues (ESLint, pylint, golangci-lint)        │   │
│  │ • Type errors (tsc, mypy)                               │   │
│  │ • Security patterns (optional)                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │ Runs if tools detected             │
│                           ▼                                    │
│  SYNTHESIS: Merge Metrics from All Layers                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Unified LanguageMetrics structure                     │   │
│  │ • Source attribution (which layer provided what)        │   │
│  │ • Confidence scores based on layer depth achieved       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Analysis Structure: Language Analyzer Interface

Chosen because:
- Consistent with ADR-0018's adapter pattern for AI tools
- Type-safe contracts between core and language-specific code
- Easy to add new languages without touching core
- Each analyzer can optimize for its language's characteristics

### Metrics Scope: Full Static Analysis

Chosen because:
- CTO directive: treat agentlint as "deep research" capability
- Comprehensive analysis provides more actionable recommendations
- Layers enable parallelization with LLM phases (per ADR-0011)
- External tool output (when available) is highly valuable

### Consequences

**Good:**
- Works on any language (Layer 1 always runs)
- Deeper analysis available when tools/parsers exist
- Parallelizable with LLM phases per deep research philosophy
- Follows established adapter pattern (consistency with ADR-0018)
- Progressive enhancement: better tools = better analysis

**Bad:**
- tree-sitter WASM is slower than native bindings in Node.js
- External tools require user to have them installed
- Full static analysis takes longer than surface metrics
- Maintaining three MVP language analyzers

**Neutral:**
- Layer depth varies per project based on available tooling
- Confidence scores reflect analysis completeness

## Detailed Design

### 1. Language Analyzer Interface

```typescript
/**
 * Interface for language-specific code analyzers.
 * Similar pattern to AIToolAdapter (ADR-0018).
 */
interface LanguageAnalyzer {
  /** Language identifier */
  readonly id: LanguageId;

  /** Human-readable name */
  readonly name: string;

  /** File extensions this analyzer handles */
  readonly extensions: string[];

  /**
   * Detect if this language is used in the project.
   * Returns file patterns and counts.
   */
  detect(projectPath: string): Promise<LanguageDetection>;

  /**
   * Run Layer 1: Surface metrics using regex/heuristics.
   * Always available, no external dependencies.
   */
  analyzeSurface(files: string[]): Promise<SurfaceMetrics>;

  /**
   * Run Layer 2: AST-based analysis using tree-sitter.
   * Returns null if tree-sitter not available for this language.
   */
  analyzeAST(files: string[]): Promise<ASTMetrics | null>;

  /**
   * Run Layer 3: Deep analysis using external tools.
   * Returns null if required tools not installed.
   */
  analyzeDeep(projectPath: string): Promise<DeepMetrics | null>;

  /**
   * Check which external tools are available.
   */
  detectTools(projectPath: string): Promise<ToolAvailability>;

  /**
   * Get language-specific recommendations based on metrics.
   */
  getRecommendations(metrics: LanguageMetrics): LanguageRecommendation[];
}

type LanguageId =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'unknown';

interface LanguageDetection {
  detected: boolean;
  fileCount: number;
  lineCount: number;
  patterns: string[];  // Matched file patterns
}
```

### 2. Metrics Structures

```typescript
/** Layer 1: Surface metrics (always available) */
interface SurfaceMetrics {
  layer: 1;

  files: {
    total: number;
    byExtension: Record<string, number>;
  };

  lines: {
    total: number;
    code: number;
    comment: number;
    blank: number;
  };

  imports: {
    count: number;
    external: string[];      // Package names
    internal: string[];      // Relative imports
    patterns: ImportPattern[];
  };

  functions: {
    estimated: number;       // Regex-based count
    avgLinesEstimate: number;
  };

  documentation: {
    hasReadme: boolean;
    hasContributing: boolean;
    inlineDocRatio: number;  // Files with docstrings/JSDoc
  };
}

/** Layer 2: AST metrics (tree-sitter) */
interface ASTMetrics {
  layer: 2;

  functions: {
    count: number;
    avgLines: number;
    maxLines: number;
    avgComplexity: number;   // Cyclomatic complexity
    maxComplexity: number;
  };

  classes: {
    count: number;
    avgMethods: number;
  };

  types: {
    annotationRatio: number;  // Functions with type annotations
    genericUsage: number;     // Generic type usage count
  };

  exports: {
    count: number;
    graph: ExportGraph;       // Module dependency graph
  };

  codeHealth: {
    duplicateRatio: number;   // Estimated duplication
    deadCodeEstimate: number; // Unused exports
  };
}

/** Layer 3: Deep metrics (external tools) */
interface DeepMetrics {
  layer: 3;

  typeCoverage?: {
    percentage: number;       // type-coverage result
    uncoveredIdentifiers: number;
    anyCount: number;
  };

  linting?: {
    errorCount: number;
    warningCount: number;
    byRule: Record<string, number>;
    fixableCount: number;
  };

  typeErrors?: {
    count: number;
    byCode: Record<string, number>;  // TS error codes
  };

  security?: {
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
  };
}

/** Combined metrics from all layers */
interface LanguageMetrics {
  languageId: LanguageId;
  projectPath: string;
  analyzedAt: Date;

  // Which layers completed
  layersCompleted: (1 | 2 | 3)[];
  confidence: number;  // 0-1 based on layer depth

  surface: SurfaceMetrics;
  ast: ASTMetrics | null;
  deep: DeepMetrics | null;

  // Tool availability for transparency
  toolsAvailable: ToolAvailability;
}

interface ToolAvailability {
  treeSitter: boolean;
  typeChecker: boolean;   // tsc, mypy, go vet
  linter: boolean;        // eslint, pylint, golangci-lint
  typeCoverage: boolean;  // type-coverage
}
```

### 3. Language Analyzer Factory

```typescript
class LanguageAnalyzerFactory {
  private analyzers: Map<LanguageId, LanguageAnalyzer> = new Map();

  constructor() {
    this.register(new TypeScriptAnalyzer());
    this.register(new PythonAnalyzer());
    this.register(new GoAnalyzer());
    this.register(new UnknownLanguageAnalyzer());
  }

  register(analyzer: LanguageAnalyzer): void {
    this.analyzers.set(analyzer.id, analyzer);
  }

  getForExtension(ext: string): LanguageAnalyzer {
    for (const analyzer of this.analyzers.values()) {
      if (analyzer.extensions.includes(ext)) {
        return analyzer;
      }
    }
    return this.analyzers.get('unknown')!;
  }

  /**
   * Detect all languages in a project.
   * Returns analyzers sorted by file count.
   */
  async detectAll(projectPath: string): Promise<DetectedLanguage[]> {
    const results: DetectedLanguage[] = [];

    for (const analyzer of this.analyzers.values()) {
      if (analyzer.id === 'unknown') continue;

      const detection = await analyzer.detect(projectPath);
      if (detection.detected) {
        results.push({ analyzer, detection });
      }
    }

    return results.sort((a, b) => b.detection.fileCount - a.detection.fileCount);
  }
}
```

### 4. Parallel Analysis Orchestration

```typescript
/**
 * Orchestrates language analysis in parallel with LLM phases.
 * Implements "deep research" philosophy per CTO directive.
 */
class LanguageAnalysisOrchestrator {
  private factory: LanguageAnalyzerFactory;
  private workerPool: WorkerPool;  // From ADR-0011

  /**
   * Run full language analysis.
   * Designed to run in parallel with LLM subagents.
   */
  async analyze(
    projectPath: string,
    options: AnalysisOptions
  ): Promise<LanguageAnalysisResult> {
    // 1. Detect languages
    const detected = await this.factory.detectAll(projectPath);

    // 2. Run all layers in parallel per language
    const results = await Promise.all(
      detected.map(({ analyzer }) =>
        this.analyzeLanguage(projectPath, analyzer, options)
      )
    );

    // 3. Merge into unified result
    return {
      languages: results,
      summary: this.summarize(results),
      recommendations: this.consolidateRecommendations(results),
    };
  }

  private async analyzeLanguage(
    projectPath: string,
    analyzer: LanguageAnalyzer,
    options: AnalysisOptions
  ): Promise<LanguageMetrics> {
    // Get files for this language
    const files = await this.getFilesForLanguage(projectPath, analyzer);

    // Run all layers in parallel
    const [surface, ast, deep, tools] = await Promise.all([
      analyzer.analyzeSurface(files),
      analyzer.analyzeAST(files),
      analyzer.analyzeDeep(projectPath),
      analyzer.detectTools(projectPath),
    ]);

    // Determine which layers completed
    const layersCompleted: (1 | 2 | 3)[] = [1];
    if (ast) layersCompleted.push(2);
    if (deep) layersCompleted.push(3);

    // Calculate confidence based on layers
    const confidence = layersCompleted.length / 3;

    return {
      languageId: analyzer.id,
      projectPath,
      analyzedAt: new Date(),
      layersCompleted,
      confidence,
      surface,
      ast,
      deep,
      toolsAvailable: tools,
    };
  }

  /**
   * Stream results as layers complete.
   * Allows UI to show progress incrementally.
   */
  async *analyzeStreaming(
    projectPath: string,
    options: AnalysisOptions
  ): AsyncIterable<LayerResult> {
    const detected = await this.factory.detectAll(projectPath);

    for (const { analyzer } of detected) {
      const files = await this.getFilesForLanguage(projectPath, analyzer);

      // Yield Layer 1 immediately
      const surface = await analyzer.analyzeSurface(files);
      yield { languageId: analyzer.id, layer: 1, metrics: surface };

      // Yield Layer 2 if available
      const ast = await analyzer.analyzeAST(files);
      if (ast) {
        yield { languageId: analyzer.id, layer: 2, metrics: ast };
      }

      // Yield Layer 3 if available
      const deep = await analyzer.analyzeDeep(projectPath);
      if (deep) {
        yield { languageId: analyzer.id, layer: 3, metrics: deep };
      }
    }
  }
}
```

### 5. TypeScript Analyzer Implementation

```typescript
class TypeScriptAnalyzer implements LanguageAnalyzer {
  readonly id = 'typescript' as const;
  readonly name = 'TypeScript';
  readonly extensions = ['.ts', '.tsx', '.mts', '.cts'];

  private treeSitterParser?: Parser;

  async detect(projectPath: string): Promise<LanguageDetection> {
    const patterns = ['**/*.ts', '**/*.tsx'];
    const files = await glob(patterns, {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    if (files.length === 0) {
      return { detected: false, fileCount: 0, lineCount: 0, patterns: [] };
    }

    const lineCount = await this.countLines(files.map(f => path.join(projectPath, f)));

    return {
      detected: true,
      fileCount: files.length,
      lineCount,
      patterns,
    };
  }

  async analyzeSurface(files: string[]): Promise<SurfaceMetrics> {
    const byExtension: Record<string, number> = {};
    let totalLines = 0, codeLines = 0, commentLines = 0, blankLines = 0;
    const externalImports = new Set<string>();
    const internalImports = new Set<string>();
    let functionCount = 0;
    let filesWithDocs = 0;

    for (const file of files) {
      const ext = path.extname(file);
      byExtension[ext] = (byExtension[ext] ?? 0) + 1;

      const content = await Bun.file(file).text();
      const lines = content.split('\n');

      for (const line of lines) {
        totalLines++;
        const trimmed = line.trim();
        if (trimmed === '') blankLines++;
        else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          commentLines++;
        } else {
          codeLines++;
        }

        // Regex-based import detection
        const importMatch = trimmed.match(/^import .* from ['"](.+)['"]/);
        if (importMatch) {
          const pkg = importMatch[1];
          if (pkg.startsWith('.') || pkg.startsWith('/')) {
            internalImports.add(pkg);
          } else {
            externalImports.add(pkg.split('/')[0]);
          }
        }

        // Regex-based function detection
        if (/^(export\s+)?(async\s+)?function\s+\w+/.test(trimmed) ||
            /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?(\([^)]*\)|[a-zA-Z_]\w*)\s*=>/.test(trimmed)) {
          functionCount++;
        }
      }

      // Check for JSDoc
      if (content.includes('/**') && content.includes('*/')) {
        filesWithDocs++;
      }
    }

    return {
      layer: 1,
      files: { total: files.length, byExtension },
      lines: { total: totalLines, code: codeLines, comment: commentLines, blank: blankLines },
      imports: {
        count: externalImports.size + internalImports.size,
        external: [...externalImports],
        internal: [...internalImports],
        patterns: [],
      },
      functions: {
        estimated: functionCount,
        avgLinesEstimate: codeLines / Math.max(functionCount, 1),
      },
      documentation: {
        hasReadme: await this.hasFile(path.dirname(files[0]), 'README.md'),
        hasContributing: await this.hasFile(path.dirname(files[0]), 'CONTRIBUTING.md'),
        inlineDocRatio: filesWithDocs / files.length,
      },
    };
  }

  async analyzeAST(files: string[]): Promise<ASTMetrics | null> {
    if (!this.treeSitterParser) {
      try {
        await this.initTreeSitter();
      } catch {
        return null;  // tree-sitter not available
      }
    }

    let functionCount = 0;
    let totalFunctionLines = 0;
    let maxFunctionLines = 0;
    let totalComplexity = 0;
    let maxComplexity = 0;
    let classCount = 0;
    let totalMethods = 0;
    let typeAnnotationCount = 0;
    let functionWithoutAnnotation = 0;
    let exportCount = 0;

    for (const file of files) {
      const content = await Bun.file(file).text();
      const tree = this.treeSitterParser!.parse(content);

      // Query for functions
      const functionQuery = new Query(
        this.treeSitterParser!.language,
        '(function_declaration) @func'
      );
      const functions = functionQuery.matches(tree.rootNode);

      for (const match of functions) {
        const node = match.captures[0].node;
        functionCount++;
        const lines = node.endPosition.row - node.startPosition.row + 1;
        totalFunctionLines += lines;
        if (lines > maxFunctionLines) maxFunctionLines = lines;

        // Calculate cyclomatic complexity
        const complexity = this.calculateComplexity(node);
        totalComplexity += complexity;
        if (complexity > maxComplexity) maxComplexity = complexity;

        // Check for return type annotation
        const returnType = node.childForFieldName('return_type');
        if (returnType) typeAnnotationCount++;
        else functionWithoutAnnotation++;
      }

      // Query for classes
      const classQuery = new Query(
        this.treeSitterParser!.language,
        '(class_declaration) @class'
      );
      const classes = classQuery.matches(tree.rootNode);
      classCount += classes.length;
      for (const match of classes) {
        const classNode = match.captures[0].node;
        const methods = classNode.descendantsOfType('method_definition');
        totalMethods += methods.length;
      }

      // Query for exports
      const exportQuery = new Query(
        this.treeSitterParser!.language,
        '(export_statement) @export'
      );
      exportCount += exportQuery.matches(tree.rootNode).length;
    }

    const totalFunctions = functionCount || 1;

    return {
      layer: 2,
      functions: {
        count: functionCount,
        avgLines: totalFunctionLines / totalFunctions,
        maxLines: maxFunctionLines,
        avgComplexity: totalComplexity / totalFunctions,
        maxComplexity,
      },
      classes: {
        count: classCount,
        avgMethods: totalMethods / Math.max(classCount, 1),
      },
      types: {
        annotationRatio: typeAnnotationCount / (typeAnnotationCount + functionWithoutAnnotation),
        genericUsage: 0,  // TODO: implement
      },
      exports: {
        count: exportCount,
        graph: { nodes: [], edges: [] },  // TODO: implement full graph
      },
      codeHealth: {
        duplicateRatio: 0,  // TODO: implement
        deadCodeEstimate: 0,  // TODO: implement
      },
    };
  }

  async analyzeDeep(projectPath: string): Promise<DeepMetrics | null> {
    const tools = await this.detectTools(projectPath);

    if (!tools.typeChecker && !tools.linter && !tools.typeCoverage) {
      return null;  // No deep tools available
    }

    const result: DeepMetrics = { layer: 3 };

    // Type coverage (if type-coverage is available)
    if (tools.typeCoverage) {
      try {
        const { lint } = await import('type-coverage-core');
        const coverage = await lint(projectPath, { strict: true });
        result.typeCoverage = {
          percentage: coverage.correctCount / coverage.totalCount * 100,
          uncoveredIdentifiers: coverage.totalCount - coverage.correctCount,
          anyCount: coverage.anys?.length ?? 0,
        };
      } catch {
        // type-coverage failed
      }
    }

    // ESLint (if available)
    if (tools.linter) {
      try {
        const eslintOutput = await this.runCommand(
          'npx eslint . --format json',
          projectPath
        );
        const results = JSON.parse(eslintOutput);
        let errors = 0, warnings = 0, fixable = 0;
        const byRule: Record<string, number> = {};

        for (const file of results) {
          for (const msg of file.messages) {
            if (msg.severity === 2) errors++;
            else warnings++;
            if (msg.fix) fixable++;
            byRule[msg.ruleId] = (byRule[msg.ruleId] ?? 0) + 1;
          }
        }

        result.linting = { errorCount: errors, warningCount: warnings, byRule, fixableCount: fixable };
      } catch {
        // ESLint not available or failed
      }
    }

    // TypeScript errors (if tsc available)
    if (tools.typeChecker) {
      try {
        const tscOutput = await this.runCommand(
          'npx tsc --noEmit --pretty false 2>&1 || true',
          projectPath
        );
        const errorLines = tscOutput.split('\n').filter(l => l.includes('error TS'));
        const byCode: Record<string, number> = {};

        for (const line of errorLines) {
          const match = line.match(/error (TS\d+)/);
          if (match) {
            byCode[match[1]] = (byCode[match[1]] ?? 0) + 1;
          }
        }

        result.typeErrors = {
          count: errorLines.length,
          byCode,
        };
      } catch {
        // tsc not available or failed
      }
    }

    return Object.keys(result).length > 1 ? result : null;
  }

  async detectTools(projectPath: string): Promise<ToolAvailability> {
    const [treeSitter, typeChecker, linter, typeCoverage] = await Promise.all([
      this.checkTreeSitter(),
      this.commandExists('npx tsc --version', projectPath),
      this.commandExists('npx eslint --version', projectPath),
      this.commandExists('npx type-coverage --version', projectPath),
    ]);

    return { treeSitter, typeChecker, linter, typeCoverage };
  }

  getRecommendations(metrics: LanguageMetrics): LanguageRecommendation[] {
    const recommendations: LanguageRecommendation[] = [];

    // Type coverage recommendations
    if (metrics.deep?.typeCoverage) {
      if (metrics.deep.typeCoverage.percentage < 80) {
        recommendations.push({
          category: 'types',
          severity: 'warning',
          title: 'Low Type Coverage',
          description: `Type coverage is ${metrics.deep.typeCoverage.percentage.toFixed(1)}%. Consider adding type annotations to improve AI assistant accuracy.`,
          impact: 'AI assistants produce better code when types are explicit.',
        });
      }
    }

    // Complexity recommendations
    if (metrics.ast?.functions.maxComplexity > 10) {
      recommendations.push({
        category: 'complexity',
        severity: 'info',
        title: 'High Function Complexity',
        description: `Some functions have cyclomatic complexity > 10. Consider refactoring for AI readability.`,
        impact: 'Simpler functions are easier for AI assistants to understand and modify.',
      });
    }

    // Linting recommendations
    if (metrics.deep?.linting && metrics.deep.linting.errorCount > 0) {
      recommendations.push({
        category: 'quality',
        severity: 'error',
        title: 'Linting Errors Present',
        description: `${metrics.deep.linting.errorCount} ESLint errors. AI assistants may reproduce these patterns.`,
        impact: 'Clean code prevents AI from learning bad patterns.',
      });
    }

    return recommendations;
  }

  private async initTreeSitter(): Promise<void> {
    const Parser = (await import('web-tree-sitter')).default;
    await Parser.init();
    this.treeSitterParser = new Parser();
    const lang = await Parser.Language.load('node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm');
    this.treeSitterParser.setLanguage(lang);
  }

  private calculateComplexity(node: SyntaxNode): number {
    // Count decision points for cyclomatic complexity
    let complexity = 1;  // Base complexity
    const decisionTypes = [
      'if_statement', 'else_clause', 'for_statement', 'while_statement',
      'do_statement', 'switch_case', 'catch_clause', 'ternary_expression',
      '&&', '||', '??',
    ];

    const walk = (n: SyntaxNode) => {
      if (decisionTypes.includes(n.type)) complexity++;
      for (const child of n.children) walk(child);
    };
    walk(node);

    return complexity;
  }

  // ... helper methods
}
```

### 6. Integration with Deep Research Pattern

Per CTO directive, agentlint operates as a "deep research" capability. Research into OpenAI, Gemini, and Claude's deep research implementations reveals common patterns we adopt:

```typescript
/**
 * Deep Research Coordinator for Language Analysis.
 *
 * Implements the Orchestrator-Worker pattern discovered in deep research:
 * - OpenAI: Interactive clarification → multi-step planning
 * - Gemini: Autonomous planning with async task manager
 * - Claude: Lead agent + parallel sub-agents
 *
 * For language analysis, we use the Claude model:
 * Lead orchestrator coordinates parallel sub-agents for each analysis domain.
 */
class DeepResearchCoordinator {
  private languageOrchestrator: LanguageAnalysisOrchestrator;
  private agentFactory: AnalysisAgentFactory;  // From ADR-0018

  /**
   * Run comprehensive analysis: language + LLM in parallel.
   *
   * Key insight from deep research patterns:
   * - Tools and agent reasoning run CONCURRENTLY as equal partners
   * - Neither is privileged over the other (Principle VII)
   * - Results stream as they complete
   * - Failures in one track don't block the other
   */
  async runDeepAnalysis(projectPath: string): Promise<DeepAnalysisResult> {
    // PARALLEL EXPLORATION (deep research pattern)
    // Language analysis and agentic analysis run simultaneously
    const [languageResult, agenticResult] = await Promise.allSettled([
      this.languageOrchestrator.analyze(projectPath, {}),
      this.runAgenticAnalysis(projectPath),
    ]);

    // GRACEFUL ERROR HANDLING (Gemini async task manager pattern)
    // Failures don't stop entire research
    const language = languageResult.status === 'fulfilled'
      ? languageResult.value
      : this.createDegradedLanguageResult(languageResult.reason);

    const agentic = agenticResult.status === 'fulfilled'
      ? agenticResult.value
      : this.createDegradedAgenticResult(agenticResult.reason);

    // STRUCTURED SYNTHESIS (common deep research pattern)
    return {
      language,
      agentic,
      combined: this.mergeInsights(language, agentic),
      completeness: this.calculateCompleteness(languageResult, agenticResult),
    };
  }

  /**
   * Stream results as they complete.
   *
   * Implements progressive disclosure pattern:
   * 1. Language Layer 1 (Surface) - FASTEST, arrives first
   * 2. Language Layer 2 (AST) - moderate speed
   * 3. LLM analysis chunks - as they complete
   * 4. Language Layer 3 (Deep/External tools) - slowest static
   * 5. Final synthesis - combines all streams
   */
  async *streamDeepAnalysis(
    projectPath: string
  ): AsyncIterable<AnalysisUpdate> {
    // PARALLEL EXPLORATION with interleaved streaming
    const languageStream = this.languageOrchestrator.analyzeStreaming(projectPath, {});
    const agenticStream = this.streamAgenticAnalysis(projectPath);

    // Interleave results as they arrive (race pattern)
    yield* this.interleaveStreams(languageStream, agenticStream);
  }

  /**
   * Agentic analysis follows Claude's lead agent + sub-agent pattern.
   * Per ADR-0011, up to 5 subagents run in parallel.
   */
  private async runAgenticAnalysis(projectPath: string): Promise<AgenticResult> {
    const profile = this.agentFactory.getAgentProfile();

    // SUB-AGENT PARALLEL EXPLORATION (Claude deep research pattern)
    const subAgentResults = await Promise.allSettled([
      this.runSubAgent('config-analyzer', projectPath, profile),
      this.runSubAgent('session-analyzer', projectPath, profile),
      this.runSubAgent('docs-analyzer', projectPath, profile),
      this.runSubAgent('code-patterns', projectPath, profile),
      this.runSubAgent('cross-reference', projectPath, profile),
    ]);

    // Synthesis: combine sub-agent findings
    return this.synthesizeSubAgentResults(subAgentResults);
  }
}
```

## Constitution Compliance

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Local-First | Yes | All analysis runs locally; no data leaves machine |
| II. Improvement-Oriented | Yes | Metrics support baseline comparison over time |
| III. Causal-First | Partial | Language metrics inform but don't directly trace issues |
| IV. Mixed-Methods | Yes | Quantitative metrics + LLM qualitative analysis |
| V. Language-Agnostic | Yes | Core design; Layer 1 works for any language |
| VI. Tool-Agnostic | N/A | Language analysis is AI-tool-independent |
| VII. Intelligent Tooling | Yes | Multiple analysis approaches run in parallel; agent synthesizes all |
| VIII. Compounding Value | Yes | Language analysis history compounds into richer recommendations |
| IX. Agent-Aware | Yes | Language metrics compressed for agent context |

## More Information

### Related Documents
- [ADR-0011: Parallel Processing Architecture](./0011-parallel-processing-architecture.md) - Worker pool for parallel analysis
- [ADR-0018: AI Tool Adapter Architecture](./0018-ai-tool-adapter-architecture.md) - Adapter pattern this follows
- Design Questions: [Section 5.2 - Language Ecosystem Support](../../design-questions.md#52-language-ecosystem-support)

### Research Sources

#### Language Analysis
- [web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter) - WASM-based multi-language parsing
- [tree-sitter TypeScript](https://github.com/tree-sitter/tree-sitter-typescript) - TypeScript grammar
- [TypeScript Parser Benchmarks](https://medium.com/@hchan_nvim/benchmark-typescript-parsers-demystify-rust-tooling-performance-025ebfd391a3) - tree-sitter vs swc
- [type-coverage](https://github.com/plantain-00/type-coverage) - TypeScript type coverage tool
- [golangci-lint CLI](https://golangci-lint.run/docs/configuration/cli/) - Go linter with JSON output
- [srclib](https://srclib.org/) - Multi-language code analysis platform

#### Deep Research Agentic Patterns
- **OpenAI Deep Research**: Interactive clarification approach, asks follow-up questions before starting research, then multi-step autonomous planning browsing dozens of sources
- **Google Gemini Deep Research**: Autonomous multi-step planning with async task manager for graceful error recovery, fully autonomous once started (no user interaction during execution)
- **Claude Research Mode**: Lead agent orchestrates parallel sub-agents, each explores specific part of problem space with structured synthesis
- **Common Pattern**: Orchestrator-Worker architecture with planning phase, parallel exploration, graceful error handling, and structured synthesis

### Implementation Notes

#### MVP Language Analyzers

| Language | Layer 1 | Layer 2 | Layer 3 Tools |
|----------|---------|---------|---------------|
| TypeScript | Regex patterns | tree-sitter-typescript | tsc, eslint, type-coverage |
| Python | Regex patterns | tree-sitter-python | mypy, pylint, ruff |
| Go | Regex patterns | tree-sitter-go | go vet, golangci-lint |

#### Tree-sitter WASM Files Required

```
node_modules/
├── tree-sitter-typescript/tree-sitter-typescript.wasm
├── tree-sitter-tsx/tree-sitter-tsx.wasm
├── tree-sitter-python/tree-sitter-python.wasm
└── tree-sitter-go/tree-sitter-go.wasm
```

#### Follow-Up Decisions

1. **WASM Performance**: Should we use native tree-sitter bindings in Node.js for better performance?
2. **Tool Detection Caching**: Cache tool availability results per project?
3. **Incremental Analysis**: Use tree-sitter's incremental parsing for watch mode?
