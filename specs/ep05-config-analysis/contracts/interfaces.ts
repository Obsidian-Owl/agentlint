/**
 * EP05 Config Analysis Tools - TypeScript Interfaces
 *
 * This file defines all public interfaces for the config analysis tools.
 * These interfaces are the API contract between:
 * - Tool implementations (src/tools/config/)
 * - Orchestration layer (src/orchestration/)
 * - CLI output formatters (src/cli/formatters/)
 *
 * @module specs/ep05-config-analysis/contracts
 */

import type { Root, Position as MdastPosition, Point as MdastPoint } from 'mdast';

// =============================================================================
// Enumerations
// =============================================================================

/**
 * Type of configuration file.
 */
export type ConfigType =
  | 'claude-md' // CLAUDE.md
  | 'agents-md' // AGENTS.md
  | 'claude-settings' // .claude/settings.json
  | 'skill-md' // SKILL.md
  | 'cursor-rules' // .cursor/rules/*.mdc (future)
  | 'unknown'; // Unrecognized format

/**
 * AI Coding Tool type.
 */
export type ACTType =
  | 'claude-code' // Claude Code (primary)
  | 'agents-md' // AGENTS.md standard
  | 'cursor' // Cursor (future)
  | 'windsurf' // Windsurf (future)
  | 'unknown'; // Unrecognized ACT

/**
 * Position in configuration hierarchy.
 */
export type HierarchyLevel =
  | 'global' // ~/.claude/
  | 'project' // Project root
  | 'local'; // Nested directory

/**
 * Quality letter grade.
 */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Type of quality issue detected.
 */
export type IssueType =
  | 'anti-pattern' // Known bad pattern
  | 'missing-section' // Expected section not found
  | 'size-warning' // Too large or too small
  | 'structure-issue' // Malformed structure
  | 'stale-content'; // Potentially outdated

/**
 * Severity of a quality issue.
 */
export type IssueSeverity =
  | 'error' // Must fix
  | 'warning' // Should fix
  | 'info'; // Consider fixing

/**
 * Type of conflict between configurations.
 */
export type ConflictType =
  | 'contradicting' // Direct contradiction
  | 'overlapping' // Redundant guidance
  | 'precedence'; // Unclear which takes priority

/**
 * Severity of a configuration conflict.
 */
export type ConflictSeverity =
  | 'high' // Will cause issues
  | 'medium' // May cause confusion
  | 'low'; // Minor inconsistency

/**
 * Type of file bundled with a skill.
 */
export type BundledFileType =
  | 'script' // scripts/ directory
  | 'reference' // references/ directory
  | 'asset'; // assets/ directory

/**
 * Warning codes for parse warnings.
 */
export type WarningCode =
  | 'INVALID_FRONTMATTER'
  | 'UNCLOSED_CODE_BLOCK'
  | 'MALFORMED_HEADING'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_YAML'
  | 'ENCODING_ISSUE'
  | 'PERMISSION_DENIED';

// =============================================================================
// Position Types (Compatible with mdast)
// =============================================================================

/**
 * A point in a source file.
 */
export interface Point {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Character offset from start of file */
  offset?: number;
}

/**
 * Position span in source file.
 */
export interface Position {
  /** Start position */
  start: Point;
  /** End position */
  end: Point;
}

// =============================================================================
// Core Entities
// =============================================================================

/**
 * A discovered configuration file.
 */
export interface ConfigFile {
  /** Absolute path to the file */
  path: string;
  /** Path relative to project root */
  relativePath: string;
  /** Type of configuration */
  type: ConfigType;
  /** File size in bytes */
  size: number;
  /** Last modification timestamp */
  lastModified: Date;
  /** Position in hierarchy */
  level: HierarchyLevel;
  /** AI Coding Tool type */
  actType: ACTType;
}

/**
 * Parsed configuration content with AST and metadata.
 */
export interface ParsedConfig {
  /** Source file metadata */
  file: ConfigFile;
  /** mdast AST root node */
  ast: Root;
  /** Parsed YAML frontmatter (if present) */
  frontmatter?: Record<string, unknown>;
  /** Extracted metrics */
  metrics: ConfigMetrics;
  /** Extracted sections with hierarchy */
  sections: Section[];
  /** Extracted code blocks */
  codeBlocks: CodeBlock[];
  /** Parse warnings (may be empty) */
  warnings: ParseWarning[];
  /** Original file content */
  raw: string;
}

/**
 * Quantitative signals extracted from configuration.
 */
export interface ConfigMetrics {
  /** Total lines in file */
  lineCount: number;
  /** Estimated token count */
  tokenEstimate: number;
  /** Number of top-level sections */
  sectionCount: number;
  /** Deepest heading level (1-6) */
  maxHeadingDepth: number;
  /** Number of code blocks */
  codeBlockCount: number;
  /** Languages used in code blocks */
  codeBlockLanguages: string[];
  /** Count of emphasis markers */
  emphasisMarkerCount: EmphasisCounts;
  /** Number of links */
  linkCount: number;
  /** Total word count */
  wordCount: number;
}

