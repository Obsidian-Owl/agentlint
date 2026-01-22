/**
 * EP05 Config Analysis Tools - Enumerations
 *
 * Type unions and enumerations for config analysis tools.
 *
 * @module src/tools/types
 */

/**
 * Type of configuration file.
 * Extended for AGE-666 to include more Claude config types.
 * Extended for remediation to include rules, agents, and commands.
 */
export type ConfigType =
  | 'claude-md' // CLAUDE.md
  | 'agents-md' // AGENTS.md
  | 'claude-settings' // .claude/settings.json
  | 'claude-settings-local' // .claude/settings.local.json (AGE-666)
  | 'mcp-json' // .mcp.json (AGE-666)
  | 'claude-hook' // .claude/hooks/* (AGE-666)
  | 'skill-md' // .claude/skills/*/SKILL.md or SKILL.md
  | 'claude-rule' // .claude/rules/**/*.md (any .md recursively)
  | 'claude-agent' // .claude/agents/*.md (subagent definitions)
  | 'claude-command' // .claude/commands/*.md (legacy slash commands)
  | 'cursor-rules' // .cursor/rules/*.mdc (future)
  | 'unknown'; // Unrecognized format

/**
 * AI Coding Tool type.
 */
export type ACTType =
  | 'claude-code' // Claude Code (primary)
  | 'agents-md' // AGENTS.md standard
  | 'cursor' // Cursor (future)
  | 'aider' // Aider (future)
  | 'copilot-cli' // GitHub Copilot CLI (future)
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
 * Anti-pattern types based on ADR-0007:
 * - generic-rule: Vague guidance that wastes tokens ("Write clean code")
 * - linter-job: Style rules that belong in ESLint/Prettier
 * - instruction-overload: >150-200 instructions become unreliable
 * - embedded-secret: API keys, passwords in config
 * - code-snippet: Large code blocks instead of file:line references
 *
 * ACT format validation types:
 * - missing-frontmatter: File type requires frontmatter but has none
 * - invalid-frontmatter: Frontmatter exists but is malformed
 * - missing-required-field: Required field not present in frontmatter
 * - invalid-field-value: Field value doesn't match schema
 */
export type IssueType =
  | 'generic-rule' // Generic rule anti-pattern
  | 'linter-job' // Linter job anti-pattern
  | 'instruction-overload' // Too many instructions
  | 'embedded-secret' // Secret in config
  | 'code-snippet' // Large code block
  | 'missing-section' // Expected section not found
  | 'size-warning' // Too large or too small
  | 'structure-warning' // Malformed structure
  | 'missing-frontmatter' // File type requires frontmatter but has none
  | 'invalid-frontmatter' // Frontmatter exists but is malformed
  | 'missing-required-field' // Required field not present in frontmatter
  | 'invalid-field-value'; // Field value doesn't match schema

/**
 * Severity of a quality issue.
 */
export type IssueSeverity =
  | 'critical' // Security issue, must fix immediately
  | 'high' // Major issue, should fix soon
  | 'medium' // Notable issue, should fix
  | 'low' // Minor issue, consider fixing
  | 'info'; // Informational only

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
  | 'INVALID_JSON'
  | 'ENCODING_ISSUE'
  | 'PERMISSION_DENIED';
