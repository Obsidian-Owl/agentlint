/**
 * EP11 Quality & Security - Secret Detection Module
 *
 * Provides pattern-based secret detection with LLM validation layer.
 *
 * @module security
 */

// =============================================================================
// Types
// =============================================================================

export type {
  GitleaksRule,
  PatternSet,
  FileLocation,
  SecretCandidate,
  SecretClassification,
  ClassifiedSecret,
  FileScanResult,
  SecretScanResult,
  ISecretDetector,
  ISecretClassifier,
  SecretDetectionCLIOptions,
  SafeSecretCandidate,
} from './types';

// Zod schemas and validation helpers
export {
  FileLocationSchema,
  SecretCandidateSchema,
  SafeSecretCandidateSchema,
  toSafeSecretCandidate,
  toSafeSecretCandidates,
} from './types';

// =============================================================================
// Entropy Utilities
// =============================================================================

export {
  calculateEntropy,
  calculateNormalizedEntropy,
  detectCharacterSet,
  getMaxEntropyForCharSet,
  analyzeEntropy,
  isLikelySecret,
  calculateWindowEntropy,
  DEFAULT_ENTROPY_THRESHOLD,
  HIGH_ENTROPY_THRESHOLD,
  CHAR_SETS,
} from './entropy';

export type { EntropyAnalysis } from './entropy';

// =============================================================================
// Pattern Parser
// =============================================================================

export {
  parseGitleaksToml,
  parseGitleaksTomlSync,
  parseGitleaksTomlContent,
  isValidRegex,
  getBundledPatternsPath,
} from './patterns/parser';

// =============================================================================
// Secret Detector
// =============================================================================

export { SecretDetector, createSecretDetector, createSecretDetectorWithPatterns } from './detector';

// =============================================================================
// Secret Classifier
// =============================================================================

export { SecretClassifier, createSecretClassifier, classifySecretTool } from './classifier';
