/**
 * T050-T055: Configuration Quality Assessment
 *
 * Evaluates AI configuration file quality using metrics from ADR-0007:
 * - Structure scoring (T051): Section hierarchy and organization
 * - Size scoring (T052): Line count and token estimates
 * - Completeness scoring (T053): Recommended section coverage
 * - Anti-pattern detection (T054): Generic rules, linter jobs, etc.
 * - Weighted score calculation (T055): Combine dimensions into grade
 *
 * @module tools/config/quality
 */

import type {
  ParsedConfig,
  QualityAssessment,
  QualityDimensions,
  QualityIssue,
  Grade,
  IssueType,
  IssueSeverity,
} from './types';

// =============================================================================
// Constants (from ADR-0007)
// =============================================================================

/** Recommended line count threshold - optimal */
const LINES_OPTIMAL = 60;

/** Maximum recommended line count */
const LINES_MAX = 300;

/** Token count: lightweight */
const TOKENS_LIGHTWEIGHT = 3000;

/** Token count: medium */
const TOKENS_MEDIUM = 15000;

/** Token count: problematic threshold */
const TOKENS_PROBLEMATIC = 25000;

/** Instruction count threshold for overload warning */
const INSTRUCTION_OVERLOAD_THRESHOLD = 200;

/** Code block size threshold (lines) for snippet warning */
const CODE_BLOCK_SIZE_THRESHOLD = 15;

/** Dimension weights for overall score */
const WEIGHTS = {
  structure: 0.25,
  size: 0.25,
  completeness: 0.2,
  specificity: 0.3,
};

/** Grade thresholds */
const GRADE_THRESHOLDS: Array<{ min: number; grade: Grade }> = [
  { min: 90, grade: 'A' },
  { min: 80, grade: 'B' },
  { min: 70, grade: 'C' },
  { min: 60, grade: 'D' },
  { min: 0, grade: 'F' },
];

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

/** Recommended section names (for completeness scoring) */
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
 * Assess the quality of a parsed configuration.
 *
 * @param config - Parsed configuration to assess
 * @returns Quality assessment with score, grade, and recommendations
 */
export function assessQuality(config: ParsedConfig): QualityAssessment {
  // Calculate dimension scores
  const structure = scoreStructure(config);
  const size = scoreSize(config);
  const completeness = scoreCompleteness(config);
  const specificity = scoreSpecificity(config);

  // Detect anti-patterns and calculate penalty
  const issues = detectAntiPatterns(config);
  const antiPatternPenalty = calculateAntiPatternPenalty(issues);

  const dimensions: QualityDimensions = {
    structure,
    size,
    completeness,
    specificity,
    antiPatternPenalty,
  };

  // Calculate weighted score (T055)
  const rawScore =
    dimensions.structure * WEIGHTS.structure +
    dimensions.size * WEIGHTS.size +
    dimensions.completeness * WEIGHTS.completeness +
    dimensions.specificity * WEIGHTS.specificity;

  // Apply penalty (capped at 50 points reduction)
  const score = Math.max(0, Math.min(100, rawScore - Math.min(antiPatternPenalty, 50)));

  // Determine grade
  const grade = calculateGrade(score);

  // Generate recommendations
  const recommendations = generateRecommendations(config, dimensions, issues);

  return {
    score: Math.round(score),
    grade,
    dimensions,
    issues,
    recommendations,
    assessedAt: new Date(),
  };
}

// =============================================================================
// Structure Scoring (T051)
// =============================================================================

/**
 * Score the structural organization of the configuration.
 * Rewards: clear hierarchy, reasonable depth, balanced sections.
 * Penalizes: flat structure, too deep, unbalanced.
 */
