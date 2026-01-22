/**
 * EP05 Config Analysis Tools - Entity Interfaces
 *
 * Core entity interfaces for config analysis tools.
 *
 * @module src/tools/config/types
 */

import type { Root } from 'mdast';
import type {
  ConfigType,
  ACTType,
  HierarchyLevel,
  IssueType,
  IssueSeverity,
  ConflictType,
  ConflictSeverity,
  BundledFileType,
  WarningCode,
} from '../types';

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
  /** Severity of the warning */
  severity?: 'error' | 'warning' | 'info';
}

// =============================================================================
// Quality Assessment
// =============================================================================

/**
 * Raw quality metrics for agent interpretation.
 *
 * Per ADR-0019, tools provide raw data and the agent makes quality judgments.
 * This interface returns factual observations without scoring or recommendations.
 */
export interface QualityAssessment {
  /** Raw metrics from the configuration */
  metrics: ConfigMetrics;
  /** Structure analysis (factual observations) */
  structure: StructureAnalysis;
  /** Size analysis (factual observations) */
  sizeAnalysis: SizeAnalysis;
  /** Completeness analysis (factual observations) */
  completeness: CompletenessAnalysis;
  /** Detected anti-patterns (factual pattern matching) */
  issues: QualityIssue[];
  /** Assessment timestamp */
  assessedAt: Date;
}

/**
 * Factual structure analysis.
 */
export interface StructureAnalysis {
  /** Number of top-level sections */
  sectionCount: number;
  /** Maximum heading depth used */
  maxHeadingDepth: number;
  /** Whether there are nested sections */
  hasNestedSections: boolean;
  /** Whether the file is empty */
  isEmpty: boolean;
  /** Whether the file has any structure (headings) */
  hasStructure: boolean;
}

/**
 * Factual size analysis based on ADR-0007 thresholds.
 */
export interface SizeAnalysis {
  /** Total line count */
  lineCount: number;
  /** Estimated token count */
  tokenEstimate: number;
  /** Whether line count exceeds 60 (optimal threshold from ADR-0007) */
  exceedsOptimalLines: boolean;
  /** Whether line count exceeds 300 (max threshold from ADR-0007) */
  exceedsMaxLines: boolean;
  /** Whether token count exceeds 3000 (lightweight threshold) */
  exceedsLightweightTokens: boolean;
  /** Whether token count exceeds 25000 (problematic threshold) */
  exceedsProblematicTokens: boolean;
}

/**
 * Factual completeness analysis.
 */
export interface CompletenessAnalysis {
  /** List of recommended sections that are present */
  presentSections: string[];
  /** List of recommended sections that are missing */
  missingSections: string[];
  /** Total number of recommended sections */
  totalRecommendedSections: number;
}

/**
 * @deprecated Use QualityAssessment directly - dimensions are no longer scored.
 * Kept for backwards compatibility during transition.
 */
export interface QualityDimensions {
  /** @deprecated Structure is now in StructureAnalysis */
  structure: number;
  /** @deprecated Size is now in SizeAnalysis */
  size: number;
  /** @deprecated Completeness is now in CompletenessAnalysis */
  completeness: number;
  /** @deprecated Specificity scoring removed per ADR-0019 */
  specificity: number;
  /** @deprecated Penalty scoring removed per ADR-0019 */
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
  /** Parse discovered skills into full Skill objects (slower but more complete) */
  parseSkills?: boolean;
}

/**
 * Result from discover_configs tool.
 */
export interface DiscoverConfigsResult {
  /** Discovered configuration files */
  files: ConfigFile[];
  /** Discovered skills (basic info for fast discovery) */
  skills: Array<{ path: string; type: 'skill-md' }>;
  /** Fully parsed skills (when parseSkills option is true) */
  parsedSkills?: Skill[];
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
  /** Summary for agent consumption (raw counts, no scoring per ADR-0019) */
  summary: {
    globalConfigExists: boolean;
    projectConfigExists: boolean;
    localConfigCount: number;
    skillCount: number;
    conflictCount: number;
    /** Total issues detected across all configs */
    totalIssues: number;
    /** Number of critical issues (security-related) */
    criticalIssues: number;
  };
}

// =============================================================================
// Re-export enumerations for convenience
// =============================================================================

export type {
  ConfigType,
  ACTType,
  HierarchyLevel,
  Grade,
  IssueType,
  IssueSeverity,
  ConflictType,
  ConflictSeverity,
  BundledFileType,
  WarningCode,
} from '../types';
