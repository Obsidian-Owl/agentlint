/**
 * EP14: Skills Effectiveness Analysis - SQL Query Helpers
 *
 * Query functions for skill invocations and session summaries.
 * All queries return raw data - the agent interprets meaning.
 *
 * @module src/skills/storage/queries
 */

import type { Database } from 'bun:sqlite';

import type {
  GetSkillInvocationsInput,
  GetSessionSummariesInput,
  SkillInvocationRecord,
  SessionSummary,
  SkillInvocationRow,
} from '../types';

// =============================================================================
// Skill Invocation Queries
// =============================================================================

/**
 * Query skill invocations with optional filters.
 * Returns raw data - agent reasons about patterns.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Array of invocation records
 */
export function querySkillInvocations(
  db: Database,
  input: GetSkillInvocationsInput
): SkillInvocationRecord[] {
  const { skillName, sessionId, since, until, limit = 100, offset = 0 } = input;

  // Build dynamic WHERE clause
  const conditions: string[] = [];
  const params: Record<string, string | number> = {
    $limit: limit,
    $offset: offset,
  };

  if (skillName) {
    conditions.push('skill_name = $skillName');
    params.$skillName = skillName;
  }

  if (sessionId) {
    conditions.push('session_id = $sessionId');
    params.$sessionId = sessionId;
  }

  if (since) {
    conditions.push('timestamp >= $since');
    params.$since = since;
  }

  if (until) {
    conditions.push('timestamp <= $until');
    params.$until = until;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      skill_name,
      session_id,
      timestamp,
      user_prompt_snippet
    FROM skill_invocations
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT $limit OFFSET $offset
  `;

  const rows = db.prepare(sql).all(params) as Array<{
    skill_name: string;
    session_id: string;
    timestamp: string;
    user_prompt_snippet: string | null;
  }>;

  return rows.map((row) => ({
    skillName: row.skill_name,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    userPromptSnippet: row.user_prompt_snippet ?? '',
  }));
}

/**
 * Get count of skill invocations matching filters.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Total count
 */
export function countSkillInvocations(
  db: Database,
  input: Omit<GetSkillInvocationsInput, 'limit' | 'offset'>
): number {
  const { skillName, sessionId, since, until } = input;

  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (skillName) {
    conditions.push('skill_name = $skillName');
    params.$skillName = skillName;
  }

  if (sessionId) {
    conditions.push('session_id = $sessionId');
    params.$sessionId = sessionId;
  }

  if (since) {
    conditions.push('timestamp >= $since');
    params.$since = since;
  }

  if (until) {
    conditions.push('timestamp <= $until');
    params.$until = until;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `SELECT COUNT(*) as count FROM skill_invocations ${whereClause}`;
  const result = db.prepare(sql).get(params) as { count: number } | null;

  return result?.count ?? 0;
}

/**
 * Get count of unique skills in query results.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Count of unique skill names
 */
export function countUniqueSkills(
  db: Database,
  input: Omit<GetSkillInvocationsInput, 'limit' | 'offset'>
): number {
  const { skillName, sessionId, since, until } = input;

  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (skillName) {
    conditions.push('skill_name = $skillName');
    params.$skillName = skillName;
  }

  if (sessionId) {
    conditions.push('session_id = $sessionId');
    params.$sessionId = sessionId;
  }

  if (since) {
    conditions.push('timestamp >= $since');
    params.$since = since;
  }

  if (until) {
    conditions.push('timestamp <= $until');
    params.$until = until;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `SELECT COUNT(DISTINCT skill_name) as count FROM skill_invocations ${whereClause}`;
  const result = db.prepare(sql).get(params) as { count: number } | null;

  return result?.count ?? 0;
}

/**
 * Get count of unique sessions in query results.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Count of unique sessions
 */
export function countUniqueSessions(
  db: Database,
  input: Omit<GetSkillInvocationsInput, 'limit' | 'offset'>
): number {
  const { skillName, sessionId, since, until } = input;

  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (skillName) {
    conditions.push('skill_name = $skillName');
    params.$skillName = skillName;
  }

  if (sessionId) {
    conditions.push('session_id = $sessionId');
    params.$sessionId = sessionId;
  }

  if (since) {
    conditions.push('timestamp >= $since');
    params.$since = since;
  }

  if (until) {
    conditions.push('timestamp <= $until');
    params.$until = until;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `SELECT COUNT(DISTINCT session_id) as count FROM skill_invocations ${whereClause}`;
  const result = db.prepare(sql).get(params) as { count: number } | null;

  return result?.count ?? 0;
}

// =============================================================================
// Skill Invocation Insert
// =============================================================================

/**
 * Insert a skill invocation record.
 *
 * @param db - Database instance
 * @param invocation - Invocation data to insert
 * @returns The inserted row ID
 */
export function insertSkillInvocation(
  db: Database,
  invocation: Omit<SkillInvocationRow, 'id'>
): number {
  const sql = `
    INSERT INTO skill_invocations
      (session_id, skill_name, timestamp, user_prompt_snippet, file_path, line_number)
    VALUES
      ($session_id, $skill_name, $timestamp, $user_prompt_snippet, $file_path, $line_number)
  `;

  const result = db.prepare(sql).run({
    $session_id: invocation.session_id,
    $skill_name: invocation.skill_name,
    $timestamp: invocation.timestamp,
    $user_prompt_snippet: invocation.user_prompt_snippet,
    $file_path: invocation.file_path,
    $line_number: invocation.line_number,
  });

  return Number(result.lastInsertRowid);
}

/**
 * Insert multiple skill invocations in a transaction.
 *
 * @param db - Database instance
 * @param invocations - Array of invocation data
 * @returns Number of records inserted
 */
export function insertSkillInvocationsBatch(
  db: Database,
  invocations: Array<Omit<SkillInvocationRow, 'id'>>
): number {
  if (invocations.length === 0) {
    return 0;
  }

  const sql = `
    INSERT INTO skill_invocations
      (session_id, skill_name, timestamp, user_prompt_snippet, file_path, line_number)
    VALUES
      ($session_id, $skill_name, $timestamp, $user_prompt_snippet, $file_path, $line_number)
  `;

  const stmt = db.prepare(sql);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const invocation of invocations) {
      stmt.run({
        $session_id: invocation.session_id,
        $skill_name: invocation.skill_name,
        $timestamp: invocation.timestamp,
        $user_prompt_snippet: invocation.user_prompt_snippet,
        $file_path: invocation.file_path,
        $line_number: invocation.line_number,
      });
    }
    db.exec('COMMIT');
    return invocations.length;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// =============================================================================
// Session Summary Queries
// =============================================================================

/**
 * Query session summaries for agent reasoning about missed opportunities.
 * Joins sessions, session_entries, and skill_invocations data.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Array of session summaries
 */
export function querySessionSummaries(
  db: Database,
  input: GetSessionSummariesInput
): SessionSummary[] {
  const { since, until, projectPath, limit = 50 } = input;

  const conditions: string[] = [];
  const params: Record<string, string | number> = {
    $limit: limit,
  };

  if (since) {
    conditions.push('s.first_timestamp >= $since');
    params.$since = since;
  }

  if (until) {
    conditions.push('s.first_timestamp <= $until');
    params.$until = until;
  }

  if (projectPath) {
    conditions.push('s.project_path = $projectPath');
    params.$projectPath = projectPath;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Query basic session info
  const sessionsSql = `
    SELECT
      s.session_id,
      s.first_timestamp as timestamp,
      s.entry_count as turn_count,
      s.project_path
    FROM sessions s
    ${whereClause}
    ORDER BY s.first_timestamp DESC
    LIMIT $limit
  `;

  const sessions = db.prepare(sessionsSql).all(params) as Array<{
    session_id: string;
    timestamp: string;
    turn_count: number;
    project_path: string;
  }>;

  // For each session, get first user prompt, files operated, and skills invoked
  const summaries: SessionSummary[] = [];

  for (const session of sessions) {
    // Get first user prompt
    const firstUserPrompt = getFirstUserPrompt(db, session.session_id);

    // Get files operated
    const filesOperated = getFilesOperated(db, session.session_id);

    // Get skills invoked
    const skillsInvoked = getSkillsInvoked(db, session.session_id);

    summaries.push({
      sessionId: session.session_id,
      timestamp: session.timestamp,
      firstUserPrompt,
      filesOperated,
      skillsInvoked,
      turnCount: session.turn_count,
    });
  }

  return summaries;
}

/**
 * Get the first user prompt from a session (truncated to 500 chars).
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns First user prompt or empty string
 */
export function getFirstUserPrompt(db: Database, sessionId: string): string {
  const sql = `
    SELECT content
    FROM session_entries
    WHERE session_id = $sessionId
      AND role = 'user'
    ORDER BY timestamp ASC
    LIMIT 1
  `;

  const result = db.prepare(sql).get({ $sessionId: sessionId }) as { content: string } | null;

  if (!result?.content) {
    return '';
  }

  // Truncate to 500 characters
  return result.content.length > 500 ? result.content.slice(0, 500) + '...' : result.content;
}

/**
 * Get files operated on in a session (Read/Write/Edit tools).
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Array of unique file paths
 */
export function getFilesOperated(db: Database, sessionId: string): string[] {
  const sql = `
    SELECT DISTINCT
      COALESCE(
        json_extract(tool_input, '$.file_path'),
        json_extract(tool_input, '$.path')
      ) as file_path
    FROM session_entries
    WHERE session_id = $sessionId
      AND tool_name IN ('Read', 'Write', 'Edit')
      AND (tool_input LIKE '%file_path%' OR tool_input LIKE '%path%')
  `;

  const rows = db.prepare(sql).all({ $sessionId: sessionId }) as Array<{ file_path: string | null }>;

  return rows.filter((r) => r.file_path !== null).map((r) => r.file_path as string);
}

/**
 * Get skills invoked in a session.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Array of unique skill names
 */
export function getSkillsInvoked(db: Database, sessionId: string): string[] {
  const sql = `
    SELECT DISTINCT skill_name
    FROM skill_invocations
    WHERE session_id = $sessionId
    ORDER BY skill_name
  `;

  const rows = db.prepare(sql).all({ $sessionId: sessionId }) as Array<{ skill_name: string }>;

  return rows.map((r) => r.skill_name);
}

/**
 * Delete all skill invocations for a session.
 * Used during re-indexing.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Number of records deleted
 */
export function deleteSkillInvocationsForSession(db: Database, sessionId: string): number {
  const sql = 'DELETE FROM skill_invocations WHERE session_id = $sessionId';
  const result = db.prepare(sql).run({ $sessionId: sessionId });
  return result.changes;
}

/**
 * Delete all skill invocations.
 * Used when force re-indexing all sessions.
 *
 * @param db - Database instance
 * @returns Number of records deleted
 */
export function deleteAllSkillInvocations(db: Database): number {
  const sql = 'DELETE FROM skill_invocations';
  const result = db.prepare(sql).run();
  return result.changes;
}
