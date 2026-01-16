#!/usr/bin/env bun
/**
 * agentlint CLI entry point
 *
 * A local-first tool for continuous improvement of AI-assisted development workflows.
 * Uses Commander.js for argument parsing (EP04).
 */

import { run } from './cli/program';
import { formatError, getExitCode } from './errors';

// Run the CLI with error handling
run().catch((error) => {
  console.error(formatError(error));
  process.exit(getExitCode(error));
});
