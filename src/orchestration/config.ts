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
import type {
  OrchestratorConfig,
  AgentlintGlobalConfig,
  VerbosityLevel,
} from './types';

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

/** Config directory path */
const CONFIG_DIR = path.join(os.homedir(), '.agentlint');

/** Config file path */
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Get the default orchestrator configuration.
 * These defaults are used when no config file exists or values are missing.
 */
export function getDefaultConfig(): Required<OrchestratorConfig> {
  return {
    model: DEFAULT_MODEL,
    checkpointIntervalMs: DEFAULT_CHECKPOINT_INTERVAL_MS,
    verbosity: DEFAULT_VERBOSITY,
    cwd: process.cwd(),
    systemPromptAppend: '',
    settingSources: DEFAULT_SETTING_SOURCES,
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
export function loadConfig(
  overrides?: Partial<OrchestratorConfig>
): Required<OrchestratorConfig> {
  const defaults = getDefaultConfig();
  const fileConfig = loadConfigFile();

  // Merge: defaults <- file config <- overrides
  return {
    model: overrides?.model ?? fileConfig?.model ?? defaults.model,
    checkpointIntervalMs:
      overrides?.checkpointIntervalMs ??
      fileConfig?.checkpoint?.intervalMs ??
      defaults.checkpointIntervalMs,
    verbosity:
      overrides?.verbosity ?? fileConfig?.verbosity ?? defaults.verbosity,
    cwd: overrides?.cwd ?? defaults.cwd,
    systemPromptAppend:
      overrides?.systemPromptAppend ?? defaults.systemPromptAppend,
    settingSources: overrides?.settingSources ?? defaults.settingSources,
  };
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
      console.warn(
        `Warning: Invalid config file at ${CONFIG_FILE}, using defaults`
      );
      return null;
    }

    return parsed;
  } catch {
    console.warn(
      `Warning: Failed to load config file at ${CONFIG_FILE}, using defaults`
    );
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
    if (
      checkpoint.intervalMs !== undefined &&
      typeof checkpoint.intervalMs !== 'number'
    ) {
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
): Required<OrchestratorConfig> {
  const defaults = getDefaultConfig();
  return {
    model: partial.model ?? defaults.model,
    checkpointIntervalMs:
      partial.checkpointIntervalMs ?? defaults.checkpointIntervalMs,
    verbosity: partial.verbosity ?? defaults.verbosity,
    cwd: partial.cwd ?? defaults.cwd,
    systemPromptAppend: partial.systemPromptAppend ?? defaults.systemPromptAppend,
    settingSources: partial.settingSources ?? defaults.settingSources,
  };
}
