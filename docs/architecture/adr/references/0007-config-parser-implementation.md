# ADR-0007 Reference: Configuration Parser Implementation

> Implementation details for [ADR-0007: Configuration Parser Design](../0007-configuration-parser-design.md)

---

## Package Dependencies

```bash
bun add unified remark-parse remark-frontmatter remark-gfm unist-util-visit
bun add -D @types/mdast
```

---

## Adapter Interface

```typescript
import type { Root } from 'mdast';

// Supported AI Coding Tool types
type ACTType = 'claude-code' | 'cursor' | 'windsurf' | 'copilot' | 'cline' | 'aider' | 'generic';

interface ConfigAdapter {
  readonly actType: ACTType;

  // Check if this adapter handles the given file
  canParse(filePath: string): boolean;

  // Parse content into normalized config
  parse(content: string, options?: ParseOptions): Promise<NormalizedConfig>;

  // ACT-specific quality thresholds
  getThresholds(): QualityThresholds;
}

interface ParseOptions {
  filePath?: string;           // For context in warnings
  includeAst?: boolean;        // Include raw AST in output
  validateReferences?: boolean; // Check file:line references exist
}

interface QualityThresholds {
  maxLines: number;            // Warning threshold
  maxTokens: number;           // Warning threshold
  recommendedLines: number;    // Info threshold
  recommendedTokens: number;   // Info threshold
}
```

---

## Normalized Config Schema

```typescript
interface NormalizedConfig {
  actType: ACTType;
  sourcePath: string;

  // === SIZE METRICS ===
  metrics: {
    lineCount: number;
    tokenEstimate: number;
    characterCount: number;
    codeBlockCount: number;
    codeBlockLines: number;
    weightClass: 'lightweight' | 'medium' | 'heavy';  // <3k, 3-15k, >25k tokens
  };

  // === STRUCTURE ANALYSIS ===
  structure: {
    sections: Section[];
    headingDepthDistribution: Record<number, number>;
    hasWhatSection: boolean;      // Tech stack/structure coverage
    hasWhySection: boolean;       // Purpose/goals coverage
    hasHowSection: boolean;       // Commands/workflows coverage
    delimiterStyle: 'xml' | 'markdown' | 'mixed' | 'none';
    nestedConfigPaths: string[];  // References to child configs
  };

  // === CONTENT QUALITY ===
  content: {
    // Essential coverage detection
    hasBuildCommands: boolean;
    hasTestCommands: boolean;
    hasCodeStyleGuidance: boolean;
    hasArchitectureNotes: boolean;
    hasErrorHandling: boolean;
    hasEnvironmentSetup: boolean;
    hasRepoEtiquette: boolean;

    // Quality indicators
    fileLineReferences: FileReference[];
    exampleCount: number;
    ruleCount: number;
    exampleToRuleRatio: number;

    // Agent optimization signals
    emphasisMarkers: EmphasisMarker[];
    progressiveDisclosureRefs: string[];
    slashCommandCount: number;
  };

  // === WARNINGS ===
  warnings: Warning[];

  // === RAW AST (optional) ===
  ast?: Root;
}

interface Section {
  heading: string;
  level: number;
  lineStart: number;
  lineEnd: number;
  tokenEstimate: number;
  childSections: Section[];
}

interface FileReference {
  path: string;
  line?: number;
  sourceLocation: { line: number; column?: number };
}

interface EmphasisMarker {
  type: 'IMPORTANT' | 'MUST' | 'NEVER' | 'ALWAYS' | 'YOU MUST' | 'DO NOT';
  context: string;
  line: number;
}

interface Warning {
  type: WarningType;
  severity: 'info' | 'warning' | 'error';
  message: string;
  location?: { line: number; column?: number };
  suggestion?: string;
}

type WarningType =
  | 'size_exceeds_recommended'
  | 'size_exceeds_maximum'
  | 'token_weight_heavy'
  | 'generic_rule_detected'
  | 'embedded_code_snippet'
  | 'potential_secret'
  | 'missing_essential_section'
  | 'excessive_slash_commands'
  | 'linter_job_detected'
  | 'duplicate_content'
  | 'no_file_references'
  | 'instruction_overload'
  | 'no_test_commands'
  | 'no_build_commands';
```

