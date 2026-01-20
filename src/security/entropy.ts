/**
 * EP11 Quality & Security - Entropy Calculation
 *
 * Shannon entropy calculation for secret candidate scoring.
 * High entropy strings are more likely to be secrets (API keys, tokens, etc.)
 * as they typically contain random or pseudo-random characters.
 *
 * Entropy is measured in bits per character. For reference:
 * - English text: ~1.0-1.5 bits/char
 * - Base64 encoded: ~5.0-6.0 bits/char
 * - Random alphanumeric: ~5.5-5.9 bits/char
 * - Random hex: ~4.0 bits/char
 *
 * @module security/entropy
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Default minimum entropy threshold for secret detection.
 * Values above this are considered potentially high-entropy secrets.
 */
export const DEFAULT_ENTROPY_THRESHOLD = 3.5;

/**
 * High entropy threshold indicating very likely to be a secret.
 */
export const HIGH_ENTROPY_THRESHOLD = 4.5;

/**
 * Character sets for entropy calculation.
 */
export const CHAR_SETS = {
  /** Base64 character set (64 characters, 6 bits/char max) */
  BASE64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',

  /** Hexadecimal character set (16 characters, 4 bits/char max) */
  HEX: '0123456789abcdefABCDEF',

  /** Alphanumeric character set (62 characters, ~5.95 bits/char max) */
  ALPHANUMERIC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
} as const;

// =============================================================================
// Shannon Entropy Calculation
// =============================================================================

/**
 * Calculate the Shannon entropy of a string.
 *
 * Shannon entropy measures the average information content per character.
 * Formula: H = -Σ p(x) * log2(p(x))
 *
 * Where p(x) is the probability of character x appearing in the string.
 *
 * @param input - The string to calculate entropy for
 * @returns Entropy in bits per character (0 to ~8 for ASCII)
 *
 * @example
 * calculateEntropy('aaaa')           // ~0.0 (no randomness)
 * calculateEntropy('abcd')           // 2.0 (uniform distribution, 4 chars)
 * calculateEntropy('aB3$fG9!')       // ~3.0 (mixed case, digits, symbols)
 * calculateEntropy('sk_live_abc123') // Higher entropy, likely API key
 */
