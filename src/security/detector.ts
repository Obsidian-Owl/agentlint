/**
 * EP11 Quality & Security - Secret Detector
 *
 * Pattern-based secret detection using Gitleaks patterns.
 * Scans files for potential secrets and creates redacted candidates
 * for LLM validation.
 *
 * @module security/detector
 */

import { randomUUID } from 'crypto';
import {
  parseGitleaksToml,
  parseGitleaksTomlSync,
  getBundledPatternsPath,
} from './patterns/parser';
import { calculateEntropy } from './entropy';
import type {
  GitleaksRule,
  PatternSet,
  SecretCandidate,
  FileScanResult,
  SecretScanResult,
  ISecretDetector,
} from './types';
import { toSafeSecretCandidates } from './types';

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum context size in characters around a match.
 */
const CONTEXT_SIZE = 50;

/**
 * Redaction placeholder template.
 */
function createRedactedPlaceholder(ruleId: string, length: number): string {
  return `[REDACTED:${ruleId}:len=${length}]`;
}

// =============================================================================
// Compiled Rule
// =============================================================================

/**
 * A rule with compiled regex for performance.
 */
interface CompiledRule {
  /** Original rule */
  rule: GitleaksRule;

  /** Compiled regex */
  regex: RegExp;

  /** Compiled allowlist regexes */
  allowlistRegexes: RegExp[];

  /** Compiled allowlist paths */
  allowlistPaths: RegExp[];
}

/**
 * Compile a rule for scanning.
 */
function compileRule(rule: GitleaksRule): CompiledRule | null {
  try {
    // Add 'g' flag for global matching if not present
    const flags = rule.regex.includes('(?i)') ? 'gi' : 'g';
    const pattern = rule.regex.replace(/\(\?i\)/g, ''); // Remove inline case-insensitive flag
    const regex = new RegExp(pattern, flags);

    // Compile allowlist regexes
    const allowlistRegexes: RegExp[] = [];
    if (rule.allowlist?.regexes) {
      for (const al of rule.allowlist.regexes) {
        try {
          allowlistRegexes.push(new RegExp(al, 'i'));
        } catch {
          // Skip invalid allowlist regex
        }
      }
    }

    // Compile allowlist paths
    const allowlistPaths: RegExp[] = [];
    if (rule.allowlist?.paths) {
      for (const p of rule.allowlist.paths) {
        try {
          allowlistPaths.push(new RegExp(p, 'i'));
        } catch {
          // Skip invalid path regex
        }
      }
    }

    return { rule, regex, allowlistRegexes, allowlistPaths };
  } catch {
    // Invalid regex, skip this rule
    return null;
  }
}

// =============================================================================
// Secret Detector Implementation
// =============================================================================

/**
 * Secret detector using Gitleaks patterns.
 *
 * SAFETY: This class handles sensitive data. The `match` field in
 * SecretCandidate contains actual secrets and must NEVER be exposed
 * externally. Use `redactedContext` for all output.
 *
 * @example
 * const detector = new SecretDetector();
 * await detector.loadPatterns();
 * const result = await detector.scanFile('config.ts', content);
 */
export class SecretDetector implements ISecretDetector {
  private patterns: PatternSet | null = null;
  private compiledRules: CompiledRule[] = [];

  /**
   * Load patterns from a TOML file.
   *
   * @param tomlPath - Path to TOML file, or undefined to use bundled patterns
   * @returns Loaded pattern set
   */
  loadPatterns(tomlPath?: string): PatternSet {
    const path = tomlPath ?? getBundledPatternsPath();
    this.patterns = parseGitleaksToml(path);
    this.compileRules();
    return this.patterns;
  }

  /**
   * Load patterns synchronously.
   */
  loadPatternsSync(tomlPath?: string): PatternSet {
    const path = tomlPath ?? getBundledPatternsPath();
    this.patterns = parseGitleaksTomlSync(path);
    this.compileRules();
    return this.patterns;
  }

  /**
   * Compile all rules for scanning.
   */
  private compileRules(): void {
    this.compiledRules = [];
    if (!this.patterns) return;

    for (const rule of this.patterns.rules) {
      const compiled = compileRule(rule);
      if (compiled) {
        this.compiledRules.push(compiled);
      }
    }
  }

  /**
   * Get the currently loaded patterns.
   */
  getPatterns(): PatternSet | null {
    return this.patterns;
  }