---

## Claude Code Adapter

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Code, Text, Link } from 'mdast';

export class ClaudeCodeAdapter implements ConfigAdapter {
  readonly actType = 'claude-code' as const;

  private parser = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm);

  canParse(filePath: string): boolean {
    const filename = path.basename(filePath).toUpperCase();
    return filename === 'CLAUDE.MD' || filename === 'CLAUDE.LOCAL.MD';
  }

  getThresholds(): QualityThresholds {
    return {
      recommendedLines: 60,    // HumanLayer recommendation
      maxLines: 300,           // General consensus
      recommendedTokens: 3000, // Lightweight agent
      maxTokens: 15000,        // Medium agent threshold
    };
  }

  async parse(content: string, options: ParseOptions = {}): Promise<NormalizedConfig> {
    const ast = this.parser.parse(content) as Root;

    const metrics = this.extractMetrics(content, ast);
    const structure = this.extractStructure(ast);
    const contentAnalysis = this.extractContent(ast);
    const warnings = this.detectWarnings(metrics, structure, contentAnalysis, this.getThresholds());

    return {
      actType: this.actType,
      sourcePath: options.filePath || '',
      metrics,
      structure,
      content: contentAnalysis,
      warnings,
      ast: options.includeAst ? ast : undefined,
    };
  }

  private extractMetrics(content: string, ast: Root): NormalizedConfig['metrics'] {
    const lines = content.split('\n');
    let codeBlockCount = 0;
    let codeBlockLines = 0;

    visit(ast, 'code', (node: Code) => {
      codeBlockCount++;
      codeBlockLines += (node.value.match(/\n/g) || []).length + 1;
    });

    // Rough token estimate: ~4 chars per token for English text
    const tokenEstimate = Math.ceil(content.length / 4);

    return {
      lineCount: lines.length,
      tokenEstimate,
      characterCount: content.length,
      codeBlockCount,
      codeBlockLines,
      weightClass: tokenEstimate < 3000 ? 'lightweight'
                 : tokenEstimate < 15000 ? 'medium'
                 : 'heavy',
    };
  }

  private extractStructure(ast: Root): NormalizedConfig['structure'] {
    const sections: Section[] = [];
    const headingDepthDistribution: Record<number, number> = {};
    const nestedConfigPaths: string[] = [];

    let currentSection: Section | null = null;

    visit(ast, 'heading', (node: Heading) => {
      headingDepthDistribution[node.depth] = (headingDepthDistribution[node.depth] || 0) + 1;

      const headingText = this.getTextContent(node);
      const lineStart = node.position?.start.line || 0;

      // Close previous section
      if (currentSection) {
        currentSection.lineEnd = lineStart - 1;
      }

      currentSection = {
        heading: headingText,
        level: node.depth,
        lineStart,
        lineEnd: 0,
        tokenEstimate: 0,
        childSections: [],
      };
      sections.push(currentSection);
    });

    // Close last section
    if (currentSection) {
      currentSection.lineEnd = ast.position?.end.line || 0;
    }

    // Detect nested config references
    visit(ast, 'link', (node: Link) => {
      if (node.url.includes('CLAUDE.md') || node.url.includes('claude.md')) {
        nestedConfigPaths.push(node.url);
      }
    });

    const sectionHeadings = sections.map(s => s.heading.toLowerCase());

    return {
      sections,
      headingDepthDistribution,
      hasWhatSection: this.detectWhatSection(sectionHeadings),
      hasWhySection: this.detectWhySection(sectionHeadings),
      hasHowSection: this.detectHowSection(sectionHeadings),
      delimiterStyle: this.detectDelimiterStyle(ast),
      nestedConfigPaths,
    };
  }

  private extractContent(ast: Root): NormalizedConfig['content'] {
    const fileLineReferences: FileReference[] = [];
    const emphasisMarkers: EmphasisMarker[] = [];
    const progressiveDisclosureRefs: string[] = [];
    let exampleCount = 0;
    let ruleCount = 0;
    let slashCommandCount = 0;

    const fileLinePattern = /([a-zA-Z0-9_\-./]+):(\d+)/g;
    const emphasisPatterns = /\b(IMPORTANT|MUST|NEVER|ALWAYS|YOU MUST|DO NOT)\b/gi;
    const slashCommandPattern = /\/[a-z]+/g;

    let fullText = '';

    visit(ast, 'text', (node: Text) => {
      fullText += node.value + ' ';
      const line = node.position?.start.line || 0;

      // Extract file:line references
      let match;
      while ((match = fileLinePattern.exec(node.value)) !== null) {
        fileLineReferences.push({
          path: match[1],
          line: parseInt(match[2], 10),
          sourceLocation: { line },
        });
      }

      // Extract emphasis markers
      while ((match = emphasisPatterns.exec(node.value)) !== null) {
        emphasisMarkers.push({
          type: match[1].toUpperCase() as EmphasisMarker['type'],
          context: node.value.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          line,
        });
      }

      // Count slash commands
      const slashMatches = node.value.match(slashCommandPattern);
      if (slashMatches) {
        slashCommandCount += slashMatches.length;
      }
    });

    // Detect progressive disclosure
    visit(ast, 'link', (node: Link) => {
      if (node.url.includes('agent_docs') || node.url.includes('docs/') || node.url.endsWith('.md')) {
        progressiveDisclosureRefs.push(node.url);
      }
    });

    // Count code blocks as examples
    visit(ast, 'code', () => exampleCount++);

    // Estimate rule count from list items
    visit(ast, 'listItem', () => ruleCount++);

    return {
      hasBuildCommands: this.detectBuildCommands(fullText),
      hasTestCommands: this.detectTestCommands(fullText),
      hasCodeStyleGuidance: this.detectCodeStyle(fullText),
      hasArchitectureNotes: this.detectArchitecture(fullText),
      hasErrorHandling: this.detectErrorHandling(fullText),
      hasEnvironmentSetup: this.detectEnvironmentSetup(fullText),
      hasRepoEtiquette: this.detectRepoEtiquette(fullText),
      fileLineReferences,
      exampleCount,
      ruleCount,
      exampleToRuleRatio: ruleCount > 0 ? exampleCount / ruleCount : 0,
      emphasisMarkers,
      progressiveDisclosureRefs,
      slashCommandCount,
    };
  }

  private detectWarnings(
    metrics: NormalizedConfig['metrics'],
    structure: NormalizedConfig['structure'],
    content: NormalizedConfig['content'],
    thresholds: QualityThresholds
  ): Warning[] {
    const warnings: Warning[] = [];

    // Size warnings
    if (metrics.lineCount > thresholds.maxLines) {
      warnings.push({
        type: 'size_exceeds_maximum',
        severity: 'warning',
        message: `File has ${metrics.lineCount} lines (recommended max: ${thresholds.maxLines})`,
        suggestion: 'Consider splitting into hierarchical CLAUDE.md files or using progressive disclosure',
      });
    } else if (metrics.lineCount > thresholds.recommendedLines) {
      warnings.push({
        type: 'size_exceeds_recommended',
        severity: 'info',
        message: `File has ${metrics.lineCount} lines (recommended: <${thresholds.recommendedLines})`,
        suggestion: 'Keep instructions universally applicable; move specifics to task-scoped docs',
      });
    }

    // Token weight warning
    if (metrics.weightClass === 'heavy') {
      warnings.push({
        type: 'token_weight_heavy',
        severity: 'warning',
        message: `Estimated ${metrics.tokenEstimate} tokens creates a "heavy" agent (>25k tokens)`,
        suggestion: 'Heavy configs slow multi-agent workflows. Consider reducing to <15k tokens.',
      });
    }

    // Missing essentials
    if (!content.hasTestCommands) {
      warnings.push({
        type: 'no_test_commands',
        severity: 'info',
        message: 'No test commands detected',
        suggestion: 'Add test commands (npm test, pytest, etc.) to enable TDD workflows',
      });
    }

    if (!content.hasBuildCommands) {
      warnings.push({
        type: 'no_build_commands',
        severity: 'info',
        message: 'No build commands detected',
        suggestion: 'Add build commands to help the agent verify changes compile',
      });
    }

    // Excessive slash commands
    if (content.slashCommandCount > 5) {
      warnings.push({
        type: 'excessive_slash_commands',
        severity: 'info',
        message: `Found ${content.slashCommandCount} slash commands`,
        suggestion: 'Many custom slash commands may indicate over-engineering.',
      });
    }

    // Instruction overload
    if (content.ruleCount > 200) {
      warnings.push({
        type: 'instruction_overload',
        severity: 'warning',
        message: `Found ~${content.ruleCount} instructions (frontier models reliably follow ~150-200)`,
        suggestion: 'Reduce instructions to most critical. Agent may ignore excess.',
      });
    }

    return warnings;
  }

  // Helper detection methods
  private getTextContent(node: Heading): string {
    let text = '';
    visit(node, 'text', (textNode: Text) => { text += textNode.value; });
    return text;
  }

  private detectWhatSection(headings: string[]): boolean {
    const patterns = ['stack', 'structure', 'architecture', 'overview', 'about', 'technology'];
    return headings.some(h => patterns.some(p => h.includes(p)));
  }

  private detectWhySection(headings: string[]): boolean {
    const patterns = ['purpose', 'goal', 'why', 'motivation', 'context', 'background'];
    return headings.some(h => patterns.some(p => h.includes(p)));
  }

  private detectHowSection(headings: string[]): boolean {
    const patterns = ['command', 'workflow', 'usage', 'how', 'getting started', 'setup', 'build', 'test'];
    return headings.some(h => patterns.some(p => h.includes(p)));
  }

  private detectDelimiterStyle(ast: Root): 'xml' | 'markdown' | 'mixed' | 'none' {
    let hasXml = false;
    let hasMarkdown = false;
    visit(ast, 'text', (node: Text) => {
      if (/<[a-z]+>|<\/[a-z]+>/i.test(node.value)) hasXml = true;
    });
    visit(ast, 'heading', () => { hasMarkdown = true; });
    if (hasXml && hasMarkdown) return 'mixed';
    if (hasXml) return 'xml';
    if (hasMarkdown) return 'markdown';
    return 'none';
  }

  private detectBuildCommands(text: string): boolean {
    return /\b(npm run build|yarn build|bun build|make|cargo build|go build)\b/i.test(text);
  }

  private detectTestCommands(text: string): boolean {
    return /\b(npm test|yarn test|bun test|pytest|jest|vitest|go test|cargo test)\b/i.test(text);
  }

  private detectCodeStyle(text: string): boolean {
    return /\b(style|naming|convention|camelCase|snake_case|format|lint)\b/i.test(text);
  }

  private detectArchitecture(text: string): boolean {
    return /\b(architecture|structure|directory|folder|layout|organization)\b/i.test(text);
  }

  private detectErrorHandling(text: string): boolean {
    return /\b(error|exception|handling|catch|throw|fail)\b/i.test(text);
  }

  private detectEnvironmentSetup(text: string): boolean {
    return /\b(environment|setup|install|prerequisite|dependency|version)\b/i.test(text);
  }

  private detectRepoEtiquette(text: string): boolean {
    return /\b(branch|commit|merge|rebase|PR|pull request|git)\b/i.test(text);
  }
}
```

---

## Adapter Registry

```typescript
class ConfigAdapterRegistry {
  private adapters: ConfigAdapter[] = [];

