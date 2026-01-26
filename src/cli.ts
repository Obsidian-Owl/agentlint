#!/usr/bin/env bun
/**
 * agentlint CLI entry point
 *
 * A local-first tool for continuous improvement of AI-assisted development workflows.
 * Uses Commander.js for argument parsing (EP04).
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load .env file from current working directory if it exists
// This allows ANTHROPIC_API_KEY and other env vars to be loaded
// Note: Simple parser - doesn't handle escaped quotes in values (e.g., "value with \" inside")
// This is sufficient for API keys and typical env vars
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Only set if not already defined (env vars take precedence)
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

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
