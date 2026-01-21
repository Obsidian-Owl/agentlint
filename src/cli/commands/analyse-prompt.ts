/**
 * Analysis Prompt Builder
 *
 * Builds the system prompt for orchestrated analysis sessions.
 * The prompt guides the agent through the DETECT → TRACE → UNDERSTAND → RECOMMEND
 * workflow defined in the Constitution.
 *
 * @module cli/commands/analyse-prompt
 */

import { relative } from 'node:path';
import type { ScanResult } from './scan';
import type { AnalyseOptions } from './analyse';

/**
 * Build the analysis prompt for the orchestrator.
 *
 * The prompt:
 * 1. Describes the discovered configurations
 * 2. Instructs the agent on available tools
 * 3. Guides through the causal analysis workflow
 * 4. Requests actionable recommendations
 *
 * @param directory - The directory being analyzed
 * @param scanResult - Results from the configuration scan
 * @param options - Analysis options
 * @returns The formatted prompt string
 */
export function buildAnalysisPrompt(
  directory: string,
  scanResult: ScanResult,
  options: AnalyseOptions
): string {
  const configList = formatConfigList(directory, scanResult);
  const focusInstructions = buildFocusInstructions(options);
  const toolInstructions = buildToolInstructions();

  return `
You are analyzing an AI-assisted development project at: ${directory}

${configList}

${focusInstructions}

## Your Task

Perform a comprehensive analysis following the DETECT → TRACE → UNDERSTAND → RECOMMEND workflow:

### 1. DETECT: Discover Issues
- Use \`discover_configs\` to find all AI configuration files
- Use \`parse_config\` to analyze each configuration in detail
- Use \`analyze_hierarchy\` to understand config precedence and conflicts
- Look for anti-patterns, gaps, and quality issues

### 2. TRACE: Find Origins
- For each issue found, trace it back to its origin
- Determine if issues stem from configuration, session history, or git changes
- Identify the root cause, not just the symptom

### 3. UNDERSTAND: Assess Impact
- Evaluate the severity of each issue (critical, high, medium, low, info)
- Consider how issues affect developer productivity and AI effectiveness
- Look for patterns across multiple issues

### 4. RECOMMEND: Suggest Improvements
- Generate actionable recommendations for each finding
- Prefer preventive over symptomatic fixes
- Provide clear rationale for each recommendation

${toolInstructions}

## Output Requirements

For each finding, explain:
- **What**: Clear description of the issue
- **Where**: File and location where detected
- **Origin**: Where the issue originated (causal trace)
- **Why it matters**: Impact on development workflow
- **How to fix**: Specific, actionable recommendation

Be thorough but concise. Focus on issues that provide value when addressed.
`.trim();
}

/**
 * Format the list of discovered configurations.
 */
function formatConfigList(directory: string, scanResult: ScanResult): string {
  if (scanResult.configs.length === 0) {
    return `## Discovered Configuration Files

No AI configuration files were found in this directory.

This itself is a finding - the project lacks AI tooling configuration.
Consider creating a CLAUDE.md or other configuration to guide AI assistants.`;
  }

  const configLines = scanResult.configs.map((config) => {
    const relPath = relative(directory, config.path);
    return `- **${relPath}** (${config.type}): ${config.description}`;
  });

  return `## Discovered Configuration Files

Found ${scanResult.configs.length} configuration file(s):

${configLines.join('\n')}`;
}

/**
 * Build focus instructions based on analysis options.
 */
function buildFocusInstructions(options: AnalyseOptions): string {
  if (options.configOnly) {
    return `## Analysis Focus

You are running in **config-only mode**. Focus exclusively on configuration files.
Do not analyze session logs or git history.`;
  }

  if (options.sessionsOnly) {
    return `## Analysis Focus

You are running in **sessions-only mode**. Focus exclusively on session logs.
Do not analyze configuration files.`;
  }

  return `## Analysis Focus

Analyze both configuration files and available session data.
Consider how configurations impact session effectiveness.`;
}

/**
 * Build tool usage instructions.
 */
function buildToolInstructions(): string {
  return `## Available Tools

**Configuration Analysis:**
- \`discover_configs\`: Find AI configuration files in a directory
- \`parse_config\`: Parse and extract structure from a configuration file
- \`analyze_hierarchy\`: Analyze configuration precedence and conflicts

**Session Analysis:**
- \`search_sessions\`: Search session logs for patterns
- \`get_session_stats\`: Get statistics about sessions

**Temporal Analysis:**
- \`store_baseline\`: Store current analysis as a baseline
- \`query_baseline\`: Query stored baselines
- \`calculate_delta\`: Compare current state to a baseline
- \`query_trends\`: Analyze trends over time

Use tools proactively to gather evidence. Don't guess - investigate.`;
}

/**
 * Build a prompt for continuing an interrupted analysis.
 *
 * @param previousFindings - Summary of findings from before interruption
 * @param lastPhase - The phase when analysis was interrupted
 * @returns Continuation prompt
 */
export function buildContinuationPrompt(
  previousFindings: string[],
  lastPhase: string
): string {
  return `
## Resuming Analysis

This analysis was interrupted and is being resumed.

Previous phase: ${lastPhase}
Findings collected so far:
${previousFindings.map((f) => `- ${f}`).join('\n')}

Continue from where you left off. Do not repeat analysis already performed.
`.trim();
}
