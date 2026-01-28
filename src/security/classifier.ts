/**
 * EP11 Quality & Security - Secret Classifier
 *
 * LLM validation layer for secret classification.
 * Provides both a tool for agent invocation and a programmatic interface.
 *
 * The classifier uses the redacted context (never the actual secret) to
 * determine if a pattern match is a real secret or a false positive.
 *
 * @module security/classifier
 */

import { z } from 'zod';
import { adaptTool } from '../opencode/tool-adapter';
import { randomUUID } from 'crypto';
import type {
  SecretCandidate,
  ClassifiedSecret,
  SecretClassification,
  ISecretClassifier,
} from './types';

// =============================================================================
// Classification Schema
// =============================================================================

/**
 * Zod schema for classification input.
 */
const classifySecretInputSchema = {
  candidateId: z.string().describe('Unique ID of the candidate'),
  ruleId: z.string().describe('ID of the rule that detected this candidate'),
  ruleDescription: z.string().describe('Description of what the rule detects'),
  redactedContext: z.string().describe('Surrounding code context with the actual value redacted'),
  entropy: z.number().describe('Shannon entropy of the matched value (0-8)'),
  filePath: z.string().describe('Path to the file containing the candidate'),
  line: z.number().describe('Line number in the file'),
  keywords: z.array(z.string()).optional().describe('Keywords that triggered the match'),
};

/**
 * Zod schema for classification output.
 */
const _classificationResultSchema = z.object({
  classification: z
    .enum(['confirmed', 'likely', 'unlikely', 'false_positive', 'needs_review'])
    .describe('Classification result'),
  confidence: z.number().min(0).max(1).describe('Confidence score (0.0 to 1.0)'),
  reasoning: z.string().describe('Explanation for the classification'),
  recommendation: z.string().describe('Suggested action for the user'),
});

type ClassificationResult = z.infer<typeof _classificationResultSchema>;

// =============================================================================
// Classification Tool
// =============================================================================

/**
 * classify_secret tool definition.
 *
 * Analyzes a secret candidate's redacted context to determine if it's
 * a real secret or a false positive.
 *
 * IMPORTANT: This tool operates on REDACTED context only.
 * The actual secret value is never passed to or processed by this tool.
 *
 * @example
 * ```typescript
 * import { classifySecretTool } from './security/classifier';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(classifySecretTool);
 * ```
 */
export const classifySecretTool = adaptTool({
  name: 'classify_secret',
  description: `Analyze a potential secret candidate to determine if it's a real secret or false positive.

You will receive:
- redactedContext: Code snippet with the actual value replaced by [REDACTED:rule-id:len=N]
- ruleId: The detection rule that flagged this (e.g., "aws-access-token", "github-pat")
- entropy: Shannon entropy of the matched value (higher = more random = more likely real)
- filePath: Where this was found
- keywords: Terms that triggered the match

Analyze the context and classify as:
- "confirmed": High confidence this is a real, active secret (>90% sure)
- "likely": Probably a real secret, recommend review (70-90% sure)
- "unlikely": Probably a false positive (30-70% sure)
- "false_positive": Definitely not a secret (<30% sure)
- "needs_review": Ambiguous, requires human judgment

Consider these factors:
1. Variable naming: "example", "test", "placeholder", "dummy" suggest false positive
2. File location: test/, fixtures/, examples/ suggest false positive
3. Comments indicating it's fake or for testing
4. Entropy: Low entropy (<3.0) suggests placeholder, high (>4.0) suggests real
5. Rule type: Some patterns (like private keys) are more definitive
6. Assignment patterns: process.env.X or os.getenv() are references, not secrets

Return your classification with confidence score and reasoning.`,
  schema: classifySecretInputSchema,
  handler: async (args: unknown) => {
    // The tool implementation provides a baseline heuristic classification.
    // In practice, the LLM agent calling this tool will use its reasoning
    // capabilities to provide the actual classification based on context.
    //
    // This implementation provides a fallback for programmatic use.

    await Promise.resolve();

    const typedArgs = args as {
      candidateId: string;
      ruleId: string;
      redactedContext: string;
      entropy: number;
      filePath: string;
      keywords?: string[];
    };

    const analysisInput: CandidateAnalysis = {
      candidateId: typedArgs.candidateId,
      ruleId: typedArgs.ruleId,
      redactedContext: typedArgs.redactedContext,
      entropy: typedArgs.entropy,
      filePath: typedArgs.filePath,
    };
    if (typedArgs.keywords !== undefined) {
      analysisInput.keywords = typedArgs.keywords;
    }

    const classification = analyzeCandidate(analysisInput);

    // Tool must return content array per SDK requirements
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(classification, null, 2),
        },
      ],
    };
  },
});

// =============================================================================
// Heuristic Analysis (Fallback)
// =============================================================================

interface CandidateAnalysis {
  candidateId: string;
  ruleId: string;
  redactedContext: string;
  entropy: number;
  filePath: string;
  keywords?: string[];
}

/**
 * Analyze a candidate using heuristics.
 * This is a fallback when LLM classification is not available.
 */
