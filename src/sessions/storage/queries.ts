/**
 * Session Intelligence - SQL Query Helpers
 *
 * Query functions for session intelligence data extraction and retrieval.
 * All queries return raw data - the agent interprets meaning.
 *
 * Per Constitution Principle VII: No judgment columns or thresholds.
 *
 * @module src/sessions/storage/queries
 */

import type { Database } from 'bun:sqlite';

import type {
  ToolCallRecord,
  FileAccessRecord,
  CompressionEventRecord,
  DelegationEventRecord,
  McpToolCallRecord,
  QualitySignalRecord,
  GetToolSequencesInput,
  GetFileAccessesInput,
  GetCompressionEventsInput,
  GetDelegationEventsInput,
  GetMcpUsageInput,
  GetQualitySignalsInput,
  FileAccessSummary,
  ToolRepeatPattern,
  McpServerUsage,
  FileOperation,
  CompressionType,
  QualitySignalType,
} from '../types';

// =============================================================================
// Tool Call Sequences
// =============================================================================

/**
 * Database row type for tool_call_sequences.
 */
interface ToolCallRow {
  id: number;
  session_id: string;
  tool_name: string;
  input_hash: string;
  timestamp: string;
  sequence_index: number;
  is_error: number;
  error_message: string | null;
  file_path: string | null;
  line_number: number | null;
}

/**
 * Insert a tool call record.
 *
 * @param db - Database instance
 * @param record - Tool call record to insert
 * @returns Inserted record ID
 */
export function insertToolCall(db: Database, record: Omit<ToolCallRecord, 'id'>): number {
  const result = db
    .prepare(
      `
    INSERT INTO tool_call_sequences
      (session_id, tool_name, input_hash, timestamp, sequence_index, is_error, error_message, file_path, line_number)
    VALUES
      ($sessionId, $toolName, $inputHash, $timestamp, $sequenceIndex, $isError, $errorMessage, $filePath, $lineNumber)
  `
    )
    .run({
      $sessionId: record.sessionId,
      $toolName: record.toolName,
      $inputHash: record.inputHash,
      $timestamp: record.timestamp,
      $sequenceIndex: record.sequenceIndex,
      $isError: record.isError ? 1 : 0,
      $errorMessage: record.errorMessage ?? null,
      $filePath: record.filePath ?? null,
      $lineNumber: record.lineNumber ?? null,
    });

  return Number(result.lastInsertRowid);
}

/**
 * Query tool call sequences with optional filters.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Array of tool call records
 */
