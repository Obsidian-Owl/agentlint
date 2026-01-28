/**
 * EP07 Causal Tracing Engine - Database Queries
 *
 * CRUD operations for causal chains and issue patterns.
 *
 * @module persistence/causal/queries
 */

import type { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';

import type {
  CausalChain,
  EvidenceItem,
  IssuePattern,
  GapType,
  GapLocation,
  ConfidenceLevel,
} from '../../tools/causal/types.js';

// =============================================================================
// Chain Operations
// =============================================================================

/**
 * Insert a causal chain with its evidence items.
 *
 * Uses a transaction to ensure atomicity - either all inserts succeed
 * or the entire operation is rolled back.
 *
 * @param db - Database instance
 * @param chain - Causal chain to insert
 * @returns The inserted chain ID
 */
export function insertChain(db: Database, chain: CausalChain): string {
  const chainId = chain.id || uuidv4();

  // Wrap in transaction for atomicity
  const insertTransaction = db.transaction(() => {
    // Insert chain
    const insertChainStmt = db.prepare(`
      INSERT INTO causal_chains (
        id, issue_id, trigger_summary,
        gap_type, gap_location, gap_expected_guidance, gap_counterfactual,
        mechanism, effect,
        confidence_overall, confidence_specificity, confidence_temporal,
        confidence_mechanistic, confidence_evidence_quality,
        confidence_reproducibility, confidence_alternatives,
        depth, depth_limit_reached, project_path, created_at,
        counterfactual, pattern_id
      ) VALUES (
        $id, $issueId, $triggerSummary,
        $gapType, $gapLocation, $gapExpectedGuidance, $gapCounterfactual,
        $mechanism, $effect,
        $confidenceOverall, $confidenceSpecificity, $confidenceTemporal,
        $confidenceMechanistic, $confidenceEvidenceQuality,
        $confidenceReproducibility, $confidenceAlternatives,
        $depth, $depthLimitReached, $projectPath, $createdAt,
        $counterfactual, $patternId
      )
    `);

    insertChainStmt.run({
      $id: chainId,
      $issueId: chain.issueId,
      $triggerSummary: chain.trigger.content ?? chain.trigger.source,
      $gapType: chain.gap?.type ?? null,
      $gapLocation: chain.gap?.location ?? null,
      $gapExpectedGuidance: chain.gap?.expectedGuidance ?? null,
      $gapCounterfactual: chain.gap?.counterfactual ?? null,
      $mechanism: chain.mechanism,
      $effect: chain.effect,
      $confidenceOverall: chain.confidence.overall,
      $confidenceSpecificity: chain.confidence.specificity ? 1 : 0,
      $confidenceTemporal: chain.confidence.temporal ? 1 : 0,
      $confidenceMechanistic: chain.confidence.mechanistic ? 1 : 0,
      $confidenceEvidenceQuality: chain.confidence.evidenceQuality ? 1 : 0,
      $confidenceReproducibility: chain.confidence.reproducibility ? 1 : 0,
      $confidenceAlternatives: chain.confidence.alternatives ? 1 : 0,
      $depth: chain.depth,
      $depthLimitReached: chain.depthLimitReached ? 1 : 0,
      $projectPath: chain.projectPath,
      $createdAt: chain.createdAt,
      $counterfactual: chain.counterfactual ?? null,
      $patternId: chain.patternId ?? null,
    });

    // Insert evidence items
    const insertEvidenceStmt = db.prepare(`
      INSERT INTO evidence_items (
        id, chain_id, type, source, timestamp, content,
        file_path, line_number, column_number, snippet, metadata, sequence
      ) VALUES (
        $id, $chainId, $type, $source, $timestamp, $content,
        $filePath, $lineNumber, $columnNumber, $snippet, $metadata, $sequence
      )
    `);

    chain.evidence.forEach((evidence, index) => {
      insertEvidenceStmt.run({
        $id: evidence.id || uuidv4(),
        $chainId: chainId,
        $type: evidence.type,
        $source: evidence.source,
        $timestamp: evidence.timestamp ?? null,
        $content: evidence.content ?? null,
        $filePath: evidence.position?.filePath ?? null,
        $lineNumber: evidence.position?.line ?? null,
        $columnNumber: evidence.position?.column ?? null,
        $snippet: evidence.position?.snippet ?? null,
        $metadata: evidence.metadata ? JSON.stringify(evidence.metadata) : null,
        $sequence: index,
      });
    });
  });

  // Execute the transaction
  insertTransaction();

  return chainId;
}

/**
 * Database row type for causal_chains table.
 */
interface ChainRow {
  id: string;
  issue_id: string;
  trigger_summary: string | null;
  gap_type: string | null;
  gap_location: string | null;
  gap_expected_guidance: string | null;
  gap_counterfactual: string | null;
  mechanism: string;
  effect: string;
  confidence_overall: string;
  confidence_specificity: number;
  confidence_temporal: number;
  confidence_mechanistic: number;
  confidence_evidence_quality: number;
  confidence_reproducibility: number;
  confidence_alternatives: number;
  depth: number;
  depth_limit_reached: number;
  project_path: string;
  created_at: string;
  counterfactual: string | null;
  pattern_id: string | null;
}

/**
 * Database row type for evidence_items table.
 */
interface EvidenceRow {
  id: string;
  chain_id: string;
  type: string;
  source: string;
  timestamp: string | null;
  content: string | null;
  file_path: string | null;
  line_number: number | null;
  column_number: number | null;
  snippet: string | null;
  metadata: string | null;
  sequence: number;
}

/**
 * Convert a database row to a CausalChain object.
 */
function rowToChain(row: ChainRow, evidence: EvidenceItem[]): CausalChain {
  // Find trigger evidence (first SessionMatch or first evidence)
  // Schema guarantees at least 1 evidence item, but handle empty case defensively
  const trigger = evidence.find((e) => e.type === 'SessionMatch') ??
    evidence[0] ?? {
      id: uuidv4(),
      type: 'TemporalMarker' as const,
      source: row.trigger_summary ?? 'unknown',
    };

  return {
    id: row.id,
    issueId: row.issue_id,
    trigger,
    gap: row.gap_type
      ? {
          type: row.gap_type as GapType,
          location: row.gap_location as GapLocation,
          expectedGuidance: row.gap_expected_guidance!,
          counterfactual: row.gap_counterfactual!,
        }
      : undefined,
    mechanism: row.mechanism,
    effect: row.effect,
    confidence: {
      specificity: row.confidence_specificity === 1,
      temporal: row.confidence_temporal === 1,
      mechanistic: row.confidence_mechanistic === 1,
      evidenceQuality: row.confidence_evidence_quality === 1,
      reproducibility: row.confidence_reproducibility === 1,
      alternatives: row.confidence_alternatives === 1,
      overall: row.confidence_overall as ConfidenceLevel,
    },
    evidence,
    depth: row.depth,
    depthLimitReached: row.depth_limit_reached === 1,
    projectPath: row.project_path,
    createdAt: row.created_at,
    counterfactual: row.counterfactual ?? undefined,
    patternId: row.pattern_id ?? undefined,
  };
}

/**
 * Safely parse JSON metadata, returning undefined on parse failure.
 */
function safeParseJson(json: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convert a database row to an EvidenceItem object.
 */
function rowToEvidence(row: EvidenceRow): EvidenceItem {
  return {
    id: row.id,
    type: row.type as EvidenceItem['type'],
    source: row.source,
    timestamp: row.timestamp ?? undefined,
    content: row.content ?? undefined,
    position:
      row.file_path || row.line_number || row.column_number || row.snippet
        ? {
            filePath: row.file_path!,
            line: row.line_number ?? undefined,
            column: row.column_number ?? undefined,
            snippet: row.snippet ?? undefined,
          }
        : undefined,
    metadata: row.metadata ? safeParseJson(row.metadata) : undefined,
  };
}

/**
 * Get a causal chain by ID.
 *
 * @param db - Database instance
 * @param chainId - Chain ID to retrieve
 * @returns The chain or null if not found
 */
export function getChainById(db: Database, chainId: string): CausalChain | null {
  const chainRow = db
    .query<ChainRow, [string]>('SELECT * FROM causal_chains WHERE id = ?')
    .get(chainId);

  if (!chainRow) {
    return null;
  }

  const evidenceRows = db
    .query<
      EvidenceRow,
      [string]
    >('SELECT * FROM evidence_items WHERE chain_id = ? ORDER BY sequence')
    .all(chainId);

  const evidence = evidenceRows.map(rowToEvidence);
  return rowToChain(chainRow, evidence);
}

/**
 * Get all causal chains for a project.
 *
 * @param db - Database instance
 * @param projectPath - Project path to filter by
 * @param options - Query options
 * @returns Array of chains
 */
export function getChainsByProject(
  db: Database,
  projectPath: string,
  options: {
    limit?: number;
    offset?: number;
    orderBy?: 'created_at' | 'depth';
    order?: 'ASC' | 'DESC';
  } = {}
): CausalChain[] {
  const { limit = 100, offset = 0, orderBy = 'created_at', order = 'DESC' } = options;

  // Validate orderBy and order to prevent SQL injection
  const validOrderBy = orderBy === 'depth' ? 'depth' : 'created_at';
  const validOrder = order === 'ASC' ? 'ASC' : 'DESC';

  const chainRows = db
    .query<ChainRow, [string, number, number]>(
      `SELECT * FROM causal_chains
       WHERE project_path = ?
       ORDER BY ${validOrderBy} ${validOrder}
       LIMIT ? OFFSET ?`
    )
    .all(projectPath, limit, offset);

  return chainRows.map((row) => {
    const evidenceRows = db
      .query<
        EvidenceRow,
        [string]
      >('SELECT * FROM evidence_items WHERE chain_id = ? ORDER BY sequence')
      .all(row.id);

    const evidence = evidenceRows.map(rowToEvidence);
    return rowToChain(row, evidence);
  });
}

/**
 * Count chains for a project.
 *
 * @param db - Database instance
 * @param projectPath - Project path to filter by
 * @returns Count of chains
 */
export function countChainsByProject(db: Database, projectPath: string): number {
  const result = db
    .query<
      { count: number },
      [string]
    >('SELECT COUNT(*) as count FROM causal_chains WHERE project_path = ?')
    .get(projectPath);
  return result?.count ?? 0;
}

/**
 * Delete a chain and its evidence items.
 *
 * @param db - Database instance
 * @param chainId - Chain ID to delete
 * @returns True if deleted, false if not found
 */
export function deleteChain(db: Database, chainId: string): boolean {
  const result = db.run('DELETE FROM causal_chains WHERE id = ?', [chainId]);
  return result.changes > 0;
}

// =============================================================================
// Pattern Operations
// =============================================================================

/**
 * Insert a new issue pattern.
 *
 * @param db - Database instance
 * @param pattern - Pattern to insert
 * @returns The inserted pattern ID
 */
export function insertPattern(db: Database, pattern: IssuePattern): string {
  const patternId = pattern.id || uuidv4();

  // Wrap in transaction for atomicity
  const insertTransaction = db.transaction(() => {
    const insertPatternStmt = db.prepare(`
      INSERT INTO issue_patterns (
        id, category, frequency, is_systemic,
        first_occurrence, last_occurrence, project_path, summary
      ) VALUES (
        $id, $category, $frequency, $isSystemic,
        $firstOccurrence, $lastOccurrence, $projectPath, $summary
      )
    `);

    insertPatternStmt.run({
      $id: patternId,
      $category: pattern.category,
      $frequency: pattern.frequency,
      $isSystemic: pattern.isSystemic ? 1 : 0,
      $firstOccurrence: pattern.firstOccurrence,
      $lastOccurrence: pattern.lastOccurrence,
      $projectPath: pattern.projectPath ?? null,
      $summary: pattern.summary,
    });

    // Link chains to pattern
    const insertLinkStmt = db.prepare(`
      INSERT INTO chain_patterns (chain_id, pattern_id) VALUES ($chainId, $patternId)
    `);

    const updateChainStmt = db.prepare(
      'UPDATE causal_chains SET pattern_id = $patternId WHERE id = $chainId'
    );

    for (const chainId of pattern.chainIds) {
      insertLinkStmt.run({ $chainId: chainId, $patternId: patternId });
      // Also update the chain's pattern_id
      updateChainStmt.run({ $patternId: patternId, $chainId: chainId });
    }
  });

  // Execute the transaction
  insertTransaction();

  return patternId;
}

/**
 * Database row type for issue_patterns table.
 */
interface PatternRow {
  id: string;
  category: string;
  frequency: number;
  is_systemic: number;
  first_occurrence: string;
  last_occurrence: string;
  project_path: string | null;
  summary: string;
}

/**
 * Get issue patterns for a project.
 *
 * @param db - Database instance
 * @param projectPath - Project path to filter by (null for global patterns)
 * @param options - Query options
 * @returns Array of patterns
 */
export function getPatternsByProject(
  db: Database,
  projectPath: string | null,
  options: {
    minFrequency?: number;
    category?: GapType;
    onlySystemic?: boolean;
  } = {}
): IssuePattern[] {
  const { minFrequency = 1, category, onlySystemic = false } = options;

  let sql = 'SELECT * FROM issue_patterns WHERE 1=1';
  const params: (string | number)[] = [];

  if (projectPath !== null) {
    sql += ' AND (project_path = ? OR project_path IS NULL)';
    params.push(projectPath);
  }

  if (minFrequency > 1) {
    sql += ' AND frequency >= ?';
    params.push(minFrequency);
  }

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (onlySystemic) {
    sql += ' AND is_systemic = 1';
  }

  sql += ' ORDER BY frequency DESC, last_occurrence DESC';

  const patternRows = db.query<PatternRow, typeof params>(sql).all(...params);

  return patternRows.map((row) => {
    // Get linked chain IDs
    const chainIds = db
      .query<{ chain_id: string }, [string]>(
        'SELECT chain_id FROM chain_patterns WHERE pattern_id = ?'
      )
      .all(row.id)
      .map((r) => r.chain_id);

    return {
      id: row.id,
      category: row.category as GapType,
      chainIds,
      frequency: row.frequency,
      isSystemic: row.is_systemic === 1,
      firstOccurrence: row.first_occurrence,
      lastOccurrence: row.last_occurrence,
      projectPath: row.project_path ?? undefined,
      summary: row.summary,
    };
  });
}

/**
 * Get a pattern by ID.
 *
 * @param db - Database instance
 * @param patternId - Pattern ID to retrieve
 * @returns The pattern or null if not found
 */
export function getPatternById(db: Database, patternId: string): IssuePattern | null {
  const row = db
    .query<PatternRow, [string]>('SELECT * FROM issue_patterns WHERE id = ?')
    .get(patternId);

  if (!row) {
    return null;
  }

  const chainIds = db
    .query<{ chain_id: string }, [string]>(
      'SELECT chain_id FROM chain_patterns WHERE pattern_id = ?'
    )
    .all(patternId)
    .map((r) => r.chain_id);

  return {
    id: row.id,
    category: row.category as GapType,
    chainIds,
    frequency: row.frequency,
    isSystemic: row.is_systemic === 1,
    firstOccurrence: row.first_occurrence,
    lastOccurrence: row.last_occurrence,
    projectPath: row.project_path ?? undefined,
    summary: row.summary,
  };
}

/**
 * Update a pattern's frequency and timestamps.
 *
 * @param db - Database instance
 * @param patternId - Pattern ID to update
 * @param chainId - New chain ID to add
 * @param timestamp - Timestamp of the new occurrence
 */
export function addChainToPattern(
  db: Database,
  patternId: string,
  chainId: string,
  timestamp: string
): void {
  // Link chain to pattern
  db.run('INSERT OR IGNORE INTO chain_patterns (chain_id, pattern_id) VALUES (?, ?)', [
    chainId,
    patternId,
  ]);

  // Update chain's pattern_id
  db.run('UPDATE causal_chains SET pattern_id = ? WHERE id = ?', [patternId, chainId]);

  // Update pattern frequency and timestamps
  db.run(
    `UPDATE issue_patterns
     SET frequency = frequency + 1,
         last_occurrence = ?,
         is_systemic = CASE WHEN frequency + 1 >= 3 THEN 1 ELSE is_systemic END
     WHERE id = ?`,
    [timestamp, patternId]
  );
}

/**
 * Delete a pattern and its chain links.
 *
 * @param db - Database instance
 * @param patternId - Pattern ID to delete
 * @returns True if deleted, false if not found
 */
export function deletePattern(db: Database, patternId: string): boolean {
  // Clear pattern_id from linked chains
  db.run('UPDATE causal_chains SET pattern_id = NULL WHERE pattern_id = ?', [patternId]);

  // Delete pattern (cascade will remove chain_patterns links)
  const result = db.run('DELETE FROM issue_patterns WHERE id = ?', [patternId]);
  return result.changes > 0;
}

/**
 * Get all patterns across all projects.
 *
 * @param db - Database instance
 * @param options - Query options
 * @returns Array of all patterns
 */
export function getAllPatterns(
  db: Database,
  options: {
    minFrequency?: number;
    category?: GapType;
    onlySystemic?: boolean;
    limit?: number;
  } = {}
): IssuePattern[] {
  const { minFrequency = 1, category, onlySystemic = false, limit = 100 } = options;

  let sql = 'SELECT * FROM issue_patterns WHERE 1=1';
  const params: (string | number)[] = [];

  if (minFrequency > 1) {
    sql += ' AND frequency >= ?';
    params.push(minFrequency);
  }

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  if (onlySystemic) {
    sql += ' AND is_systemic = 1';
  }

  sql += ' ORDER BY frequency DESC, last_occurrence DESC';
  sql += ' LIMIT ?';
  params.push(limit);

  const patternRows = db.query<PatternRow, typeof params>(sql).all(...params);

  return patternRows.map((row) => {
    // Get linked chain IDs
    const chainIds = db
      .query<{ chain_id: string }, [string]>(
        'SELECT chain_id FROM chain_patterns WHERE pattern_id = ?'
      )
      .all(row.id)
      .map((r) => r.chain_id);

    return {
      id: row.id,
      category: row.category as GapType,
      chainIds,
      frequency: row.frequency,
      isSystemic: row.is_systemic === 1,
      firstOccurrence: row.first_occurrence,
      lastOccurrence: row.last_occurrence,
      projectPath: row.project_path ?? undefined,
      summary: row.summary,
    };
  });
}
