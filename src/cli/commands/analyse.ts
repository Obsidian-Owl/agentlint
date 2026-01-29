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
import { printException, printIOError } from '../utils/error';
import type { GlobalOptions, OutputMode } from '../types';
import { scanForConfigs, type ScanResult, type ConfigFile as ScanConfigFile } from './scan';
import { discoverConfigs, type DiscoverConfigsResult } from '../../tools/config';
import { parseConfigSync } from '../../tools/config/parse-config';
import { assessQuality } from '../../tools/config/quality';
import { GapAnalyzer } from '../../tools/causal/gap-analyzer';
import type { QualityIssue } from '../../tools/config/types';
import { sanitizePromptInput } from '../../utils/sanitize';
import { redact } from '../../debug/redaction';

// Orchestration imports
import {
  createToolRegistry,
  createOrchestrator,
  shouldDisplay,
  runWithExecutionContext,
} from '../../orchestration';
import type { VerbosityLevel, StreamChunk } from '../../orchestration/types';
import { registerAllTools } from '../../tools';
import { createLoggerFromCLIOptions, setDefaultLogger, getDefaultLogger } from '../../debug/logger';
import { DEBUG_NAMESPACES } from '../../debug/namespaces';
import { createRenderer } from '../renderers';
import { TuiStreamRenderer, createTuiCanUseTool, type ITuiRenderer } from '../../tui';
import { buildAnalysisPrompt } from './analyse-prompt';

// Recommendation storage imports for clean-slate functionality and findings count
import {
  getRecommendationsDir,
  clearRecommendations,
  listRecommendationIds,
  loadRecommendation,
} from '../../recommendations/storage';

// Database initialization import (Issue 4 fix)
import { initializeDatabases } from '../../persistence';

// Session indexing imports (Issue 2 fix: auto-index sessions before analysis)
import { discoverSessions } from '../../tools/sessions/discovery';
import { indexSessions } from '../../tools/sessions/indexer';

// Session recording imports (default logging feature)
import { createSessionRecorder, type SessionRecorder } from '../../orchestration/checkpoint';
import type {
  SessionCheckpoint,
  SessionCheckpointTrigger,
  SessionMetrics,
  ToolHistoryEntry,
  CheckpointFindingSummary,
} from '../../orchestration/checkpoint-types';

// Log rotation imports (clean up old logs on startup)
import { cleanupLogsOnStartup } from '../../debug/rotation';

// Telemetry imports
import { getTelemetryClient } from '../../telemetry';

// EP15 Session Intelligence imports
import { buildSessionAnalystAgent } from '../../sessions/subagent';
import { buildQueryPrompt } from '../../sessions/tools/spawn-session-analyst';
import type { SessionAnalysisContext } from '../../sessions/subagent/types';

// Welcome flow and conversation mode imports
import { runWelcomeFlow } from './welcome-flow';
import { ConversationManager } from './conversation-manager';

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
  /** Clear existing recommendations before analysis */
  cleanSlate?: boolean;
  /** Focus analysis on skills effectiveness (EP14) - internal use */
  skills?: boolean;
  /** Session ID or path for session-specific analysis (EP15) */
  session?: string;
  /** Disable session recording for this run */
  noSession?: boolean;
  /** Override default log file location */
  logFile?: string;
  /** Disable file logging for this run */
  noLog?: boolean;
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
    /** AGE-684: Recommendations created during this session */
    sessionFindings?: number;
    /** AGE-684: Total open recommendations in the project */
    totalOpen?: number;
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
 * Detect the primary project type from scan results.
 * Used for telemetry to categorize analysis sessions.
 */
