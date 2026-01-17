/**
 * EP06 Session Analysis Tools - Utility Functions
 *
 * Path encoding/decoding and other utilities for session analysis.
 *
 * @module src/tools/sessions/utils
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default location for Claude Code session logs.
 */
export const DEFAULT_CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * Default location for agentlint data.
 */
export const DEFAULT_AGENTLINT_DIR = join(homedir(), '.agentlint');

/**
 * Default path to the sessions FTS5 database.
 */
export const DEFAULT_SESSIONS_DB_PATH = join(DEFAULT_AGENTLINT_DIR, 'sessions.db');

// =============================================================================
// Path Encoding/Decoding
// =============================================================================

/**
 * Decode a project path from Claude Code's encoded directory name format.
 *
 * Claude Code encodes project paths by replacing forward slashes with dashes.
 * For example:
 * - `/Users/foo/bar` becomes `-Users-foo-bar`
 * - `/home/user/projects/myapp` becomes `-home-user-projects-myapp`
 *
 * @param encodedPath - The encoded directory name (e.g., `-Users-foo-bar`)
 * @returns The decoded project path (e.g., `/Users/foo/bar`)
 *
 * @example
 * ```typescript
 * decodeProjectPath('-Users-dmccarthy-Projects-agentlint');
 * // Returns: '/Users/dmccarthy/Projects/agentlint'
 * ```
 *
 * @note Directory names that originally contained dashes are indistinguishable
 * from path separators. Both encoded and decoded paths should be stored.
 */
export function decodeProjectPath(encodedPath: string): string {
  // Remove leading dash and replace all dashes with slashes
  return encodedPath.replace(/^-/, '/').replace(/-/g, '/');
}

/**
 * Encode a project path to Claude Code's directory name format.
 *
 * This is the reverse of decodeProjectPath - converts forward slashes to dashes.
 *
 * @param projectPath - The project path (e.g., `/Users/foo/bar`)
 * @returns The encoded directory name (e.g., `-Users-foo-bar`)
 *
 * @example
 * ```typescript
 * encodeProjectPath('/Users/dmccarthy/Projects/agentlint');
 * // Returns: '-Users-dmccarthy-Projects-agentlint'
 * ```
 */
export function encodeProjectPath(projectPath: string): string {
  // Replace leading slash with dash and all slashes with dashes
  return projectPath.replace(/^\//, '-').replace(/\//g, '-');
}

/**
 * Extract the project path from a full file path within the Claude projects directory.
 *
 * @param filePath - Full path to a session log file
 * @param projectsDir - Base directory containing project directories (defaults to ~/.claude/projects)
 * @returns Object containing encoded path, decoded path, and remaining file path
 *
 * @example
 * ```typescript
 * extractProjectPath('/Users/user/.claude/projects/-Users-foo-bar/abc123.jsonl');
 * // Returns: {
 * //   encodedPath: '-Users-foo-bar',
 * //   decodedPath: '/Users/foo/bar',
 * //   relativePath: 'abc123.jsonl'
 * // }
 * ```
 */
export function extractProjectPath(
  filePath: string,
  projectsDir: string = DEFAULT_CLAUDE_PROJECTS_DIR
): { encodedPath: string; decodedPath: string; relativePath: string } | null {
  // Normalize paths
  const normalizedFile = filePath.replace(/\\/g, '/');
  const normalizedDir = projectsDir.replace(/\\/g, '/').replace(/\/$/, '');

  // Check if file is within projects directory
  if (!normalizedFile.startsWith(normalizedDir + '/')) {
    return null;
  }

  // Extract relative path after projects directory
  const relativeToProjets = normalizedFile.slice(normalizedDir.length + 1);

  // Split into project directory and remaining path
  const firstSlash = relativeToProjets.indexOf('/');
  if (firstSlash === -1) {
    // File is directly in projects dir (unusual case)
    return null;
  }

  const encodedPath = relativeToProjets.slice(0, firstSlash);
  const relativePath = relativeToProjets.slice(firstSlash + 1);
  const decodedPath = decodeProjectPath(encodedPath);

  return {
    encodedPath,
    decodedPath,
    relativePath,
  };
}

// =============================================================================
// Session ID Utilities
// =============================================================================

/**
 * Extract the session ID from a JSONL filename.
 *
 * Claude Code session log filenames are UUIDs with .jsonl extension.
 *
 * @param filename - The filename (e.g., `abc123-def456.jsonl`)
 * @returns The session ID or null if not a valid session file
 *
 * @example
 * ```typescript
 * extractSessionId('d9d9f969-cd10-4814-bdbc-0e366c2c9e65.jsonl');
 * // Returns: 'd9d9f969-cd10-4814-bdbc-0e366c2c9e65'
 * ```
 */
export function extractSessionId(filename: string): string | null {
  // UUID pattern: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const match = filename.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i
  );
  return match?.[1] ?? null;
}

