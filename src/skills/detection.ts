/**
 * EP14: Skills Effectiveness Analysis - Skill Invocation Detection
 *
 * Extracts skill invocations from session log entries.
 * Looks for tool_use blocks with name="Skill".
 *
 * @module src/skills/detection
 */

import type { SessionEntry, ContentBlock } from '../tools/sessions/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Extracted skill invocation data from a session entry.
 */
export interface DetectedSkillInvocation {
  /** Name of the invoked skill */
  skillName: string;
  /** Timestamp of the invocation */
  timestamp: string;
  /** Session ID */
  sessionId: string;
  /** Truncated user prompt context */
  userPromptSnippet: string;
  /** Source file path (for causal tracing) */
  filePath: string | undefined;
  /** Line number in source file */
  lineNumber: number | undefined;
}

/**
 * Input arguments for the Skill tool.
 */
interface SkillToolInput {
  skill?: string;
  args?: string;
}

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Check if a session entry contains a Skill tool invocation.
 *
 * Per strategic review: `tool_use.name === "Skill"` in session logs.
 *
 * @param entry - Session entry to check
 * @returns True if entry contains a Skill tool_use
 */
export function isSkillInvocation(entry: SessionEntry): boolean {
  if (!entry.message?.content) {
    return false;
  }

  return entry.message.content.some(
    (block: ContentBlock) => block.type === 'tool_use' && block.name === 'Skill'
  );
}

/**
 * Extract skill command from a session entry.
 *
 * Parses the Skill tool_use input to get the skill name.
 *
 * @param entry - Session entry containing Skill tool_use
 * @returns Skill name or null if not found
 */
export function extractSkillCommand(entry: SessionEntry): string | null {
  if (!entry.message?.content) {
    return null;
  }

  for (const block of entry.message.content) {
    if (block.type === 'tool_use' && block.name === 'Skill' && block.input) {
      const input = block.input as SkillToolInput;
      // The skill name is in the 'skill' field of the input
      if (input.skill && typeof input.skill === 'string') {
        return input.skill;
      }
    }
  }

  return null;
}

/**
 * Extract user prompt context from nearby entries.
 *
 * Looks backwards from the skill invocation to find the most recent
 * user message, which provides context for why the skill was invoked.
 *
 * @param entries - Array of session entries (chronologically ordered)
 * @param invocationIndex - Index of the skill invocation entry
 * @param maxLength - Maximum length of snippet (default: 200)
 * @returns Truncated user prompt or empty string
 */
export function extractUserPromptContext(
  entries: SessionEntry[],
  invocationIndex: number,
  maxLength: number = 200
): string {
  // Look backwards from invocation to find user message
  for (let i = invocationIndex - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry) {
      continue;
    }

    // Skip non-user entries
    if (entry.message?.role !== 'user') {
      continue;
    }

    // Extract text from content blocks
    const text = extractTextFromEntry(entry);
    if (text) {
      return truncateText(text, maxLength);
    }
  }

  return '';
}

/**
 * Extract all text content from a session entry.
 *
 * @param entry - Session entry
 * @returns Combined text content or null
 */
function extractTextFromEntry(entry: SessionEntry): string | null {
  if (!entry.message?.content) {
    return null;
  }

  const textParts: string[] = [];

  for (const block of entry.message.content) {
    if (block.type === 'text' && block.text) {
      textParts.push(block.text);
    }
  }

  if (textParts.length === 0) {
    return null;
  }

  return textParts.join('\n');
}

/**
 * Truncate text to max length with ellipsis.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncateText(text: string, maxLength: number): string {
  // Clean up whitespace
  const cleaned = text.replace(/\s+/g, ' ').trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Detect all skill invocations in an array of session entries.
 *
 * @param entries - Array of session entries
 * @param sessionId - Session ID for the entries
 * @param filePath - Source file path (optional)
 * @returns Array of detected skill invocations
 */
export function detectSkillInvocations(
  entries: SessionEntry[],
  sessionId: string,
  filePath?: string
): DetectedSkillInvocation[] {
  const invocations: DetectedSkillInvocation[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) {
      continue;
    }

    if (!isSkillInvocation(entry)) {
      continue;
    }

    const skillName = extractSkillCommand(entry);
    if (!skillName) {
      continue;
    }

    const userPromptSnippet = extractUserPromptContext(entries, i);

    invocations.push({
      skillName,
      timestamp: entry.timestamp,
      sessionId: entry.sessionId ?? sessionId,
      userPromptSnippet,
      filePath: entry.filePath ?? filePath,
      lineNumber: entry.lineNumber,
    });
  }

  return invocations;
}

/**
 * Check if a content block is a Skill tool_use.
 *
 * Utility function for checking individual content blocks.
 *
 * @param block - Content block to check
 * @returns True if block is a Skill tool_use
 */
export function isSkillToolUse(block: ContentBlock): boolean {
  return block.type === 'tool_use' && block.name === 'Skill';
}