export function queryToolCalls(db: Database, input: GetToolSequencesInput): ToolCallRecord[] {
  const { sessionId, limit = 100, offset = 0, toolName, errorsOnly = false } = input;

  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string | number> = {
    $sessionId: sessionId,
    $limit: limit,
    $offset: offset,
  };

  if (toolName) {
    conditions.push('tool_name = $toolName');
    params.$toolName = toolName;
  }

  if (errorsOnly) {
    conditions.push('is_error = 1');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT id, session_id, tool_name, input_hash, timestamp, sequence_index,
           is_error, error_message, file_path, line_number
    FROM tool_call_sequences
    ${whereClause}
    ORDER BY sequence_index ASC
    LIMIT $limit OFFSET $offset
  `;

  const rows = db.prepare(sql).all(params) as ToolCallRow[];

  return rows.map(mapToolCallRow);
}

/**
 * Count tool calls matching filters.
 *
 * @param db - Database instance
 * @param input - Query filters (without pagination)
 * @returns Total count
 */
export function countToolCalls(
  db: Database,
  input: Omit<GetToolSequencesInput, 'limit' | 'offset'>
): number {
  const { sessionId, toolName, errorsOnly = false } = input;

  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string> = { $sessionId: sessionId };

  if (toolName) {
    conditions.push('tool_name = $toolName');
    params.$toolName = toolName;
  }

  if (errorsOnly) {
    conditions.push('is_error = 1');
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const sql = `SELECT COUNT(*) as count FROM tool_call_sequences ${whereClause}`;

  const result = db.prepare(sql).get(params) as { count: number } | null;
  return result?.count ?? 0;
}

/**
 * Find repeated tool call patterns (same tool + input hash).
 * Per Constitution VII: Returns counts - agent judges if "stuck".
 *
 * @param db - Database instance
 * @param sessionId - Session to analyze
 * @param minRepeats - Minimum repeat count (default 2)
 * @returns Array of repeat patterns
 */
export function findToolRepeatPatterns(
  db: Database,
  sessionId: string,
  minRepeats: number = 2
): ToolRepeatPattern[] {
  const sql = `
    SELECT
      tool_name,
      input_hash,
      COUNT(*) as repeat_count,
      MIN(sequence_index) as first_occurrence,
      MAX(sequence_index) as last_occurrence
    FROM tool_call_sequences
    WHERE session_id = $sessionId
    GROUP BY tool_name, input_hash
    HAVING COUNT(*) >= $minRepeats
    ORDER BY repeat_count DESC
  `;

  const rows = db.prepare(sql).all({ $sessionId: sessionId, $minRepeats: minRepeats }) as Array<{
    tool_name: string;
    input_hash: string;
    repeat_count: number;
    first_occurrence: number;
    last_occurrence: number;
  }>;

  return rows.map((row) => ({
    toolName: row.tool_name,
    inputHash: row.input_hash,
    repeatCount: row.repeat_count,
    firstOccurrence: row.first_occurrence,
    lastOccurrence: row.last_occurrence,
  }));
}

function mapToolCallRow(row: ToolCallRow): ToolCallRecord {
  const record: ToolCallRecord = {
    id: row.id,
    sessionId: row.session_id,
    toolName: row.tool_name,
    inputHash: row.input_hash,
    timestamp: row.timestamp,
    sequenceIndex: row.sequence_index,
    isError: row.is_error === 1,
  };
  if (row.error_message !== null) record.errorMessage = row.error_message;
  if (row.file_path !== null) record.filePath = row.file_path;
  if (row.line_number !== null) record.lineNumber = row.line_number;
  return record;
}

// =============================================================================
// File Accesses
// =============================================================================

/**
 * Database row type for file_accesses.
 */
interface FileAccessRow {
  id: number;
  session_id: string;
  file_path: string;
  operation: string;
  timestamp: string;
  access_sequence: number;
}

/**
 * Insert a file access record.
 *
 * @param db - Database instance
 * @param record - File access record to insert
 * @returns Inserted record ID
 */
export function insertFileAccess(db: Database, record: Omit<FileAccessRecord, 'id'>): number {
  const result = db
    .prepare(
      `
    INSERT INTO file_accesses
      (session_id, file_path, operation, timestamp, access_sequence)
    VALUES
      ($sessionId, $filePath, $operation, $timestamp, $accessSequence)
  `
    )
    .run({
      $sessionId: record.sessionId,
      $filePath: record.filePath,
      $operation: record.operation,
      $timestamp: record.timestamp,
      $accessSequence: record.accessSequence,
    });

  return Number(result.lastInsertRowid);
}

/**
 * Query file accesses with optional filters.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @param limit - Max records (default 100)
 * @param offset - Skip records (default 0)
 * @returns Array of file access records
 */
export function queryFileAccesses(
  db: Database,
  input: GetFileAccessesInput,
  limit: number = 100,
  offset: number = 0
): FileAccessRecord[] {
  const { sessionId, filePattern, operation } = input;

  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string | number> = {
    $sessionId: sessionId,
    $limit: limit,
    $offset: offset,
  };

  if (filePattern) {
    // Use LIKE with glob-style pattern converted to SQL LIKE
    const likePattern = filePattern.replace(/\*\*/g, '%').replace(/\*/g, '%');
    conditions.push('file_path LIKE $filePattern');
    params.$filePattern = likePattern;
  }

  if (operation) {
    conditions.push('operation = $operation');
    params.$operation = operation;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT id, session_id, file_path, operation, timestamp, access_sequence
    FROM file_accesses
    ${whereClause}
    ORDER BY access_sequence ASC
    LIMIT $limit OFFSET $offset
  `;

  const rows = db.prepare(sql).all(params) as FileAccessRow[];

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    filePath: row.file_path,
    operation: row.operation as FileOperation,
    timestamp: row.timestamp,
    accessSequence: row.access_sequence,
  }));
}

/**
 * Count file accesses matching filters.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Total count
 */