/**
 * Count of emphasis markers in configuration.
 */
export interface EmphasisCounts {
  /** Count of "MUST" occurrences */
  must: number;
  /** Count of "IMPORTANT" occurrences */
  important: number;
  /** Count of "CRITICAL" occurrences */
  critical: number;
  /** Count of "NEVER" occurrences */
  never: number;
  /** Count of "ALWAYS" occurrences */
  always: number;
  /** Sum of all emphasis markers */
  total: number;
}

/**
 * A logical section extracted from configuration.
 */
export interface Section {
  /** Generated section ID */
  id: string;
  /** Section heading text */
  title: string;
  /** Heading level (1-6) */
  level: number;
  /** Section content (excluding children) */
  content: string;
  /** Nested subsections */
  children: Section[];
  /** Start/end position in source */
  position: Position;
  /** Lines in this section */
  lineCount: number;
}

/**
 * A fenced code block from configuration.
 */
export interface CodeBlock {
  /** Language identifier (e.g., "typescript") */
  language?: string;
  /** Code content */
  content: string;
  /** Start/end position in source */
  position: Position;
  /** Number of lines */
  lineCount: number;
  /** Additional meta string after language */
  meta?: string;
}

/**
 * A non-fatal issue encountered during parsing.
 */
export interface ParseWarning {
  /** Warning identifier */
  code: WarningCode;
  /** Human-readable message */
  message: string;
  /** Location in source */
  position?: Position;
  /** Was partial parsing possible */
  recoverable: boolean;
}

// =============================================================================
// Quality Assessment
// =============================================================================

/**
 * Quality evaluation result for a configuration.
 */
export interface QualityAssessment {
  /** Overall quality score (0-100) */
  score: number;
  /** Letter grade */
  grade: Grade;
  /** Per-dimension scores */
  dimensions: QualityDimensions;
  /** Detected issues */
  issues: QualityIssue[];
  /** Improvement suggestions */
  recommendations: string[];
  /** Assessment timestamp */
  assessedAt: Date;
}

/**
 * Per-dimension quality scores.
 */
export interface QualityDimensions {
  /** Structure quality (0-100) */
  structure: number;
  /** Size appropriateness (0-100) */
  size: number;
  /** Recommended section coverage (0-100) */
  completeness: number;
  /** Project-specific vs generic (0-100) */
  specificity: number;
  /** Penalty points for anti-patterns */
  antiPatternPenalty: number;
}

/**
 * A quality problem detected in configuration.
 */
export interface QualityIssue {
  /** Issue identifier */
  id: string;
  /** Category of issue */
  type: IssueType;
  /** Impact severity */
  severity: IssueSeverity;
  /** Human-readable description */
  message: string;
  /** Location in source */
  position?: Position;
  /** How to fix */
  suggestion: string;
}

// =============================================================================
// Hierarchy & Conflicts
// =============================================================================

/**
 * Configuration inheritance tree.
 */
export interface ConfigHierarchy {
  /** Global config (~/.claude/CLAUDE.md) */
  global?: ParsedConfig;
  /** Project root config */
  project?: ParsedConfig;
  /** Nested/local configs */
  local: ParsedConfig[];
  /** Discovered skills */
  skills: Skill[];
  /** Merged effective configuration */
  effectiveConfig: EffectiveConfig;
  /** Detected conflicts */
  conflicts: Conflict[];
}

/**
 * Merged effective configuration from all levels.
 */
export interface EffectiveConfig {
  /** Combined sections from all levels */
  sections: Section[];
  /** Combined code blocks */
  codeBlocks: CodeBlock[];
  /** Merged metrics */
  aggregateMetrics: ConfigMetrics;
  /** Source file count */
  fileCount: number;
}

/**
 * A conflict between configurations at different levels.
 */
export interface Conflict {
  /** Conflict identifier */
  id: string;
  /** Category of conflict */
  type: ConflictType;
  /** Human-readable description */
  description: string;
  /** Files involved (min 2) */
  files: ConfigFile[];
  /** Locations of conflicting content */
  positions: Position[];
  /** Impact severity */
  severity: ConflictSeverity;
  /** Suggested resolution */
  resolution?: string;
}

// =============================================================================
// Skills
// =============================================================================

/**
 * A parsed SKILL.md file.
 */
