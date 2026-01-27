/**
 * EP04 CLI Interface - Commander.js Program Setup
 *
 * Implements FR-001: Central program definition using Commander.js.
 * Implements FR-002: Help text for all commands.
 * Defines all commands and global options for the agentlint CLI.
 *
 * @module cli/program
 */

import { Command, Help } from 'commander';
import { getVersion } from '../version';
import { getTerminalWidth } from './utils/terminal';
import type { GlobalOptions } from './types';
import { createLoggerFromCLIOptions, setDefaultLogger } from '../debug/logger';
import type { IDebugLogger } from '../debug/types';
import { registerAllPrompts } from '../prompts';

/**
 * Package description for CLI.
 */
const DESCRIPTION =
  'Local-first CLI tool for continuous improvement of AI-assisted development workflows';

/**
 * Custom Help class that respects terminal width (NFR-002).
 */
class TerminalAwareHelp extends Help {
  override helpWidth: number;

  constructor() {
    super();
    // Use terminal width with a max of 120 chars (NFR-002)
    this.helpWidth = Math.min(getTerminalWidth(), 120);
  }
}

/**
 * Creates and configures the Commander.js program.
 *
 * @returns Configured Commander program instance
 */
export function createProgram(): Command {
  registerAllPrompts();

  const program = new Command();
  const version = getVersion();

  // Program metadata
  program
    .name('agentlint')
    .description(DESCRIPTION)
    .version(version.version, '-v, --version', 'Show version information')
    .usage('[options] [command]');

  // Add examples to main help
  program.addHelpText(
    'after',
    `
Examples:
  $ agentlint scan                     Discover AI config files in current directory
  $ agentlint analyse                  Run full analysis on configs and sessions
  $ agentlint analyse --json           Output analysis results as JSON
  $ agentlint trace FND-001            Trace finding to its root cause
  $ agentlint baseline -l "v1.0"       Capture current state as baseline

Documentation:
  https://github.com/Obsidian-Owl/agentlint`
  );

  // Global options (available on all commands)
  program
    .option('--json', 'Output results as JSON')
    .option('--markdown', 'Output results as Markdown')
    .option('--plain', 'Plain text output without colors')
    .option('--verbose', 'Show detailed output including tool calls')
    .option('--fail-on-findings', 'Exit with code 1 if findings are present')
    .option(
      '--debug-level <level>',
      'Debug verbosity: minimal (errors/tools), normal (skip small chunks), verbose (everything)',
      'normal'
    )
    .option('--quiet', 'Suppress non-error output')
    .option('--log-file <path>', 'Override default log file location (~/.agentlint/logs/)')
    .option('--no-log', 'Disable file logging for this run')
    .option('--no-session', 'Disable session recording for this run')
    .option('--no-secrets', 'Disable automatic secret detection scanning')
    .option('--non-interactive', 'Run without interactive TUI (auto-approve permissions)');

  // Configure help behavior with terminal-aware formatter
  program.configureHelp({
    sortSubcommands: true,
    sortOptions: false,
    helpWidth: Math.min(getTerminalWidth(), 120),
  });

  // Use custom help class
  program.createHelp = (): Help => new TerminalAwareHelp();

  // Add commands (stubs for now, will be implemented in later phases)
  addScanCommand(program);
  addAnalyseCommand(program);
  addBaselineCommand(program);
  addCompareCommand(program);
  addTraceCommand(program);
  addLearnCommand(program);
  addRecommendCommand(program);
  addValidateCommand(program);

  // Keep existing update command
  addUpdateCommand(program);

  // Add session management command (EP11)
  addSessionCommand(program);

  // Add backup, restore, and clean commands
  addBackupCommand(program);
  addRestoreCommand(program);
  addCleanCommand(program);

  // Add skills command (EP14)
  addSkillsCommand(program);

  return program;
}

/**
 * Extracts global options from parsed command options.
 *
 * @param options - Parsed command options
 * @returns Extracted global options
 */