function analyzeCandidate(candidate: CandidateAnalysis): ClassificationResult {
  const signals: string[] = [];
  let score = 0.5; // Start neutral

  // Check entropy
  if (candidate.entropy >= 4.5) {
    score += 0.2;
    signals.push('High entropy suggests random value');
  } else if (candidate.entropy >= 3.5) {
    score += 0.1;
    signals.push('Moderate entropy');
  } else if (candidate.entropy < 3.0) {
    score -= 0.2;
    signals.push('Low entropy suggests non-random value');
  }

  // Check file path for test/example indicators
  const pathLower = candidate.filePath.toLowerCase();
  const testPathPatterns = [
    /\btest[s]?\b/,
    /\bspec[s]?\b/,
    /\bfixture[s]?\b/,
    /\bexample[s]?\b/,
    /\bmock[s]?\b/,
    /\b__test__\b/,
    /\.test\./,
    /\.spec\./,
  ];

  for (const pattern of testPathPatterns) {
    if (pattern.test(pathLower)) {
      score -= 0.15;
      signals.push(`File path suggests test/example: ${candidate.filePath}`);
      break;
    }
  }

  // Check context for placeholder indicators
  const contextLower = candidate.redactedContext.toLowerCase();
  const placeholderPatterns = [
    /\bexample\b/,
    /\bplaceholder\b/,
    /\bdummy\b/,
    /\bfake\b/,
    /\btest\b/,
    /\bsample\b/,
    /\bdemo\b/,
    /\bxxx+\b/,
    /\byour[-_]?(?:api[-_]?key|token|secret)\b/,
    /\breplace[-_]?(?:me|this)\b/,
    /\binsert[-_]?(?:here|token|key)\b/,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(contextLower)) {
      score -= 0.2;
      signals.push('Context suggests placeholder/example value');
      break;
    }
  }

  // Check for environment variable references
  const envRefPatterns = [
    /process\.env\./,
    /os\.(?:environ|getenv)/,
    /\$\{[A-Z_]+\}/,
    /\$[A-Z_]+/,
    /env\[['"]/,
  ];

  for (const pattern of envRefPatterns) {
    if (pattern.test(candidate.redactedContext)) {
      score -= 0.15;
      signals.push('Appears to be environment variable reference');
      break;
    }
  }

  // Check rule type for high-confidence patterns
  const highConfidenceRules = [
    'private-key',
    'aws-access-token',
    'github-pat',
    'stripe-access-token',
  ];

  if (highConfidenceRules.includes(candidate.ruleId)) {
    score += 0.1;
    signals.push(`Rule '${candidate.ruleId}' typically indicates real secrets`);
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score));

  // Determine classification
  let classification: SecretClassification;
  if (score >= 0.8) {
    classification = 'confirmed';
  } else if (score >= 0.6) {
    classification = 'likely';
  } else if (score >= 0.4) {
    classification = 'needs_review';
  } else if (score >= 0.2) {
    classification = 'unlikely';
  } else {
    classification = 'false_positive';
  }

  // Generate recommendation
  let recommendation: string;
  switch (classification) {
    case 'confirmed':
      recommendation =
        'This appears to be a real secret. Remove it from the codebase and rotate the credential immediately.';
      break;
    case 'likely':
      recommendation =
        'This is probably a real secret. Review and remove if confirmed. Consider rotating the credential.';
      break;
    case 'needs_review':
      recommendation =
        'Manual review required. Check if this is a real credential or a placeholder value.';
      break;
    case 'unlikely':
      recommendation = 'This is probably a false positive, but verify it is not a real credential.';
      break;
    case 'false_positive':
      recommendation = 'This appears to be a false positive. No action needed.';
      break;
  }

  return {
    classification,
    confidence: score,
    reasoning: signals.join('. ') || 'No specific signals detected.',
    recommendation,
  };
}

// =============================================================================
// SecretClassifier Implementation
// =============================================================================

/**
 * Secret classifier implementation.
 *
 * Uses heuristic analysis for programmatic classification.
 * For LLM-based classification, use the classifySecretTool with an agent.
 */
export class SecretClassifier implements ISecretClassifier {
  /**
   * Classify a single secret candidate.
   */
  classify(candidate: SecretCandidate): ClassifiedSecret {
    const analysisInput: CandidateAnalysis = {
      candidateId: candidate.id,
      ruleId: candidate.ruleId,
      redactedContext: candidate.redactedContext,
      entropy: candidate.entropy,
      filePath: candidate.location.file,
    };
    if (candidate.keywords !== undefined) {
      analysisInput.keywords = candidate.keywords;
    }
    const result = analyzeCandidate(analysisInput);

    return {
      id: randomUUID(),
      candidateId: candidate.id,
      ruleId: candidate.ruleId,
      classification: result.classification,
      confidence: result.confidence,
      reasoning: result.reasoning,
      recommendation: result.recommendation,
      location: candidate.location,
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Classify multiple candidates.
   */
  classifyBatch(candidates: SecretCandidate[]): ClassifiedSecret[] {
    const results: ClassifiedSecret[] = [];

    for (const candidate of candidates) {
      const classified = this.classify(candidate);
      results.push(classified);
    }

    return results;
  }
}

/**
 * Create a new SecretClassifier instance.
 */
export function createSecretClassifier(): SecretClassifier {
  return new SecretClassifier();
}
