/**
 * EP11 Quality & Security - Gitleaks TOML Parser
 *
 * Parses Gitleaks TOML pattern files into typed GitleaksRule objects.
 *
 * @module security/patterns/parser
 */

import { readFileSync } from 'fs';
import { parse as parseTOML } from 'toml';
import type { GitleaksRule, PatternSet } from '../types';

// =============================================================================
// Raw TOML Types (what we parse from the file)
// =============================================================================

/**
 * Raw allowlist configuration from TOML.
 */
interface RawAllowlist {
  description?: string;
  regexes?: string[];
  paths?: string[];
  commits?: string[];
  stopwords?: string[];
  regexTarget?: string;
}

/**
 * Raw rule from TOML.
 */
interface RawRule {
  id: string;
  description: string;
  regex: string;
  keywords?: string[];
  entropy?: number;
  secretGroup?: number;
  path?: string;
  allowlist?: RawAllowlist;
  allowlists?: RawAllowlist[];
}

/**
 * Root TOML structure.
 */
interface RawGitleaksConfig {
  title?: string;
  minVersion?: string;
  allowlist?: RawAllowlist;
  rules?: RawRule[];
}

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Parse a single rule from raw TOML data.
 */
function parseRule(raw: RawRule): GitleaksRule {
  const rule: GitleaksRule = {
    id: raw.id,
    description: raw.description,
    regex: raw.regex,
  };

  // Optional fields
  if (raw.keywords && raw.keywords.length > 0) {
    rule.keywords = raw.keywords;
  }

  if (typeof raw.entropy === 'number') {
    rule.entropy = raw.entropy;
  }

  if (typeof raw.secretGroup === 'number') {
    rule.secretGroup = raw.secretGroup;
  }

  // Merge allowlist and allowlists (Gitleaks supports both)
  const allowlists: RawAllowlist[] = [];
  if (raw.allowlist) {
    allowlists.push(raw.allowlist);
  }
  if (raw.allowlists) {
    allowlists.push(...raw.allowlists);
  }

  if (allowlists.length > 0) {
    const mergedAllowlist: GitleaksRule['allowlist'] = {};

    for (const al of allowlists) {
      if (al.regexes && al.regexes.length > 0) {
        mergedAllowlist.regexes = [
          ...(mergedAllowlist.regexes || []),
          ...al.regexes,
        ];
      }
      if (al.paths && al.paths.length > 0) {
        mergedAllowlist.paths = [
          ...(mergedAllowlist.paths || []),
          ...al.paths,
        ];
      }
      if (al.commits && al.commits.length > 0) {
        mergedAllowlist.commits = [
          ...(mergedAllowlist.commits || []),
          ...al.commits,
        ];
      }
    }

    // Only add if there's content
    if (
      mergedAllowlist.regexes?.length ||
      mergedAllowlist.paths?.length ||
      mergedAllowlist.commits?.length
    ) {
      rule.allowlist = mergedAllowlist;
    }
  }

  return rule;
}

/**
 * Parse a Gitleaks TOML file into a PatternSet.
 *
 * @param tomlPath - Path to the TOML file
 * @returns Parsed pattern set
 * @throws Error if file cannot be read or parsed
 *
 * @example
 * const patterns = await parseGitleaksToml('gitleaks.toml');
 * console.log(`Loaded ${patterns.rules.length} rules`);
 */
export function parseGitleaksToml(tomlPath: string): PatternSet {
  // Read the file
  const content = readFileSync(tomlPath, 'utf-8');

  // Parse TOML
  const raw = parseTOML(content) as RawGitleaksConfig;

  // Extract version from minVersion if present
  const version = raw.minVersion?.replace(/^v/, '');

  // Parse rules
  const rules: GitleaksRule[] = [];
  if (raw.rules && Array.isArray(raw.rules)) {
    for (const rawRule of raw.rules) {
      try {
        const rule = parseRule(rawRule);
        rules.push(rule);
      } catch (error) {
        // Skip invalid rules but log warning
        console.warn(
          `Warning: Skipping invalid rule '${rawRule.id}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // Build result with proper handling of optional version
  const result: PatternSet = {
    source: tomlPath,
    rules,
    loadedAt: new Date().toISOString(),
  };
  if (version !== undefined) {
    result.version = version;
  }
  return result;
}

/**
 * Synchronous version of parseGitleaksToml.
 *
 * @param tomlPath - Path to the TOML file
 * @returns Parsed pattern set
 */
export function parseGitleaksTomlSync(tomlPath: string): PatternSet {
  // Read the file
  const content = readFileSync(tomlPath, 'utf-8');

  // Parse TOML
  const raw = parseTOML(content) as RawGitleaksConfig;

  // Extract version from minVersion if present
  const version = raw.minVersion?.replace(/^v/, '');

  // Parse rules
  const rules: GitleaksRule[] = [];
  if (raw.rules && Array.isArray(raw.rules)) {
    for (const rawRule of raw.rules) {
      try {
        const rule = parseRule(rawRule);
        rules.push(rule);
      } catch (error) {
        console.warn(
          `Warning: Skipping invalid rule '${rawRule.id}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // Build result with proper handling of optional version
  const result: PatternSet = {
    source: tomlPath,
    rules,
    loadedAt: new Date().toISOString(),
  };
  if (version !== undefined) {
    result.version = version;
  }
  return result;
}

/**
 * Parse TOML content directly (without reading from file).
 *
 * @param content - TOML content string
 * @param sourceName - Name to use for the source field
 * @returns Parsed pattern set
 */
export function parseGitleaksTomlContent(
  content: string,
  sourceName: string = 'inline'
): PatternSet {
  const raw = parseTOML(content) as RawGitleaksConfig;
  const version = raw.minVersion?.replace(/^v/, '');

  const rules: GitleaksRule[] = [];
  if (raw.rules && Array.isArray(raw.rules)) {
    for (const rawRule of raw.rules) {
      try {
        const rule = parseRule(rawRule);
        rules.push(rule);
      } catch (error) {
        console.warn(
          `Warning: Skipping invalid rule '${rawRule.id}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // Build result with proper handling of optional version
  const result: PatternSet = {
    source: sourceName,
    rules,
    loadedAt: new Date().toISOString(),
  };
  if (version !== undefined) {
    result.version = version;
  }
  return result;
}

/**
 * Validate that a regex pattern is valid JavaScript regex.
 *
 * @param pattern - Regex pattern string
 * @returns true if valid, false otherwise
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the bundled gitleaks.toml path.
 *
 * @returns Absolute path to the bundled patterns file
 */
export function getBundledPatternsPath(): string {
  return new URL('./gitleaks.toml', import.meta.url).pathname;
}