  register(adapter: ConfigAdapter): void {
    this.adapters.push(adapter);
  }

  getAdapter(filePath: string): ConfigAdapter | undefined {
    return this.adapters.find(a => a.canParse(filePath));
  }

  getSupportedACTs(): ACTType[] {
    return this.adapters.map(a => a.actType);
  }
}

// Initialize with MVP adapter
const registry = new ConfigAdapterRegistry();
registry.register(new ClaudeCodeAdapter());

// Future: registry.register(new CursorAdapter());
```

---

## Anti-Pattern Detection

```typescript
const ANTI_PATTERNS = {
  // Generic rules that waste tokens
  genericRules: [
    /write clean code/i,
    /follow best practices/i,
    /use meaningful (variable )?names/i,
    /write readable code/i,
  ],

  // Linter jobs - should use deterministic tools
  linterJobs: [
    /use (single|double) quotes/i,
    /indent with (tabs|spaces|\d+ spaces)/i,
    /max(imum)? line length/i,
    /trailing (comma|whitespace)/i,
  ],

  // Potential secrets
  secrets: [
    /['"](sk-[a-zA-Z0-9]{20,})['"]/,           // OpenAI keys
    /['"](anthropic-[a-zA-Z0-9]{20,})['"]/,    // Anthropic keys
    /password\s*[=:]\s*['"][^'"]+['"]/i,
    /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/i,
  ],
};
```

---

## Quality Thresholds by ACT

```typescript
const ACT_THRESHOLDS: Record<ACTType, QualityThresholds> = {
  'claude-code': {
    recommendedLines: 60,
    maxLines: 300,
    recommendedTokens: 3000,
    maxTokens: 15000,
  },
  'cursor': {
    recommendedLines: 100,
    maxLines: 500,
    recommendedTokens: 5000,
    maxTokens: 20000,
  },
  'windsurf': {
    recommendedLines: 100,
    maxLines: 400,
    recommendedTokens: 4000,
    maxTokens: 16000,
  },
  'copilot': {
    recommendedLines: 80,
    maxLines: 300,
    recommendedTokens: 3000,
    maxTokens: 12000,
  },
  'cline': {
    recommendedLines: 100,
    maxLines: 500,
    recommendedTokens: 5000,
    maxTokens: 20000,
  },
  'aider': {
    recommendedLines: 60,
    maxLines: 200,
    recommendedTokens: 2500,
    maxTokens: 10000,
  },
  'generic': {
    recommendedLines: 80,
    maxLines: 300,
    recommendedTokens: 3500,
    maxTokens: 15000,
  },
};
```

---

## Tool Integration

```typescript
export const configParserTool = tool(
  "parse_config",
  `Parse and analyze an AI coding tool configuration file.

   Use this tool when you need to understand:
   - Configuration structure and organization
   - Quality signals (size, coverage, patterns)
   - Anti-patterns and improvement opportunities

   Supports: CLAUDE.md, .cursorrules, .cursor/rules/*.mdc`,
  {
    file_path: z.string().describe("Absolute path to the configuration file"),
    include_ast: z.boolean().optional().default(false)
      .describe("Include raw AST for advanced analysis"),
  },
  async (args) => {
    const content = await Bun.file(args.file_path).text();
    const adapter = registry.getAdapter(args.file_path);

    if (!adapter) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            message: `No adapter found for ${args.file_path}`,
            supportedACTs: registry.getSupportedACTs(),
          })
        }],
        isError: true,
      };
    }

    const result = await adapter.parse(content, {
      filePath: args.file_path,
      includeAst: args.include_ast,
    });

    return handleToolResult(result);
  }
);
```
