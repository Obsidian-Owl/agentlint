/**
 * EP11 Quality & Security - Pattern Module
 *
 * Exports for the Gitleaks pattern parser.
 *
 * @module security/patterns
 */

export {
  parseGitleaksToml,
  parseGitleaksTomlSync,
  parseGitleaksTomlContent,
  isValidRegex,
  getBundledPatternsPath,
} from './parser';
