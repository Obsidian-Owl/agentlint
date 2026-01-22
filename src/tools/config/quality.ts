/**
 * T050-T055: Configuration Quality Assessment
 *
 * Per ADR-0019 (Tool/Agent Boundary), this module provides raw metrics
 * for agent interpretation. Tools extract factual data; agents make
 * quality judgments and recommendations.
 *
 * Returns:
 * - Raw metrics (line count, section count, token estimate)
 * - Structure analysis (factual observations)
 * - Size analysis with threshold flags (based on ADR-0007)
 * - Completeness analysis (present/missing sections)
 * - Anti-pattern detection (factual pattern matching)
 *
 * @module tools/config/quality
 */

import type {
  ParsedConfig,
  QualityAssessment,
  QualityIssue,
  IssueType,
  IssueSeverity,
  StructureAnalysis,
  SizeAnalysis,
  CompletenessAnalysis,
} from './types';
import { validateACTFormat } from './act-format-validator';

// =============================================================================
// Constants (from ADR-0007)
// =============================================================================

/** Recommended line count threshold - optimal */
const LINES_OPTIMAL = 60;

/** Maximum recommended line count */
const LINES_MAX = 300;

/** Token count: lightweight */
const TOKENS_LIGHTWEIGHT = 3000;

/** Token count: problematic threshold */
const TOKENS_PROBLEMATIC = 25000;

/** Instruction count threshold for overload warning */
const INSTRUCTION_OVERLOAD_THRESHOLD = 200;

/** Code block size threshold (lines) for snippet warning */
const CODE_BLOCK_SIZE_THRESHOLD = 15;

/** Generic rule patterns (wastes tokens) */
const GENERIC_RULE_PATTERNS = [
  /write clean code/i,
  /follow best practices/i,
  /keep it simple/i,
  /be consistent/i,
  /don't repeat yourself/i,
  /dry principle/i,
  /kiss principle/i,
  /solid principles?/i,
  /maintain code quality/i,
  /write maintainable code/i,
  /use meaningful names/i,
  /avoid magic numbers/i,
  /write readable code/i,
  /follow coding standards/i,
  /use proper indentation/i,
];

/** Linter job patterns (belong in ESLint/Prettier) */
const LINTER_JOB_PATTERNS = [
  /no-unused-vars/i,
  /no-console/i,
  /prefer-const/i,
  /eqeqeq/i,
  /semi(colon)?s?/i,
  /single quotes?/i,
  /double quotes?/i,
  /2 space indent/i,
  /4 space indent/i,
  /tab indent/i,
  /max.?line.?length/i,
  /trailing (comma|whitespace)/i,
  /eslint.*(rule|config)/i,
  /prettier/i,
  /\bno-[a-z-]+\b/i, // ESLint rule pattern
];