  /**
   * Scan a single file for secrets.
   *
   * @param filePath - Path to the file (for context)
   * @param content - File content to scan
   * @returns Scan result with candidates
   */
  scanFile(filePath: string, content: string): FileScanResult {
    const startTime = performance.now();

    if (!this.patterns) {
      return {
        file: filePath,
        candidateCount: 0,
        candidates: [],
        durationMs: 0,
        error: 'Patterns not loaded. Call loadPatterns() first.',
      };
    }

    const candidates: SecretCandidate[] = [];
    const lines = content.split('\n');

    // Build line offset map for efficient position lookup
    const lineOffsets: number[] = [0];
    for (let i = 0; i < lines.length - 1; i++) {
      const currentOffset = lineOffsets[i];
      const currentLine = lines[i];
      if (currentOffset !== undefined && currentLine !== undefined) {
        lineOffsets.push(currentOffset + currentLine.length + 1); // +1 for newline
      }
    }

    // Scan with each rule
    for (const compiled of this.compiledRules) {
      const { rule, regex, allowlistRegexes, allowlistPaths } = compiled;

      // Check path allowlist
      if (allowlistPaths.length > 0) {
        const isPathAllowed = allowlistPaths.some((p) => p.test(filePath));
        if (isPathAllowed) continue;
      }

      // Keyword pre-filtering for performance
      if (rule.keywords && rule.keywords.length > 0) {
        const contentLower = content.toLowerCase();
        const hasKeyword = rule.keywords.some((kw) =>
          contentLower.includes(kw.toLowerCase())
        );
        if (!hasKeyword) continue;
      }

      // Reset regex lastIndex for global matching
      regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        // Get the actual secret value (considering secretGroup)
        let secretValue: string;
        if (rule.secretGroup !== undefined) {
          const groupValue = match[rule.secretGroup];
          secretValue = groupValue !== undefined ? groupValue : match[0];
        } else {
          secretValue = match[0];
        }

        // Check entropy threshold if specified
        if (rule.entropy !== undefined) {
          const entropy = calculateEntropy(secretValue);
          if (entropy < rule.entropy) continue;
        }

        // Check allowlist regexes
        const isAllowlisted = allowlistRegexes.some((al) =>
          al.test(secretValue)
        );
        if (isAllowlisted) continue;

        // Find line number
        const matchStart = match.index;
        let lineNumber = 1;
        for (let i = 0; i < lineOffsets.length; i++) {
          const offset = lineOffsets[i];
          if (offset !== undefined && offset > matchStart) {
            lineNumber = i;
            break;
          }
          lineNumber = i + 1;
        }

        // Calculate column
        const lineStart = lineOffsets[lineNumber - 1] ?? 0;
        const column = matchStart - lineStart;

        // Create redacted context
        const redactedContext = this.createRedactedContext(
          content,
          matchStart,
          secretValue.length,
          rule.id
        );

        // Create candidate
        const candidate: SecretCandidate = {
          id: randomUUID(),
          ruleId: rule.id,
          ruleDescription: rule.description,
          match: secretValue,
          redactedContext,
          entropy: calculateEntropy(secretValue),
          location: {
            file: filePath,
            line: lineNumber,
            column,
          },
          detectedAt: new Date().toISOString(),
        };

        if (rule.keywords) {
          candidate.keywords = rule.keywords;
        }

        candidates.push(candidate);
      }
    }

    const durationMs = performance.now() - startTime;

    // Create result WITHOUT the match field for serialization safety
    // Using Zod validation to enforce at runtime
    const safeCandidates = toSafeSecretCandidates(candidates);

