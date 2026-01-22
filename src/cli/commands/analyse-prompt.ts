/**
 * Analysis Prompt Builder
 *
 * Builds the system prompt for orchestrated analysis sessions.
 * The prompt guides the agent through the DETECT → TRACE → UNDERSTAND → RECOMMEND
 * workflow defined in the Constitution.
 *
 * @module cli/commands/analyse-prompt
 */

import { relative, resolve } from 'node:path';
import type { ScanResult } from './scan';
import type { AnalyseOptions } from './analyse';
import {
  loadRecommendationsForContext,
  getRecommendationsDir,
} from '../../recommendations/storage';
import type { RecommendationSummary } from '../../recommendations/types';

// Debug logging for recommendation loading - write to stderr to avoid polluting output
const DEBUG_RECS = process.env['DEBUG']?.includes('agentlint:recs') ?? false;
function debugLog(message: string, data?: unknown): void {
  if (DEBUG_RECS) {
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
    console.error(`[DEBUG:recs] ${message}${dataStr}`);
  }
}

// =============================================================================
// Existing Recommendations Context
// =============================================================================

/**
 * Build context showing existing recommendations for the agent to review.
 *
 * Per Anthropic's "Effective Context Engineering" research:
 * - Just-in-time retrieval: Show identifiers, load details on demand
 * - Context as precious resource: Eliminate redundancy ruthlessly
 *
 * @param directory - The directory being analyzed
 * @returns Formatted context string with existing recommendations
 */
async function buildExistingRecommendationsContext(directory: string): Promise<string> {
  const errors: string[] = [];

  // Resolve directory to absolute path to handle relative paths correctly
  const resolvedDir = resolve(directory);
  debugLog('Building recommendations context', { directory, resolvedDir });

  // Try target directory first, then fall back to cwd
  const dirsToCheck = [getRecommendationsDir(resolvedDir), getRecommendationsDir(process.cwd())];

  // Dedupe directories (may be same if running from target)
  const uniqueDirs = [...new Set(dirsToCheck)];
  debugLog('Checking recommendation directories', { dirs: uniqueDirs });

  let summaries: RecommendationSummary[] = [];
  for (const baseDir of uniqueDirs) {
    try {
      debugLog('Loading from directory', { baseDir });
      const loaded = await loadRecommendationsForContext({
        baseDir,
        status: 'open',
        tokenBudget: 4000, // Half of 8K budget for context
      });
      debugLog('Loaded recommendations', { baseDir, count: loaded.length });
      if (loaded.length > 0) {
        summaries = loaded;
        break;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`${baseDir}: ${errorMsg}`);
      debugLog('Error loading recommendations', { baseDir, error: errorMsg });
      // Continue to next directory
    }
  }

  if (summaries.length === 0) {
    // Include error info if loading failed (helps debugging)
    const errorContext =
      errors.length > 0 ? `\n\n_Note: Failed to load from: ${errors.join(', ')}_` : '';

    debugLog('No recommendations found', { errors });
    return `## Existing Recommendations

No open recommendations found. Create new ones as needed, but avoid duplicating the same issue.${errorContext}`;
  }

  debugLog('Building recommendations table', { count: summaries.length });

  const lines: string[] = [
    `## Existing Open Recommendations (${summaries.length})`,
    '',
    '**Review these BEFORE creating new recommendations.** Use `get_recommendation` for full details.',
    '',
    '| ID | Type/Priority | Target | Action (summary) |',
    '|-----|---------------|--------|------------------|',
  ];

  for (const summary of summaries) {
    const shortId = summary.id.slice(0, 8);
    const typePriority = `${summary.type}/${summary.priority}`;
    const shortTarget =
      summary.target.length > 25 ? '...' + summary.target.slice(-22) : summary.target;
    const shortAction =
      summary.actionSummary.length > 40
        ? summary.actionSummary.slice(0, 37) + '...'
        : summary.actionSummary;
    lines.push(`| ${shortId} | ${typePriority} | \`${shortTarget}\` | ${shortAction} |`);
  }

  return lines.join('\n');
}

// =============================================================================
// Recommendation Management Protocol
// =============================================================================

/**
 * Build the recommendation management protocol instructions.
 *
 * Per Anthropic's "Claude Code Best Practices" research:
 * - Explore → Plan → Act: Don't jump to action, investigate first
 * - Deliberate sequencing: Structure prompts for review-before-modify
 *
 * @returns Formatted protocol instructions
 */
function buildRecommendationProtocol(): string {
  return `## Recommendation Management: Review → Decide → Act

Follow this sequence for EVERY finding before recording it:

### Step 1: REVIEW existing recommendations
Look at the table above. Does an existing recommendation:
- Target the same file? (e.g., both target CLAUDE.md)
- Address the same or similar issue?

### Step 2: DECIDE on action
Based on your review:

| Existing rec for same target? | Same/similar issue? | Your action |
|-------------------------------|---------------------|-------------|
| No                            | -                   | Create new  |
| Yes                           | Yes                 | Add observation to existing |
| Yes                           | Needs update        | Refine existing |
| Yes                           | Completely different| Create new  |
| Yes                           | **Contradicts**     | Resolve first (see RECONCILE) |

**Contradiction detection**: Before creating, ask: "Does this contradict any existing recommendation?" If yes, you MUST resolve the conflict first—either complete the old one as 'obsolete' or discard your finding after verification.

### Step 3: ACT using the appropriate tool
- \`add_recommendation_event\` - Add observation to existing (use ID from table above)
- \`refine_recommendation\` - Update action/priority of existing (use ID from table above)
- \`create_recommendation\` - Only if nothing similar exists

**Quality over quantity.** 10 redundant recommendations for "expand CLAUDE.md" is noise, not signal. One well-maintained recommendation with observations is valuable.`;
}

