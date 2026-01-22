/**
 * EP11 Quality & Security - Code-Based Grader
 *
 * First-tier evaluation that validates output structure and format
 * before LLM-as-judge evaluation runs. This is a fast, deterministic
 * check that gates the more expensive LLM evaluation.
 *
 * @module eval/graders/code-based
 */

import type { GoldenScenario, CodeBasedGrade, ICodeBasedGrader } from '../types';

// =============================================================================
// Types
// =============================================================================

/**
 * Analysis output structure for validation.
 */
interface AnalysisOutput {
  format_version?: unknown;
  command?: unknown;
  timestamp?: unknown;
  success?: unknown;
  findings?: Array<{
    id?: unknown;
    type?: unknown;
    severity?: unknown;
    description?: unknown;
    location?: {
      file?: string;
      line?: number;
    };
    origin?: unknown;
  }>;
  recommendations?: Array<{
    id?: unknown;
    title?: unknown;
    priority?: unknown;
    description?: unknown;
    findingIds?: string[];
  }>;
  metrics?: unknown;
}

/**
 * File reference for hallucination checking.
 */
interface FileReference {
  file: string;
  source: 'finding' | 'recommendation';
}

// =============================================================================
// CodeBasedGrader Implementation
// =============================================================================

/**
 * Code-based grader for structural validation.
 *
 * Performs four checks:
 * 1. Output format validation (format_version, success boolean)
 * 2. Required fields present (command, timestamp)
 * 3. No hallucinated file references
 * 4. Causal chain completeness (findings have origins)
 */
export class CodeBasedGrader implements ICodeBasedGrader {
  /**
   * Grade the analysis output against a scenario.
   */
  grade(scenario: GoldenScenario, output: unknown): CodeBasedGrade {
    const checks = {
      outputFormatValid: this.checkOutputFormat(output),
      requiredFieldsPresent: this.checkRequiredFields(output),
      noHallucinatedFiles: this.checkNoHallucinatedFiles(scenario, output),
      causalChainComplete: this.checkCausalChain(output),
    };

    const failedChecks = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);

    const result: CodeBasedGrade = {
      passed: failedChecks.length === 0,
      checks,
    };

    if (failedChecks.length > 0) {
      result.details = { failedChecks: failedChecks.join(', ') };
    }

    return result;
  }

  /**
   * Check that output has valid format (format_version string, success boolean).
   */
  private checkOutputFormat(output: unknown): boolean {
    if (typeof output !== 'object' || output === null) {
      return false;
    }

    const o = output as AnalysisOutput;
    return typeof o.format_version === 'string' && typeof o.success === 'boolean';
  }

  /**
   * Check that required fields are present.
   */
  private checkRequiredFields(output: unknown): boolean {
    if (typeof output !== 'object' || output === null) {
      return false;
    }

    const o = output as AnalysisOutput;
    return 'format_version' in o && 'command' in o && 'timestamp' in o && 'success' in o;
  }

  /**
   * Check that file references in findings don't reference non-existent files.
   *
   * For now, this is a simple check that validates files are from the input.
   * A real implementation would cross-reference against actual project files.
   */
  private checkNoHallucinatedFiles(scenario: GoldenScenario, output: unknown): boolean {
    if (typeof output !== 'object' || output === null) {
      return true; // No output = no hallucinations
    }

    const o = output as AnalysisOutput;
    const fileRefs = this.extractFileReferences(o);

    // Get known files from scenario input
    const knownFiles = this.getKnownFiles(scenario);

    // Check each reference
    for (const ref of fileRefs) {
      if (!this.isValidFileReference(ref.file, knownFiles)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract all file references from the output.
   */
  private extractFileReferences(output: AnalysisOutput): FileReference[] {
    const refs: FileReference[] = [];

    if (output.findings) {
      for (const finding of output.findings) {
        if (finding.location?.file) {
          refs.push({ file: finding.location.file, source: 'finding' });
        }
      }
    }

    return refs;
  }

  /**
   * Get known files from scenario input.
   */
  private getKnownFiles(scenario: GoldenScenario): Set<string> {
    const files = new Set<string>();

    // CLAUDE.md is always valid
    files.add('CLAUDE.md');
    files.add('claude.md');
    files.add('./CLAUDE.md');

    // .cursorrules is also valid
    files.add('.cursorrules');
    files.add('./.cursorrules');

    // Add any files mentioned in the input
    // This is a simple heuristic - could be expanded
    const claudeMd = scenario.input.claudeMd;
    const filePatterns = claudeMd.match(/`([^`]+\.[a-z]+)`/gi) || [];
    for (const match of filePatterns) {
      const file = match.replace(/`/g, '');
      files.add(file);
    }

    return files;
  }

  /**
   * Check if a file reference is valid.
   */
  private isValidFileReference(file: string, knownFiles: Set<string>): boolean {
    // Normalize the file path
    const normalized = file.replace(/^\.\//, '').toLowerCase();

    // Check against known files
    for (const known of knownFiles) {
      const knownNormalized = known.replace(/^\.\//, '').toLowerCase();
      if (normalized === knownNormalized) {
        return true;
      }
    }

    // Allow common config file patterns
    const commonPatterns = [
      /^claude\.md$/i,
      /^\.cursorrules$/i,
      /^\.claude\//i,
      /^package\.json$/i,
      /^tsconfig\.json$/i,
      /^\.env/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(file)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check that each finding has a traced origin (causal chain).
   */
  private checkCausalChain(output: unknown): boolean {
    if (typeof output !== 'object' || output === null) {
      return true; // No output = vacuously true
    }

    const o = output as AnalysisOutput;

    if (!o.findings || o.findings.length === 0) {
      return true; // No findings = nothing to check
    }

    // Each finding must have an origin
    for (const finding of o.findings) {
      if (!finding.origin) {
        return false;
      }
    }

    return true;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new CodeBasedGrader instance.
 */
export function createCodeBasedGrader(): CodeBasedGrader {
  return new CodeBasedGrader();
}

// =============================================================================
// Exports
// =============================================================================

export default CodeBasedGrader;
