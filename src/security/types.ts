/**
 * EP11 Quality & Security - Security Type Definitions
 *
 * TypeScript interfaces for secret detection and classification.
 *
 * @module security/types
 */

// =============================================================================
// Gitleaks Pattern Types
// =============================================================================

/**
 * A detection rule from Gitleaks TOML.
 */
export interface GitleaksRule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable description */
  description: string;

  /** Regex pattern for detection */
  regex: string;

  /** Keywords that must be present (optimization) */
  keywords?: string[];

  /** Minimum entropy threshold */
  entropy?: number;

  /** Capture group index for the secret (default: 0 = full match) */
  secretGroup?: number;

  /** Allowlist patterns for false positive reduction */
  allowlist?: {
    regexes?: string[];
    paths?: string[];
    commits?: string[];
  };
}

/**
 * Loaded pattern set.
 */
export interface PatternSet {
  /** Source of patterns (e.g., 'gitleaks.toml') */
  source: string;

  /** Version of the pattern file */
  version?: string;

  /** Loaded rules */
  rules: GitleaksRule[];

  /** Load timestamp */
  loadedAt: string;
}

// =============================================================================
// File Location
// =============================================================================

/**
 * Location in a file.
 */
export interface FileLocation {
  /** File path (absolute or relative) */
  file: string;

  /** Line number (1-indexed) */
  line: number;

  /** Column number (0-indexed, optional) */
  column?: number;
}

// =============================================================================
// Secret Candidate
// =============================================================================

/**
 * A potential secret detected by pattern matching.
 *
 * IMPORTANT: The `match` field contains the actual secret value.
 * It must NEVER be:
 * - Serialized to JSON
 * - Logged (even in debug mode)
 * - Transmitted to any external service
 * - Persisted to disk
 *
 * Use `redactedContext` for all external operations.
 */
export interface SecretCandidate {
  /** Unique identifier */
  id: string;

  /** Rule that detected this candidate */
  ruleId: string;

  /** Human-readable rule description */
  ruleDescription: string;

  /**
   * The actual matched secret value.
   * @internal NEVER expose this field externally.
   */
  match: string;

  /** Surrounding context with secret redacted */
  redactedContext: string;

  /** Shannon entropy of the matched value */
  entropy: number;

  /** Location in the file */
  location: FileLocation;

  /** Keywords that triggered the match */
  keywords?: string[];

  /** Detection timestamp */
  detectedAt: string;
}

// =============================================================================
// Secret Classification
// =============================================================================

/**
 * Classification result from LLM validation.
 */
export type SecretClassification =
  | 'confirmed' // High confidence real secret
  | 'likely' // Probable secret, recommend review
  | 'unlikely' // Probably false positive
  | 'false_positive' // Definitely not a secret
  | 'needs_review'; // Agent uncertain, human review needed

/**
 * A secret candidate after LLM validation.
 */
export interface ClassifiedSecret {
  /** Same as SecretCandidate.id */
  id: string;

  /** Reference to the original candidate */
  candidateId: string;

  /** Rule that detected this */
  ruleId: string;

  /** Classification result */
  classification: SecretClassification;

  /** Confidence score (0-1) */
  confidence: number;

  /** LLM's reasoning */
  reasoning: string;

  /** Suggested action for the user */
  recommendation: string;

  /** Location for reference */
  location: FileLocation;

  /** Validation timestamp */
  validatedAt: string;
}

// =============================================================================
// Detection Results
// =============================================================================

/**
 * Results from scanning a single file.
 */
export interface FileScanResult {
  /** File that was scanned */
  file: string;

  /** Number of candidates found */
  candidateCount: number;

  /** Candidates (without actual secret values in serialized form) */
  candidates: Omit<SecretCandidate, 'match'>[];

  /** Scan duration in milliseconds */
  durationMs: number;

  /** Any errors during scanning */
  error?: string;
}

/**
 * Aggregated scan results.
 */
export interface SecretScanResult {
  /** Number of files scanned */
  scannedFiles: number;

  /** Total candidates detected */
  candidatesDetected: number;

  /** Classified secrets (after LLM validation) */
  classifiedSecrets: ClassifiedSecret[];

  /** Summary by classification */
  summary: {
    confirmed: number;
    likely: number;
    unlikely: number;
    falsePositives: number;
    needsReview: number;
  };

  /** Total scan duration */
  durationMs: number;
}

// =============================================================================
// Detection Interface
// =============================================================================

/**
 * Interface for the secret detector.
 */
export interface ISecretDetector {
  /**
   * Load patterns from a TOML file.
   */
  loadPatterns(tomlPath: string): Promise<PatternSet>;

  /**
   * Scan a file for secrets.
   */
  scanFile(filePath: string, content: string): Promise<FileScanResult>;

  /**
   * Scan multiple files.
   */
  scanFiles(files: Array<{ path: string; content: string }>): Promise<SecretScanResult>;

  /**
   * Get loaded patterns.
   */
  getPatterns(): PatternSet | null;
}

/**
 * Interface for the secret classifier (LLM validation).
 */
export interface ISecretClassifier {
  /**
   * Classify a secret candidate using LLM.
   *
   * @param candidate - The candidate to classify (match field used internally only)
   * @returns Classification result
   */
  classify(candidate: SecretCandidate): Promise<ClassifiedSecret>;

  /**
   * Classify multiple candidates.
   */
  classifyBatch(candidates: SecretCandidate[]): Promise<ClassifiedSecret[]>;
}

// =============================================================================
// CLI Integration
// =============================================================================

/**
 * CLI options for secret detection.
 */
export interface SecretDetectionCLIOptions {
  /** Disable secret scanning (opt-out) */
  noSecrets?: boolean;
}