function scoreStructure(config: ParsedConfig): number {
  const { sections, metrics } = config;

  // Empty or no sections = very low score
  if (sections.length === 0 || metrics.sectionCount === 0) {
    // Check if there's any content at all
    if (config.raw.trim().length === 0) {
      return 5; // Empty file gets minimum score
    }
    return 15; // Has content but no structure
  }

  let score = 50; // Start at 50

  // Reward for having sections (up to 20 points)
  const sectionBonus = Math.min(20, metrics.sectionCount * 4);
  score += sectionBonus;

  // Reward for reasonable heading depth (up to 15 points)
  // Optimal depth is 2-3 levels
  if (metrics.maxHeadingDepth >= 2 && metrics.maxHeadingDepth <= 4) {
    score += 15;
  } else if (metrics.maxHeadingDepth === 1) {
    score += 5; // Single level is okay but not great
  } else if (metrics.maxHeadingDepth > 4) {
    score += 8; // Too deep, slightly penalized
  }

  // Reward for hierarchical nesting (up to 15 points)
  const hasNestedSections = sections.some((s) => s.children.length > 0);
  if (hasNestedSections) {
    score += 15;
  }

  // Cap at 100
  return Math.min(100, Math.max(0, score));
}

// =============================================================================
// Size Scoring (T052)
// =============================================================================

/**
 * Score the size appropriateness based on ADR-0007 thresholds.
 * <60 lines: optimal (90-100)
 * 60-150 lines: good (70-90)
 * 150-300 lines: acceptable (50-70)
 * >300 lines: too large (<50)
 */
function scoreSize(config: ParsedConfig): number {
  const { metrics } = config;
  const lineCount = metrics.lineCount;
  const tokenCount = metrics.tokenEstimate;

  // Line-based scoring
  let lineScore: number;
  if (lineCount <= LINES_OPTIMAL) {
    lineScore = 100;
  } else if (lineCount <= 150) {
    // Linear interpolation from 90 to 70
    lineScore = 90 - ((lineCount - LINES_OPTIMAL) / 90) * 20;
  } else if (lineCount <= LINES_MAX) {
    // Linear interpolation from 70 to 50
    lineScore = 70 - ((lineCount - 150) / 150) * 20;
  } else {
    // Over 300 lines: rapid decline to below 50
    // Start at 40 and decrease further (ensures <50 for >300 lines)
    lineScore = Math.max(5, 40 - (lineCount - LINES_MAX) / 10);
  }

  // Token-based scoring
  let tokenScore: number;
  if (tokenCount <= TOKENS_LIGHTWEIGHT) {
    tokenScore = 100;
  } else if (tokenCount <= TOKENS_MEDIUM) {
    tokenScore =
      80 - ((tokenCount - TOKENS_LIGHTWEIGHT) / (TOKENS_MEDIUM - TOKENS_LIGHTWEIGHT)) * 30;
  } else if (tokenCount <= TOKENS_PROBLEMATIC) {
    tokenScore = 50 - ((tokenCount - TOKENS_MEDIUM) / (TOKENS_PROBLEMATIC - TOKENS_MEDIUM)) * 30;
  } else {
    tokenScore = Math.max(5, 20 - (tokenCount - TOKENS_PROBLEMATIC) / 5000);
  }

  // Combine both scores
  // If lines exceed max, use line score more heavily to ensure penalty
  if (lineCount > LINES_MAX) {
    // Over 300 lines: line score dominates (80/20 weighting)
    return Math.round(lineScore * 0.8 + tokenScore * 0.2);
  }
  // Normal case: weighted average with lines slightly more important
  return Math.round(lineScore * 0.6 + tokenScore * 0.4);
}

// =============================================================================
// Completeness Scoring (T053)
// =============================================================================

/**
 * Score coverage of recommended sections.
 * Checks for presence of key section types.
 */
