/**
 * EP07 Causal Tracing Engine - trace_issue_origin SDK Tool
 *
 * SDK tool definition for tracing issues to their origin.
 * Uses the Claude Agent SDK's tool() pattern for MCP integration.
 *
 * @module tools/causal/trace-issue-tool
 */

import { z } from 'zod';
import { adaptTool } from '../../opencode/tool-adapter';
import { v4 as uuidv4 } from 'uuid';

import type { EvidenceItem, TracedIssue, TraceIssueOutput, ConfidenceScore, Gap } from './types';
import { EvidenceCollector } from './evidence-collector';
import { GapAnalyzer } from './gap-analyzer';
import { ChainBuilder } from './chain-builder';
import { insertChain, getPatternsByProject } from '../../persistence/causal';
import { openDatabase, closeDatabase } from '../../persistence/sessions/fts';
import { DEFAULT_SESSIONS_DB_PATH } from '../sessions/utils';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Input schema for trace_issue_origin tool.
 */
const traceIssueInputSchema = {
  issueDescription: z
    .string()
    .min(1)
    .describe('Description of the issue to trace (what went wrong)'),
  filePath: z.string().optional().describe('File path where the issue was detected'),
  lineNumber: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Line number where the issue was detected'),
  keywords: z.array(z.string()).optional().describe('Keywords to search for in session logs'),
  since: z.string().optional().describe('Only search sessions after this ISO-8601 timestamp'),
  until: z.string().optional().describe('Only search sessions before this ISO-8601 timestamp'),
  projectPath: z.string().optional().describe('Project path to scope the search'),
  maxDepth: z.number().int().min(1).max(5).optional().describe('Maximum trace depth (default: 5)'),
};

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Format evidence items for display.
 */