/** Secret patterns (critical security issue) */
const SECRET_PATTERNS = [
  /api[_-]?key\s*[=:]\s*["']?[a-z0-9]{20,}/i,
  /password\s*[=:]\s*["']?[^\s"']{8,}/i,
  /secret\s*[=:]\s*["']?[^\s"']{8,}/i,
  /sk-[a-z0-9]{20,}/i, // OpenAI/Anthropic key pattern
  /-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /ghp_[a-zA-Z0-9]{36}/i, // GitHub token
  /gho_[a-zA-Z0-9]{36}/i, // GitHub OAuth
  /aws[_-]?(access[_-]?key|secret)/i,
];

/** Environment variable reference patterns (NOT secrets) */
const ENV_VAR_PATTERNS = [/\$[A-Z_]+/, /process\.env\.[A-Z_]+/, /\$\{[A-Z_]+\}/, /\benv\.[A-Z_]+/];

/** Recommended section names (for completeness analysis) */
const RECOMMENDED_SECTIONS = [
  'overview',
  'project',
  'technology',
  'stack',
  'development',
  'build',
  'test',
  'commands',
  'architecture',
  'structure',
];

// =============================================================================
// Main Assessment Function (T050)
// =============================================================================

/**
 * Options for quality assessment.
 */
export interface AssessQualityOptions {
  /** Include ACT format validation (frontmatter requirements). Default: false */
  validateFormat?: boolean;
}

/**
 * Analyze the quality characteristics of a parsed configuration.
 *
 * Per ADR-0019, returns raw metrics for agent interpretation.
 * The agent determines what constitutes "good" or "bad" quality
 * based on context.
 *
 * @param config - Parsed configuration to analyze
 * @param options - Optional assessment options
 * @returns Raw quality metrics for agent interpretation
 */
export function assessQuality(
  config: ParsedConfig,
  options?: AssessQualityOptions
): QualityAssessment {
  const { validateFormat = false } = options ?? {};

  // Analyze structure (factual observations)
  const structure = analyzeStructure(config);

  // Analyze size (factual observations with threshold flags)
  const sizeAnalysis = analyzeSize(config);

  // Analyze completeness (present/missing sections)
  const completeness = analyzeCompleteness(config);

  // Detect anti-patterns (factual pattern matching)
  const issues = detectAntiPatterns(config);

  // Optionally validate ACT format requirements (frontmatter, required fields)
  if (validateFormat) {
    const formatResult = validateACTFormat({
      configType: config.file.type,
      filePath: config.file.path,
      content: config.raw,
      frontmatter: config.frontmatter,
      hasFrontmatter: config.frontmatter !== undefined,
    });
    issues.push(...formatResult.issues);
  }

  return {
    metrics: config.metrics,
    structure,
    sizeAnalysis,
    completeness,
    issues,
    assessedAt: new Date(),
  };
}

// =============================================================================
// Structure Analysis (T051)
// =============================================================================

/**
 * Analyze the structural characteristics of the configuration.
 * Returns factual observations without scoring.
 */
function analyzeStructure(config: ParsedConfig): StructureAnalysis {
  const { sections, metrics, raw } = config;

  const isEmpty = !raw || raw.trim().length === 0;
  const hasStructure = sections.length > 0 || metrics.sectionCount > 0;
  const hasNestedSections = sections.some((s) => s.children.length > 0);

  return {
    sectionCount: metrics.sectionCount,
    maxHeadingDepth: metrics.maxHeadingDepth,
    hasNestedSections,
    isEmpty,
    hasStructure,
  };
}

// =============================================================================
// Size Analysis (T052)
// =============================================================================

/**
 * Analyze the size characteristics based on ADR-0007 thresholds.
 * Returns factual observations with threshold flags.
 */
function analyzeSize(config: ParsedConfig): SizeAnalysis {
  const { metrics } = config;
  const lineCount = metrics.lineCount;
  const tokenEstimate = metrics.tokenEstimate;

  return {
    lineCount,
    tokenEstimate,
    exceedsOptimalLines: lineCount > LINES_OPTIMAL,
    exceedsMaxLines: lineCount > LINES_MAX,
    exceedsLightweightTokens: tokenEstimate > TOKENS_LIGHTWEIGHT,
    exceedsProblematicTokens: tokenEstimate > TOKENS_PROBLEMATIC,
  };
}

// =============================================================================
// Completeness Analysis (T053)
// =============================================================================

/**
 * Analyze coverage of recommended sections.
 * Returns factual list of present/missing sections.
 */
function analyzeCompleteness(config: ParsedConfig): CompletenessAnalysis {
  const { sections, file, raw } = config;

  // Empty config has all sections missing
  if (!raw || raw.trim().length === 0) {
    return {
      presentSections: [],
      missingSections: [...RECOMMENDED_SECTIONS],
      totalRecommendedSections: RECOMMENDED_SECTIONS.length,
    };
  }

  // JSON configs don't have markdown sections
  if (file.type === 'claude-settings') {
    return {
      presentSections: [],
      missingSections: [],
      totalRecommendedSections: 0, // N/A for JSON
    };
  }

  if (sections.length === 0) {
    return {
      presentSections: [],
      missingSections: [...RECOMMENDED_SECTIONS],
      totalRecommendedSections: RECOMMENDED_SECTIONS.length,
    };
  }

  // Collect all section titles (including nested)
  const allTitles: string[] = [];
  function collectTitles(sectionList: typeof sections): void {
    for (const section of sectionList) {
      allTitles.push(section.title.toLowerCase());
      if (section.children.length > 0) {
        collectTitles(section.children);
      }
    }
  }
  collectTitles(sections);

  // Check for recommended sections
  const presentSections: string[] = [];
  const missingSections: string[] = [];

  for (const recommended of RECOMMENDED_SECTIONS) {
    if (allTitles.some((title) => title.includes(recommended))) {
      presentSections.push(recommended);
    } else {
      missingSections.push(recommended);
    }
  }

  return {
    presentSections,
    missingSections,
    totalRecommendedSections: RECOMMENDED_SECTIONS.length,
  };
}

// =============================================================================
// Anti-Pattern Detection (T054)
// =============================================================================

/**
 * Detect anti-patterns in configuration content.
 * This is factual pattern matching, not quality judgment.
 */
export function detectAntiPatterns(config: ParsedConfig): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const { raw, codeBlocks, metrics } = config;

  if (!raw) {
    return issues;
  }

  // 1. Generic rules detection
  const genericIssues = detectGenericRules(raw);
  issues.push(...genericIssues);

  // 2. Linter jobs detection
  const linterIssues = detectLinterJobs(raw);
  issues.push(...linterIssues);

  // 3. Instruction overload detection
  const overloadIssue = detectInstructionOverload(raw, metrics.lineCount);
  if (overloadIssue) {
    issues.push(overloadIssue);
  }

  // 4. Embedded secrets detection
  const secretIssues = detectEmbeddedSecrets(raw);
  issues.push(...secretIssues);

  // 5. Large code snippets detection
  const snippetIssues = detectLargeCodeSnippets(codeBlocks);
  issues.push(...snippetIssues);

  return issues;
}

/**
 * Detect generic rules that waste tokens.
 */
function detectGenericRules(content: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const pattern of GENERIC_RULE_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          id: `generic-rule-${i + 1}`,
          type: 'generic-rule' as IssueType,
          severity: 'low' as IssueSeverity,
          message: `Generic rule detected: "${line.trim().slice(0, 50)}..."`,
          position: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length + 1 },
          },
          suggestion:
            'Replace with project-specific guidance. Generic advice wastes tokens without providing value.',
        });
        break; // Only one issue per line
      }
    }
  }

  return issues;
}

