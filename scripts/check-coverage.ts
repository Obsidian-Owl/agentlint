#!/usr/bin/env bun
/**
 * EP09 Temporal Analysis - Coverage Threshold Verification
 *
 * Verifies that test coverage meets the 80% threshold for the temporal module
 * per spec.md success criteria. Parses Bun's coverage output and checks thresholds.
 *
 * Usage:
 *   bun run scripts/check-coverage.ts
 *   bun run scripts/check-coverage.ts --verbose
 *
 * @module scripts/check-coverage
 */

const THRESHOLD = 80;

interface CoverageEntry {
  file: string;
  funcCoverage: number;
  lineCoverage: number;
}

interface CoverageResult {
  entries: CoverageEntry[];
  totalLines: number;
  coveredLines: number;
  averageLineCoverage: number;
  meetsThreshold: boolean;
}

/**
 * Parse coverage output from Bun test --coverage.
 *
 * Coverage output format:
 *  src/temporal/file.ts             |   90.00 |   85.00 | 10-15,20
 */
function parseCoverageOutput(output: string): CoverageEntry[] {
  const entries: CoverageEntry[] = [];

  const lines = output.split('\n');
  for (const line of lines) {
    // Match coverage lines: " path/to/file.ts | 100.00 | 85.00 | uncovered"
    const match = line.match(
      /^\s*(src\/temporal\/[^\s|]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/
    );
    if (match) {
      const [, file, funcCov, lineCov] = match;
      // Skip test files
      if (file && !file.includes('__tests__')) {
        entries.push({
          file: file.trim(),
          funcCoverage: parseFloat(funcCov ?? '0'),
          lineCoverage: parseFloat(lineCov ?? '0'),
        });
      }
    }
  }

  return entries;
}

/**
 * Check if a file is a tool handler (SDK integration code).
 * Per ADR-0011, these are covered by VCR recordings and TruLens evals, not unit tests.
 */
function isToolHandler(file: string): boolean {
  return file.includes('/tools/') && !file.includes('/tools/index.ts') && !file.includes('/tools/descriptions.ts');
}

/**
 * Calculate coverage statistics.
 */
function calculateStats(entries: CoverageEntry[]): CoverageResult {
  if (entries.length === 0) {
    return {
      entries: [],
      totalLines: 0,
      coveredLines: 0,
      averageLineCoverage: 0,
      meetsThreshold: false,
    };
  }

  // Filter out tool handlers for threshold calculation (covered by VCR/evals per ADR-0011)
  const coreEntries = entries.filter((e) => !isToolHandler(e.file));

  // Calculate weighted average for core files only
  const totalLineCoverage = coreEntries.reduce((sum, e) => sum + e.lineCoverage, 0);
  const averageLineCoverage = coreEntries.length > 0 ? totalLineCoverage / coreEntries.length : 0;

  return {
    entries,
    totalLines: coreEntries.length, // Core files only
    coveredLines: Math.round((averageLineCoverage / 100) * coreEntries.length),
    averageLineCoverage: Math.round(averageLineCoverage * 100) / 100,
    meetsThreshold: averageLineCoverage >= THRESHOLD,
  };
}

/**
 * Run coverage check.
 */
async function main(): Promise<void> {
  const verbose = process.argv.includes('--verbose');

  console.log('EP09 Temporal Analysis - Coverage Verification');
  console.log('='.repeat(50));
  console.log(`Threshold: ${THRESHOLD}%`);
  console.log();

  // Run bun test with coverage
  // Note: bun outputs coverage to stdout, test results to stderr
  console.log('Running tests with coverage...');
  const proc = Bun.spawn(['bun', 'test', '--coverage'], {
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: process.cwd(),
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    console.error('Tests failed!');
    console.error(stderr);
    process.exit(1);
  }

  // Combine stdout and stderr - bun puts coverage in stdout but test output in stderr
  const combinedOutput = stdout + '\n' + stderr;

  // Parse coverage for temporal module
  const entries = parseCoverageOutput(combinedOutput);
  const result = calculateStats(entries);

  // Separate core files from tool handlers for display
  const coreCount = result.entries.filter((e) => !isToolHandler(e.file)).length;
  const toolCount = result.entries.length - coreCount;

  // Display results
  console.log(`\nTemporal Module Coverage Summary:`);
  console.log('-'.repeat(50));
  console.log(`Total files: ${result.entries.length} (${coreCount} core + ${toolCount} tool handlers)`);
  console.log(`Core module coverage: ${result.averageLineCoverage}%`);
  console.log(`Threshold: ${THRESHOLD}%`);
  console.log();

  // Separate core files from tool handlers
  const coreFiles = result.entries.filter((e) => !isToolHandler(e.file));
  const toolHandlers = result.entries.filter((e) => isToolHandler(e.file));

  if (verbose) {
    console.log('Core Module Coverage (counts toward threshold):');
    console.log('-'.repeat(70));
    for (const entry of coreFiles.sort(
      (a, b) => a.lineCoverage - b.lineCoverage
    )) {
      const status = entry.lineCoverage >= THRESHOLD ? '✓' : '✗';
      console.log(
        `${status} ${entry.file.padEnd(45)} ${entry.lineCoverage.toFixed(2)}%`
      );
    }
    console.log();

    if (toolHandlers.length > 0) {
      console.log('Tool Handlers (covered by VCR/evals per ADR-0011, excluded from threshold):');
      console.log('-'.repeat(70));
      for (const entry of toolHandlers.sort(
        (a, b) => a.lineCoverage - b.lineCoverage
      )) {
        console.log(
          `  ${entry.file.padEnd(45)} ${entry.lineCoverage.toFixed(2)}%`
        );
      }
      console.log();
    }
  }

  // Low coverage core files (for CI feedback) - exclude tool handlers
  const lowCoverage = coreFiles.filter((e) => e.lineCoverage < THRESHOLD);
  if (lowCoverage.length > 0) {
    console.log(`Core files below ${THRESHOLD}% threshold:`);
    for (const entry of lowCoverage) {
      console.log(`  - ${entry.file}: ${entry.lineCoverage}%`);
    }
    console.log();
  }

  // Final verdict
  if (result.meetsThreshold) {
    console.log(`✓ Coverage meets ${THRESHOLD}% threshold`);
    if (toolHandlers.length > 0 && !verbose) {
      console.log(`  (${toolHandlers.length} tool handlers excluded - covered by VCR/evals per ADR-0011)`);
    }
    process.exit(0);
  } else {
    console.log(`✗ Coverage ${result.averageLineCoverage}% is below ${THRESHOLD}% threshold`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
