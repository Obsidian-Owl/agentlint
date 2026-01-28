/**
 * EP02 Orchestration Core - Configuration
 *
 * Functions for loading and managing orchestrator configuration.
 * Configuration is loaded from ~/.agentlint/config.json with defaults.
 *
 * @module orchestration/config
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { OrchestratorConfig, AgentlintGlobalConfig, VerbosityLevel } from './types';
import { redact } from '../debug/redaction';

// =============================================================================
// Constants
// =============================================================================

/** Default Claude model to use */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/** Default checkpoint interval (1 minute) */
const DEFAULT_CHECKPOINT_INTERVAL_MS = 60000;

/** Default verbosity level */
const DEFAULT_VERBOSITY: VerbosityLevel = 'normal';

/** Default setting sources (must include 'project' for CLAUDE.md) */
const DEFAULT_SETTING_SOURCES: ('user' | 'project' | 'local')[] = ['project'];

/** Default subagent depth (0 = main orchestrator) */
const DEFAULT_DEPTH = 0;

/** Maximum allowed subagent depth per Constitution Principle C8 */
export const MAX_SUBAGENT_DEPTH = 1;

/** Config directory path */
const CONFIG_DIR = path.join(os.homedir(), '.agentlint');

/** Config file path */
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default allowed tools.
 * Includes 'Task' for subagent invocation (EP08) and all agentlint MCP tools.
 * MCP tools use the prefix 'mcp__agentlint__' per SDK convention.
 *
 * Built-in SDK tools:
 * - Read-only tools (Read, Glob, Grep) are auto-allowed for analysis
 * - Write/Edit/Bash are NOT included - SDK will prompt user for these
 */
const DEFAULT_ALLOWED_TOOLS: string[] = [
  // Subagent invocation
  'Task',
  // Built-in SDK read-only tools (safe for analysis)
  'Read',
  'Glob',
  'Grep',
  // WebSearch for fact verification (model names, API versions, etc.)
  'WebSearch',
  // EP05 Config analysis tools
  'mcp__agentlint__discover_configs',
  'mcp__agentlint__parse_config',
  'mcp__agentlint__analyze_hierarchy',
  // EP06 Session analysis tools
  'mcp__agentlint__search_sessions',
  'mcp__agentlint__get_session_stats',
  // EP09 Temporal analysis tools
  'mcp__agentlint__store_baseline',
  'mcp__agentlint__query_baseline',
  'mcp__agentlint__list_baselines',
  'mcp__agentlint__calculate_delta',
  'mcp__agentlint__query_trends',
  'mcp__agentlint__conduct_review',
  'mcp__agentlint__get_review_history',
  'mcp__agentlint__spawn_temporal_analyst',
  // Causal analysis tools
  'mcp__agentlint__get_issue_patterns',
  'mcp__agentlint__trace_issue_origin',
  // Security tools
  'mcp__agentlint__classify_secret',
  // EP10 Recommendation tools
  'mcp__agentlint__create_recommendation',
  'mcp__agentlint__list_recommendations',
  'mcp__agentlint__refine_recommendation',
  'mcp__agentlint__add_recommendation_event',
  'mcp__agentlint__complete_recommendation',
  'mcp__agentlint__get_recommendation_summary',
  'mcp__agentlint__update_recommendation_status',
  'mcp__agentlint__get_recommendation',
  'mcp__agentlint__spawn_recommendation_advisor',
];

/**
 * Get the default orchestrator configuration.
 * These defaults are used when no config file exists or values are missing.
 */
/**
 * Config type with all required fields except canUseTool and telemetry fields which remain optional.
 * Note: We use Pick<Required<OrchestratorConfig>, K> to get the non-undefined types for optional fields.
 * This is necessary for exactOptionalPropertyTypes compliance.
 */
export type ResolvedOrchestratorConfig = Required<
  Omit<
    OrchestratorConfig,
    'canUseTool' | 'telemetryClient' | 'telemetrySessionId' | 'telemetryParentEventId'
  >
> & {
  canUseTool?: Pick<Required<OrchestratorConfig>, 'canUseTool'>['canUseTool'];
  telemetryClient?: Pick<Required<OrchestratorConfig>, 'telemetryClient'>['telemetryClient'];
  telemetrySessionId?: Pick<
    Required<OrchestratorConfig>,
    'telemetrySessionId'
  >['telemetrySessionId'];
  telemetryParentEventId?: Pick<
    Required<OrchestratorConfig>,
    'telemetryParentEventId'
  >['telemetryParentEventId'];
};

export function getDefaultConfig(): ResolvedOrchestratorConfig {
  return {
    model: DEFAULT_MODEL,
    checkpointIntervalMs: DEFAULT_CHECKPOINT_INTERVAL_MS,
    verbosity: DEFAULT_VERBOSITY,
    cwd: process.cwd(),
    systemPromptAppend: '',
    settingSources: DEFAULT_SETTING_SOURCES,
    depth: DEFAULT_DEPTH,
    allowedTools: DEFAULT_ALLOWED_TOOLS,
    nonInteractive: false,
  };
}

/**
 * Get the default global configuration.
 * Used when creating a new config file.
 */
export function getDefaultGlobalConfig(): AgentlintGlobalConfig {
  return {
    model: DEFAULT_MODEL,
    checkpoint: {
      intervalMs: DEFAULT_CHECKPOINT_INTERVAL_MS,
    },
    verbosity: DEFAULT_VERBOSITY,
  };
}

