/**
 * EP07 Causal Tracing Engine - Counterfactual Generator
 *
 * Generates counterfactual analysis following the format:
 * "If [X] were present, [Y] would not have occurred"
 *
 * @module src/tools/causal/counterfactual
 */

import type { Gap, GapLocation, CausalChain } from './types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for counterfactual generation.
 */
export interface CounterfactualOptions {
  /** Maximum length for the counterfactual statement */
  maxLength?: number;
  /** Include location name in the statement */
  includeLocation?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Location name mappings for human-readable output.
 */
const LOCATION_NAMES: Record<GapLocation, string> = {
  claude_md: 'CLAUDE.md',
  project_config: 'project settings (.claude/settings.json)',
  global_config: 'global user settings',
  mcp_config: '.mcp.json',
  skill: '.claude/skills/',
  other: 'configuration',
};

/**
 * Default maximum counterfactual length.
 */
const DEFAULT_MAX_LENGTH = 500;

// =============================================================================
// CounterfactualGenerator Class
// =============================================================================

/**
 * Generates counterfactual analysis for causal chains.
 *
 * Counterfactual statements follow the format:
 * "If [X] were present, [Y] would not have occurred"
 *
 * @example
 * ```typescript
 * const generator = new CounterfactualGenerator();
 *
 * const counterfactual = generator.generateFromGap({
 *   type: 'missing_guidance',
 *   location: 'claude_md',
 *   expectedGuidance: 'Error handling best practices',
 *   counterfactual: '', // Will be generated
 * });
 *
 * // Returns: 'If "Error handling best practices" were documented in CLAUDE.md, this issue would have been prevented'
 * ```
 */
export class CounterfactualGenerator {
  /**
   * Generate a counterfactual statement from a gap.
   *
   * @param gap - The gap to generate counterfactual for
   * @param options - Generation options
   * @returns Counterfactual statement
   */
  generateFromGap(gap: Gap, options: CounterfactualOptions = {}): string {
    const { maxLength = DEFAULT_MAX_LENGTH, includeLocation = true } = options;

    // If gap already has a specific counterfactual, use it
    if (gap.counterfactual && gap.counterfactual.length > 0) {
      return this.truncate(gap.counterfactual, maxLength);
    }

    // Generate counterfactual from gap properties
    const locationName = includeLocation
      ? (LOCATION_NAMES[gap.location] ?? 'configuration')
      : undefined;

    const guidance = this.sanitizeGuidance(gap.expectedGuidance);

    let statement: string;
    if (locationName) {
      statement = `If "${guidance}" were documented in ${locationName}, this issue would have been prevented`;
    } else {
      statement = `If "${guidance}" were documented, this issue would have been prevented`;
    }

    return this.truncate(statement, maxLength);
  }

  /**
   * Generate a counterfactual statement from a causal chain.
   *
   * @param chain - The causal chain
   * @param options - Generation options
   * @returns Counterfactual statement
   */
  generateFromChain(chain: CausalChain, options: CounterfactualOptions = {}): string {
    const { maxLength = DEFAULT_MAX_LENGTH } = options;

    // Priority 1: Use gap's counterfactual if present
    if (chain.gap?.counterfactual && chain.gap.counterfactual.length > 0) {
      return this.truncate(chain.gap.counterfactual, maxLength);
    }

    // Priority 2: Generate from gap if present
    if (chain.gap) {
      return this.generateFromGap(chain.gap, options);
    }

    // Priority 3: Use chain's own counterfactual if present
    if (chain.counterfactual && chain.counterfactual.length > 0) {
      return this.truncate(chain.counterfactual, maxLength);
    }

    // Priority 4: Generate generic counterfactual from effect
    return this.generateFromEffect(chain.effect, maxLength);
  }

  /**
   * Get the human-readable location name.
   *
   * @param location - The gap location
   * @returns Human-readable location name
   */
  getLocationName(location: GapLocation): string {
    return LOCATION_NAMES[location] ?? 'configuration';
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Sanitize guidance text for use in counterfactual.
   */
  private sanitizeGuidance(guidance: string): string {
    // Handle empty guidance
    if (!guidance || guidance.length === 0) {
      return 'appropriate guidance';
    }

    // Replace newlines with spaces
    let sanitized = guidance.replace(/[\r\n]+/g, ' ');

    // Collapse multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Truncate if too long (for readability in the counterfactual)
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100) + '...';
    }

    return sanitized;
  }

  /**
   * Truncate a string to maximum length.
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Generate a generic counterfactual from the effect description.
   */
  private generateFromEffect(effect: string, maxLength: number): string {
    const sanitized = effect.replace(/[\r\n]+/g, ' ').trim();
    const truncated = sanitized.length > 80 ? sanitized.substring(0, 80) + '...' : sanitized;

    const statement = `If proper guidance were present, the issue "${truncated}" would not have occurred`;
    return this.truncate(statement, maxLength);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new CounterfactualGenerator instance.
 *
 * @returns CounterfactualGenerator instance
 */
export function createCounterfactualGenerator(): CounterfactualGenerator {
  return new CounterfactualGenerator();
}

// =============================================================================
// Standalone Function
// =============================================================================

/**
 * Generate a counterfactual statement from a gap.
 *
 * This is a convenience function for one-off counterfactual generation.
 * For multiple generations, use `createCounterfactualGenerator()` to reuse the instance.
 *
 * @param gap - The gap to generate counterfactual for
 * @param options - Generation options
 * @returns Counterfactual statement
 */
export function generateCounterfactual(gap: Gap, options: CounterfactualOptions = {}): string {
  const generator = new CounterfactualGenerator();
  return generator.generateFromGap(gap, options);
}