function formatEvidence(evidence: EvidenceItem[]): string {
  if (evidence.length === 0) {
    return 'No evidence collected.';
  }

  const lines: string[] = [];
  for (let i = 0; i < evidence.length; i++) {
    const e = evidence[i]!;
    lines.push(`#### Evidence ${i + 1}: ${e.type}`);
    lines.push(`- **Source**: ${e.source}`);
    if (e.timestamp) {
      lines.push(`- **Time**: ${e.timestamp}`);
    }
    if (e.position) {
      lines.push(
        `- **Location**: ${e.position.filePath}${e.position.line ? `:${e.position.line}` : ''}`
      );
    }
    if (e.content) {
      lines.push(
        `- **Content**: ${e.content.substring(0, 200)}${e.content.length > 200 ? '...' : ''}`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Format confidence score for display.
 */
function formatConfidence(confidence: ConfidenceScore): string {
  const factors = [
    ['Specificity', confidence.specificity],
    ['Temporal', confidence.temporal],
    ['Mechanistic', confidence.mechanistic],
    ['Evidence Quality', confidence.evidenceQuality],
    ['Reproducibility', confidence.reproducibility],
    ['Alternatives Considered', confidence.alternatives],
  ] as const;

  const lines: string[] = [];
  lines.push(`**Overall**: ${confidence.overall.toUpperCase()}`);
  lines.push('');
  for (const [name, value] of factors) {
    lines.push(`- ${name}: ${value ? '✓' : '✗'}`);
  }
  return lines.join('\n');
}

/**
 * Format gap analysis for display.
 */
function formatGap(gap: Gap | undefined): string {
  if (!gap) {
    return 'No configuration gap identified.';
  }

  const lines: string[] = [];
  lines.push(`**Type**: ${gap.type}`);
  lines.push(`**Location**: ${gap.location}`);
  lines.push(`**Expected Guidance**: ${gap.expectedGuidance}`);
  lines.push(`**Counterfactual**: ${gap.counterfactual}`);
  return lines.join('\n');
}

/**
 * Format traced issue for tool output.
 */
function formatTracedIssue(result: TracedIssue): string {
  const lines: string[] = [];
  const { chain } = result;

  lines.push('## Causal Trace Analysis\n');

  // Summary
  lines.push('### Summary\n');
  lines.push(`**Issue ID**: ${result.issueId}`);
  lines.push(`**Trace Completeness**: ${result.traceCompleteness}`);
  lines.push(`**Chain Depth**: ${chain.depth}`);
  if (chain.depthLimitReached) {
    lines.push('⚠️ Maximum trace depth reached');
  }
  lines.push('');

  // Trigger
  lines.push('### Trigger (Origin)\n');
  lines.push(`**Type**: ${chain.trigger.type}`);
  lines.push(`**Source**: ${chain.trigger.source}`);
  if (chain.trigger.timestamp) {
    lines.push(`**Time**: ${chain.trigger.timestamp}`);
  }
  if (chain.trigger.content) {
    lines.push(`**Content**:\n\`\`\`\n${chain.trigger.content}\n\`\`\``);
  }
  lines.push('');

  // Mechanism
  lines.push('### Causal Mechanism\n');
  lines.push(chain.mechanism);
  lines.push('');

  // Effect
  lines.push('### Effect (Issue)\n');
  lines.push(chain.effect);
  lines.push('');

  // Gap Analysis
  lines.push('### Configuration Gap\n');
  lines.push(formatGap(chain.gap));
  lines.push('');

  // Counterfactual
  if (result.counterfactual) {
    lines.push('### Counterfactual Analysis\n');
    lines.push(`*"${result.counterfactual}"*`);
    lines.push('');
  }

  // Confidence
  lines.push('### Confidence Assessment\n');
  lines.push(formatConfidence(chain.confidence));
  lines.push('');

  // Evidence Chain
  lines.push('### Evidence Chain\n');
  lines.push(formatEvidence(chain.evidence));

  // Pattern Link
  if (result.patternId) {
    lines.push('### Recurring Pattern\n');
    lines.push(`This issue is linked to pattern: \`${result.patternId}\``);
    lines.push('');
  }

  // Limitations
  if (result.limitations && result.limitations.length > 0) {
    lines.push('### Limitations\n');
    for (const limitation of result.limitations) {
      lines.push(`- ${limitation}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * trace_issue_origin tool definition.
 *
 * Traces a detected issue back to its origin in session logs.
 * Builds a causal chain with evidence and confidence assessment.
 *
 * @example
 * ```typescript
 * import { traceIssueOriginTool } from './tools/causal/trace-issue-tool';
 * import { ToolRegistry } from './orchestration/tool-registry';
 *
 * const registry = new ToolRegistry();
 * registry.register(traceIssueOriginTool);
 * ```
 */
export const traceIssueOriginTool = adaptTool({
  name: 'trace_issue_origin',
  description: `Trace a detected issue back to its origin in session logs.

Searches through session history to find when and how an issue was introduced.
Builds a causal chain from trigger (origin) to effect (detected issue).

The tool will:
1. Search session logs for related content using keywords
2. Correlate file/line locations with tool calls
3. Build temporal evidence chain
4. Assess confidence in the causal relationship
5. Return structured analysis for recommendations

Use this tool when you detect an issue and need to understand:
- When it was introduced
- What session prompt or action caused it
- What configuration gap may have enabled it

Returns a TracedIssue with causal chain, evidence, and confidence score.`,
  schema: traceIssueInputSchema,
  // eslint-disable-next-line @typescript-eslint/require-await
  handler: async (args: unknown) => {
    const typedArgs = args as {
      issueDescription: string;
      filePath?: string;
      lineNumber?: number;
      keywords?: string[];
      since?: string;
      until?: string;
      projectPath?: string;
      maxDepth?: number;
    };
    const issueId = `issue-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const projectPath = typedArgs.projectPath ?? process.cwd();
    const maxDepth = typedArgs.maxDepth ?? 5;
    const dbPath = DEFAULT_SESSIONS_DB_PATH;

    try {
      const collector = new EvidenceCollector(dbPath);
      const allEvidence: EvidenceItem[] = [];
      const limitations: string[] = [];

      // Collect evidence by keywords
      const keywords = typedArgs.keywords ?? extractKeywords(typedArgs.issueDescription);
      if (keywords.length > 0) {
        const keywordOptions: Parameters<typeof collector.collectSessionEvidence>[0] = {
          keywords,
          limit: 20,
        };
        if (typedArgs.projectPath) keywordOptions.projectPath = typedArgs.projectPath;
        if (typedArgs.since) keywordOptions.since = typedArgs.since;
        if (typedArgs.until) keywordOptions.until = typedArgs.until;

        const keywordResult = collector.collectSessionEvidence(keywordOptions);

        if (keywordResult.warnings) {
          limitations.push(...keywordResult.warnings);
        }
        allEvidence.push(...keywordResult.evidence);
      }

      // Collect evidence by file location
      if (typedArgs.filePath) {
        const locationOptions: Parameters<typeof collector.collectLocationEvidence>[0] = {
          filePath: typedArgs.filePath,
        };
        if (typedArgs.lineNumber) locationOptions.lineNumber = typedArgs.lineNumber;
        if (typedArgs.projectPath) locationOptions.projectPath = typedArgs.projectPath;

        const locationResult = collector.collectLocationEvidence(locationOptions);

        if (locationResult.warnings) {
          limitations.push(...locationResult.warnings);
        }
        allEvidence.push(...locationResult.evidence);
      }

      // Check if we found any evidence
      if (allEvidence.length === 0) {
        const output: TraceIssueOutput = {
          success: false,
          error:
            'No matching sessions found for the issue. Try different keywords or check if sessions are indexed.',
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: `## Trace Failed\n\n${output.error}\n\n**Tips:**\n- Ensure sessions are indexed with the indexer\n- Try more specific keywords from the issue\n- Check the date range filters`,
            },
          ],
          isError: true,
          _rawData: output,
        };
      }

      // Deduplicate evidence by source
      const seenSources = new Set<string>();
      const uniqueEvidence = allEvidence.filter((e) => {
        const key = `${e.source}-${e.timestamp ?? ''}`;
        if (seenSources.has(key)) return false;
        seenSources.add(key);
        return true;
      });

      // Analyze configuration gaps
      let gap: Gap | undefined;
      try {
        const gapAnalyzer = new GapAnalyzer();
        const gapResult = gapAnalyzer.analyzeGaps({
          projectPath,
          issueDescription: typedArgs.issueDescription,
          evidence: uniqueEvidence,
        });
        gap = gapResult.gap;

        if (gapResult.warnings) {
          limitations.push(...gapResult.warnings);
        }
      } catch {
        limitations.push('Could not analyze configuration gaps');
      }

      // Build causal chain using ChainBuilder
      const chainBuilder = new ChainBuilder();
      const chainBuildOptions: Parameters<typeof chainBuilder.build>[0] = {
        issueId,
        issueDescription: typedArgs.issueDescription,
        evidence: uniqueEvidence,
        projectPath,
        maxDepth,
      };
      if (gap) chainBuildOptions.gap = gap;
      const chainResult = chainBuilder.build(chainBuildOptions);
      const chain = chainResult.chain;

      // Add chain builder warnings to limitations
      if (chainResult.warnings) {
        limitations.push(...chainResult.warnings);
      }

      // Check for existing patterns
      let patternId: string | undefined;
      try {
        const db = openDatabase(dbPath);
        try {
          const patterns = getPatternsByProject(db, projectPath);
          if (patterns.length > 0) {
            // Link to most recent pattern (simplistic for now)
            patternId = patterns[0]!.id;
            chain.patternId = patternId;
          }
        } finally {
          closeDatabase(db);
        }
      } catch {
        // Pattern lookup failed, continue without
        limitations.push('Could not check for recurring patterns');
      }

      // Persist the chain
      try {
        const db = openDatabase(dbPath);
        try {
          insertChain(db, chain);
        } finally {
          closeDatabase(db);
        }
      } catch {
        limitations.push('Could not persist chain to database');
      }

      // Build result - use gap counterfactual if available
      const counterfactual = chain.gap?.counterfactual ?? chain.counterfactual;

      const tracedIssue: TracedIssue = {
        issueId,
        chain,
        counterfactual,
        patternId,
        traceCompleteness: chainResult.traceCompleteness,
        limitations: limitations.length > 0 ? limitations : undefined,
      };

      const output: TraceIssueOutput = {
        success: true,
        result: tracedIssue,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: formatTracedIssue(tracedIssue),
          },
        ],
        _rawData: output,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const output: TraceIssueOutput = {
        success: false,
        error: errorMessage,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: `## Trace Error\n\n${errorMessage}`,
          },
        ],
        isError: true,
        _rawData: output,
      };
    }
  },
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract keywords from issue description.
 */
function extractKeywords(description: string): string[] {
  // Remove common words and split into keywords
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'up',
    'down',
    'out',
    'off',
    'over',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'every',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    'and',
    'but',
    'if',
    'or',
    'because',
    'until',
    'while',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
  ]);

  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word));

  // Return unique keywords, max 5
  return [...new Set(words)].slice(0, 5);
}
