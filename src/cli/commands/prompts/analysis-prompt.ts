/**
 * Versioned Analysis Prompt Templates
 *
 * Provides versioned prompt templates for analysis sessions,
 * enabling prompt evolution tracking and A/B testing.
 *
 * Following the pattern from src/act/instructions.ts for consistency.
 *
 * @module cli/commands/prompts/analysis-prompt
 */

// =============================================================================
// Types
// =============================================================================

export interface AnalysisPromptSections {
  /** Introductory context for the analysis */
  intro: string;
  /** The main workflow steps (DETECT, TRACE, etc.) */
  workflow: string;
  /** Output formatting requirements */
  outputRequirements: string;
}

export interface AnalysisPromptConfig {
  version: string;
  sections: AnalysisPromptSections;
}

// =============================================================================
// Prompt Versions
// =============================================================================

/** Current default prompt version */
export const ANALYSIS_PROMPT_VERSION = '1.0.0';

/**
 * Registry of all prompt versions.
 * New versions should be added here with a descriptive version number.
 */
export const ANALYSIS_PROMPTS: Record<string, AnalysisPromptConfig> = {
  '1.0.0': {
    version: '1.0.0',
    sections: {
      intro: `You are analyzing an AI-assisted development project.`,

      workflow: `## Your Task

Perform a comprehensive analysis following the DETECT \u2192 TRACE \u2192 UNDERSTAND \u2192 RECONCILE \u2192 RECOMMEND workflow:

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
- "Expand CLAUDE.md" vs "Reduce CLAUDE.md" \u2192 Only one can be correct
- "File has 11 lines" vs "File has 762 lines" \u2192 Verify actual state
- "Missing error handling" vs "Error handling present but verbose" \u2192 Verify actual code

### 5. RECOMMEND: Record Improvements
**CRITICAL: Follow the Review \u2192 Decide \u2192 Act protocol above for EVERY finding.**

- Check existing recommendations table FIRST
- Consolidate similar findings into existing recommendations when appropriate
- Only create NEW recommendations when truly distinct AND verified in RECONCILE step
- Prefer preventive over symptomatic fixes
- Provide clear rationale for each recommendation`,

      outputRequirements: `## Output Requirements

**Recording Findings**

Use the appropriate recommendation tool based on your Review \u2192 Decide \u2192 Act decision:

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

Be thorough but concise. Quality over quantity - consolidate similar findings.`,
    },
  },
};

// =============================================================================
// API
// =============================================================================

/**
 * Get a specific prompt configuration by version.
 *
 * @param version - The version to retrieve (defaults to ANALYSIS_PROMPT_VERSION)
 * @returns The prompt configuration
 * @throws Error if the version is not found
 */
export function getPromptConfig(version?: string): AnalysisPromptConfig {
  const v = version ?? ANALYSIS_PROMPT_VERSION;
  const config = ANALYSIS_PROMPTS[v];
  if (!config) {
    const available = Object.keys(ANALYSIS_PROMPTS).join(', ');
    throw new Error(`Unknown prompt version: ${v}. Available versions: ${available}`);
  }
  return config;
}

/**
 * List all available prompt versions.
 *
 * @returns Array of version strings
 */
export function listPromptVersions(): string[] {
  return Object.keys(ANALYSIS_PROMPTS);
}
