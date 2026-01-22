/**
 * EP04 CLI Interface - Analyse Command
 *
 * Implements US-001: Run analysis with streaming output.
 * Implements FR-001: Primary command is `agentlint analyse`.
 * Implements FR-015: Support --config-only and --sessions-only flags.
 *
 * The analyse command is the primary entry point for agentlint analysis.
 * It supports three modes:
 * - Orchestrated (default): Uses Claude agent for intelligent analysis
 * - Static (--static): Fast analysis without LLM
 * - Dry-run (--dry-run): Scan only
 *
 * @module cli/commands/analyse
 */

import { resolve, relative } from 'node:path';
import { stat } from 'node:fs/promises';
import { getOutputMode } from '../utils/output';
import type { GlobalOptions, OutputMode } from '../types';
import { scanForConfigs, type ScanResult, type ConfigFile as ScanConfigFile } from './scan';
import { discoverConfigs, type DiscoverConfigsResult } from '../../tools/config';
import { parseConfigSync } from '../../tools/config/parse-config';
import { assessQuality } from '../../tools/config/quality';
import { GapAnalyzer } from '../../tools/causal/gap-analyzer';
import type { QualityIssue } from '../../tools/config/types';

// Orchestration imports
import {
  createToolRegistry,
  createOrchestrator,
  shouldDisplay,
  runWithExecutionContext,
} from '../../orchestration';
import type { VerbosityLevel, StreamChunk } from '../../orchestration/types';
import { registerAllTools } from '../../tools';
import { createLoggerFromCLIOptions, setDefaultLogger } from '../../debug/logger';
import { createRenderer } from '../renderers';
import { buildAnalysisPrompt } from './analyse-prompt';

// Recommendation storage imports for findings bridge
import {
  listRecommendationIds,
  loadRecommendation,
  getRecommendationsDir,
} from '../../recommendations/storage';
import type { Recommendation } from '../../recommendations/types';

// Database initialization import (Issue 4 fix)
import { initializeDatabases } from '../../persistence';

// Session indexing imports (Issue 2 fix: auto-index sessions before analysis)
import { discoverSessions } from '../../tools/sessions/discovery';
import { indexSessions } from '../../tools/sessions/indexer';

/**
 * Options for the analyse command.
 */
export interface AnalyseOptions extends GlobalOptions {
  /** Directory to analyse (default: current directory) */
  directory?: string;
  /** Only analyse configuration files */
  configOnly?: boolean;
  /** Only analyse session logs */
  sessionsOnly?: boolean;
  /** Dry run mode - scan only, don't run full analysis */
  dryRun?: boolean;
  /** Static analysis mode - no LLM, fast pattern matching only */
  static?: boolean;
  /** Non-interactive mode - skip confirmations (for CI) */
  nonInteractive?: boolean;
}

/**
 * Analysis result structure for JSON output.
 */
export interface AnalyseResult {
  /** Status of the analysis */
  status: 'success' | 'error' | 'dry-run';
  /** Error message if status is 'error' */
  error?: string;
  /** Directory that was analysed */
  directory: string;
  /** Discovered configuration files */
  configs: ScanResult['configs'];
  /** Analysis findings (empty for dry-run) */
  findings: AnalyseFinding[];
  /** Summary of findings */
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Duration in milliseconds (if analysis was run) */
  durationMs?: number;
}

/**
 * Simplified finding for JSON output.
 * Extended to include origin and recommendations for causal tracing.
 */
