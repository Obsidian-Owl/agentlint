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
  const subagentGuidance = buildSubagentGuidance(scanResult);
  const outputGuidance = buildOutputGuidance();

  return `
You are analyzing an AI-assisted development project at: ${directory}

${configList}

${focusInstructions}

${subagentGuidance}

${outputGuidance}

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

**CRITICAL: Recording Findings**

You MUST use the \`create_recommendation\` tool to formally record each finding you discover.
Findings are only counted in the analysis summary if they are recorded via this tool.

For each finding:
1. First, call \`create_recommendation\` with:
   - \`type\`: "symptomatic" | "preventive" | "systemic"
   - \`action\`: The specific change to make
   - \`target\`: File path where the change should be made
   - \`rationale\`: Why this matters and what happens if ignored
   - \`priority\`: "high" | "medium" | "low"
   - \`tracedOrigin\`: Where the issue originated

2. Then, in your text output explain:
   - **What**: Clear description of the issue
   - **Where**: File and location where detected
   - **Why it matters**: Impact on development workflow
   - **How to fix**: Specific, actionable recommendation

Be thorough but concise. Focus on issues that provide value when addressed.
Do NOT skip the create_recommendation step - findings without tool calls will not be counted.
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

**Causal Tracing:**
- \`trace_issue_origin\`: Trace an issue back to its root cause
- \`get_issue_patterns\`: Detect systemic patterns across issues

**Temporal Analysis:**
- \`store_baseline\`: Store current analysis as a baseline
- \`query_baseline\`: Query stored baselines
- \`calculate_delta\`: Compare current state to a baseline
- \`query_trends\`: Analyze trends over time
- \`spawn_temporal_analyst\`: Spawn subagent for deep temporal analysis

**Recording Findings:**
- \`create_recommendation\`: Formally record each finding as a recommendation
- \`list_recommendations\`: List all recorded recommendations
- \`get_recommendation_summary\`: Get summary statistics

**Security Analysis:**
- \`classify_secret\`: Classify potential secrets with LLM validation

## Critical Thinking - Verify Before Flagging

**ALWAYS use \`WebSearch\` to verify information that may change over time:**
- Model names (e.g., "Is claude-opus-4-5-20251101 a valid model?")
- API versions and features
- Library versions and compatibility
- Feature availability and deprecation status

**Never assume something is wrong without verification.** When uncertain, investigate first.

**Fact Verification Protocol:**
1. Identify claims about external systems (models, APIs, versions)
2. Use WebSearch to verify current status
3. Only flag as an issue if verification confirms the problem
4. Include verification source in your finding

Use tools proactively to gather evidence. Don't guess - investigate.`;
}

/**
 * Build output formatting guidance for clear, readable terminal output.
 */
function buildOutputGuidance(): string {
  return `## Response Formatting

Your output will be displayed in a command line interface. Follow these rules:

**Conciseness:**
- Be direct and to the point
- Avoid introductions, conclusions, or unnecessary elaboration
- Use short paragraphs (2-3 sentences max)

**Structure:**
- Use markdown headers (##, ###) to organize sections
- Use bullet points for lists of 3+ items
- Add blank lines between sections for readability

**Clarity:**
- Write in active voice
- Explain technical concepts simply
- For each finding, state: What → Where → Why → How to fix

**Verification:**
- Use WebSearch to verify facts you're uncertain about (model names, API versions, etc.)
- Don't guess at technical details - investigate first

**Avoid:**
- Excessive markdown formatting (don't bold everything)
- Long unbroken paragraphs
- Repeating information
- Self-congratulatory language ("Great question!", "Excellent!")`;
}

/**
 * Build subagent guidance based on detected ACT types.
 *
 * This informs the agent about available specialist subagents
 * that can be delegated to for deep ACT-specific analysis.
 */
function buildSubagentGuidance(scanResult: ScanResult): string {
  // Extract unique ACT types from configs
  const actTypes = new Set<string>();
  for (const config of scanResult.configs) {
    if (config.actType) {
      actTypes.add(config.actType);
    }
  }

  const lines: string[] = ['## Specialist Subagents', ''];

  if (actTypes.size === 0) {
    lines.push('No specific AI Coding Tool type was detected.');
    lines.push('You can delegate to **generalized-analyzer** for heuristic analysis.');
  } else {
    lines.push(
      'Detected AI Coding Tool types: ' +
        Array.from(actTypes)
          .map((t) => `**${t}**`)
          .join(', ')
    );
    lines.push('');

    if (actTypes.has('claude-code')) {
      lines.push('**claude-code-analyzer** - Deep analysis of Claude Code configs,');
      lines.push('settings hierarchies, CLAUDE.md, and session logs.');
    }

    lines.push('**generalized-analyzer** - Fallback for unknown tools or AGENTS.md.');
  }

  lines.push('');
  lines.push('To delegate: `Task(subagent_type="<name>", prompt="<request>")`');
  lines.push('');
  lines.push(
    'Delegate when: Deep ACT-specific analysis needed, session log patterns, config hierarchy issues.'
  );
  lines.push('Do NOT delegate for: Simple config checks, surface-level review.');

  return lines.join('\n');
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