/**
 * Check if a filename is a valid session log file.
 *
 * @param filename - The filename to check
 * @returns True if the filename is a valid session log file
 */
export function isSessionLogFile(filename: string): boolean {
  return extractSessionId(filename) !== null;
}

// =============================================================================
// Tool Categorization
// =============================================================================

/**
 * Read-oriented tools.
 */
const READ_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'View',
  'List',
  'Cat',
  'Head',
  'Tail',
  'Find',
  'Search',
  'LS',
]);

/**
 * Write-oriented tools.
 */
const WRITE_TOOLS = new Set([
  'Write',
  'Edit',
  'Create',
  'Delete',
  'Remove',
  'Move',
  'Copy',
  'Rename',
  'Mkdir',
  'Touch',
  'NotebookEdit',
]);

/**
 * Bash/command execution tools.
 */
const BASH_TOOLS = new Set(['Bash', 'Shell', 'Exec', 'Run', 'Command', 'Terminal']);

/**
 * Search-oriented tools.
 */
const SEARCH_TOOLS = new Set(['WebSearch', 'WebFetch', 'Search', 'Grep', 'Ripgrep', 'Ag', 'Ack']);

/**
 * Categorize a tool by its name.
 *
 * @param toolName - The name of the tool
 * @returns The category: 'read', 'write', 'bash', 'search', or 'other'
 *
 * @example
 * ```typescript
 * categorizeToolByName('Read');  // Returns: 'read'
 * categorizeToolByName('Edit');  // Returns: 'write'
 * categorizeToolByName('Bash');  // Returns: 'bash'
 * categorizeToolByName('WebSearch');  // Returns: 'search'
 * categorizeToolByName('Custom');  // Returns: 'other'
 * ```
 */
export function categorizeToolByName(
  toolName: string
): 'read' | 'write' | 'bash' | 'search' | 'other' {
  const normalized = toolName.trim();

  if (BASH_TOOLS.has(normalized)) {
    return 'bash';
  }
  if (WRITE_TOOLS.has(normalized)) {
    return 'write';
  }
  if (SEARCH_TOOLS.has(normalized)) {
    return 'search';
  }
  if (READ_TOOLS.has(normalized)) {
    return 'read';
  }

  return 'other';
}

// =============================================================================
// Timestamp Utilities
// =============================================================================

/**
 * Parse an ISO-8601 timestamp to a Date object.
 *
 * @param timestamp - ISO-8601 timestamp string
 * @returns Date object or null if invalid
 */
export function parseTimestamp(timestamp: string): Date | null {
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if a timestamp falls within a date range.
 *
 * @param timestamp - ISO-8601 timestamp to check
 * @param since - Start of range (inclusive), optional
 * @param until - End of range (inclusive), optional
 * @returns True if timestamp is within range
 */
export function isWithinDateRange(timestamp: string, since?: string, until?: string): boolean {
  const date = parseTimestamp(timestamp);
  if (!date) return false;

  if (since) {
    const sinceDate = parseTimestamp(since);
    if (sinceDate && date < sinceDate) return false;
  }

  if (until) {
    const untilDate = parseTimestamp(until);
    if (untilDate && date > untilDate) return false;
  }

  return true;
}

// =============================================================================
// Content Extraction
// =============================================================================

/**
 * Extract plain text content from message content blocks.
 *
 * @param content - Array of content blocks
 * @returns Concatenated text content
 */
export function extractTextFromContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text!)
    .join('\n');
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