/**
 * Detect linter/formatter rules that belong in tool configs.
 */
function detectLinterJobs(content: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const pattern of LINTER_JOB_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          id: `linter-job-${i + 1}`,
          type: 'linter-job' as IssueType,
          severity: 'medium' as IssueSeverity,
          message: `Linter/formatter rule in config: "${line.trim().slice(0, 50)}..."`,
          position: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length + 1 },
          },
          suggestion:
            'Move formatting and style rules to ESLint, Prettier, or appropriate tool config files.',
        });
        break;
      }
    }
  }

  return issues;
}

/**
 * Detect instruction overload (>200 instructions).
 */
function detectInstructionOverload(content: string, lineCount: number): QualityIssue | null {
  // Count list items and numbered instructions
  const listMatches = content.match(/^[-*+]\s+.+$/gm) || [];
  const numberedMatches = content.match(/^\d+[.)]\s+.+$/gm) || [];
  const totalInstructions = listMatches.length + numberedMatches.length;

  if (totalInstructions >= INSTRUCTION_OVERLOAD_THRESHOLD || lineCount > LINES_MAX) {
    return {
      id: 'instruction-overload',
      type: 'instruction-overload' as IssueType,
      severity: 'high' as IssueSeverity,
      message: `Configuration has ${totalInstructions} instructions and ${lineCount} lines. This exceeds recommended limits.`,
      suggestion:
        'Break up the config into multiple focused files or use SKILL.md for specialized guidance. Large configs become unreliable.',
    };
  }

  return null;
}

/**
 * Detect embedded secrets (critical security issue).
 */
function detectEmbeddedSecrets(content: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Skip if it's an environment variable reference
    const isEnvRef = ENV_VAR_PATTERNS.some((p) => p.test(line));
    if (isEnvRef && !line.includes('=')) {
      continue; // It's a reference, not a secret
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        issues.push({
          id: `embedded-secret-${i + 1}`,
          type: 'embedded-secret' as IssueType,
          severity: 'critical' as IssueSeverity,
          message: `Potential secret detected on line ${i + 1}`,
          position: {
            start: { line: i + 1, column: 1 },
            end: { line: i + 1, column: line.length + 1 },
          },
          suggestion:
            'Remove secrets from config immediately. Use environment variables or a secrets manager.',
        });
        break;
      }
    }
  }

  return issues;
}

/**
 * Detect large code snippets that should be file references.
 */
function detectLargeCodeSnippets(codeBlocks: ParsedConfig['codeBlocks']): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const block of codeBlocks) {
    if (block.lineCount > CODE_BLOCK_SIZE_THRESHOLD) {
      issues.push({
        id: `code-snippet-${block.position.start.line}`,
        type: 'code-snippet' as IssueType,
        severity: 'medium' as IssueSeverity,
        message: `Large code block (${block.lineCount} lines) starting at line ${block.position.start.line}`,
        position: block.position,
        suggestion:
          'Consider using file:line references instead of embedding large code blocks. This reduces config size and keeps content up-to-date.',
      });
    }
  }

  return issues;
}