export function extractGlobalOptions(options: Record<string, unknown>): GlobalOptions {
  const result: GlobalOptions = {};

  if (typeof options['json'] === 'boolean') {
    result.json = options['json'];
  }
  if (typeof options['markdown'] === 'boolean') {
    result.markdown = options['markdown'];
  }
  if (typeof options['plain'] === 'boolean') {
    result.plain = options['plain'];
  }
  if (typeof options['verbose'] === 'boolean') {
    result.verbose = options['verbose'];
  }
  if (typeof options['failOnFindings'] === 'boolean') {
    result.failOnFindings = options['failOnFindings'];
  }
  if (typeof options['debugLevel'] === 'string') {
    const level = options['debugLevel'];
    if (level === 'minimal' || level === 'normal' || level === 'verbose') {
      result.debugLevel = level;
    }
  }
  if (typeof options['quiet'] === 'boolean') {
    result.quiet = options['quiet'];
  }
  if (typeof options['logFile'] === 'string') {
    result.logFile = options['logFile'];
  }
  // Commander.js converts --no-log to options.log = false
  if (options['log'] === false) {
    result.noLog = true;
  }
  // Commander.js converts --no-session to options.session = false
  if (options['session'] === false) {
    result.noSession = true;
  }
  if (typeof options['nonInteractive'] === 'boolean') {
    result.nonInteractive = options['nonInteractive'];
  }

  return result;
}

/**
 * Initializes the debug logger from global CLI options.
 *
 * This function should be called at the start of command handlers to
 * configure the debug logger based on --verbose, --quiet, --log-file, and --no-log flags.
 *
 * By default, logging is enabled at info level to ~/.agentlint/logs/.
 * Use --no-log to disable file logging.
 *
 * @param options - Global options from CLI
 * @returns Configured debug logger
 *
 * @example
 * ```typescript
 * const logger = initializeDebugLogger(globalOpts);
 * logger.info('agentlint:tools', 'Starting analysis');
 * ```
 */
export function initializeDebugLogger(options: GlobalOptions): IDebugLogger {
  // Build options object, only including defined values
  const loggerOptions: {
    verbose?: boolean;
    quiet?: boolean;
    logFile?: string;
    noLog?: boolean;
  } = {};

  if (options.verbose !== undefined) {
    loggerOptions.verbose = options.verbose;
  }
  if (options.quiet !== undefined) {
    loggerOptions.quiet = options.quiet;
  }
  if (options.logFile !== undefined) {
    loggerOptions.logFile = options.logFile;
  }
  if (options.noLog !== undefined) {
    loggerOptions.noLog = options.noLog;
  }

  const logger = createLoggerFromCLIOptions(loggerOptions);

  // Set as default logger so all modules can access it
  setDefaultLogger(logger);

  return logger;
}

// =============================================================================
// Command Definitions (Stubs)
// =============================================================================

function addScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Discover AI configuration files in the project')
    .option('-d, --directory <path>', 'Directory to scan', '.')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint scan                   Scan current directory
  $ agentlint scan -d ./projects     Scan specific directory
  $ agentlint scan --json            Output results as JSON