function scoreCompleteness(config: ParsedConfig): number {
  const { sections, file, raw } = config;

  // Empty config gets minimum
  if (!raw || raw.trim().length === 0) {
    return 5;
  }

  // JSON configs don't have markdown sections
  if (file.type === 'claude-settings') {
    // For JSON, check if required fields are present
    const frontmatter = config.frontmatter || {};
    const hasModel = 'model' in frontmatter;
    return hasModel ? 70 : 40;
  }

  if (sections.length === 0) {
    return 10;
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
  let found = 0;
  for (const recommended of RECOMMENDED_SECTIONS) {
    if (allTitles.some((title) => title.includes(recommended))) {
      found++;
    }
  }

  // Score based on coverage (10 recommended sections)
  const coverageRatio = found / RECOMMENDED_SECTIONS.length;
  return Math.round(20 + coverageRatio * 80);
}

// =============================================================================
// Specificity Scoring
// =============================================================================

/**
 * Score how project-specific vs generic the config content is.
 * Rewards: specific commands, file paths, tool names.
 * Penalizes: generic advice, platitudes.
 */
function scoreSpecificity(config: ParsedConfig): number {
  const { raw, codeBlocks } = config;

  if (!raw || raw.trim().length === 0) {
    return 5; // Empty config gets minimum
  }

  let score = 50;

  // Reward for code blocks with commands (up to 20 points)
  const commandBlocks = codeBlocks.filter(
    (cb) => cb.language === 'bash' || cb.language === 'sh' || cb.language === 'shell'
  );
  score += Math.min(20, commandBlocks.length * 5);

  // Reward for inline code (backticks suggest specific commands/paths)
  const inlineCodeMatches = raw.match(/`[^`]+`/g) || [];
  score += Math.min(15, inlineCodeMatches.length * 2);

  // Reward for file path references
  const filePathMatches = raw.match(/\b\w+\.\w+\b/g) || []; // simple file.ext pattern
  score += Math.min(10, filePathMatches.length);

  // Penalize for generic phrases
  let genericCount = 0;
  for (const pattern of GENERIC_RULE_PATTERNS) {
    if (pattern.test(raw)) {
      genericCount++;
    }
  }
  score -= genericCount * 8;

  return Math.max(0, Math.min(100, score));
}

// =============================================================================
// Anti-Pattern Detection (T054)
// =============================================================================

/**
 * Detect anti-patterns in configuration content.
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

// =============================================================================
// Score Calculation (T055)
// =============================================================================

/**
 * Calculate penalty points from detected issues.
 */
function calculateAntiPatternPenalty(issues: QualityIssue[]): number {
  let penalty = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        penalty += 20;
        break;
      case 'high':
        penalty += 10;
        break;
      case 'medium':
        penalty += 5;
        break;
      case 'low':
        penalty += 2;
        break;
      case 'info':
        penalty += 1;
        break;
    }
  }

  return penalty;
}

/**
 * Determine letter grade from score.
 */
function calculateGrade(score: number): Grade {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.grade;
    }
  }
  return 'F';
}

/**
 * Generate actionable recommendations based on assessment.
 */
function generateRecommendations(
  config: ParsedConfig,
  dimensions: QualityDimensions,
  issues: QualityIssue[]
): string[] {
  const recommendations: string[] = [];

  // Structure recommendations
  if (dimensions.structure < 50) {
    recommendations.push(
      'Add section headings to organize your configuration. Use ## for main sections and ### for subsections.'
    );
  }

  // Size recommendations
  if (dimensions.size < 50) {
    if (config.metrics.lineCount > LINES_MAX) {
      recommendations.push(
        `Configuration has ${config.metrics.lineCount} lines. Consider splitting into multiple files or using SKILL.md for specialized sections.`
      );
    }
    if (config.metrics.tokenEstimate > TOKENS_PROBLEMATIC) {
      recommendations.push(
        `High token count (${config.metrics.tokenEstimate}). Remove redundant content and use file references instead of embedded code.`
      );
    }
  }

  // Completeness recommendations
  if (dimensions.completeness < 50) {
    recommendations.push(
      'Consider adding sections for: Project Overview, Development Commands, and Architecture/Structure.'
    );
  }

  // Specificity recommendations
  if (dimensions.specificity < 50) {
    recommendations.push(
      'Add specific commands, file paths, and tool configurations. Avoid generic advice that the AI already knows.'
    );
  }

  // Issue-specific recommendations (limit to avoid overwhelming)
  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  const highIssues = issues.filter((i) => i.severity === 'high');

  if (criticalIssues.length > 0) {
    recommendations.unshift(
      `CRITICAL: ${criticalIssues.length} security issue(s) detected. Remove secrets immediately.`
    );
  }

  if (highIssues.length > 0) {
    recommendations.push(`${highIssues.length} high-priority issue(s) should be addressed soon.`);
  }

  // Limit recommendations to prevent information overload
  return recommendations.slice(0, 5);
}
