/**
 * EP07 Causal Tracing Engine - Config State Snapshot
 *
 * Captures configuration state (CLAUDE.md, settings.json, .mcp.json)
 * at the time an issue was detected for causal analysis.
 *
 * @module src/tools/causal/config-snapshot
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Stable JSON comparison that handles property ordering differences.
 * Sorts object keys recursively before stringifying.
 */
function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify((obj as Record<string, unknown>)[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

// =============================================================================
// Types
// =============================================================================

/**
 * CLAUDE.md content and metadata.
 */
export interface ClaudeMdContent {
  /** Full content of the file */
  content: string;
  /** File path */
  path: string;
}

/**
 * Extracted guidance from CLAUDE.md.
 */
export interface GuidanceItem {
  /** Topic or section header */
  topic: string;
  /** Content of the guidance */
  content: string;
  /** Category of guidance */
  category: 'convention' | 'security' | 'process' | 'other';
  /** Source section in CLAUDE.md */
  source: string;
}

/**
 * Change detected between two config states.
 */
export interface ConfigChange {
  /** Type of change */
  type: 'added' | 'removed' | 'modified';
  /** File that changed */
  file: string;
  /** Description of the change */
  description?: string;
}

/**
 * Result of comparing two config states.
 */
export interface ConfigDiff {
  /** List of changes */
  changes: ConfigChange[];
  /** Whether any changes were detected */
  hasChanges: boolean;
}

/**
 * Captured configuration state at a point in time.
 */
export interface ConfigState {
  /** Project directory path */
  projectPath: string;
  /** ISO timestamp when state was captured */
  capturedAt: string;
  /** CLAUDE.md content if present */
  claudeMd?: ClaudeMdContent;
  /** Parsed settings.json if present */
  projectSettings?: Record<string, unknown>;
  /** Parsed .mcp.json if present */
  mcpConfig?: Record<string, unknown>;
  /** Warnings encountered during capture */
  warnings?: string[];
}

// =============================================================================
// ConfigSnapshot Class
// =============================================================================

/**
 * Captures and compares configuration state for causal analysis.
 *
 * @example
 * ```typescript
 * const snapshot = new ConfigSnapshot('/my/project');
 *
 * // Capture current state
 * const state = snapshot.capture();
 * console.log(state.claudeMd?.content);
 *
 * // Compare states
 * const before = snapshot.capture();
 * // ... make changes ...
 * const after = snapshot.capture();
 * const diff = snapshot.compare(before, after);
 *
 * // Extract guidance
 * const guidance = snapshot.extractGuidance(state);
 * ```
 */
export class ConfigSnapshot {
  private readonly projectPath: string;

  /**
   * Create a new ConfigSnapshot.
   *
   * @param projectPath - Path to the project directory
   */
  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Capture the current configuration state.
   *
   * @returns The captured configuration state
   */
  capture(): ConfigState {
    const warnings: string[] = [];
    const capturedAt = new Date().toISOString();

    // Capture CLAUDE.md
    const claudeMd = this.captureClaudeMd();

    // Capture settings.json
    const { settings: projectSettings, warning: settingsWarning } = this.captureSettings();
    if (settingsWarning) {
      warnings.push(settingsWarning);
    }

    // Capture .mcp.json
    const { config: mcpConfig, warning: mcpWarning } = this.captureMcpConfig();
    if (mcpWarning) {
      warnings.push(mcpWarning);
    }

    const result: ConfigState = {
      projectPath: this.projectPath,
      capturedAt,
    };
    if (claudeMd) result.claudeMd = claudeMd;
    if (projectSettings) result.projectSettings = projectSettings;
    if (mcpConfig) result.mcpConfig = mcpConfig;
    if (warnings.length > 0) result.warnings = warnings;
    return result;
  }

  /**
   * Compare two configuration states and return the differences.
   *
   * @param before - The earlier state
   * @param after - The later state
   * @returns The differences between the states
   */
  compare(before: ConfigState, after: ConfigState): ConfigDiff {
    const changes: ConfigChange[] = [];

    // Compare CLAUDE.md
    if (!before.claudeMd && after.claudeMd) {
      changes.push({ type: 'added', file: 'CLAUDE.md' });
    } else if (before.claudeMd && !after.claudeMd) {
      changes.push({ type: 'removed', file: 'CLAUDE.md' });
    } else if (before.claudeMd && after.claudeMd) {
      if (before.claudeMd.content !== after.claudeMd.content) {
        changes.push({ type: 'modified', file: 'CLAUDE.md' });
      }
    }

    // Compare settings.json
    if (!before.projectSettings && after.projectSettings) {
      changes.push({ type: 'added', file: 'settings.json' });
    } else if (before.projectSettings && !after.projectSettings) {
      changes.push({ type: 'removed', file: 'settings.json' });
    } else if (before.projectSettings && after.projectSettings) {
      if (stableStringify(before.projectSettings) !== stableStringify(after.projectSettings)) {
        changes.push({ type: 'modified', file: 'settings.json' });
      }
    }

    // Compare .mcp.json
    if (!before.mcpConfig && after.mcpConfig) {
      changes.push({ type: 'added', file: '.mcp.json' });
    } else if (before.mcpConfig && !after.mcpConfig) {
      changes.push({ type: 'removed', file: '.mcp.json' });
    } else if (before.mcpConfig && after.mcpConfig) {
      if (stableStringify(before.mcpConfig) !== stableStringify(after.mcpConfig)) {
        changes.push({ type: 'modified', file: '.mcp.json' });
      }
    }

    return {
      changes,
      hasChanges: changes.length > 0,
    };
  }

  /**
   * Extract guidance items from the configuration state.
   *
   * Parses CLAUDE.md to extract structured guidance about conventions,
   * security practices, and processes.
   *
   * @param state - The configuration state to extract from
   * @returns Array of guidance items
   */
  extractGuidance(state: ConfigState): GuidanceItem[] {
    const guidance: GuidanceItem[] = [];

    if (!state.claudeMd?.content) {
      return guidance;
    }

    const content = state.claudeMd.content;
    const sections = this.parseSections(content);

    for (const section of sections) {
      const category = this.categorizeSection(section.header, section.content);

      // Extract individual guidance items from section
      const items = this.extractItemsFromSection(section);

      for (const item of items) {
        guidance.push({
          topic: section.header,
          content: item,
          category,
          source: `CLAUDE.md#${section.header}`,
        });
      }
    }

    return guidance;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Capture CLAUDE.md content.
   */
  private captureClaudeMd(): ClaudeMdContent | undefined {
    const claudeMdPath = join(this.projectPath, 'CLAUDE.md');

    if (!existsSync(claudeMdPath)) {
      return undefined;
    }

    try {
      const content = readFileSync(claudeMdPath, 'utf-8');
      return {
        content,
        path: claudeMdPath,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Capture settings.json content.
   */
  private captureSettings(): {
    settings?: Record<string, unknown>;
    warning?: string;
  } {
    const settingsPath = join(this.projectPath, '.claude', 'settings.json');

    if (!existsSync(settingsPath)) {
      return {};
    }

    try {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;
      return { settings };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { warning: `Failed to parse settings.json: ${message}` };
    }
  }

  /**
   * Capture .mcp.json content.
   */
  private captureMcpConfig(): {
    config?: Record<string, unknown>;
    warning?: string;
  } {
    const mcpPath = join(this.projectPath, '.mcp.json');

    if (!existsSync(mcpPath)) {
      return {};
    }

    try {
      const content = readFileSync(mcpPath, 'utf-8');
      const config = JSON.parse(content) as Record<string, unknown>;
      return { config };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { warning: `Failed to parse .mcp.json: ${message}` };
    }
  }

  /**
   * Parse markdown content into sections.
   */
  private parseSections(content: string): Array<{ header: string; content: string }> {
    const sections: Array<{ header: string; content: string }> = [];
    const lines = content.split('\n');

    let currentHeader = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headerMatch && headerMatch[1]) {
        // Save previous section if exists
        if (currentHeader) {
          sections.push({
            header: currentHeader,
            content: currentContent.join('\n').trim(),
          });
        }
        currentHeader = headerMatch[1];
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentHeader) {
      sections.push({
        header: currentHeader,
        content: currentContent.join('\n').trim(),
      });
    }

    return sections;
  }

  /**
   * Categorize a section based on its header and content.
   */
  private categorizeSection(
    header: string,
    content: string
  ): 'convention' | 'security' | 'process' | 'other' {
    const headerLower = header.toLowerCase();
    const contentLower = content.toLowerCase();

    // Security keywords
    const securityKeywords = [
      'secret',
      'api key',
      'password',
      'credential',
      'token',
      'security',
      'auth',
      'never commit',
      'sensitive',
    ];
    for (const keyword of securityKeywords) {
      if (headerLower.includes(keyword) || contentLower.includes(keyword)) {
        return 'security';
      }
    }

    // Convention keywords
    const conventionKeywords = [
      'guideline',
      'convention',
      'style',
      'naming',
      'format',
      'pattern',
      'use typescript',
      'follow',
    ];
    for (const keyword of conventionKeywords) {
      if (headerLower.includes(keyword) || contentLower.includes(keyword)) {
        return 'convention';
      }
    }

    // Process keywords
    const processKeywords = [
      'workflow',
      'process',
      'step',
      'procedure',
      'how to',
      'getting started',
      'setup',
    ];
    for (const keyword of processKeywords) {
      if (headerLower.includes(keyword) || contentLower.includes(keyword)) {
        return 'process';
      }
    }

    return 'other';
  }

  /**
   * Extract individual guidance items from a section.
   */
  private extractItemsFromSection(section: { header: string; content: string }): string[] {
    const items: string[] = [];
    const lines = section.content.split('\n');

    for (const line of lines) {
      // Extract list items
      const listMatch = line.match(/^[-*]\s+(.+)$/);
      if (listMatch) {
        items.push(listMatch[1]!.trim());
      }
    }

    // If no list items, use the whole content if it's meaningful
    if (items.length === 0 && section.content.trim().length > 10) {
      items.push(section.content.trim());
    }

    return items;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a new ConfigSnapshot instance.
 *
 * @param projectPath - Path to the project directory
 * @returns ConfigSnapshot instance
 */
export function createConfigSnapshot(projectPath: string): ConfigSnapshot {
  return new ConfigSnapshot(projectPath);
}

/**
 * Capture configuration state with a single call.
 *
 * Convenience function that creates a snapshot and captures state.
 *
 * @param projectPath - Path to the project directory
 * @returns The captured configuration state
 */
export function captureConfigState(projectPath: string): ConfigState {
  const snapshot = new ConfigSnapshot(projectPath);
  return snapshot.capture();
}
