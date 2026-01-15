#!/usr/bin/env bun
/**
 * agentlint CLI entry point
 *
 * A local-first tool for continuous improvement of AI-assisted development workflows.
 */

import { getVersion, formatVersion } from './version';
import { ExitCode, formatError, getExitCode } from './errors';
import { runUpdate } from './commands/update';

const HELP_TEXT = `
agentlint - Local-first AI development workflow improvement

Usage:
  agentlint [command] [options]

Commands:
  update        Update agentlint to the latest version

Options:
  -h, --help    Show this help message
  -v, --version Show version information

Examples:
  agentlint --version    Show version info
  agentlint update       Update to latest version

For more information, visit: https://github.com/Obsidian-Owl/agentlint
`.trim();

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle flags
  if (args.includes('-h') || args.includes('--help')) {
    console.log(HELP_TEXT);
    process.exit(ExitCode.Success);
  }

  if (args.includes('-v') || args.includes('--version')) {
    const versionInfo = getVersion();
    console.log(formatVersion(versionInfo));
    process.exit(ExitCode.Success);
  }

  // Handle commands
  const command = args[0];

  if (command === undefined || command === '') {
    console.log(HELP_TEXT);
    process.exit(ExitCode.Success);
  }

  // Route to command handlers
  if (command === 'update') {
    const exitCode = await runUpdate(args.slice(1));
    process.exit(exitCode);
  }

  // Unknown command
  console.error(`Unknown command: ${command}`);
  console.error('Run "agentlint --help" for usage information.');
  process.exit(ExitCode.InvalidArgument);
}

// Run with error handling
main().catch((error) => {
  console.error(formatError(error));
  process.exit(getExitCode(error));
});