// =============================================================================
// Interactive Mode Instructions
// =============================================================================

/**
 * Build instructions for interactive vs non-interactive mode.
 *
 * Per Claude Code's pattern of "built-in review gates" where the agent
 * requests approval for system-modifying actions.
 *
 * @param isInteractive - Whether running in interactive mode
 * @returns Formatted instructions for the current mode
 */
function buildInteractiveInstructions(isInteractive: boolean): string {
  if (!isInteractive) {
    return `## Non-Interactive Mode

You are running in CI/automated mode. For each finding:
1. Review existing recommendations (table above)
2. Decide: create, update, or add observation
3. Execute without asking - follow the decision matrix`;
  }

  return `## Interactive Mode

For EACH significant finding, have a brief conversation with the user:

### 1. State your finding (2-3 sentences)
Describe what you found, where, and why it matters.

### 2. State your assessment
After reviewing existing recommendations, tell the user what you plan to do:
- "I found an existing recommendation for CLAUDE.md (abc123). I'll add this as an observation."
- "No existing recommendation covers this. I'll create a new one."
- "This finding is minor. I suggest we skip recording it."

### 3. Ask for confirmation if creating new
For new recommendations, ask briefly: "Create new recommendation for [target]? (yes/no)"

### 4. Execute based on response

**Brevity matters.** Don't over-explain. State finding → propose action → confirm if needed → act.`;
}

// =============================================================================
// Main Prompt Builder
// =============================================================================

/**
 * Build the analysis prompt for the orchestrator.
 *
 * The prompt:
 * 1. Describes the discovered configurations
 * 2. Shows existing recommendations for deduplication
 * 3. Instructs the agent on available tools and recommendation protocol
 * 4. Guides through the causal analysis workflow
 * 5. Requests actionable recommendations
 *
 * @param directory - The directory being analyzed
 * @param scanResult - Results from the configuration scan
 * @param options - Analysis options
 * @returns The formatted prompt string
 */
export async function buildAnalysisPrompt(
  directory: string,
  scanResult: ScanResult,
  options: AnalyseOptions
): Promise<string> {
  const configList = formatConfigList(directory, scanResult);
  const focusInstructions = buildFocusInstructions(options);
  const toolInstructions = buildToolInstructions();
  const subagentGuidance = buildSubagentGuidance(scanResult);
  const outputGuidance = buildOutputGuidance();

  // Load existing recommendations context (async)
  const existingRecs = await buildExistingRecommendationsContext(directory);
  const recProtocol = buildRecommendationProtocol();
  const interactiveInstructions = buildInteractiveInstructions(!options.nonInteractive);

  return `
You are analyzing an AI-assisted development project at: ${directory}

${configList}

${focusInstructions}

${existingRecs}

${recProtocol}

${interactiveInstructions}

${subagentGuidance}

${outputGuidance}

## Your Task

Perform a comprehensive analysis following the DETECT → TRACE → UNDERSTAND → RECONCILE → RECOMMEND workflow:

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

### 4. RECONCILE: Resolve Contradictions (AGE-678)
**Before creating ANY recommendations, check for contradictions:**

- Do your findings contradict each other? (e.g., "file too large" AND "file too small")
- Do they contradict existing recommendations in the table above?
- Are the claims about file sizes, line counts, or states consistent?

**When contradictions are found:**
1. State the contradiction explicitly: "Finding A says X, but Finding B says Y"
2. Investigate to determine which is correct (re-read the file, check actual state)
3. Discard the incorrect finding - do NOT create recommendations for both
4. If existing recommendation contradicts your verified finding, complete it with reason 'obsolete'

**Examples of contradictions to catch:**
- "Expand CLAUDE.md" vs "Reduce CLAUDE.md" → Only one can be correct
- "File has 11 lines" vs "File has 762 lines" → Verify actual state
- "Missing error handling" vs "Error handling present but verbose" → Verify actual code

### 5. RECOMMEND: Record Improvements
**CRITICAL: Follow the Review → Decide → Act protocol above for EVERY finding.**

- Check existing recommendations table FIRST
- Consolidate similar findings into existing recommendations when appropriate
- Only create NEW recommendations when truly distinct AND verified in RECONCILE step
- Prefer preventive over symptomatic fixes
- Provide clear rationale for each recommendation

${toolInstructions}

## Output Requirements

**Recording Findings**

Use the appropriate recommendation tool based on your Review → Decide → Act decision:

| Decision | Tool to use |
|----------|-------------|
| Similar recommendation exists | \`add_recommendation_event\` to add observation |
| Existing rec needs update | \`refine_recommendation\` to update action/target |
| **Contradicts existing** | \`complete_recommendation\` with reason 'obsolete' first |
| Truly new finding | \`create_recommendation\` to create new |

For each finding, explain briefly:
- **What**: Clear description of the issue
- **Where**: File and location where detected
- **Action taken**: Which tool you used and why (existing vs new)

Be thorough but concise. Quality over quantity - consolidate similar findings.
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

**Recommendation Management (use per Review → Decide → Act protocol):**
- \`list_recommendations\`: Query existing recommendations
- \`get_recommendation\`: Get full details of a specific recommendation by ID
- \`add_recommendation_event\`: Add observation to existing recommendation
- \`refine_recommendation\`: Update action/target/priority of existing recommendation
- \`create_recommendation\`: Create new recommendation (only if no similar exists)
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
export function buildContinuationPrompt(previousFindings: string[], lastPhase: string): string {
  return `
## Resuming Analysis

This analysis was interrupted and is being resumed.

Previous phase: ${lastPhase}
Findings collected so far:
${previousFindings.map((f) => `- ${f}`).join('\n')}

Continue from where you left off. Do not repeat analysis already performed.
`.trim();
}