    return {
      file: filePath,
      candidateCount: candidates.length,
      candidates: safeCandidates,
      durationMs,
    };
  }

  /**
   * Scan multiple files.
   *
   * @param files - Files to scan
   * @returns Aggregated scan results
   */
  scanFiles(
    files: Array<{ path: string; content: string }>
  ): SecretScanResult {
    const startTime = performance.now();

    const fileResults: FileScanResult[] = [];

    for (const file of files) {
      try {
        const result = this.scanFile(file.path, file.content);
        fileResults.push(result);

        // Note: We can't access the full candidates with match field here
        // since scanFile strips them for safety. For batch operations,
        // the caller should use scanFile directly if they need match values.
      } catch (error) {
        fileResults.push({
          file: file.path,
          candidateCount: 0,
          candidates: [],
          durationMs: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const durationMs = performance.now() - startTime;
    const totalCandidates = fileResults.reduce(
      (sum, r) => sum + r.candidateCount,
      0
    );

    return {
      scannedFiles: files.length,
      candidatesDetected: totalCandidates,
      classifiedSecrets: [], // Populated by classifier
      summary: {
        confirmed: 0,
        likely: 0,
        unlikely: 0,
        falsePositives: 0,
        needsReview: 0,
      },
      durationMs,
    };
  }

  /**
   * Create redacted context around a match.
   */
  private createRedactedContext(
    content: string,
    matchStart: number,
    matchLength: number,
    ruleId: string
  ): string {
    const contextStart = Math.max(0, matchStart - CONTEXT_SIZE);
    const contextEnd = Math.min(
      content.length,
      matchStart + matchLength + CONTEXT_SIZE
    );

    const before = content.slice(contextStart, matchStart);
    const redacted = createRedactedPlaceholder(ruleId, matchLength);
    const after = content.slice(matchStart + matchLength, contextEnd);

    // Add ellipsis if truncated
    const prefix = contextStart > 0 ? '...' : '';
    const suffix = contextEnd < content.length ? '...' : '';

    return `${prefix}${before}${redacted}${after}${suffix}`;
  }

  /**
   * Internal scan that returns full candidates with match field.
   * Use with caution - the match field contains actual secrets.
   *
   * @internal
   */
  scanFileInternal(
    filePath: string,
    content: string
  ): { candidates: SecretCandidate[]; durationMs: number } {
    const startTime = performance.now();

    if (!this.patterns) {
      return { candidates: [], durationMs: 0 };
    }

    const candidates: SecretCandidate[] = [];
    const lines = content.split('\n');
    const lineOffsets: number[] = [0];
    for (let i = 0; i < lines.length - 1; i++) {
      const currentOffset = lineOffsets[i];
      const currentLine = lines[i];
      if (currentOffset !== undefined && currentLine !== undefined) {
        lineOffsets.push(currentOffset + currentLine.length + 1);
      }
    }

    for (const compiled of this.compiledRules) {
      const { rule, regex, allowlistRegexes, allowlistPaths } = compiled;

      if (allowlistPaths.length > 0) {
        const isPathAllowed = allowlistPaths.some((p) => p.test(filePath));
        if (isPathAllowed) continue;
      }

      if (rule.keywords && rule.keywords.length > 0) {
        const contentLower = content.toLowerCase();
        const hasKeyword = rule.keywords.some((kw) =>
          contentLower.includes(kw.toLowerCase())
        );
        if (!hasKeyword) continue;
      }

      regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        let secretValue: string;
        if (rule.secretGroup !== undefined) {
          const groupValue = match[rule.secretGroup];
          secretValue = groupValue !== undefined ? groupValue : match[0];
        } else {
          secretValue = match[0];
        }

        if (rule.entropy !== undefined) {
          const entropy = calculateEntropy(secretValue);
          if (entropy < rule.entropy) continue;
        }

        const isAllowlisted = allowlistRegexes.some((al) =>
          al.test(secretValue)
        );
        if (isAllowlisted) continue;

        const matchStart = match.index;
        let lineNumber = 1;
        for (let i = 0; i < lineOffsets.length; i++) {
          const offset = lineOffsets[i];
          if (offset !== undefined && offset > matchStart) {
            lineNumber = i;
            break;
          }
          lineNumber = i + 1;
        }

        const lineStart = lineOffsets[lineNumber - 1] ?? 0;
        const column = matchStart - lineStart;

        const redactedContext = this.createRedactedContext(
          content,
          matchStart,
          secretValue.length,
          rule.id
        );

        const candidate: SecretCandidate = {
          id: randomUUID(),
          ruleId: rule.id,
          ruleDescription: rule.description,
          match: secretValue,
          redactedContext,
          entropy: calculateEntropy(secretValue),
          location: {
            file: filePath,
            line: lineNumber,
            column,
          },
          detectedAt: new Date().toISOString(),
        };

        if (rule.keywords) {
          candidate.keywords = rule.keywords;
        }

        candidates.push(candidate);
      }
    }

    return {
      candidates,
      durationMs: performance.now() - startTime,
    };
  }
}

/**
 * Create a new SecretDetector instance.
 */
export function createSecretDetector(): SecretDetector {
  return new SecretDetector();
}

/**
 * Create and initialize a SecretDetector with bundled patterns.
 */
export function createSecretDetectorWithPatterns(): SecretDetector {
  const detector = new SecretDetector();
  detector.loadPatterns();
  return detector;
}