Supported config files:
  - CLAUDE.md           Claude Code project instructions
  - .cursorrules        Cursor AI rules
  - .github/copilot-*   GitHub Copilot configuration
  - .continue/*         Continue.dev configuration`
    )
    .action(async (options: { directory?: string }) => {
      const { runScan } = await import('./commands/scan');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await runScan({ ...globalOpts, ...options });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

function addAnalyseCommand(program: Command): void {
  program
    .command('analyse')
    .alias('analyze') // Support both spellings
    .description('Run analysis on AI configurations and sessions')
    .option('-d, --directory <path>', 'Directory to analyse', '.')
    .option('--config-only', 'Only analyze configuration files')
    .option('--sessions-only', 'Only analyze session logs')
    .option('--dry-run', 'Scan only, do not run full analysis')
    .option('--static', 'Run static analysis without LLM (fast mode)')
    .option('--non-interactive', 'Skip confirmations (for CI/automated use)')
    .option('--clean-slate', 'Clear existing recommendations before analysis')
    .option('--session <id>', 'Analyze a specific Claude Code session by ID or path')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint analyse                   Run full agent-based analysis (interactive)
  $ agentlint analyse --non-interactive Run without confirmations (for CI)
  $ agentlint analyse --static          Fast static analysis (no LLM)
  $ agentlint analyse --config-only     Analyze only config files
  $ agentlint analyse --session <id>    Analyze a specific session
  $ agentlint analyse --json            Output as JSON for CI
  $ agentlint analyse --verbose         Show agent reasoning and tool calls
  $ agentlint analyse --dry-run         Scan configs without full analysis

The analyse command runs the agentlint analysis pipeline:
  1. Discovers AI configuration files
  2. Parses and validates configurations
  3. Analyzes session logs (if available)
  4. Identifies issues and traces to root causes
  5. Generates recommendations (deduplicating with existing ones)

By default, runs in interactive mode where the agent confirms actions.
Use --non-interactive for CI pipelines or automated analysis.
Use --static for fast analysis without LLM.`
    )
    .action(
      async (options: {
        directory?: string;
        configOnly?: boolean;
        sessionsOnly?: boolean;
        dryRun?: boolean;
        static?: boolean;
        nonInteractive?: boolean;
        cleanSlate?: boolean;
        session?: string;
      }) => {
        const { runAnalyse } = await import('./commands/analyse');
        const globalOpts = extractGlobalOptions(program.opts());
        const exitCode = await runAnalyse({ ...globalOpts, ...options });
        if (exitCode !== 0) {
          process.exit(exitCode);
        }
      }
    );
}

function addBaselineCommand(program: Command): void {
  program
    .command('baseline')
    .description('Capture current analysis state as a baseline')
    .option('-l, --label <label>', 'Label for the baseline')
    .option('-n, --notes <notes>', 'Notes about the baseline')
    .option('-d, --directory <path>', 'Directory to capture baseline for', '.')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint baseline                    Capture baseline with auto-generated ID
  $ agentlint baseline -l "pre-refactor"  Capture with descriptive label
  $ agentlint baseline -n "Before Q1"     Add notes to baseline

Baselines are stored in .agentlint/baselines/ and can be used
with 'agentlint compare' to track improvement over time.`
    )
    .action(async (options: { label?: string; notes?: string; directory?: string }) => {
      const { runBaseline } = await import('./commands/baseline');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await runBaseline({ ...globalOpts, ...options });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

function addCompareCommand(program: Command): void {
  program
    .command('compare')
    .description('Compare current state against a baseline')
    .option('-b, --baseline <id>', 'Baseline ID or label to compare against')
    .option('-d, --directory <path>', 'Directory to compare', '.')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint compare                     Compare to latest baseline
  $ agentlint compare -b "pre-refactor"   Compare to labeled baseline
  $ agentlint compare --json              Output comparison as JSON

The comparison shows:
  - New findings (not in baseline)
  - Resolved findings (in baseline, not current)
  - Delta metrics (improved/worsened)`
    )
    .action(async (options: { baseline?: string; directory?: string }) => {
      const { runCompare } = await import('./commands/compare');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await runCompare({ ...globalOpts, ...options });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

function addTraceCommand(program: Command): void {
  program
    .command('trace <finding-id>')
    .description('Trace a finding to its origin and show causal chain')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint trace FND-001              Show causal chain for finding
  $ agentlint trace FND-001 --json       Output as JSON

The trace shows the causal chain from issue to root cause:
  Issue → Origin → Root Cause → Recommendation`
    )
    .action(async (findingId: string) => {
      const { runTrace } = await import('./commands/trace');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await runTrace({ ...globalOpts, findingId });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

function addLearnCommand(program: Command): void {
  const learn = program
    .command('learn')
    .description('Manage learnings from analysis')
    .addHelpText(
      'after',
      `
Subcommands:
  list     List stored learnings
  add      Add a new learning
  promote  Promote project learning to global scope`
    );

  learn
    .command('list')
    .description('List stored learnings')
    .option(
      '-c, --category <category>',
      'Filter by category (patterns, anti-patterns, tools, workflows)'
    )
    .option('-s, --scope <scope>', 'Filter by scope (project, global)')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint learn list                        List all learnings
  $ agentlint learn list -c patterns            Filter by category
  $ agentlint learn list -s global              Show only global learnings`
    )
    .action((_options) => {
      console.log('learn list not yet implemented (Phase 10)');
    });

  learn
    .command('add')
    .description('Add a new learning')
    .requiredOption('-t, --title <title>', 'Learning title')
    .requiredOption('--content <content>', 'Learning content (Markdown)')
    .requiredOption(
      '-c, --category <category>',
      'Category (patterns, anti-patterns, tools, workflows)'
    )
    .option('-s, --scope <scope>', 'Scope (project, global)', 'project')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint learn add -t "Use TypeScript" -c patterns --content "Always..."
  $ agentlint learn add -t "Avoid globals" -c anti-patterns -s global --content "..."`
    )
    .action((_options) => {
      console.log('learn add not yet implemented (Phase 10)');
    });

  learn
    .command('promote <learning-id>')
    .description('Promote a project learning to global scope')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint learn promote LRN-001  Promote learning to global scope`
    )
    .action((_learningId) => {
      console.log('learn promote not yet implemented (Phase 10)');
    });
}

function addRecommendCommand(program: Command): void {
  program
    .command('recommend')
    .description('Show recommendations for improving AI workflows')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint recommend              Show all recommendations
  $ agentlint recommend --json       Output as JSON

Recommendations are generated based on analysis findings and
stored learnings.`
    )
    .action(() => {
      console.log('recommend command not yet implemented (EP05+)');
    });
}

function addValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate AI configuration files for ACT format requirements')
    .option('-d, --directory <path>', 'Directory to validate', '.')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint validate                     Validate all config files
  $ agentlint validate -d ./my-project     Validate specific directory
  $ agentlint validate --json              Output validation results as JSON
  $ agentlint validate --fail-on-findings  Exit 1 if issues found (CI mode)

Validates ACT format requirements for AI configuration files:
  - Agent files (.claude/agents/*.md) - requires YAML frontmatter
  - Skill files (.claude/skills/*/SKILL.md) - requires name and description

