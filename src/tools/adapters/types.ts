/**
 * EP05 Config Analysis Tools - Adapter Interface
 *
 * Interface for ACT-specific adapters that normalize different
 * AI Coding Tool configuration formats.
 *
 * @module src/tools/adapters/types
 */

import type { Root } from 'mdast';
import type { ACTType, ConfigType, IssueSeverity } from '../types';
import type { ParsedConfig, Position } from '../config/types';

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
