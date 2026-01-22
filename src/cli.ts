#!/usr/bin/env bun
/**
 * agentlint CLI entry point
 *
 * A local-first tool for continuous improvement of AI-assisted development workflows.
 * Uses Commander.js for argument parsing (EP04).
 */

// AGE-685: Disable SDK telemetry to prevent "Safe-chain" errors from being displayed
// This must be set before any SDK imports
process.env.DISABLE_TELEMETRY = '1';

import { run } from './cli/program';
import { formatError, getExitCode } from './errors';
import { redact } from './debug/redaction';

// Run the CLI with error handling
run().catch((error) => {
  // Redact any secrets from error messages before printing
  console.error(redact(formatError(error)));
  process.exit(getExitCode(error));
});