export interface Skill {
  /** Path to SKILL.md */
  path: string;
  /** Skill name (from frontmatter, max 64 chars) */
  name: string;
  /** When to invoke (from frontmatter, max 200 chars) */
  description: string;
  /** Permitted tools (comma-separated in frontmatter) */
  allowedTools?: string[];
  /** Specific model to use */
  model?: string;
  /** Available in slash menu (default: true) */
  userInvocable: boolean;
  /** Block programmatic use (default: false) */
  disableModelInvocation: boolean;
  /** Markdown content sections */
  contentSections: Section[];
  /** Files in scripts/, references/, assets/ */
  bundledFiles: BundledFile[];
  /** Validation warnings */
  warnings: ParseWarning[];
}

/**
 * A file bundled with a skill.
 */
export interface BundledFile {
  /** Relative path from skill directory */
  path: string;
  /** Category (script, reference, asset) */
  type: BundledFileType;
  /** File size in bytes */
  size: number;
}

// =============================================================================
// Tool Input/Output Types
// =============================================================================

/**
 * Input options for parse_config tool.
 */
export interface ParseConfigInput {
  /** Absolute path to configuration file */
  filePath: string;
  /** Include quality assessment (default: true) */
  includeQuality?: boolean;
  /** Include raw content in output (default: false) */
  includeRaw?: boolean;
}

/**
 * Successful result from parse_config tool.
 */
export interface ParseConfigSuccess {
  success: true;
  /** Parsed configuration */
  config: ParsedConfig;
  /** Quality assessment (if requested) */
  quality?: QualityAssessment;
}

/**
 * Failed result from parse_config tool.
 */
export interface ParseConfigFailure {
  success: false;
  /** Error information */
  error: {
    code: string;
    message: string;
    suggestion: string;
  };
  /** Partial result if recoverable */
  partial?: Partial<ParsedConfig>;
}

/**
 * Result from parse_config tool.
 */
export type ParseConfigResult = ParseConfigSuccess | ParseConfigFailure;

/**
 * Input options for discover_configs tool.
 */
export interface DiscoverConfigsInput {
  /** Project root directory */
  cwd: string;
  /** Include global configs (~/.claude/) */
  includeGlobal?: boolean;
  /** Additional exclude patterns */
  exclude?: string[];
  /** Maximum directory depth to search */
  maxDepth?: number;
}

/**
 * Result from discover_configs tool.
 */
export interface DiscoverConfigsResult {
  /** Discovered configuration files */
  files: ConfigFile[];
  /** Discovered skills */
  skills: Array<{ path: string; type: 'skill-md' }>;
  /** Total files scanned */
  filesScanned: number;
  /** Directories excluded */
  directoriesExcluded: number;
  /** Scan duration in milliseconds */
  durationMs: number;
}

/**
 * Input options for analyze_hierarchy tool.
 */
export interface AnalyzeHierarchyInput {
  /** Project root directory */
  cwd: string;
  /** Include global configs */
  includeGlobal?: boolean;
}

/**
 * Result from analyze_hierarchy tool.
 */
export interface AnalyzeHierarchyResult {
  /** Full configuration hierarchy */
  hierarchy: ConfigHierarchy;
  /** Summary for agent consumption */
  summary: {
    globalConfigExists: boolean;
    projectConfigExists: boolean;
    localConfigCount: number;
    skillCount: number;
    conflictCount: number;
    overallGrade: Grade;
  };
}

// =============================================================================
// Adapter Interface
// =============================================================================

/**
 * Interface for ACT-specific adapters.
 * Each supported AI Coding Tool implements this interface.
 */
export interface IConfigAdapter {
  /** ACT type this adapter handles */
  readonly actType: ACTType;

  /** Config types this adapter can parse */
  readonly supportedTypes: ConfigType[];

  /**
   * Detect if a file is a config for this ACT.
   * @param path - File path to check
   * @returns true if this adapter should handle the file
   */
  detect(path: string): boolean;

  /**
   * Parse a configuration file.
   * @param path - Path to the config file
   * @param content - File content
   * @returns Parsed configuration
   */
  parse(path: string, content: string): Promise<ParsedConfig>;

  /**
   * Get recommended section names for this ACT type.
   * Used for completeness scoring.
   */
  getRecommendedSections(): string[];

  /**
   * Get known anti-patterns for this ACT type.
   */
  getAntiPatterns(): AntiPattern[];
}

/**
 * Definition of an anti-pattern to detect.
 */
export interface AntiPattern {
  /** Pattern identifier */
  id: string;
  /** Pattern name */
  name: string;
  /** Description of why this is bad */
  description: string;
  /** Regex or AST matcher */
  detect: (ast: Root, content: string) => PatternMatch[];
}

/**
 * A matched anti-pattern instance.
 */
export interface PatternMatch {
  /** Pattern that matched */
  pattern: string;
  /** Location of match */
  position: Position;
  /** Severity of this occurrence */
  severity: IssueSeverity;
  /** Suggested fix */
  suggestion: string;
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type { Root, MdastPosition, MdastPoint };