export interface AnalyseFinding {
  id: string;
  severity: string;
  type: string;
  title: string;
  description: string;
  location?: {
    file: string;
    line?: number;
  };
  /** Traced origin (where the issue originated) */
  origin?: {
    type: 'config' | 'session' | 'git';
    reference: string;
    description: string;
  };
  /** Recommendations for addressing the finding */
  recommendations?: Array<{
    type: 'symptomatic' | 'preventive' | 'systemic';
    action: string;
    rationale: string;
    priority?: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Perform static analysis on discovered configs.
 * Uses quality assessment and gap analysis to produce findings.
 */
function performStaticAnalysis(
  directory: string,
  configs: ScanResult['configs']
): AnalyseFinding[] {
  const findings: AnalyseFinding[] = [];
  const gapAnalyzer = new GapAnalyzer();
  let findingId = 1;

  for (const config of configs) {
    try {
      // Parse the config
      const parsed = parseConfigSync(config.path);

      // Run quality assessment
      const quality = assessQuality(parsed);

      // Convert quality issues to findings
      for (const issue of quality.issues) {
        findings.push(convertQualityIssueToFinding(issue, config.path, findingId++));
      }

      // Check for missing sections (completeness)
      if (quality.completeness.missingSections.length > 0) {
        const missingCount = quality.completeness.missingSections.length;
        const missingList = quality.completeness.missingSections.slice(0, 3).join(', ');
        findings.push({
          id: `FND-${String(findingId++).padStart(4, '0')}`,
          severity: 'medium',
          type: 'config_gap',
          title: 'Missing recommended sections',
          description: `Configuration is missing ${missingCount} recommended sections: ${missingList}${missingCount > 3 ? '...' : ''}. Consider adding sections for development workflow, testing, and architecture.`,
          location: {
            file: relative(directory, config.path),
          },
          origin: {
            type: 'config',
            reference: relative(directory, config.path),
            description: 'Incomplete configuration structure',
          },
          recommendations: [
            {
              type: 'preventive',
              action: `Add missing sections to ${relative(directory, config.path)}: ${missingList}`,
              rationale:
                'Complete documentation prevents repeated questions and ensures consistent behavior',
              priority: 'medium',
            },
          ],
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  // Run gap analysis on the directory
  const gapResult = gapAnalyzer.analyzeGaps({ projectPath: directory });

  // Convert gaps to findings
  for (const gap of gapResult.allGaps) {
    // Avoid duplicates with completeness findings
    if (gap.type === 'missing_guidance' && findings.some((f) => f.type === 'config_gap')) {
      continue;
    }

    findings.push({
      id: `FND-${String(findingId++).padStart(4, '0')}`,
      severity: gap.type === 'missing_config' ? 'high' : 'medium',
      type: 'config_gap',
      title: formatGapTitle(gap.type),
      description: gap.expectedGuidance,
      origin: {
        type: 'config',
        reference: formatGapLocation(gap.location),
        description: gap.counterfactual,
      },
      recommendations: [
        {
          type: 'preventive',
          action: `Add ${gap.expectedGuidance.toLowerCase()} to configuration`,
          rationale: gap.counterfactual,
          priority: gap.type === 'missing_config' ? 'high' : 'medium',
        },
      ],
    });
  }

  return findings;
}

/**
 * Convert a quality issue to an AnalyseFinding.
 */
function convertQualityIssueToFinding(
  issue: QualityIssue,
  filePath: string,
  id: number
): AnalyseFinding {
  const severityMap: Record<string, string> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  const typeMap: Record<string, string> = {
    'embedded-secret': 'secret_exposure',
    'generic-rule': 'config_antipattern',
    'linter-job': 'config_antipattern',
    'instruction-overload': 'config_antipattern',
    'code-snippet': 'config_antipattern',
  };

  const recTypeMap: Record<string, 'symptomatic' | 'preventive' | 'systemic'> = {
    'embedded-secret': 'systemic',
    'generic-rule': 'preventive',
    'linter-job': 'preventive',
    'instruction-overload': 'preventive',
    'code-snippet': 'symptomatic',
  };

  const finding: AnalyseFinding = {
    id: `FND-${String(id).padStart(4, '0')}`,
    severity: severityMap[issue.severity] ?? 'medium',
    type: typeMap[issue.type] ?? 'config_antipattern',
    title: formatIssueTitle(issue.type),
    description: issue.message,
    location: {
      file: filePath,
    },
    origin: {
      type: 'config',
      reference: `${filePath}:${issue.position?.start.line ?? 1}`,
      description: `Issue detected in configuration file`,
    },
  };

  // Add line number if available
  if (issue.position?.start.line !== undefined) {
    finding.location = { file: filePath, line: issue.position.start.line };
  }

  // Add recommendations if suggestion is available
  if (issue.suggestion) {
    finding.recommendations = [
      {
        type: recTypeMap[issue.type] ?? 'symptomatic',
        action: issue.suggestion,
        rationale: 'Improves configuration quality and reduces token waste',
        priority: issue.severity === 'critical' ? 'high' : 'medium',
      },
    ];
  }

  return finding;
}

/**
 * Format issue type as human-readable title.
 */
function formatIssueTitle(type: string): string {
  const titles: Record<string, string> = {
    'embedded-secret': 'Embedded secret detected',
    'generic-rule': 'Generic rule wastes tokens',
    'linter-job': 'Linter/formatter rule in config',
    'instruction-overload': 'Configuration overload',
    'code-snippet': 'Large code snippet',
  };
  return titles[type] ?? 'Configuration issue';
}

/**
 * Format gap type as human-readable title.
 */
function formatGapTitle(type: string): string {
  const titles: Record<string, string> = {
    missing_config: 'Missing configuration file',
    missing_guidance: 'Missing guidance section',
    missing_example: 'Missing code examples',
    terminology_gap: 'Undefined terminology',
    context_loss: 'Context loss risk',
  };
  return titles[type] ?? 'Configuration gap';
}

/**
 * Format gap location as human-readable string.
 */
function formatGapLocation(location: string): string {
  const locations: Record<string, string> = {
    claude_md: 'CLAUDE.md',
    global_config: '~/.claude/settings.json',
    project_config: '.claude/settings.json',
    mcp_config: '.mcp.json',
    skill: '.claude/skills/',
  };
  return locations[location] ?? location;
}

// =============================================================================
// Orchestrated Analysis (Default Mode)
// =============================================================================

/**
 * Determine the verbosity level from CLI options.
 */
function getVerbosityLevel(options: AnalyseOptions): VerbosityLevel {
  if (options.debug) return 'debug';
  if (options.verbose) return 'verbose';
  if (options.quiet) return 'quiet';
  return 'normal';
}

/**
 * Convert a StreamChunk finding to an AnalyseFinding.
 */
function convertChunkToFinding(chunk: StreamChunk): AnalyseFinding | null {
  if (chunk.type !== 'finding' || !chunk.metadata?.finding) {
    return null;
  }

  const finding = chunk.metadata.finding as Record<string, unknown>;
  const result: AnalyseFinding = {
    id: (finding.id as string) ?? `FND-${Date.now()}`,
    severity: (finding.severity as string) ?? 'medium',
    type: (finding.type as string) ?? 'quality_issue',
    title: (finding.title as string) ?? 'Unknown finding',
    description: (finding.description as string) ?? '',
  };

  // Add optional fields only if they're defined
  if (finding.location) {
    result.location = finding.location as { file: string; line?: number };
  }
  if (finding.origin) {
    result.origin = finding.origin as {
      type: 'config' | 'session' | 'git';
      reference: string;
      description: string;
    };
  }
  if (finding.recommendations) {
    result.recommendations = finding.recommendations as Array<{
      type: 'symptomatic' | 'preventive' | 'systemic';
      action: string;
      rationale: string;
      priority?: 'high' | 'medium' | 'low';
    }>;
  }

  return result;
}

/**
 * Convert a stored recommendation to an AnalyseFinding.
 * This bridges the recommendation storage to the findings output.
 */
function convertRecommendationToFinding(rec: Recommendation): AnalyseFinding {
  // Map recommendation priority to severity
  const priorityToSeverity: Record<string, string> = {
    high: 'high',
    medium: 'medium',
    low: 'low',
  };

  // Map recommendation type to finding type
  const typeMap: Record<string, string> = {
    symptomatic: 'quick_fix',
    preventive: 'config_improvement',
    systemic: 'architecture_issue',
  };

  const finding: AnalyseFinding = {
    id: rec.id,
    severity: priorityToSeverity[rec.priority] ?? 'medium',
    type: typeMap[rec.type] ?? 'recommendation',
    title: `[${rec.type}] ${rec.action.slice(0, 60)}${rec.action.length > 60 ? '...' : ''}`,
    description: rec.rationale,
  };

  // Add location from target
  if (rec.target) {
    finding.location = {
      file: rec.target,
    };
  }

  // Add origin from tracedOrigin
  if (rec.tracedOrigin) {
    finding.origin = {
      type: rec.tracedOrigin.sessionId ? 'session' : 'config',
      reference:
        rec.tracedOrigin.configGap ?? rec.tracedOrigin.findingId ?? rec.target ?? 'unknown',
      description: rec.tracedOrigin.pattern ?? 'Recommendation from analysis',
    };
  }

  // Add as a recommendation
  finding.recommendations = [
    {
      type: rec.type,
      action: rec.action,
      rationale: rec.rationale,
      priority: rec.priority,
    },
  ];

  return finding;
}

/**
 * Load stored recommendations and convert them to findings.
 * This bridges the gap between recommendation tools (which store to disk)
 * and the findings output (which counts StreamChunk findings).
 *
 * Note: Due to SDK limitations, tools use process.cwd() for storage, not the
 * target directory. We check both locations to handle this.
 */
async function loadRecommendationsAsFindings(directory: string): Promise<AnalyseFinding[]> {
  const findings: AnalyseFinding[] = [];
  const seenIds = new Set<string>();

  // Check both target directory and CWD (where tools actually store recommendations)
  const dirsToCheck = [
    getRecommendationsDir(directory), // Target project
    getRecommendationsDir(process.cwd()), // Where tools store (fallback)
  ];

  // Dedupe if same directory
  const uniqueDirs = [...new Set(dirsToCheck)];

  for (const recDir of uniqueDirs) {
    try {
      const ids = listRecommendationIds({ baseDir: recDir });

      for (const id of ids) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const rec = await loadRecommendation(id, { baseDir: recDir });
        if (rec && rec.status === 'open') {
          findings.push(convertRecommendationToFinding(rec));
        }
      }
    } catch {
      // Directory doesn't exist or empty - continue to next
    }
  }

  return findings;
}

/**
 * Build the final result from collected findings.
 */
function buildAnalyseResult(
  directory: string,
  scanResult: ScanResult,
  findings: AnalyseFinding[],
  startTime: number,
  error?: string
): AnalyseResult {
  const bySeverity: Record<string, number> = {};
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
  }

  const result: AnalyseResult = {
    status: error ? 'error' : 'success',
    directory,
    configs: scanResult.configs,
    findings,
    summary: { total: findings.length, bySeverity },
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };

  // Add error only if defined
  if (error) {
    result.error = error;
  }

  return result;
}

/**
 * Run orchestrated analysis using the Claude agent.
 *
 * This is the default mode when ANTHROPIC_API_KEY is available.
 * The agent uses tools to discover, parse, and analyze configurations,
 * then provides intelligent recommendations.
 */
async function runOrchestratedAnalysis(
  directory: string,
  options: AnalyseOptions,
  scanResult: ScanResult,
  outputMode: OutputMode
): Promise<AnalyseResult> {
  const startTime = Date.now();
  const findings: AnalyseFinding[] = [];

  // Initialize debug logger from CLI options
  const loggerOpts: { verbose?: boolean; debug?: string; quiet?: boolean; logFile?: string } = {};
  if (options.verbose !== undefined) loggerOpts.verbose = options.verbose;
  if (options.debug !== undefined) loggerOpts.debug = options.debug;
  if (options.quiet !== undefined) loggerOpts.quiet = options.quiet;
  if (options.logFile !== undefined) loggerOpts.logFile = options.logFile;
  const logger = createLoggerFromCLIOptions(loggerOpts);
  setDefaultLogger(logger);

  // Issue 4 fix: Initialize databases before tools can use them
  // This ensures baselines, learnings, recommendations directories and DBs exist
  await initializeDatabases({ projectPath: directory });

  // Issue 2 fix: Auto-index sessions before analysis so session tools have data
  // This populates the sessions database with any discovered session files
  try {
    const discovered = await discoverSessions({ projectPath: directory });
    if (discovered.files.length > 0) {
      await indexSessions(
        discovered.files.map((f) => ({ path: f.path, projectPath: f.projectPath })),
        { force: false }
      );
    }
  } catch {
    // Don't block analysis if session indexing fails - it's supplementary
    // The agent can still analyze configs without session data
  }

  // Create tool registry and register all tools
  const registry = createToolRegistry();
  registerAllTools(registry);

  // Create orchestrator with configuration
  // Issue 3 fix: Use agentlint's cwd, NOT target directory, to avoid loading
  // target's .mcp.json which causes MCP connection timeouts (90s+ delays)
  const verbosity = getVerbosityLevel(options);
  const orchestrator = createOrchestrator(
    {
      verbosity,
      cwd: process.cwd(), // Agentlint's directory, NOT target
      settingSources: [], // Don't load ANY .mcp.json files
      systemPromptAppend: `\nAnalysis target directory: ${directory}`,
    },
    registry
  );

  // Build the analysis prompt (async to load existing recommendations context)
  const prompt = await buildAnalysisPrompt(directory, scanResult, options);

  // Create renderer for output
  const renderer = createRenderer(outputMode, options);

  // Set up interrupt handler
  let interrupted = false;
  const handleInterrupt = (): void => {
    if (!interrupted) {
      interrupted = true;
      void orchestrator.interrupt().then(() => {
        renderer.renderChunk({
          type: 'status',
          level: 'normal',
          content: 'Analysis interrupted by user',
          timestamp: new Date().toISOString(),
        });
      });
    }
  };

  // Bind interrupt handler
  process.on('SIGINT', handleInterrupt);

  try {
    // Run the orchestrator with execution context so tools know the target directory
    // This ensures create_recommendation stores files in the target project, not cwd
    return await runWithExecutionContext({ targetDirectory: directory }, async () => {
      // Run the orchestrator and stream output
      for await (const chunk of orchestrator.run(prompt)) {
        // Check for interruption
        if (interrupted) {
          break;
        }

        // Filter by verbosity and render
        if (shouldDisplay(chunk.level, verbosity)) {
          renderer.renderChunk(chunk);
        }

        // Collect findings from chunks
        if (chunk.type === 'finding') {
          const finding = convertChunkToFinding(chunk);
          if (finding) {
            findings.push(finding);
            renderer.renderFinding(finding);
          }
        }
      }

      // Bridge recommendations to findings (Issue 2 fix)
      // Agent calls create_recommendation → stored to disk → we collect them here
      const storedRecFindings = await loadRecommendationsAsFindings(directory);
      for (const recFinding of storedRecFindings) {
        // Only add if not already in findings (avoid duplicates from chunk findings)
        if (!findings.some((f) => f.id === recFinding.id)) {
          findings.push(recFinding);
          renderer.renderFinding(recFinding);
        }
      }

      // Build and output final result
      const result = buildAnalyseResult(directory, scanResult, findings, startTime);
      renderer.renderComplete(result);
      renderer.flush();

      return result;
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderer.renderError(error instanceof Error ? error : new Error(errorMessage));
    renderer.flush();

    // Return result with error
    return buildAnalyseResult(directory, scanResult, findings, startTime, errorMessage);
  } finally {
    // Clean up interrupt handler
    process.removeListener('SIGINT', handleInterrupt);
  }
}

/**
 * Run static analysis and output results.
 */
function runStaticAnalysisMode(
  directory: string,
  _options: AnalyseOptions,
  scanResult: ScanResult,
  outputMode: OutputMode,
  verbose: boolean
): AnalyseResult {
  const startTime = Date.now();

  // Perform static analysis on discovered configs
  const findings = performStaticAnalysis(directory, scanResult.configs);

  // Calculate summary
  const bySeverity: Record<string, number> = {};
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
  }

  const result: AnalyseResult = {
    status: 'success',
    directory,
    configs: scanResult.configs,
    findings,
    summary: { total: findings.length, bySeverity },
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };

  if (outputMode === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Format terminal output with findings
    const lines: string[] = [];
    lines.push('');
    lines.push('Static Analysis Complete');
    lines.push('========================');
    lines.push('');
    lines.push(`Directory: ${directory}`);
    lines.push(`Configs analyzed: ${scanResult.configs.length}`);
    lines.push(`Findings: ${findings.length}`);
    lines.push('');

    if (findings.length > 0) {
      lines.push('Findings:');
      for (const finding of findings) {
        const severity = finding.severity.toUpperCase().padEnd(8);
        lines.push(`  [${severity}] ${finding.title}`);
        if (verbose) {
          lines.push(`             ${finding.description}`);
          if (finding.location) {
            lines.push(
              `             Location: ${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}`
            );
          }
        }
      }
      lines.push('');
    }

    console.log(lines.join('\n'));
  }

  return result;
}

/**
 * Formats a dry-run result for terminal output.
 *
 * @param result - The analyse result
 * @param verbose - Whether to show verbose output
 * @returns Formatted string for terminal display
 */
function formatDryRunTerminal(result: AnalyseResult, verbose: boolean): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Dry Run Analysis');
  lines.push('================');
  lines.push('');

  if (result.configs.length === 0) {
    lines.push('No AI configuration files found.');
    lines.push('');
    lines.push('To get started, create a configuration file:');
    lines.push('  - CLAUDE.md for Claude Code');
    lines.push('  - .cursorrules for Cursor');
    lines.push('  - .github/copilot-instructions.md for GitHub Copilot');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`Directory: ${result.directory}`);
  lines.push(`Found ${result.configs.length} configuration file(s):`);
  lines.push('');

  for (const config of result.configs) {
    const relPath = relative(result.directory, config.path);
    lines.push(`  • ${relPath} (${config.type})`);
    if (verbose) {
      lines.push(`      ${config.description}`);
      lines.push(`      Size: ${config.size} bytes`);
    }
  }

  lines.push('');
  lines.push('To run full analysis (requires API key):');
  lines.push('  agentlint analyse');
  lines.push('');

  return lines.join('\n');
}

/**
 * Formats a dry-run result for JSON output.
 *
 * @param result - The analyse result
 * @returns JSON string
 */
function formatDryRunJson(result: AnalyseResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Check if orchestrated analysis is available.
 * Requires ANTHROPIC_API_KEY environment variable.
 */
function canUseOrchestratedAnalysis(): boolean {
  return !!process.env['ANTHROPIC_API_KEY'];
}

/**
 * Type description map for config types (from discovery module).
 * Extended for remediation to include rules, agents, and commands.
 */
const CONFIG_TYPE_DESCRIPTIONS: Record<string, string> = {
  'claude-md': 'Claude Code project instructions',
  'agents-md': 'Multi-agent configuration',
  'claude-settings': 'Claude Code settings',
  'claude-settings-local': 'Claude Code local settings',
  'mcp-json': 'MCP server configuration',
  'claude-hook': 'Claude Code hook script',
  'skill-md': 'Claude Code skill definition',
  'claude-rule': 'Claude Code rule file',
  'claude-agent': 'Claude Code agent/subagent definition',
  'claude-command': 'Claude Code legacy command',
  'cursor-rules': 'Cursor AI rules',
  unknown: 'Unknown configuration',
};

/**
 * Map discovery ConfigType to scan ConfigType.
 * Discovery uses specific types (claude-md, claude-settings) while
 * scan uses broader categories (claude-code, cursor).
 * Extended for remediation to handle rules, agents, and commands.
 */
function mapDiscoveryTypeToScanType(discoveryType: string): ScanConfigFile['type'] {
  switch (discoveryType) {
    case 'claude-md':
    case 'claude-settings':
    case 'claude-settings-local':
    case 'mcp-json':
    case 'claude-hook':
    case 'skill-md':
    case 'claude-rule':
    case 'claude-agent':
    case 'claude-command':
      return 'claude-code';
    case 'agents-md':
      return 'claude-code'; // AGENTS.md is also Claude ecosystem
    case 'cursor-rules':
      return 'cursor';
    default:
      return 'unknown';
  }
}

/**
 * Convert comprehensive discovery result to ScanResult format.
 * This allows orchestrated analysis to use the full discovery while
 * maintaining compatibility with the rest of the analysis pipeline.
 */
function convertDiscoveryToScanResult(
  discovery: DiscoverConfigsResult,
  directory: string
): ScanResult {
  const configs: ScanConfigFile[] = discovery.files.map((file) => ({
    path: file.path,
    relativePath: file.relativePath,
    type: mapDiscoveryTypeToScanType(file.type),
    description: CONFIG_TYPE_DESCRIPTIONS[file.type] ?? 'Configuration file',
    size: file.size,
    actType: file.actType,
  }));

  return {
    directory,
    configs,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Run comprehensive config discovery using the tools module.
 * This finds all configs including skills, hooks, and nested configs.
 */
async function runComprehensiveDiscovery(directory: string): Promise<ScanResult> {
  const discovery = await discoverConfigs({
    cwd: directory,
    includeGlobal: false,
    parseSkills: true,
  });

  return convertDiscoveryToScanResult(discovery, directory);
}

/**
 * Runs the analyse command.
 *
 * Modes:
 * - --dry-run: Scan only, no analysis
 * - --static: Static analysis without LLM
 * - (default): Orchestrated analysis with Claude agent (requires API key)
 *
 * @param options - Command options
 * @returns Exit code (0 for success, non-zero for failure)
 */
export async function runAnalyse(options: AnalyseOptions): Promise<number> {
  const directory = resolve(options.directory ?? '.');
  const outputMode = getOutputMode(options);
  const verbose = options.verbose ?? false;

  // Validate directory exists
  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      const error = `Not a directory: ${directory}`;
      if (outputMode === 'json') {
        console.log(JSON.stringify({ status: 'error', error }, null, 2));
      } else {
        console.error(`Error: ${error}`);
      }
      return 1;
    }
  } catch {
    const error = `Directory not found: ${directory}`;
    if (outputMode === 'json') {
      console.log(JSON.stringify({ status: 'error', error }, null, 2));
    } else {
      console.error(`Error: ${error}`);
    }
    return 1;
  }

  // Scan for configurations
  // Use basic scan for dry-run/static modes, comprehensive discovery for orchestrated
  const useComprehensive = !options.dryRun && !options.static && canUseOrchestratedAnalysis();
  const scanResult = useComprehensive
    ? await runComprehensiveDiscovery(directory)
    : await scanForConfigs(directory);

  // Dry run mode: just scan and report
  if (options.dryRun) {
    const result: AnalyseResult = {
      status: 'dry-run',
      directory,
      configs: scanResult.configs,
      findings: [],
      summary: { total: 0, bySeverity: {} },
      timestamp: new Date().toISOString(),
    };

    if (outputMode === 'json') {
      console.log(formatDryRunJson(result));
    } else {
      console.log(formatDryRunTerminal(result, verbose));
    }

    // Dry run always succeeds (exit 0)
    return 0;
  }

  // Handle empty config case for all modes
  if (scanResult.configs.length === 0) {
    const result: AnalyseResult = {
      status: 'success',
      directory,
      configs: [],
      findings: [],
      summary: { total: 0, bySeverity: {} },
      timestamp: new Date().toISOString(),
      durationMs: 0,
    };

    if (outputMode === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatDryRunTerminal(result, verbose));
    }
    return 0; // No configs = no findings = success
  }

  // Route based on mode
  let result: AnalyseResult;

  if (options.static) {
    // Static analysis mode (explicit --static flag)
    result = runStaticAnalysisMode(directory, options, scanResult, outputMode, verbose);
  } else if (!canUseOrchestratedAnalysis()) {
    // No API key - fall back to static with warning
    if (outputMode !== 'json' && !options.quiet) {
      console.warn(
        'ANTHROPIC_API_KEY not set. Falling back to static analysis.\n' +
          'Set ANTHROPIC_API_KEY for intelligent agent-based analysis.\n'
      );
    }
    result = runStaticAnalysisMode(directory, options, scanResult, outputMode, verbose);
  } else {
    // Default: Orchestrated analysis with Claude agent
    result = await runOrchestratedAnalysis(directory, options, scanResult, outputMode);
  }

  // Return exit code based on --fail-on-findings flag
  if (options.failOnFindings && result.findings.length > 0) {
    return 1;
  }

  // Return error exit code if analysis failed
  if (result.status === 'error') {
    return 1;
  }

  return 0;
}

export default runAnalyse;
