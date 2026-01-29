/**
 * EP22: Local JSONL Exporter
 * Writes completed spans to local NDJSON files with rotation.
 */

import { appendFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// =============================================================================
// Types
// =============================================================================

/** Local exporter configuration */
export interface LocalExporterConfig {
  /** Output directory (default: ~/.agentlint/logs) */
  outputDir?: string;
  /** Max file size in MB before rotation (default: 10) */
  maxFileSizeMB?: number;
  /** File name prefix (default: 'traces') */
  filePrefix?: string;
}

/** Exportable span structure (OpenTelemetry-like) */
export interface ExportableSpan {
  /** W3C trace ID (32 hex chars) */
  traceId: string;
  /** Span ID (16 hex chars) */
  spanId: string;
  /** Parent span ID (optional) */
  parentSpanId?: string;
  /** Span name */
  name: string;
  /** Span kind */
  kind: 'internal' | 'client' | 'server';
  /** Start timestamp (ms since epoch) */
  startTime: number;
  /** End timestamp (ms since epoch) */
  endTime: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Span status */
  status: {
    code: 'ok' | 'error' | 'unset';
    message?: string;
  };
  /** Span attributes */
  attributes: Record<string, string | number | boolean>;
  /** Span events */
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_OUTPUT_DIR = join(homedir(), '.agentlint', 'logs');
const DEFAULT_MAX_FILE_SIZE_MB = 10;
const DEFAULT_FILE_PREFIX = 'traces';
const BYTES_PER_MB = 1024 * 1024;

// =============================================================================
// LocalSpanExporter
// =============================================================================

/**
 * Local JSONL exporter for spans.
 * Writes completed spans to ~/.agentlint/logs/traces-{date}.ndjson
 * with automatic file rotation when size exceeds limit.
 */
export class LocalSpanExporter {
  private readonly outputDir: string;
  private readonly maxFileSizeBytes: number;
  private readonly filePrefix: string;
  private currentFilePath: string;

  constructor(config: LocalExporterConfig = {}) {
    this.outputDir = config.outputDir ?? DEFAULT_OUTPUT_DIR;
    this.maxFileSizeBytes = (config.maxFileSizeMB ?? DEFAULT_MAX_FILE_SIZE_MB) * BYTES_PER_MB;
    this.filePrefix = config.filePrefix ?? DEFAULT_FILE_PREFIX;

    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true, mode: 0o700 });
    }

    this.currentFilePath = this.generateFilePath();
  }

  /**
   * Export spans to file.
   * Checks file size before writing and rotates if needed.
   */
  export(spans: ExportableSpan[]): void {
    if (spans.length === 0) {
      return;
    }

    // Check if rotation is needed
    this.maybeRotate();

    // Write each span as a single JSON line (NDJSON)
    for (const span of spans) {
      const line = JSON.stringify(span) + '\n';
      appendFileSync(this.currentFilePath, line);
    }
  }

  /**
   * Get current output file path.
   */
  getCurrentFilePath(): string {
    return this.currentFilePath;
  }

  /**
   * Force flush to disk.
   * (appendFileSync is already synchronous, so this is a no-op)
   */
  flush(): void {
    // No-op: appendFileSync already writes synchronously
  }

  /**
   * Cleanup (close file handles).
   * (No open handles with appendFileSync, so this is a no-op)
   */
  shutdown(): void {
    // No-op: no persistent file handles to close
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Generate file path for current date: {prefix}-{YYYY-MM-DD}.ndjson
   */
  private generateFilePath(rotationIndex?: number): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const suffix = rotationIndex !== undefined ? `.${rotationIndex}` : '';
    return join(this.outputDir, `${this.filePrefix}-${date}${suffix}.ndjson`);
  }

  /**
   * Check file size and rotate if needed.
   */
  private maybeRotate(): void {
    // Check if current file exists and exceeds size limit
    if (!existsSync(this.currentFilePath)) {
      return;
    }

    const stats = statSync(this.currentFilePath);
    if (stats.size < this.maxFileSizeBytes) {
      return;
    }

    // File is too large, rotate to next index
    let rotationIndex = 1;
    let candidatePath = this.generateFilePath(rotationIndex);

    // Find next available rotation index
    while (existsSync(candidatePath)) {
      rotationIndex++;
      candidatePath = this.generateFilePath(rotationIndex);
    }

    // Update current file path to new rotation
    this.currentFilePath = candidatePath;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a local span exporter.
 * @param config - Exporter configuration
 * @returns Configured LocalSpanExporter
 */
export function createLocalExporter(config?: LocalExporterConfig): LocalSpanExporter {
  return new LocalSpanExporter(config);
}
