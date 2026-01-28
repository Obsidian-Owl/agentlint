/**
 * Shared telemetry utilities for truncation and error extraction.
 * Used by both legacy Orchestrator and OpencodeOrchestrator.
 *
 * @module orchestration/telemetry-utils
 */

/**
 * Truncate tool output for telemetry to prevent excessive payload sizes.
 * Handles strings, objects, and arrays.
 *
 * @param output - Raw tool output
 * @param maxLength - Maximum length in characters (default 5000)
 * @returns Truncated output suitable for telemetry
 */
export function truncateToolOutput(output: unknown, maxLength = 5000): unknown {
  if (output === null || output === undefined) {
    return output;
  }

  // Handle strings
  if (typeof output === 'string') {
    if (output.length <= maxLength) {
      return output;
    }
    return output.slice(0, maxLength) + '... [truncated]';
  }

  // Handle arrays - truncate long arrays
  if (Array.isArray(output)) {
    const stringified = JSON.stringify(output);
    if (stringified.length <= maxLength) {
      return output;
    }
    // Return first few items with truncation notice
    const truncated = output.slice(0, 3);
    return {
      items: truncated,
      _truncated: true,
      _totalItems: output.length,
    };
  }

  // Handle objects - stringify and truncate
  if (typeof output === 'object') {
    const stringified = JSON.stringify(output);
    if (stringified.length <= maxLength) {
      return output;
    }
    return {
      _summary: stringified.slice(0, maxLength) + '... [truncated]',
      _truncated: true,
    };
  }

  // Return primitives as-is
  return output;
}

/**
 * Truncate tool input for telemetry to prevent excessive payload sizes.
 * Mirrors the output truncation pattern for consistency.
 *
 * @param input - Raw tool input
 * @param maxLength - Maximum length in characters (default 5000)
 * @returns Truncated input suitable for telemetry
 */
export function truncateToolInput(
  input: Record<string, unknown>,
  maxLength = 5000
): Record<string, unknown> {
  const stringified = JSON.stringify(input);

  if (stringified.length <= maxLength) {
    return input;
  }

  const truncated: Record<string, unknown> = {};
  let currentLength = 2; // Account for {}

  for (const [key, value] of Object.entries(input)) {
    const valueStr = JSON.stringify(value);

    if (currentLength + key.length + valueStr.length + 4 > maxLength) {
      // Truncate large string values, mark others as truncated
      if (typeof value === 'string' && value.length > 100) {
        truncated[key] = value.slice(0, 100) + '... [truncated]';
      } else {
        truncated[key] = '[truncated]';
      }
    } else {
      truncated[key] = value;
      currentLength += key.length + valueStr.length + 4;
    }
  }

  truncated._inputTruncated = true;
  truncated._originalSize = stringified.length;

  return truncated;
}

/**
 * Extract error message from tool output.
 * Handles various error formats from SDK.
 *
 * @param output - Raw tool output (usually error content)
 * @returns Extracted error message string
 */
export function extractErrorMessage(output: unknown): string | undefined {
  if (typeof output === 'string') {
    return output.slice(0, 500); // Limit error message length
  }

  if (Array.isArray(output) && output.length > 0) {
    // SDK often returns array with text content blocks
    const firstBlock = output[0] as unknown;
    if (typeof firstBlock === 'object' && firstBlock !== null && 'text' in firstBlock) {
      const textBlock = firstBlock as { text: unknown };
      return String(textBlock.text).slice(0, 500);
    }
    if (typeof firstBlock === 'string') {
      return firstBlock.slice(0, 500);
    }
  }

  if (typeof output === 'object' && output !== null) {
    // Try common error fields
    const obj = output as Record<string, unknown>;
    if ('message' in obj && typeof obj.message === 'string') {
      return obj.message.slice(0, 500);
    }
    if ('error' in obj && typeof obj.error === 'string') {
      return obj.error.slice(0, 500);
    }
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text.slice(0, 500);
    }
  }

  return undefined;
}