function detectProjectType(scanResult: ScanResult): string {
  const types = scanResult.configs.map((c) => c.type);

  // Check for Claude Code configs
  if (types.includes('claude-code')) {
    return 'claude-code';
  }
  // Check for Cursor configs
  if (types.includes('cursor')) {
    return 'cursor';
  }
  // Check for GitHub Copilot configs
  if (types.includes('github-copilot')) {
    return 'github-copilot';
  }
  if (types.length > 0) {
    return types[0] ?? 'unknown';
  }

  return 'no-config';
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
    } catch (error) {
      // Log parsing error but continue with other configs
      printException(error, `Parsing config ${config.path}`);
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
// Session Recording Helpers
// =============================================================================

/**
 * State tracked during analysis for session recording.
 */
interface SessionRecordingState {
  sessionId: string;
  recorder: SessionRecorder;
  sequence: number;
  startTime: number;
  toolHistory: ToolHistoryEntry[];
  findings: CheckpointFindingSummary[];
  metrics: SessionMetrics;
  phase: 'init' | 'scan' | 'analyze' | 'recommend' | 'complete';
}

/**
 * Generate a unique session ID using cryptographically secure randomness.
 */
function generateSessionId(): string {
  // Use crypto.randomUUID() for proper entropy (defense-in-depth)
  return crypto.randomUUID();
}

/**
 * Create a session checkpoint from current state.
 */
function createCheckpoint(
  state: SessionRecordingState,
  trigger: SessionCheckpointTrigger
): SessionCheckpoint {
  return {
    version: '1.0',
    sessionId: state.sessionId,
    timestamp: new Date().toISOString(),
    sequence: ++state.sequence,
    phase: state.phase,
    trigger,
    toolHistory: state.toolHistory.slice(-20), // Keep last 20 tool calls
    findings: state.findings,
    metrics: {
      ...state.metrics,
      elapsedMs: Date.now() - state.startTime,
    },
  };
}

/**
 * Record a checkpoint if session recording is active.
 */
async function recordCheckpointIfActive(
  state: SessionRecordingState | null,
  trigger: SessionCheckpointTrigger
): Promise<void> {
  if (!state) return;
  const checkpoint = createCheckpoint(state, trigger);
  await state.recorder.recordCheckpoint(checkpoint);
}

// =============================================================================
// Orchestrated Analysis (Default Mode)
// =============================================================================

/**
 * Determine the verbosity level from CLI options.
 */
function getVerbosityLevel(options: AnalyseOptions): VerbosityLevel {
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
 * AGE-684: Count recommendations from storage.
 * Returns both session-scoped (new) and project-scoped (total open) counts.
 */
async function countRecommendations(
  directory: string,
  sessionStartTime: number
): Promise<{ sessionFindings: number; totalOpen: number }> {
  const recDir = getRecommendationsDir(directory);
  const ids = listRecommendationIds({ baseDir: recDir });

  let sessionFindings = 0;
  let totalOpen = 0;

  for (const id of ids) {
    const rec = await loadRecommendation(id, { baseDir: recDir });
    if (rec && rec.status === 'open') {
      totalOpen++;
      // Check if created during this session
      const createdAt = new Date(rec.createdAt).getTime();
      if (createdAt >= sessionStartTime) {
        sessionFindings++;
      }
    }
  }

  return { sessionFindings, totalOpen };
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
 * This is the default mode. The agent uses tools to discover, parse,
 * and analyze configurations, then provides intelligent recommendations.
 * Falls back to static analysis if no LLM provider is configured.
 */
async function runOrchestratedAnalysis(
  directory: string,
  options: AnalyseOptions,
  scanResult: ScanResult,
  outputMode: OutputMode
): Promise<AnalyseResult> {
  const startTime = Date.now();
  const findings: AnalyseFinding[] = [];

  // Clean up old log files on startup (log rotation)
  if (!options.noLog) {
    cleanupLogsOnStartup();
  }

  // Initialize debug logger from CLI options
  // By default, logs to ~/.agentlint/logs/{date}.ndjson
  const loggerOpts: { verbose?: boolean; quiet?: boolean; logFile?: string; noLog?: boolean } = {};
  if (options.verbose !== undefined) loggerOpts.verbose = options.verbose;
  if (options.quiet !== undefined) loggerOpts.quiet = options.quiet;
  if (options.logFile !== undefined) loggerOpts.logFile = options.logFile;
  if (options.noLog !== undefined) loggerOpts.noLog = options.noLog;
  const logger = createLoggerFromCLIOptions(loggerOpts);
  setDefaultLogger(logger);

  // Initialize session recording (unless --no-session)
  let recordingState: SessionRecordingState | null = null;
  if (!options.noSession) {
    const sessionId = generateSessionId();
    const recorder = createSessionRecorder();
    recorder.startRecording(sessionId);

    recordingState = {
      sessionId,
      recorder,
      sequence: 0,
      startTime,
      toolHistory: [],
      findings: [],
      metrics: {
        toolCalls: 0,
        llmCalls: 0,
        tokensUsed: 0,
        inputTokens: 0,
        outputTokens: 0,
        elapsedMs: 0,
      },
      phase: 'init',
    };

    // Record initial checkpoint
    await recordCheckpointIfActive(recordingState, 'phase_transition');
  }

  // Initialize telemetry (opt-in only, disabled by default)
  const telemetry = getTelemetryClient();
  const telemetrySessionId = recordingState?.sessionId ?? generateSessionId();
  if (telemetry.isEnabled()) {
    // Detect project type from scan results for context
    const hasConfig = scanResult.configs.length > 0;
    const projectType = detectProjectType(scanResult);

    telemetry.sessionStart(telemetrySessionId, {
      command: 'analyse',
      hasConfig,
      projectType,
      // Include directory basename for human-readable session naming in HoneyHive
      directory: directory.split('/').pop() ?? directory,
    });
  }

  // Issue 4 fix: Initialize databases before tools can use them
  // This ensures baselines, learnings, recommendations directories and DBs exist
  await initializeDatabases({ projectPath: directory });

  // Issue 2 fix: Auto-index sessions before analysis so session tools have data
  // This populates the sessions database with any discovered session files
  const sessionLogger = getDefaultLogger().child(DEBUG_NAMESPACES.TOOLS);
  try {
    sessionLogger.debug('Starting session discovery', { directory });
    const discovered = await discoverSessions({ projectPath: directory });
    sessionLogger.debug('Sessions discovered', {
      count: discovered.files.length,
      totalSize: discovered.totalSize,
      projects: discovered.projects,
    });
    if (discovered.files.length > 0) {
      sessionLogger.debug('Indexing discovered sessions', { count: discovered.files.length });
      await indexSessions(
        discovered.files.map((f) => ({ path: f.path, projectPath: f.projectPath })),
        { force: false }
      );
      sessionLogger.debug('Session indexing complete');
    }
  } catch (error) {
    // Session indexing is supplementary - log but don't block analysis
    sessionLogger.debug('Session indexing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    printException(error, 'Session indexing');
  }

  // Create tool registry and register all tools
  const registry = createToolRegistry();
  registerAllTools(registry);

  // Build the analysis prompt (async to load existing recommendations context)
  // Returns separate system and user prompts to avoid system prompt appearing in output
  const { systemPrompt, userPrompt } = await buildAnalysisPrompt(directory, scanResult, {
    ...options,
    sessionId: telemetrySessionId,
  });

  // Create renderer for output
  const renderer = createRenderer(outputMode, options);

  // Extract TUI renderer if using Ink mode for lifecycle management and permission handling
  let tuiRenderer: ITuiRenderer | undefined;
  let canUseTool:
    | ((
        toolName: string,
        input: Record<string, unknown>
      ) => Promise<{
        behavior: 'allow' | 'deny';
        message?: string;
        updatedInput?: Record<string, unknown>;
      }>)
    | undefined;
  if (renderer instanceof TuiStreamRenderer) {
    tuiRenderer = renderer.tuiRenderer;
    // Only pass autoApprove if explicitly true (to satisfy exactOptionalPropertyTypes)
    const permissionOptions = options.nonInteractive === true ? { autoApprove: true } : {};
    canUseTool = createTuiCanUseTool(tuiRenderer, permissionOptions);
  }

  // Create orchestrator with configuration
  // Issue 3 fix: Use agentlint's cwd, NOT target directory, to avoid loading
  // target's .mcp.json which causes MCP connection timeouts (90s+ delays)
  const verbosity = getVerbosityLevel(options);

  // Build orchestrator config
  const orchestratorConfig: Parameters<typeof createOrchestrator>[0] = {
    verbosity,
    cwd: process.cwd(), // Agentlint's directory, NOT target
    settingSources: [], // Don't load ANY .mcp.json files
    systemPromptAppend: `\nAnalysis target directory: ${sanitizePromptInput(directory)}`,
    // ADR-0021: Pass nonInteractive for CI/automation mode
    nonInteractive: options.nonInteractive ?? false,
  };

  // Pass telemetry client for direct instrumentation (more reliable than chunk observation)
  // Only add these fields when telemetry is enabled (exactOptionalPropertyTypes compliance)
  if (telemetry.isEnabled()) {
    orchestratorConfig.telemetryClient = telemetry;
    orchestratorConfig.telemetrySessionId = telemetrySessionId;
    const parentEventId = telemetry.getSessionEventId?.(telemetrySessionId);
    if (parentEventId) {
      orchestratorConfig.telemetryParentEventId = parentEventId;
    }
  }

  // EP17: Use TuiPermissionHandler when TUI mode is active
  if (canUseTool) {
    orchestratorConfig.canUseTool = canUseTool;
  }

  const orchestrator = createOrchestrator(orchestratorConfig, registry);

  // Set up interrupt handler
  let interrupted = false;
  const handleInterrupt = async (): Promise<void> => {
    if (!interrupted) {
      interrupted = true;
      try {
        await orchestrator.interrupt();
        renderer.renderChunk({
          type: 'status',
          level: 'normal',
          content: 'Analysis interrupted by user',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Interrupt failed - log but continue shutdown
        console.error(
          'Failed to interrupt orchestrator:',
          error instanceof Error ? error.message : error
        );
      }
    }
  };

  // Bind interrupt handler
  process.on('SIGINT', () => {
    void handleInterrupt();
  });

  // Start TUI renderer and welcome flow if present (for Ink mode)
  let conversationManager: ConversationManager | undefined;
  if (tuiRenderer) {
    tuiRenderer.start({
      onInput: async (input) => {
        if (conversationManager) {
          await conversationManager.handleInput(input);
        }
      },
      onExit: async () => {
        // Stop the SSE stream and server - don't rely on handleInterrupt
        // because interrupted flag check would cause early return
        try {
          await orchestrator.interrupt();
        } catch {
          // Interrupt failure is non-fatal during exit
        }
        interrupted = true;
        if (conversationManager) {
          await conversationManager.saveSession();
        }
        // CRITICAL: Stop the server before exiting
        orchestrator.dispose();
      },
    });

    const welcomeResult = await runWelcomeFlow(tuiRenderer, { projectPath: directory });

    conversationManager = new ConversationManager({
      tuiRenderer,
      orchestrator,
      welcomeContext: welcomeResult.context,
      projectPath: directory,
    });
    await conversationManager.initialize();

    tuiRenderer.setTuiState('analysing');
  }

  try {
    // Run the orchestrator with execution context so tools know the target directory
    // This ensures create_recommendation stores files in the target project, not cwd
    return await runWithExecutionContext({ targetDirectory: directory }, async () => {
      // Run the orchestrator and stream output
      // System prompt is sent via body.system to avoid appearing in output
      for await (const chunk of orchestrator.run(userPrompt, { systemPrompt })) {
        // Check for interruption
        if (interrupted) {
          break;
        }

        // Debug logging for chunk flow - helps diagnose rendering issues (AGE-671, AGE-682)
        // Enabled via --verbose flag, respects --debug-level: minimal|normal|verbose
        if (options.verbose) {
          const debugLevel = options.debugLevel ?? 'normal';

          // Determine if this chunk should be shown based on debug level
          let shouldLog = true;
          if (debugLevel === 'minimal') {
            // Only show errors, tool calls, phase changes
            shouldLog = ['error', 'tool_start', 'tool_result', 'phase_change'].includes(chunk.type);
          } else if (debugLevel === 'normal') {
            // Show everything except small text chunks (under 10 chars)
            if (chunk.type === 'text' && chunk.content.length < 10) {
              shouldLog = false;
            }
          }
          // verbose: show everything (no filtering)

          if (shouldLog) {
            // Build debug line with content preview for text chunks
            let debugLine = `[CHUNK] type=${chunk.type} level=${chunk.level}`;
            const toolNameValue = chunk.metadata?.toolName;
            if (typeof toolNameValue === 'string') {
              debugLine += ` tool=${toolNameValue}`;
            }
            // Show content preview for text chunks (escape special chars for readability)
            if (chunk.type === 'text' && chunk.content) {
              const preview = chunk.content
                .slice(0, 30)
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
              debugLine += ` content="${preview}${chunk.content.length > 30 ? '...' : ''}"`;
            }
            console.error(debugLine);
          }
        }

        // Filter by verbosity and render
        if (shouldDisplay(chunk.level, verbosity)) {
          renderer.renderChunk(chunk);
        }

        // Track tool calls for session recording
        // Note: Telemetry tracking is now handled directly by the Orchestrator
        // for more reliable timing and hierarchy (see orchestrator.ts processMessage)
        if (chunk.type === 'tool_result') {
          const toolName = chunk.metadata?.toolName;
          // DEBUG: Log tool_result chunks to diagnose telemetry
          if (process.env['AGENTLINT_TELEMETRY_DEBUG'] === '1') {
            console.error(
              `[DEBUG] tool_result: toolName=${String(toolName)}, metadata keys=${Object.keys(chunk.metadata ?? {}).join(',')}`
            );
          }

          // Track for session recording (if enabled)
          if (recordingState && typeof toolName === 'string') {
            recordingState.toolHistory.push({
              tool: toolName,
              arguments: (chunk.metadata?.arguments as Record<string, unknown>) ?? {},
              resultSummary: chunk.content.slice(0, 500),
              timestamp: chunk.timestamp,
              durationMs: (chunk.metadata?.durationMs as number) ?? 0,
            });
            recordingState.metrics.toolCalls++;

            // Record checkpoint on tool completion
            await recordCheckpointIfActive(recordingState, 'tool_complete');
          }
          // Note: telemetry.trackTool removed - orchestrator handles this directly
        }

        // Track LLM calls for session recording
        if (chunk.type === 'text' && recordingState) {
          // Update phase based on content hints
          if (recordingState.phase === 'init' && recordingState.metrics.toolCalls > 0) {
            recordingState.phase = 'analyze';
            await recordCheckpointIfActive(recordingState, 'phase_transition');
          }
        }

        // Collect findings from chunks
        if (chunk.type === 'finding') {
          const finding = convertChunkToFinding(chunk);
          if (finding) {
            findings.push(finding);
            renderer.renderFinding(finding);

            // Track finding for session recording
            if (recordingState) {
              recordingState.findings.push({
                id: finding.id,
                type: finding.type,
                location: {
                  file: finding.location?.file ?? 'unknown',
                  line: finding.location?.line ?? 0,
                },
                summary: finding.title,
              });
              await recordCheckpointIfActive(recordingState, 'finding');
            }

            // Track finding for telemetry (privacy-safe: type and severity only)
            if (telemetry.isEnabled()) {
              telemetry.trackFinding(
                telemetrySessionId,
                finding.type ?? 'unknown',
                (finding.severity as 'info' | 'warning' | 'error' | 'critical') ?? 'info'
              );
            }
          }
        }

        // Handle human-in-the-loop questions
        // Note: Interactive question answering is now handled via TuiPermissionHandler
        // when the AskUserQuestion tool is used. The chunk is informational only.
        if (chunk.type === 'user_question') {
          if (options.nonInteractive && !options.quiet) {
            console.log('\n[Non-interactive mode: Questions answered automatically]');
          }
        }

        // Track token usage from status chunks (session completion has totals)
        // Note: Telemetry LLM tracking is now handled directly by the Orchestrator
        // for accurate per-turn tracking with timing (see orchestrator.ts processMessage)
        if (chunk.type === 'status' && chunk.metadata?.inputTokens !== undefined) {
          const inputTokens = chunk.metadata.inputTokens as number;
          const outputTokens = (chunk.metadata.outputTokens as number) ?? 0;

          // Update session recording metrics (track input/output separately for telemetry)
          if (recordingState) {
            recordingState.metrics.tokensUsed += inputTokens + outputTokens;
            recordingState.metrics.inputTokens += inputTokens;
            recordingState.metrics.outputTokens += outputTokens;
            recordingState.metrics.llmCalls++;
          }
          // Note: telemetry.trackLLM removed - orchestrator handles this directly
        }
      }

      // AGE-679: Removed stored rec rendering - it duplicated streaming output.
      // The agent's streaming shows findings as they're discovered. Loading stored
      // recommendations and re-rendering them was redundant and overwhelming.
      // Findings array already contains chunk findings from streaming above.

      // Record final checkpoint
      if (recordingState) {
        recordingState.phase = 'complete';
        await recordCheckpointIfActive(recordingState, 'session_end');
      }

      // Build and output final result
      const result = buildAnalyseResult(directory, scanResult, findings, startTime);

      // AGE-684: Count recommendations from storage for accurate summary
      const recCounts = await countRecommendations(directory, startTime);
      result.summary.sessionFindings = recCounts.sessionFindings;
      result.summary.totalOpen = recCounts.totalOpen;

      // Record telemetry session end (success case)
      if (telemetry.isEnabled()) {
        telemetry.sessionEnd(telemetrySessionId, {
          durationMs: Date.now() - startTime,
          toolCallCount: recordingState?.metrics.toolCalls ?? 0,
          findingCount: findings.length,
          recommendationCount: recCounts.sessionFindings ?? 0,
          totalInputTokens: recordingState?.metrics.inputTokens ?? 0,
          totalOutputTokens: recordingState?.metrics.outputTokens ?? 0,
          success: true,
          interrupted,
        });
      }

      renderer.renderComplete(result);
      renderer.flush();

      if (tuiRenderer) {
        tuiRenderer.setTuiState('presenting');
      }

      return result;
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderer.renderError(error instanceof Error ? error : new Error(errorMessage));
    renderer.flush();

    // Track error for telemetry (error type only, no message content)
    if (telemetry.isEnabled()) {
      telemetry.trackError(
        telemetrySessionId,
        error instanceof Error ? error.name : 'UnknownError'
      );
      telemetry.sessionEnd(telemetrySessionId, {
        durationMs: Date.now() - startTime,
        toolCallCount: recordingState?.metrics.toolCalls ?? 0,
        findingCount: findings.length,
        recommendationCount: 0,
        totalInputTokens: recordingState?.metrics.inputTokens ?? 0,
        totalOutputTokens: recordingState?.metrics.outputTokens ?? 0,
        success: false,
        interrupted,
      });
    }

    // Record error checkpoint before returning
    if (recordingState) {
      await recordCheckpointIfActive(recordingState, 'session_end');
    }

    // Return result with error
    return buildAnalyseResult(directory, scanResult, findings, startTime, errorMessage);
  } finally {
    // Shutdown telemetry (flushes any buffered events)
    await telemetry.shutdown();

    // Dispose orchestrator (clears sessions, stops server)
    orchestrator.dispose();

    // Stop session recording
    if (recordingState) {
      recordingState.recorder.stopRecording();
    }
    // Stop TUI renderer if present
    tuiRenderer?.stop();
    // Clean up interrupt handler (reference to the wrapper function)
    process.removeAllListeners('SIGINT');

    // Note: Don't force process.exit(0) here - let normal control flow return
    // The TUI renderer stop() and exit() callbacks handle process termination
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

// =============================================================================
// EP15 Session Analysis Mode
// =============================================================================

/**
 * Run session-specific analysis using the Session Analyst subagent.
 *
 * This mode is triggered by --session <id> and focuses on understanding
 * what happened in a specific Claude Code session.
 *
 * @param sessionId - Session ID or path to session JSONL
 * @param options - Analyse options
 * @param outputMode - Output format
 * @returns Exit code
 */
async function runSessionAnalysis(
  sessionId: string,
  options: AnalyseOptions,
  outputMode: OutputMode
): Promise<number> {
  const startTime = Date.now();

  // Initialize debug logger from CLI options
  const loggerOpts: { verbose?: boolean; quiet?: boolean; logFile?: string; noLog?: boolean } = {};
  if (options.verbose !== undefined) loggerOpts.verbose = options.verbose;
  if (options.quiet !== undefined) loggerOpts.quiet = options.quiet;
  if (options.logFile !== undefined) loggerOpts.logFile = options.logFile;
  if (options.noLog !== undefined) loggerOpts.noLog = options.noLog;
  const logger = createLoggerFromCLIOptions(loggerOpts);
  setDefaultLogger(logger);

  // Build session analyst context
  const context: SessionAnalysisContext = {
    sessionId,
    focus: 'comprehensive',
    sessionFileExists: true,
  };

  // If sessionId looks like a path, use it directly
  if (sessionId.includes('/') || sessionId.endsWith('.jsonl')) {
    context.sessionFilePath = sessionId;
  }

  // Build the Session Analyst agent
  const agent = buildSessionAnalystAgent();
  const queryPrompt = buildQueryPrompt('comprehensive', context);

  // Create tool registry and register all tools
  const registry = createToolRegistry();
  registerAllTools(registry);

  // Create orchestrator
  const verbosity = getVerbosityLevel(options);
  const orchestrator = createOrchestrator(
    {
      verbosity,
      cwd: process.cwd(),
      settingSources: [],
      systemPromptAppend: `\n\nSession Analysis Mode\n=====================\n\nYou are analyzing session: ${sanitizePromptInput(sessionId)}\n\n${sanitizePromptInput(agent.prompt)}`,
      nonInteractive: options.nonInteractive ?? false,
    },
    registry
  );

  // Create renderer
  const renderer = createRenderer(outputMode, options);

  // Set up interrupt handler
  let interrupted = false;
  const handleInterrupt = (): void => {
    if (!interrupted) {
      interrupted = true;
      orchestrator
        .interrupt()
        .then(() => {
          renderer.renderChunk({
            type: 'status',
            level: 'normal',
            content: 'Session analysis interrupted by user',
            timestamp: new Date().toISOString(),
          });
        })
        .catch((error) => {
          // Interrupt failed - log but continue shutdown
          console.error(
            'Failed to interrupt orchestrator:',
            error instanceof Error ? error.message : error
          );
        });
    }
  };
  process.on('SIGINT', handleInterrupt);

  try {
    // Header
    if (outputMode !== 'json' && !options.quiet) {
      console.log('\n=== Session Analysis ===');
      console.log(`Session: ${sessionId}`);
      console.log(`Focus: comprehensive\n`);
    }

    // Run the orchestrator with session-focused prompt
    for await (const chunk of orchestrator.run(queryPrompt)) {
      if (interrupted) break;

      if (shouldDisplay(chunk.level, verbosity)) {
        renderer.renderChunk(chunk);
      }
    }

    renderer.flush();

    const durationMs = Date.now() - startTime;
    if (outputMode !== 'json' && !options.quiet) {
      console.log(`\nSession analysis completed in ${(durationMs / 1000).toFixed(1)}s`);
    }

    return 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    renderer.renderError(error instanceof Error ? error : new Error(errorMessage));
    renderer.flush();
    return 1;
  } finally {
    orchestrator.dispose();
    process.removeListener('SIGINT', handleInterrupt);
  }
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

  // EP15: Session-specific analysis mode
  if (options.session) {
    return runSessionAnalysis(options.session, options, outputMode);
  }

  // Validate directory exists
  try {
    const stats = await stat(directory);
    if (!stats.isDirectory()) {
      const error = `Not a directory: ${directory}`;
      if (outputMode === 'json') {
        console.log(JSON.stringify({ status: 'error', error: redact(error) }, null, 2));
      } else {
        console.error(`Error: ${error}`);
      }
      return 1;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const error = `Cannot access directory: ${message}`;
    if (outputMode === 'json') {
      console.log(
        JSON.stringify(
          { status: 'error', error: redact(error), directory: redact(directory) },
          null,
          2
        )
      );
    } else {
      printIOError(error, directory);
    }
    return 1;
  }

  // Handle --clean-slate: clear existing recommendations before analysis
  // Only run if not in dry-run mode (dry-run should not modify state)
  if (options.cleanSlate && !options.dryRun) {
    const recDir = getRecommendationsDir(directory);
    const clearedCount = clearRecommendations(recDir);
    if (!options.quiet) {
      console.log(`Cleared ${clearedCount} existing recommendation(s) (--clean-slate)`);
    }
  }

  // Scan for configurations
  // Use basic scan for dry-run/static modes, comprehensive discovery for orchestrated
  const useComprehensive = !options.dryRun && !options.static;
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
  } else {
    // Default: Orchestrated analysis with Claude agent
    // Falls back to static if no LLM provider is configured
    try {
      result = await runOrchestratedAnalysis(directory, options, scanResult, outputMode);
    } catch (error) {
      // Check if this is a provider auth error
      if (error instanceof Error && error.name === 'ProviderAuthError') {
        if (outputMode !== 'json' && !options.quiet) {
          console.warn(
            'No LLM provider configured. Run "opencode auth" or set provider env vars.\n' +
              'Falling back to static analysis.\n'
          );
        }
        result = runStaticAnalysisMode(directory, options, scanResult, outputMode, verbose);
      } else {
        throw error;
      }
    }
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
