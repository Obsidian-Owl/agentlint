/**
 * MCP Environment Variable Validation
 *
 * Validates environment variables in MCP server configurations.
 * Detects sensitive data and variable references.
 *
 * @module tools/config/mcp/validators/env
 */

import type { McpValidationIssue, EnvVarInfo, Position, McpIssueCode } from '../types';
import { ISSUE_CODE_METADATA, SENSITIVE_PATTERNS } from '../types';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a validation issue with standard fields populated.
 */
function createIssue(
  code: McpIssueCode,
  message: string,
  file: string,
  position: Position,
  serverName?: string,
  field?: string,
  value?: string,
  context?: Record<string, unknown>,
  fix?: string
): McpValidationIssue {
  const metadata = ISSUE_CODE_METADATA[code];
  const issue: McpValidationIssue = {
    code,
    severity: metadata.severity,
    message,
    file,
    line: position.start.line,
    column: position.start.column,
  };
  if (serverName !== undefined) issue.serverName = serverName;
  if (field !== undefined) issue.field = field;
  if (value !== undefined) issue.value = value;
  if (context !== undefined) issue.context = context;
  if (fix !== undefined) issue.fix = fix;
  return issue;
}

// =============================================================================
// Sensitive Name Detection
// =============================================================================

/**
 * Check if an environment variable name matches sensitive patterns.
 *
 * @param name - Environment variable name
 * @returns True if the name matches any sensitive pattern
 */
export function isSensitiveName(name: string): boolean {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(name)) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// Variable Reference Detection
// =============================================================================

/**
 * Variable reference pattern info.
 */
interface VarRefInfo {
  /** Full pattern: ${VAR}, ${env:VAR}, $VAR */
  pattern: string;
  /** Extracted variable name */
  varName: string;
}

/**
 * Patterns for detecting variable references in env values.
 */
const VAR_REF_PATTERNS = [
  /\$\{env:([A-Z_][A-Z0-9_]*)\}/gi, // ${env:VAR}
  /\$\{([A-Z_][A-Z0-9_]*)\}/gi, // ${VAR}
  /\$([A-Z_][A-Z0-9_]*)/g, // $VAR
];

/**
 * Detect variable references in an env value.
 *
 * @param value - Environment variable value
 * @returns Array of detected variable references
 */
export function detectVariableRefs(value: string): VarRefInfo[] {
  const refs: VarRefInfo[] = [];
  const seen = new Set<string>();

  for (const pattern of VAR_REF_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(value)) !== null) {
      const fullPattern = match[0];
      if (!seen.has(fullPattern)) {
        seen.add(fullPattern);
        refs.push({
          pattern: fullPattern,
          varName: match[1] ?? fullPattern.replace(/[${}]/g, '').replace(/^env:/, ''),
        });
      }
    }
  }

  return refs;
}

/**
 * Check if a value contains variable references.
 */
function hasVariableRef(value: string): boolean {
  return detectVariableRefs(value).length > 0;
}

// =============================================================================
// Env Var Analysis
// =============================================================================

/**
 * Analyze a single environment variable.
 *
 * @param name - Variable name
 * @param value - Variable value
 * @param position - Position in source file
 * @returns EnvVarInfo with analysis results
 */
export function analyzeEnvVar(name: string, value: string, position: Position): EnvVarInfo {
  return {
    name,
    value,
    isSensitive: isSensitiveName(name),
    hasVariableRef: hasVariableRef(value),
    position,
  };
}

// =============================================================================
// Env Validation
// =============================================================================

/**
 * Validate environment variables in an MCP server configuration.
 *
 * @param env - Environment variables object
 * @param file - Source file path
 * @param serverName - Server name
 * @param position - Position in source file
 * @returns Array of validation issues
 */
export function validateEnv(
  env: Record<string, string>,
  file: string,
  serverName: string,
  position: Position
): McpValidationIssue[] {
  const issues: McpValidationIssue[] = [];

  for (const [name, value] of Object.entries(env)) {
    // Handle non-string values gracefully
    const strValue = typeof value === 'string' ? value : String(value);
    const envInfo = analyzeEnvVar(name, strValue, position);

    // MCP014: Sensitive data in config
    // Only warn if the value is a literal (not a variable reference)
    if (envInfo.isSensitive && !envInfo.hasVariableRef) {
      issues.push(
        createIssue(
          'MCP014',
          `Server '${serverName}' has sensitive env var '${name}' with literal value`,
          file,
          position,
          serverName,
          name,
          undefined, // Don't expose the actual value
          { envInfo },
          `Use variable reference like \${${name}} instead of literal value`
        )
      );
    }

    // MCP023: Variable reference detected
    if (envInfo.hasVariableRef) {
      const refs = detectVariableRefs(strValue);
      issues.push(
        createIssue(
          'MCP023',
          `Server '${serverName}' env var '${name}' contains variable reference(s)`,
          file,
          position,
          serverName,
          name,
          strValue,
          { variableRefs: refs.map((r) => r.pattern), envInfo }
        )
      );
    }
  }

  return issues;
}