Fast static check that runs without LLM, suitable for CI/pre-commit hooks.`
    )
    .action(async (options: { directory?: string }) => {
      const { runValidate } = await import('./commands/validate');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await runValidate({ ...globalOpts, ...options });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

function addUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update agentlint to the latest version')
    .option('-c, --check', 'Check for updates without installing')
    .option('--channel <channel>', 'Release channel (stable, beta, nightly)', 'stable')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint update                 Update to latest stable
  $ agentlint update --check         Check for updates only
  $ agentlint update --channel beta  Update to latest beta`
    )
    .action(async (options: { check?: boolean; channel?: string }) => {
      // Import dynamically to avoid loading update logic when not needed
      const { runUpdate } = await import('../commands/update');
      const args: string[] = [];
      if (options.check) args.push('--check');
      if (options.channel) args.push('--channel', options.channel);
      const exitCode = await runUpdate(args);
      process.exit(exitCode);
    });
}

// =============================================================================
// EP11: Session Management Commands (T055)
// =============================================================================

function addSessionCommand(program: Command): void {
  const session = program
    .command('session')
    .description('Manage analysis session recordings')
    .addHelpText(
      'after',
      `
Subcommands:
  list      List recorded analysis sessions
  replay    Replay a session for debugging
  delete    Delete a recorded session
  cleanup   Remove old sessions based on retention policy

Session recordings enable crash recovery and debugging.`
    );

  // session list
  session
    .command('list')
    .description('List recorded analysis sessions')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint session list           List all recorded sessions
  $ agentlint session list --json    Output as JSON`
    )
    .action(async () => {
      const { runSessionList } = await import('./commands/session');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await runSessionList(globalOpts);
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });

  // session replay
  session
    .command('replay <session-id>')
    .description('Replay a recorded session')
    .option('-s, --sequence <number>', 'Replay from specific checkpoint sequence', undefined)
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint session replay abc123              Replay from last checkpoint
  $ agentlint session replay abc123 -s 5         Replay from checkpoint 5
  $ agentlint session replay abc123 --json       Output replay context as JSON`
    )
    .action(async (sessionId: string, options: { sequence?: string }) => {
      const { runSessionReplay } = await import('./commands/session');
      const globalOpts = extractGlobalOptions(program.opts());
      const replayOpts = { ...globalOpts, sessionId } as Parameters<typeof runSessionReplay>[0];
      if (options.sequence) {
        replayOpts.sequence = parseInt(options.sequence, 10);
      }
      const exitCode = await runSessionReplay(replayOpts);
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });

  // session delete
  session
    .command('delete <session-id>')
    .description('Delete a recorded session')
    .option('-f, --force', 'Skip confirmation')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint session delete abc123        Delete session (with confirmation)
  $ agentlint session delete abc123 -f     Delete without confirmation`
    )
    .action(async (sessionId: string, options: { force?: boolean }) => {
      const { runSessionDelete } = await import('./commands/session');
      const globalOpts = extractGlobalOptions(program.opts());
      const deleteOpts = { ...globalOpts, sessionId } as Parameters<typeof runSessionDelete>[0];
      if (options.force !== undefined) {
        deleteOpts.force = options.force;
      }
      const exitCode = await runSessionDelete(deleteOpts);
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });

  // session cleanup
  session
    .command('cleanup')
    .description('Remove old sessions based on retention policy')
    .option('-d, --days <number>', 'Retention days (default: 7)', '7')
    .option('--dry-run', 'Show what would be deleted without deleting')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint session cleanup              Clean up sessions older than 7 days
  $ agentlint session cleanup -d 30        Keep sessions from last 30 days
  $ agentlint session cleanup --dry-run    Preview what would be deleted`
    )
    .action(async (options: { days?: string; dryRun?: boolean }) => {
      const { runSessionCleanup } = await import('./commands/session');
      const globalOpts = extractGlobalOptions(program.opts());
      const days = options.days ? parseInt(options.days, 10) : 7;
      const cleanupOpts = { ...globalOpts, days } as Parameters<typeof runSessionCleanup>[0];
      if (options.dryRun !== undefined) {
        cleanupOpts.dryRun = options.dryRun;
      }
      const exitCode = await runSessionCleanup(cleanupOpts);
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

// =============================================================================
// Backup and Restore Commands
// =============================================================================

function addBackupCommand(program: Command): void {
  program
    .command('backup')
    .description('Create a backup of .agentlint state')
    .option('-d, --directory <path>', 'Project directory', '.')
    .option('-o, --output <path>', 'Output file path')
    .option('--include-global', 'Include ~/.agentlint data')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint backup                         Create backup with auto-generated name
  $ agentlint backup -o my-backup.tar.gz     Create backup with custom name
  $ agentlint backup --json                  Output backup info as JSON

Backups include:
  - baselines/       Baseline snapshots
  - recommendations/ Recommendation cases
  - learnings/       Stored learnings
  - sessions/        Session recordings
  - *.db             Database files`
    )
    .action(async (options: { directory?: string; output?: string; includeGlobal?: boolean }) => {
      const { runBackup } = await import('./commands/backup');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await runBackup({ ...globalOpts, ...options });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

function addRestoreCommand(program: Command): void {
  program
    .command('restore <backup-file>')
    .description('Restore .agentlint state from a backup')
    .option('-d, --directory <path>', 'Target project directory', '.')
    .option('--force', 'Overwrite existing data without confirmation')
    .option('--dry-run', 'Show what would be restored without doing it')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint restore backup.tar.gz           Restore from backup
  $ agentlint restore backup.tar.gz --force   Overwrite existing data
  $ agentlint restore backup.tar.gz --dry-run Preview what would be restored
  $ agentlint restore backup.tar.gz --json    Output restore info as JSON`
    )
    .action(
      async (
        backupFile: string,
        options: { directory?: string; force?: boolean; dryRun?: boolean }
      ) => {
        const { runRestore } = await import('./commands/backup');
        const globalOpts = extractGlobalOptions(program.opts());
        const exitCode = await runRestore(backupFile, { ...globalOpts, ...options });
        if (exitCode !== 0) {
          process.exit(exitCode);
        }
      }
    );
}

function addCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Remove .agentlint state directory (preview by default)')
    .option('-d, --directory <path>', 'Project directory', '.')
    .option('-f, --force', 'Actually perform the clean (default is preview only)')
    .option('--no-backup', 'Skip creating backup before cleaning')
    .option('--global', 'Also clean global ~/.agentlint directory')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint clean                     Preview what would be removed
  $ agentlint clean --force             Actually clean (with backup)
  $ agentlint clean --force --no-backup Clean without backup
  $ agentlint clean --global --force    Also clean ~/.agentlint
  $ agentlint clean --json              Output as JSON

By default, shows a preview of what would be removed.
Use --force to actually remove the .agentlint directory.
A backup is created automatically before cleaning unless --no-backup is used.`
    )
    .action(
      async (options: {
        directory?: string;
        force?: boolean;
        backup?: boolean;
        global?: boolean;
      }) => {
        const { runClean } = await import('./commands/clean');
        const globalOpts = extractGlobalOptions(program.opts());
        const cleanOpts: Parameters<typeof runClean>[0] = {
          ...globalOpts,
          noBackup: options.backup === false,
        };
        if (options.directory !== undefined) {
          cleanOpts.directory = options.directory;
        }
        if (options.force !== undefined) {
          cleanOpts.force = options.force;
        }
        if (options.global !== undefined) {
          cleanOpts.global = options.global;
        }
        const exitCode = await runClean(cleanOpts);
        if (exitCode !== 0) {
          process.exit(exitCode);
        }
      }
    );
}

// =============================================================================
// EP14: Skills Command
// =============================================================================

function addSkillsCommand(program: Command): void {
  program
    .command('skills')
    .description('Show skills inventory and usage statistics')
    .option('-d, --directory <path>', 'Directory to analyze', '.')
    .option('--detail <skill-name>', 'Show detailed information for a specific skill')
    .option('--stats', 'Include invocation statistics')
    .addHelpText(
      'after',
      `
Examples:
  $ agentlint skills                    List all defined skills
  $ agentlint skills --stats            Include usage statistics
  $ agentlint skills --detail commit    Show details for 'commit' skill
  $ agentlint skills --json             Output as JSON

Skills are defined in .claude/skills/ and can be invoked using
the /skill-name syntax in Claude Code.

For full analysis including skills effectiveness, use:
  $ agentlint analyse`
    )
    .action(async (options: { directory?: string; detail?: string; stats?: boolean }) => {
      const { skillsCommand } = await import('./commands/skills');
      const globalOpts = extractGlobalOptions(program.opts());
      const exitCode = await skillsCommand({ ...globalOpts, ...options });
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });
}

/**
 * Runs the CLI program.
 *
 * @param argv - Command line arguments (default: process.argv)
 * @returns Promise that resolves when program completes
 */
export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