export function calculateEntropy(input: string): number {
  if (!input || input.length === 0) {
    return 0;
  }

  // Count character frequencies
  const frequencies = new Map<string, number>();
  for (const char of input) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }

  // Calculate entropy
  const length = input.length;
  let entropy = 0;

  for (const count of frequencies.values()) {
    const probability = count / length;
    // Using log2 for bits: H = -Σ p * log2(p)
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Calculate entropy normalized to a 0-1 scale based on string length.
 *
 * This accounts for the maximum possible entropy given the string length,
 * making it easier to compare strings of different lengths.
 *
 * @param input - The string to calculate normalized entropy for
 * @returns Normalized entropy (0 to 1)
 */
export function calculateNormalizedEntropy(input: string): number {
  if (!input || input.length <= 1) {
    return 0;
  }

  const entropy = calculateEntropy(input);

  // Maximum entropy is log2(n) for n unique characters
  // For a string of length L, max is log2(min(L, 256)) assuming ASCII
  const maxPossibleUnique = Math.min(input.length, 256);
  const maxEntropy = Math.log2(maxPossibleUnique);

  if (maxEntropy === 0) {
    return 0;
  }

  return entropy / maxEntropy;
}

// =============================================================================
// Character Set Detection
// =============================================================================

/**
 * Detect the likely character set of a string.
 *
 * @param input - The string to analyze
 * @returns The detected character set type
 */
export function detectCharacterSet(
  input: string
): 'hex' | 'base64' | 'alphanumeric' | 'mixed' {
  if (!input || input.length === 0) {
    return 'mixed';
  }

  // Check if all characters are hex
  const isHex = /^[0-9a-fA-F]+$/.test(input);
  if (isHex) {
    return 'hex';
  }

  // Check if all characters are base64
  const isBase64 = /^[A-Za-z0-9+/=]+$/.test(input);
  if (isBase64) {
    return 'base64';
  }

  // Check if all characters are alphanumeric
  const isAlphanumeric = /^[A-Za-z0-9]+$/.test(input);
  if (isAlphanumeric) {
    return 'alphanumeric';
  }

  return 'mixed';
}

/**
 * Get the theoretical maximum entropy for a character set.
 *
 * @param charSet - The character set type
 * @returns Maximum bits per character
 */
export function getMaxEntropyForCharSet(
  charSet: 'hex' | 'base64' | 'alphanumeric' | 'mixed'
): number {
  switch (charSet) {
    case 'hex':
      return 4.0; // log2(16) = 4
    case 'base64':
      return 6.0; // log2(64) = 6
    case 'alphanumeric':
      return 5.954; // log2(62) ≈ 5.954
    case 'mixed':
      return 6.6; // log2(95) ≈ 6.57 (printable ASCII)
  }
}

// =============================================================================
// Secret Likelihood Scoring
// =============================================================================

/**
 * Result of entropy analysis for a potential secret.
 */
export interface EntropyAnalysis {
  /** Raw Shannon entropy (bits per character) */
  entropy: number;

  /** Normalized entropy (0-1 scale) */
  normalizedEntropy: number;

  /** Detected character set */
  characterSet: 'hex' | 'base64' | 'alphanumeric' | 'mixed';

  /** Whether entropy exceeds the default threshold */
  isHighEntropy: boolean;

  /** Whether entropy is very high (likely secret) */
  isVeryHighEntropy: boolean;

  /** Entropy as percentage of theoretical max for detected charset */
  entropyEfficiency: number;
}

/**
 * Analyze a string for entropy characteristics.
 *
 * @param input - The string to analyze
 * @param threshold - Custom entropy threshold (default: DEFAULT_ENTROPY_THRESHOLD)
 * @returns Comprehensive entropy analysis
 *
 * @example
 * const result = analyzeEntropy('xY7mK9pL2qR5sT8vW');
 * // {
 * //   entropy: 4.09,
 * //   normalizedEntropy: 1.0,
 * //   characterSet: 'alphanumeric',
 * //   isHighEntropy: true,
 * //   isVeryHighEntropy: false,
 * //   entropyEfficiency: 0.69
 * // }
 */
export function analyzeEntropy(
  input: string,
  threshold: number = DEFAULT_ENTROPY_THRESHOLD
): EntropyAnalysis {
  const entropy = calculateEntropy(input);
  const normalizedEntropy = calculateNormalizedEntropy(input);
  const characterSet = detectCharacterSet(input);
  const maxEntropy = getMaxEntropyForCharSet(characterSet);

  return {
    entropy,
    normalizedEntropy,
    characterSet,
    isHighEntropy: entropy >= threshold,
    isVeryHighEntropy: entropy >= HIGH_ENTROPY_THRESHOLD,
    entropyEfficiency: maxEntropy > 0 ? entropy / maxEntropy : 0,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a string likely contains a secret based on entropy alone.
 *
 * This is a quick heuristic check. For comprehensive detection,
 * use pattern matching combined with entropy analysis.
 *
 * @param input - The string to check
 * @param minLength - Minimum length to consider (default: 16)
 * @param threshold - Entropy threshold (default: DEFAULT_ENTROPY_THRESHOLD)
 * @returns true if the string has high entropy and sufficient length
 */
export function isLikelySecret(
  input: string,
  minLength: number = 16,
  threshold: number = DEFAULT_ENTROPY_THRESHOLD
): boolean {
  if (!input || input.length < minLength) {
    return false;
  }

  const entropy = calculateEntropy(input);
  return entropy >= threshold;
}

/**
 * Calculate entropy for a substring window.
 *
 * Useful for finding high-entropy regions within larger strings.
 *
 * @param input - The full string
 * @param start - Start index
 * @param length - Window length
 * @returns Entropy of the window, or 0 if out of bounds
 */
export function calculateWindowEntropy(
  input: string,
  start: number,
  length: number
): number {
  if (start < 0 || start + length > input.length) {
    return 0;
  }

  return calculateEntropy(input.slice(start, start + length));
}
