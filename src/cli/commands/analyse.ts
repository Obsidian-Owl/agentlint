/**
 * EP04 CLI Interface - Analyse Command
 *
 * Implements US-001: Run analysis with streaming output.
 * Implements FR-001: Primary command is `agentlint analyse`.
 * Implements FR-015: Support --config-only and --sessions-only flags.
 *
 * The analyse command is the primary entry point for agentlint analysis.
 * It:
 * 1. Discovers AI configuration files
 * 2. Runs the orchestrator to analyze configs and sessions
 * 3. Streams progress and findings to the terminal
 * 4. Outputs results in the requested format
 *
 * @module cli/commands/analyse
 */

import { resolve, relative } from 'node:path';
import { stat } from 'node:fs/promises';
import { getOutputMode } from '../utils/output';
import type { GlobalOptions } from '../types';
import { scanForConfigs, type ScanResult } from './scan';
import { parseConfigSync } from '../../tools/config/parse-config';
import { assessQuality } from '../../tools/config/quality';
import { GapAnalyzer } from '../../tools/causal/gap-analyzer';
import type { QualityIssue } from '../../tools/config/types';

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

  return {
    id: `FND-${String(id).padStart(4, '0')}`,
    severity: severityMap[issue.severity] ?? 'medium',
    type: typeMap[issue.type] ?? 'config_antipattern',
    title: formatIssueTitle(issue.type),
    description: issue.message,
    location: {
      file: filePath,
      line: issue.position?.start.line,
    },
    origin: {
      type: 'config',
      reference: `${filePath}:${issue.position?.start.line ?? 1}`,
      description: `Issue detected in configuration file`,
    },
    recommendations: issue.suggestion
      ? [
          {
            type: recTypeMap[issue.type] ?? 'symptomatic',
            action: issue.suggestion,
            rationale: 'Improves configuration quality and reduces token waste',
            priority: issue.severity === 'critical' ? 'high' : 'medium',
          },
        ]
      : undefined,
  };
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
 * Runs the analyse command.
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

  // Dry run mode: just scan and report
  if (options.dryRun) {
    const scanResult = await scanForConfigs(directory);
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

  // Full analysis mode - perform static analysis
  const startTime = Date.now();
  const scanResult = await scanForConfigs(directory);

  if (scanResult.configs.length === 0) {
    const result: AnalyseResult = {
      status: 'success',
      directory,
      configs: [],
      findings: [],
      summary: { total: 0, bySeverity: {} },
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };

    if (outputMode === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatDryRunTerminal(result, verbose));
    }
    return 0; // No configs = no findings = success
  }

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
    lines.push('Analysis Complete');
    lines.push('=================');
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
            lines.push(`             Location: ${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}`);
          }
        }
      }
      lines.push('');
    }

    console.log(lines.join('\n'));
  }

  // Return exit code based on --fail-on-findings flag
  if (options.failOnFindings && findings.length > 0) {
    return 1;
  }

  return 0;
}

export default runAnalyse;