export function countFileAccesses(
  db: Database,
  input: Omit<GetFileAccessesInput, 'limit' | 'offset'>
): number {
  const { sessionId, filePattern, operation } = input;

  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string> = { $sessionId: sessionId };

  if (filePattern) {
    const likePattern = filePattern.replace(/\*\*/g, '%').replace(/\*/g, '%');
    conditions.push('file_path LIKE $filePattern');
    params.$filePattern = likePattern;
  }

  if (operation) {
    conditions.push('operation = $operation');
    params.$operation = operation;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const sql = `SELECT COUNT(*) as count FROM file_accesses ${whereClause}`;

  const result = db.prepare(sql).get(params) as { count: number } | null;
  return result?.count ?? 0;
}

/**
 * Get file access summary with per-file operation counts.
 *
 * @param db - Database instance
 * @param sessionId - Session to summarize
 * @param limit - Max files to return (default 50)
 * @returns Array of file access summaries sorted by total accesses
 */
export function getFileAccessSummary(
  db: Database,
  sessionId: string,
  limit: number = 50
): FileAccessSummary[] {
  const sql = `
    SELECT
      file_path,
      SUM(CASE WHEN operation = 'read' THEN 1 ELSE 0 END) as read_count,
      SUM(CASE WHEN operation = 'write' THEN 1 ELSE 0 END) as write_count,
      SUM(CASE WHEN operation = 'edit' THEN 1 ELSE 0 END) as edit_count,
      COUNT(*) as total_accesses
    FROM file_accesses
    WHERE session_id = $sessionId
    GROUP BY file_path
    ORDER BY total_accesses DESC
    LIMIT $limit
  `;

  const rows = db.prepare(sql).all({ $sessionId: sessionId, $limit: limit }) as Array<{
    file_path: string;
    read_count: number;
    write_count: number;
    edit_count: number;
    total_accesses: number;
  }>;

  return rows.map((row) => ({
    filePath: row.file_path,
    operations: {
      read: row.read_count,
      write: row.write_count,
      edit: row.edit_count,
    },
    totalAccesses: row.total_accesses,
  }));
}

// =============================================================================
// Compression Events
// =============================================================================

/**
 * Database row type for compression_events.
 */
interface CompressionEventRow {
  id: number;
  session_id: string;
  timestamp: string;
  compression_type: string;
  pre_tokens: number | null;
  tokens_saved: number | null;
  summary_preserved: string | null;
  file_path: string | null;
  line_number: number | null;
}

/**
 * Insert a compression event record.
 *
 * @param db - Database instance
 * @param record - Compression event to insert
 * @returns Inserted record ID
 */
export function insertCompressionEvent(
  db: Database,
  record: Omit<CompressionEventRecord, 'id'>
): number {
  const result = db
    .prepare(
      `
    INSERT INTO compression_events
      (session_id, timestamp, compression_type, pre_tokens, tokens_saved, summary_preserved, file_path, line_number)
    VALUES
      ($sessionId, $timestamp, $compressionType, $preTokens, $tokensSaved, $summaryPreserved, $filePath, $lineNumber)
  `
    )
    .run({
      $sessionId: record.sessionId,
      $timestamp: record.timestamp,
      $compressionType: record.compressionType,
      $preTokens: record.preTokens ?? null,
      $tokensSaved: record.tokensSaved ?? null,
      $summaryPreserved: record.summaryPreserved ?? null,
      $filePath: record.filePath ?? null,
      $lineNumber: record.lineNumber ?? null,
    });

  return Number(result.lastInsertRowid);
}

/**
 * Query compression events for a session.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Array of compression event records
 */
export function queryCompressionEvents(
  db: Database,
  input: GetCompressionEventsInput
): CompressionEventRecord[] {
  const { sessionId } = input;

  const sql = `
    SELECT id, session_id, timestamp, compression_type, pre_tokens, tokens_saved,
           summary_preserved, file_path, line_number
    FROM compression_events
    WHERE session_id = $sessionId
    ORDER BY timestamp ASC
  `;

  const rows = db.prepare(sql).all({ $sessionId: sessionId }) as CompressionEventRow[];

  return rows.map((row) => {
    const record: CompressionEventRecord = {
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      compressionType: row.compression_type as CompressionType,
    };
    if (row.pre_tokens !== null) record.preTokens = row.pre_tokens;
    if (row.tokens_saved !== null) record.tokensSaved = row.tokens_saved;
    if (row.summary_preserved !== null) record.summaryPreserved = row.summary_preserved;
    if (row.file_path !== null) record.filePath = row.file_path;
    if (row.line_number !== null) record.lineNumber = row.line_number;
    return record;
  });
}

/**
 * Count compression events for a session.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Total compression count
 */
export function countCompressionEvents(db: Database, sessionId: string): number {
  const sql = `SELECT COUNT(*) as count FROM compression_events WHERE session_id = $sessionId`;
  const result = db.prepare(sql).get({ $sessionId: sessionId }) as { count: number } | null;
  return result?.count ?? 0;
}

// =============================================================================
// Delegation Events
// =============================================================================

/**
 * Database row type for delegation_events.
 */
interface DelegationEventRow {
  id: number;
  session_id: string;
  subagent_type: string;
  task_prompt: string | null;
  timestamp: string;
  turn_index: number;
  success: number;
  subagent_session_id: string | null;
  file_path: string | null;
  line_number: number | null;
}

/**
 * Insert a delegation event record.
 *
 * @param db - Database instance
 * @param record - Delegation event to insert
 * @returns Inserted record ID
 */
export function insertDelegationEvent(
  db: Database,
  record: Omit<DelegationEventRecord, 'id'>
): number {
  const result = db
    .prepare(
      `
    INSERT INTO delegation_events
      (session_id, subagent_type, task_prompt, timestamp, turn_index, success, subagent_session_id, file_path, line_number)
    VALUES
      ($sessionId, $subagentType, $taskPrompt, $timestamp, $turnIndex, $success, $subagentSessionId, $filePath, $lineNumber)
  `
    )
    .run({
      $sessionId: record.sessionId,
      $subagentType: record.subagentType,
      $taskPrompt: record.taskPrompt ?? null,
      $timestamp: record.timestamp,
      $turnIndex: record.turnIndex,
      $success: record.success ? 1 : 0,
      $subagentSessionId: record.subagentSessionId ?? null,
      $filePath: record.filePath ?? null,
      $lineNumber: record.lineNumber ?? null,
    });

  return Number(result.lastInsertRowid);
}

/**
 * Query delegation events with optional filters.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Array of delegation event records
 */
export function queryDelegationEvents(
  db: Database,
  input: GetDelegationEventsInput
): DelegationEventRecord[] {
  const { sessionId, subagentType } = input;

  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string> = { $sessionId: sessionId };

  if (subagentType) {
    conditions.push('subagent_type = $subagentType');
    params.$subagentType = subagentType;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT id, session_id, subagent_type, task_prompt, timestamp, turn_index,
           success, subagent_session_id, file_path, line_number
    FROM delegation_events
    ${whereClause}
    ORDER BY turn_index ASC
  `;

  const rows = db.prepare(sql).all(params) as DelegationEventRow[];

  return rows.map((row) => {
    const record: DelegationEventRecord = {
      id: row.id,
      sessionId: row.session_id,
      subagentType: row.subagent_type,
      timestamp: row.timestamp,
      turnIndex: row.turn_index,
      success: row.success === 1,
    };
    if (row.task_prompt !== null) record.taskPrompt = row.task_prompt;
    if (row.subagent_session_id !== null) record.subagentSessionId = row.subagent_session_id;
    if (row.file_path !== null) record.filePath = row.file_path;
    if (row.line_number !== null) record.lineNumber = row.line_number;
    return record;
  });
}

/**
 * Count delegation events for a session.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @param subagentType - Optional filter by subagent type
 * @returns Total delegation count
 */
export function countDelegationEvents(
  db: Database,
  sessionId: string,
  subagentType?: string
): number {
  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string> = { $sessionId: sessionId };

  if (subagentType) {
    conditions.push('subagent_type = $subagentType');
    params.$subagentType = subagentType;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const sql = `SELECT COUNT(*) as count FROM delegation_events ${whereClause}`;

  const result = db.prepare(sql).get(params) as { count: number } | null;
  return result?.count ?? 0;
}

// =============================================================================
// MCP Tool Calls
// =============================================================================

/**
 * Database row type for mcp_tool_calls.
 */
interface McpToolCallRow {
  id: number;
  session_id: string;
  server_name: string;
  tool_name: string;
  timestamp: string;
  is_error: number;
  error_message: string | null;
  file_path: string | null;
  line_number: number | null;
}

/**
 * Insert an MCP tool call record.
 *
 * @param db - Database instance
 * @param record - MCP tool call to insert
 * @returns Inserted record ID
 */
export function insertMcpToolCall(db: Database, record: Omit<McpToolCallRecord, 'id'>): number {
  const result = db
    .prepare(
      `
    INSERT INTO mcp_tool_calls
      (session_id, server_name, tool_name, timestamp, is_error, error_message, file_path, line_number)
    VALUES
      ($sessionId, $serverName, $toolName, $timestamp, $isError, $errorMessage, $filePath, $lineNumber)
  `
    )
    .run({
      $sessionId: record.sessionId,
      $serverName: record.serverName,
      $toolName: record.toolName,
      $timestamp: record.timestamp,
      $isError: record.isError ? 1 : 0,
      $errorMessage: record.errorMessage ?? null,
      $filePath: record.filePath ?? null,
      $lineNumber: record.lineNumber ?? null,
    });

  return Number(result.lastInsertRowid);
}

/**
 * Query MCP tool calls with optional filters.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Array of MCP tool call records
 */
export function queryMcpToolCalls(db: Database, input: GetMcpUsageInput): McpToolCallRecord[] {
  const { sessionId, serverName } = input;

  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string> = { $sessionId: sessionId };

  if (serverName) {
    conditions.push('server_name = $serverName');
    params.$serverName = serverName;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT id, session_id, server_name, tool_name, timestamp, is_error, error_message, file_path, line_number
    FROM mcp_tool_calls
    ${whereClause}
    ORDER BY timestamp ASC
  `;

  const rows = db.prepare(sql).all(params) as McpToolCallRow[];

  return rows.map((row) => {
    const record: McpToolCallRecord = {
      id: row.id,
      sessionId: row.session_id,
      serverName: row.server_name,
      toolName: row.tool_name,
      timestamp: row.timestamp,
      isError: row.is_error === 1,
    };
    if (row.error_message !== null) record.errorMessage = row.error_message;
    if (row.file_path !== null) record.filePath = row.file_path;
    if (row.line_number !== null) record.lineNumber = row.line_number;
    return record;
  });
}

/**
 * Get MCP server usage summary with error rates.
 * Per Constitution VII: Rates are data - agent judges significance.
 *
 * @param db - Database instance
 * @param sessionId - Session to summarize
 * @returns Array of per-server usage summaries
 */
export function getMcpServerUsage(db: Database, sessionId: string): McpServerUsage[] {
  // Get per-server totals
  const serverSql = `
    SELECT
      server_name,
      COUNT(*) as call_count,
      SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error_count
    FROM mcp_tool_calls
    WHERE session_id = $sessionId
    GROUP BY server_name
    ORDER BY call_count DESC
  `;

  const serverRows = db.prepare(serverSql).all({ $sessionId: sessionId }) as Array<{
    server_name: string;
    call_count: number;
    error_count: number;
  }>;

  // Get per-tool breakdown for each server
  const toolSql = `
    SELECT
      server_name,
      tool_name,
      COUNT(*) as call_count,
      SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error_count
    FROM mcp_tool_calls
    WHERE session_id = $sessionId
    GROUP BY server_name, tool_name
    ORDER BY server_name, call_count DESC
  `;

  const toolRows = db.prepare(toolSql).all({ $sessionId: sessionId }) as Array<{
    server_name: string;
    tool_name: string;
    call_count: number;
    error_count: number;
  }>;

  // Group tools by server
  const toolsByServer = new Map<
    string,
    Array<{ toolName: string; callCount: number; errorCount: number }>
  >();
  for (const row of toolRows) {
    const tools = toolsByServer.get(row.server_name) ?? [];
    tools.push({
      toolName: row.tool_name,
      callCount: row.call_count,
      errorCount: row.error_count,
    });
    toolsByServer.set(row.server_name, tools);
  }

  return serverRows.map((row) => ({
    serverName: row.server_name,
    callCount: row.call_count,
    errorCount: row.error_count,
    errorRate: row.call_count > 0 ? row.error_count / row.call_count : 0,
    tools: toolsByServer.get(row.server_name) ?? [],
  }));
}

// =============================================================================
// Quality Signals
// =============================================================================

/**
 * Database row type for quality_signals.
 */
interface QualitySignalRow {
  id: number;
  session_id: string;
  signal_type: string;
  timestamp: string;
  passed: number | null;
  raw_output: string | null;
  file_path: string | null;
  line_number: number | null;
}

/**
 * Insert a quality signal record.
 *
 * @param db - Database instance
 * @param record - Quality signal to insert
 * @returns Inserted record ID
 */
export function insertQualitySignal(db: Database, record: Omit<QualitySignalRecord, 'id'>): number {
  const result = db
    .prepare(
      `
    INSERT INTO quality_signals
      (session_id, signal_type, timestamp, passed, raw_output, file_path, line_number)
    VALUES
      ($sessionId, $signalType, $timestamp, $passed, $rawOutput, $filePath, $lineNumber)
  `
    )
    .run({
      $sessionId: record.sessionId,
      $signalType: record.signalType,
      $timestamp: record.timestamp,
      $passed: record.passed === null ? null : record.passed ? 1 : 0,
      $rawOutput: record.rawOutput ?? null,
      $filePath: record.filePath ?? null,
      $lineNumber: record.lineNumber ?? null,
    });

  return Number(result.lastInsertRowid);
}

/**
 * Query quality signals with optional filters.
 *
 * @param db - Database instance
 * @param input - Query filters
 * @returns Array of quality signal records
 */
export function queryQualitySignals(
  db: Database,
  input: GetQualitySignalsInput
): QualitySignalRecord[] {
  const { sessionId, signalType } = input;

  const conditions: string[] = ['session_id = $sessionId'];
  const params: Record<string, string> = { $sessionId: sessionId };

  if (signalType) {
    conditions.push('signal_type = $signalType');
    params.$signalType = signalType;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT id, session_id, signal_type, timestamp, passed, raw_output, file_path, line_number
    FROM quality_signals
    ${whereClause}
    ORDER BY timestamp ASC
  `;

  const rows = db.prepare(sql).all(params) as QualitySignalRow[];

  return rows.map((row) => {
    const record: QualitySignalRecord = {
      id: row.id,
      sessionId: row.session_id,
      signalType: row.signal_type as QualitySignalType,
      timestamp: row.timestamp,
      passed: row.passed === null ? null : row.passed === 1,
    };
    if (row.raw_output !== null) record.rawOutput = row.raw_output;
    if (row.file_path !== null) record.filePath = row.file_path;
    if (row.line_number !== null) record.lineNumber = row.line_number;
    return record;
  });
}

/**
 * Count quality signals by type for a session.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Object with counts per signal type
 */
export function countQualitySignalsByType(
  db: Database,
  sessionId: string
): Record<
  QualitySignalType,
  { total: number; passed: number; failed: number; indeterminate: number }
> {
  const sql = `
    SELECT
      signal_type,
      COUNT(*) as total,
      SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN passed IS NULL THEN 1 ELSE 0 END) as indeterminate
    FROM quality_signals
    WHERE session_id = $sessionId
    GROUP BY signal_type
  `;

  const rows = db.prepare(sql).all({ $sessionId: sessionId }) as Array<{
    signal_type: string;
    total: number;
    passed: number;
    failed: number;
    indeterminate: number;
  }>;

  const result: Record<
    QualitySignalType,
    { total: number; passed: number; failed: number; indeterminate: number }
  > = {
    test: { total: 0, passed: 0, failed: 0, indeterminate: 0 },
    build: { total: 0, passed: 0, failed: 0, indeterminate: 0 },
    lint: { total: 0, passed: 0, failed: 0, indeterminate: 0 },
  };

  for (const row of rows) {
    const type = row.signal_type as QualitySignalType;
    if (type in result) {
      result[type] = {
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        indeterminate: row.indeterminate,
      };
    }
  }

  return result;
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Insert multiple tool calls in a transaction.
 *
 * @param db - Database instance
 * @param records - Array of tool call records
 * @returns Number of inserted records
 */
export function insertToolCallsBatch(db: Database, records: Omit<ToolCallRecord, 'id'>[]): number {
  let inserted = 0;

  db.transaction(() => {
    for (const record of records) {
      insertToolCall(db, record);
      inserted++;
    }
  })();

  return inserted;
}

/**
 * Insert multiple file accesses in a transaction.
 *
 * @param db - Database instance
 * @param records - Array of file access records
 * @returns Number of inserted records
 */
export function insertFileAccessesBatch(
  db: Database,
  records: Omit<FileAccessRecord, 'id'>[]
): number {
  let inserted = 0;

  db.transaction(() => {
    for (const record of records) {
      insertFileAccess(db, record);
      inserted++;
    }
  })();

  return inserted;
}