// =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Load configuration from ~/.agentlint/config.json.
 * Missing values are filled with defaults.
 *
 * @param overrides - Optional overrides to apply on top of loaded config
 * @returns Fully populated orchestrator configuration
 */
export function loadConfig(overrides?: Partial<OrchestratorConfig>): ResolvedOrchestratorConfig {
  const defaults = getDefaultConfig();
  const fileConfig = loadConfigFile();

  // Merge: defaults <- file config <- overrides
  const result: ResolvedOrchestratorConfig = {
    model: overrides?.model ?? fileConfig?.model ?? defaults.model,
    checkpointIntervalMs:
      overrides?.checkpointIntervalMs ??
      fileConfig?.checkpoint?.intervalMs ??
      defaults.checkpointIntervalMs,
    verbosity: overrides?.verbosity ?? fileConfig?.verbosity ?? defaults.verbosity,
    cwd: overrides?.cwd ?? defaults.cwd,
    systemPromptAppend: overrides?.systemPromptAppend ?? defaults.systemPromptAppend,
    settingSources: overrides?.settingSources ?? defaults.settingSources,
    depth: overrides?.depth ?? defaults.depth,
    allowedTools: overrides?.allowedTools ?? defaults.allowedTools,
    nonInteractive: overrides?.nonInteractive ?? defaults.nonInteractive,
  };

  // Only add canUseTool if provided (to satisfy exactOptionalPropertyTypes)
  if (overrides?.canUseTool) {
    result.canUseTool = overrides.canUseTool;
  }

  return result;
}

/**
 * Load the global config file if it exists.
 * Returns null if file doesn't exist or is invalid.
 */
function loadConfigFile(): AgentlintGlobalConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null;
    }

    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(content) as unknown;

    // Basic validation
    if (!isValidGlobalConfig(parsed)) {
      console.warn(`Warning: Invalid config file at ${redact(CONFIG_FILE)}, using defaults`);
      return null;
    }

    return parsed;
  } catch {
    console.warn(`Warning: Failed to load config file at ${redact(CONFIG_FILE)}, using defaults`);
    return null;
  }
}

/**
 * Validate that an object is a valid AgentlintGlobalConfig.
 */
function isValidGlobalConfig(obj: unknown): obj is AgentlintGlobalConfig {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  // model must be string if present
  if (config.model !== undefined && typeof config.model !== 'string') {
    return false;
  }

  // checkpoint must be object with intervalMs if present
  if (config.checkpoint !== undefined) {
    if (typeof config.checkpoint !== 'object' || config.checkpoint === null) {
      return false;
    }
    const checkpoint = config.checkpoint as Record<string, unknown>;
    if (checkpoint.intervalMs !== undefined && typeof checkpoint.intervalMs !== 'number') {
      return false;
    }
  }

  // verbosity must be valid enum if present
  if (config.verbosity !== undefined) {
    const validVerbosity = ['quiet', 'normal', 'verbose', 'debug'];
    if (!validVerbosity.includes(config.verbosity as string)) {
      return false;
    }
  }

  return true;
}

// =============================================================================
// Configuration Persistence
// =============================================================================

/**
 * Save global configuration to ~/.agentlint/config.json.
 * Creates the directory if it doesn't exist.
 *
 * @param config - The configuration to save
 */
export function saveGlobalConfig(config: AgentlintGlobalConfig): void {
  // Ensure directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Write config file
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Initialize the config directory and file with defaults.
 * Does nothing if config already exists.
 *
 * @returns true if config was created, false if it already existed
 */
export function initializeConfig(): boolean {
  if (fs.existsSync(CONFIG_FILE)) {
    return false;
  }

  saveGlobalConfig(getDefaultGlobalConfig());
  return true;
}

// =============================================================================
// Configuration Utilities
// =============================================================================

/**
 * Get the config directory path.
 */
export function getConfigDir(): string {
  return CONFIG_DIR;
}

/**
 * Get the config file path.
 */
export function getConfigFilePath(): string {
  return CONFIG_FILE;
}

/**
 * Check if a config file exists.
 */
export function configFileExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

/**
 * Merge partial config with defaults.
 * Useful for applying user-provided options.
 *
 * @param partial - Partial configuration
 * @returns Fully populated configuration
 */
export function mergeWithDefaults(
  partial: Partial<OrchestratorConfig>
): ResolvedOrchestratorConfig {
  const defaults = getDefaultConfig();
  const result: ResolvedOrchestratorConfig = {
    model: partial.model ?? defaults.model,
    checkpointIntervalMs: partial.checkpointIntervalMs ?? defaults.checkpointIntervalMs,
    verbosity: partial.verbosity ?? defaults.verbosity,
    cwd: partial.cwd ?? defaults.cwd,
    systemPromptAppend: partial.systemPromptAppend ?? defaults.systemPromptAppend,
    settingSources: partial.settingSources ?? defaults.settingSources,
    depth: partial.depth ?? defaults.depth,
    allowedTools: partial.allowedTools ?? defaults.allowedTools,
    nonInteractive: partial.nonInteractive ?? defaults.nonInteractive,
  };

  // Only add canUseTool if provided (to satisfy exactOptionalPropertyTypes)
  if (partial.canUseTool) {
    result.canUseTool = partial.canUseTool;
  }

  return result;
}
