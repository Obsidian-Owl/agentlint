/**
 * EP14: Skills Effectiveness Analysis - Contract Definitions
 *
 * These interfaces define the data structures returned by skills tools.
 * Per Constitution Principle VII: Tools return data, not judgments.
 *
 * @module specs/ep14-skills-effectiveness/contracts
 */

// =============================================================================
// Tool Input Schemas
// =============================================================================

/**
 * Input for get_skill_inventory tool.
 */
export interface GetSkillInventoryInput {
  /** Project path (defaults to cwd) */
  projectPath?: string;
}

/**
 * Input for get_skill_invocations tool.
 */
export interface GetSkillInvocationsInput {
  /** Filter by skill name */
  skillName?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Start date (ISO-8601) */
  since?: string;
  /** End date (ISO-8601) */
  until?: string;
  /** Maximum results (default: 100) */
  limit?: number;
}

/**
 * Input for get_session_summaries tool.
 */
export interface GetSessionSummariesInput {
  /** Start date (ISO-8601) */
  since?: string;
  /** End date (ISO-8601) */
  until?: string;
  /** Filter by project path */
  projectPath?: string;
  /** Maximum sessions (default: 50) */
  limit?: number;
}

/**
 * Input for index_skill_invocations tool.
 */
export interface IndexSkillInvocationsInput {
  /** Project path */
  projectPath?: string;
  /** Force re-index even if already indexed */
  force?: boolean;
}

// =============================================================================
// Tool Output Types - DATA ONLY, NO JUDGMENTS
// =============================================================================

/**
 * A skill defined in .claude/skills/ directory.
 *
 * Note: filePatterns are HINTS for agent reasoning, NOT programmatic rules.
 * The agent decides whether these patterns are relevant to a given context.
 */
export interface SkillInventoryItem {
  /** Skill name from frontmatter */
  name: string;
  /** Skill description (max 200 chars) */
  description: string;
  /** Path to SKILL.md file */
  path: string;
  /** File patterns as hints for agent (NOT matching rules) */
  filePatterns: string[];
  /** Section headings in SKILL.md */
  contentSections: string[];
  /** Whether user can invoke directly via /command */
  userInvocable: boolean;
}

/**
 * Result from get_skill_inventory tool.
 *
 * Returns DATA: list of defined skills.
 * Agent DECIDES: which skills are relevant, whether coverage is adequate.
 */
export interface GetSkillInventoryResult {
  /** All discovered skills */
  skills: SkillInventoryItem[];
  /** Path searched for skills */
  discoveryPath: string;
  /** Total skill count */
  skillCount: number;
  /** Query time in milliseconds */
  queryTimeMs: number;
}

/**
 * A single skill invocation from session logs.
 */
export interface SkillInvocationRecord {
  /** Name of the invoked skill */
  skillName: string;
  /** Session where invocation occurred */
  sessionId: string;
  /** When the skill was invoked */
  timestamp: string;
  /** First ~200 chars of user prompt that triggered invocation */
  userPromptSnippet: string;
}

/**
 * Result from get_skill_invocations tool.
 *
 * Returns DATA: when skills were invoked, in which sessions.
 * Agent DECIDES: whether invocation rate is "low" or "high",
 *                whether patterns indicate issues.
 */
export interface GetSkillInvocationsResult {
  /** Invocation records matching query */
  invocations: SkillInvocationRecord[];
  /** Total matching invocations */
  totalCount: number;
  /** Number of unique skills in results */
  uniqueSkills: number;
  /** Number of sessions queried */
  sessionsQueried: number;
  /** Applied filters (for context) */
  filters: {
    skillName?: string;
    sessionId?: string;
    since?: string;
    until?: string;
  };
  /** Query time in milliseconds */
  queryTimeMs: number;
}

/**
 * Summarized session data for agent reasoning.
 */
export interface SessionSummary {
  /** Session UUID */
  sessionId: string;
  /** Session start timestamp */
  timestamp: string;
  /** First user message (truncated to 500 chars) */
  firstUserPrompt: string;
  /** Files touched via Read/Write/Edit tools */
  filesOperated: string[];
  /** Skills invoked in this session */
  skillsInvoked: string[];
  /** Total conversation turns */
  turnCount: number;
}

/**
 * Result from get_session_summaries tool.
 *
 * Returns DATA: session context (user intent, files, skills used).
 * Agent DECIDES: whether skills SHOULD have been used (missed opportunities),
 *                why discovery may have failed.
 */
export interface GetSessionSummariesResult {
  /** Session summaries matching query */
  sessions: SessionSummary[];
  /** Total sessions returned */
  totalSessions: number;
  /** Applied filters */
  filters: {
    since?: string;
    until?: string;
    projectPath?: string;
  };
  /** Query time in milliseconds */
  queryTimeMs: number;
}

/**
 * Result from index_skill_invocations tool.
 *
 * Returns DATA: indexing statistics.
 * Agent DECIDES: whether to proceed with analysis.
 */
export interface IndexSkillInvocationsResult {
  /** Sessions processed in this indexing run */
  sessionsIndexed: number;
  /** Total skill invocations found */
  invocationsFound: number;
  /** New invocations since last index */
  newSinceLastIndex: number;
  /** When indexing completed */
  indexedAt: string;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Database Types (Internal)
// =============================================================================

/**
 * Skill invocation row in SQLite database.
 * @internal
 */
export interface SkillInvocationRow {
  id: number;
  session_id: string;
  skill_name: string;
  timestamp: string;
  user_prompt_snippet: string | null;
  file_path: string | null;
  line_number: number | null;
}

// =============================================================================
// ANTI-PATTERNS - What these interfaces DO NOT include
// =============================================================================

/*
 * Per Constitution Principle VII, the following are AGENT REASONING,
 * not tool outputs:
 *
 * - effectiveness_score: number
 * - status: 'underutilized' | 'healthy' | 'overused'
 * - missed_opportunities: MissedOpportunity[]
 * - recommendations: string[]
 * - description_mismatches: DescriptionMismatch[]
 * - is_low_invocation: boolean
 * - should_have_been_used: boolean
 *
 * These judgments are made by the agent using the data these tools provide.
 */
