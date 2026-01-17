/**
 * EP07 Causal Tracing Engine - Gap Analyzer
 *
 * Analyzes configuration gaps that may have enabled issues.
 * Identifies missing or incomplete guidance in CLAUDE.md,
 * settings, MCP config, and skills.
 *
 * @module src/tools/causal/gap-analyzer
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Gap, GapType, GapLocation, EvidenceItem } from './types';
import type { ConfigState, GuidanceItem } from './config-snapshot';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for gap analysis.
 */
export interface GapAnalysisOptions {
  /** Project path to analyze */
  projectPath: string;
  /** Issue description for keyword extraction */
  issueDescription?: string;
  /** Evidence items for context */
  evidence?: EvidenceItem[];
  /** Check for specific gap types only */
  checkTypes?: GapType[];
  /** Pre-captured config state snapshot (avoids re-reading files) */
  configSnapshot?: ConfigState;
}

/**
 * Result of gap analysis.
 */
export interface GapAnalysisResult {
  /** Identified gap (if any) */
  gap?: Gap;
  /** All potential gaps found */
  allGaps: Gap[];
  /** Config files checked */
  filesChecked: string[];
  /** Warnings during analysis */
  warnings?: string[];
  /** Extracted guidance items from config */
  guidance?: GuidanceItem[];
  /** Config state used for analysis (if snapshot provided) */
  configState?: ConfigState;
}

/**
 * Config file status.
 */
interface ConfigFileStatus {
  path: string;
  exists: boolean;
  location: GapLocation;
  content?: string | undefined;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Expected sections in CLAUDE.md for comprehensive guidance.
 */
const EXPECTED_SECTIONS = [
  'error handling',
  'testing',
  'code style',
  'architecture',
  'security',
  'dependencies',
];

/**
 * Gap severity ranking (higher = more severe).
 */
const GAP_SEVERITY: Record<GapType, number> = {
  missing_config: 5,
  context_loss: 4,
  missing_guidance: 3,
  terminology_gap: 2,
  missing_example: 1,
  other: 0,
};

// =============================================================================
// Gap Analyzer Class
// =============================================================================

/**
 * Analyzes configuration gaps that may have enabled issues.
 *
 * The GapAnalyzer checks for missing or incomplete configuration:
 * - CLAUDE.md file and sections
 * - Project settings (.claude/settings.json)
 * - Global settings (~/.claude/settings.json)
 * - MCP configuration (.mcp.json)
 * - Skills (.claude/skills/)
 *
 * @example
 * ```typescript
 * const analyzer = new GapAnalyzer();
 * const result = analyzer.analyzeGaps({
 *   projectPath: '/my/project',
 *   issueDescription: 'TypeError when accessing undefined property',
 * });
 *
 * if (result.gap) {
 *   console.log(`Gap found: ${result.gap.type} in ${result.gap.location}`);
 * }
 * ```
 */
export class GapAnalyzer {
  /**
   * Analyze configuration gaps for a project.
   *
   * @param options - Analysis options
   * @returns Analysis result with identified gaps
   */
  analyzeGaps(options: GapAnalysisOptions): GapAnalysisResult {
    const { projectPath, issueDescription, checkTypes, configSnapshot } = options;
    const allGaps: Gap[] = [];
    const filesChecked: string[] = [];
    const warnings: string[] = [];

    // Use snapshot if provided, otherwise read from disk
    const claudeMdStatus = configSnapshot
      ? this.getClaudeMdFromSnapshot(configSnapshot)
      : this.checkClaudeMd(projectPath);
    filesChecked.push(claudeMdStatus.path);

    if (!claudeMdStatus.exists) {
      allGaps.push({
        type: 'missing_config',
        location: 'claude_md',
        expectedGuidance: 'Project configuration and guidelines',
        counterfactual: 'If CLAUDE.md existed, the agent would have project-specific guidance',
      });
    } else if (claudeMdStatus.content) {
      // Check for missing sections
      const missingSections = this.findMissingSections(claudeMdStatus.content);
      if (missingSections.length > 0) {
        allGaps.push({
          type: 'missing_guidance',
          location: 'claude_md',
          expectedGuidance: `Missing sections: ${missingSections.join(', ')}`,
          counterfactual: 'If these sections existed, the agent would have specific guidance',
        });
      }

      // Check for missing examples
      if (!claudeMdStatus.content.includes('```')) {
        allGaps.push({
          type: 'missing_example',
          location: 'claude_md',
          expectedGuidance: 'Code examples for patterns and usage',
          counterfactual: 'If code examples existed, the agent would know the correct patterns',
        });
      }

      // Check for TODO/incomplete sections
      if (claudeMdStatus.content.includes('TODO') || claudeMdStatus.content.includes('TBD')) {
        allGaps.push({
          type: 'missing_guidance',
          location: 'claude_md',
          expectedGuidance: 'Complete guidelines (contains TODO/TBD)',
          counterfactual: 'If guidelines were complete, the agent would follow them',
        });
      }
    }

    // Check project settings
    const projectConfigStatus = configSnapshot
      ? this.getProjectConfigFromSnapshot(configSnapshot)
      : this.checkProjectConfig(projectPath);
    filesChecked.push(projectConfigStatus.path);

    if (!projectConfigStatus.exists) {
      allGaps.push({
        type: 'missing_config',
        location: 'project_config',
        expectedGuidance: 'Project-specific Claude settings',
        counterfactual: 'If project settings existed, behavior would be customized',
      });
    }

    // Check MCP config
    const mcpStatus = configSnapshot
      ? this.getMcpConfigFromSnapshot(configSnapshot)
      : this.checkMcpConfig(projectPath);
    filesChecked.push(mcpStatus.path);

    // Only flag MCP as gap if evidence suggests MCP was needed
    if (!mcpStatus.exists && this.evidenceSuggestsMcp(options.evidence)) {
      allGaps.push({
        type: 'missing_config',
        location: 'mcp_config',
        expectedGuidance: 'MCP server configuration',
        counterfactual: 'If .mcp.json existed, MCP tools would be available',
      });
    }

    // Check for terminology gaps if issue description provided
    if (issueDescription && claudeMdStatus.content) {
      const terminologyGap = this.checkTerminologyGap(issueDescription, claudeMdStatus.content);
      if (terminologyGap) {
        allGaps.push(terminologyGap);
      }
    }

    // Filter by requested types
    let filteredGaps = allGaps;
    if (checkTypes && checkTypes.length > 0) {
      filteredGaps = allGaps.filter((gap) => checkTypes.includes(gap.type));
    }

    // Sort by severity and return highest
    const sortedGaps = this.sortGapsBySeverity(filteredGaps);

    // Extract guidance if config snapshot provided
    const guidance = configSnapshot ? this.extractGuidanceFromSnapshot(configSnapshot) : undefined;

    const result: GapAnalysisResult = {
      allGaps: sortedGaps,
      filesChecked,
    };
    if (sortedGaps[0]) {
      result.gap = sortedGaps[0];
    }
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    if (guidance && guidance.length > 0) {
      result.guidance = guidance;
    }
    if (configSnapshot) {
      result.configState = configSnapshot;
    }
    return result;
  }

  /**
   * Identify the most likely gap for an issue.
   *
   * @param projectPath - Project to analyze
   * @param issueDescription - Description of the issue
   * @returns The most likely gap, or undefined if none found
   */
  identifyGap(projectPath: string, issueDescription: string): Gap | undefined {
    const result = this.analyzeGaps({
      projectPath,
      issueDescription,
    });
    return result.gap;
  }

  /**
   * Classify a gap type based on the issue context.
   *
   * @param issueDescription - Description of the issue
   * @param configContent - Content of the config file (if any)
   * @returns The classified gap type
   */
  classifyGapType(issueDescription: string, configContent: string | undefined): GapType {
    const lowerIssue = issueDescription.toLowerCase();
    const lowerConfig = configContent?.toLowerCase() ?? '';

    // No config at all
    if (!configContent) {
      return 'missing_config';
    }

    // Check for context loss patterns
    if (
      lowerIssue.includes('again') ||
      lowerIssue.includes('forgot') ||
      lowerIssue.includes('repeated')
    ) {
      return 'context_loss';
    }

    // Check for terminology issues
    const issueTerms = this.extractTerms(issueDescription);
    const undefinedTerms = issueTerms.filter((term) => !lowerConfig.includes(term.toLowerCase()));
    if (undefinedTerms.length > 0) {
      return 'terminology_gap';
    }

    // Check for missing examples
    if (
      lowerIssue.includes('pattern') ||
      lowerIssue.includes('example') ||
      lowerIssue.includes('how to')
    ) {
      if (!configContent.includes('```')) {
        return 'missing_example';
      }
    }

    // Default to missing guidance
    return 'missing_guidance';
  }

  /**
   * Generate a counterfactual statement for a gap.
   *
   * @param gap - The gap to generate counterfactual for
   * @returns Counterfactual string
   */
  generateCounterfactual(gap: Omit<Gap, 'counterfactual'>): string {
    const locationName = this.getLocationName(gap.location);

    return `If "${gap.expectedGuidance}" were documented in ${locationName}, this issue would have been prevented`;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Check CLAUDE.md file status.
   */
  private checkClaudeMd(projectPath: string): ConfigFileStatus {
    const path = join(projectPath, 'CLAUDE.md');
    const exists = existsSync(path);

    const result: ConfigFileStatus = { path, exists, location: 'claude_md' };

    if (exists) {
      try {
        result.content = readFileSync(path, 'utf-8');
      } catch {
        // Could not read file
      }
    }

    return result;
  }

  /**
   * Get CLAUDE.md status from a config snapshot.
   */
  private getClaudeMdFromSnapshot(snapshot: ConfigState): ConfigFileStatus {
    const path = join(snapshot.projectPath, 'CLAUDE.md');
    return {
      path,
      exists: !!snapshot.claudeMd,
      location: 'claude_md',
      content: snapshot.claudeMd?.content,
    };
  }

  /**
   * Get project settings status from a config snapshot.
   */
  private getProjectConfigFromSnapshot(snapshot: ConfigState): ConfigFileStatus {
    const path = join(snapshot.projectPath, '.claude', 'settings.json');
    return {
      path,
      exists: !!snapshot.projectSettings,
      location: 'project_config',
    };
  }

  /**
   * Get MCP config status from a config snapshot.
   */
  private getMcpConfigFromSnapshot(snapshot: ConfigState): ConfigFileStatus {
    const path = join(snapshot.projectPath, '.mcp.json');
    return {
      path,
      exists: !!snapshot.mcpConfig,
      location: 'mcp_config',
    };
  }

  /**
   * Extract guidance items from a config snapshot.
   */
  private extractGuidanceFromSnapshot(snapshot: ConfigState): GuidanceItem[] {
    const guidance: GuidanceItem[] = [];

    if (!snapshot.claudeMd?.content) {
      return guidance;
    }

    const content = snapshot.claudeMd.content;
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
      if (headerMatch) {
        // Save previous section if exists
        if (currentHeader) {
          sections.push({
            header: currentHeader,
            content: currentContent.join('\n').trim(),
          });
        }
        currentHeader = headerMatch[1]!;
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

  /**
   * Check project settings file status.
   */
  private checkProjectConfig(projectPath: string): ConfigFileStatus {
    const path = join(projectPath, '.claude', 'settings.json');
    return { path, exists: existsSync(path), location: 'project_config' };
  }

  /**
   * Check MCP config file status.
   */
  private checkMcpConfig(projectPath: string): ConfigFileStatus {
    const path = join(projectPath, '.mcp.json');
    return { path, exists: existsSync(path), location: 'mcp_config' };
  }

  /**
   * Find missing sections in CLAUDE.md content.
   */
  private findMissingSections(content: string): string[] {
    const lowerContent = content.toLowerCase();
    return EXPECTED_SECTIONS.filter((section) => !lowerContent.includes(section));
  }

  /**
   * Check if evidence suggests MCP tools were needed.
   */
  private evidenceSuggestsMcp(evidence?: EvidenceItem[]): boolean {
    if (!evidence) return false;

    return evidence.some(
      (e) =>
        e.content?.toLowerCase().includes('mcp') ||
        e.content?.toLowerCase().includes('tool') ||
        e.metadata?.toolName
    );
  }

  /**
   * Check for terminology gaps between issue and config.
   */
  private checkTerminologyGap(issueDescription: string, configContent: string): Gap | undefined {
    const terms = this.extractTerms(issueDescription);
    const lowerConfig = configContent.toLowerCase();

    const undefinedTerms = terms.filter((term) => !lowerConfig.includes(term.toLowerCase()));

    if (undefinedTerms.length >= 2) {
      return {
        type: 'terminology_gap',
        location: 'claude_md',
        expectedGuidance: `Definition of terms: ${undefinedTerms.slice(0, 3).join(', ')}`,
        counterfactual: 'If terms were defined, the agent would use correct terminology',
      };
    }

    return undefined;
  }

  /**
   * Extract potential domain terms from text.
   */
  private extractTerms(text: string): string[] {
    // Extract capitalized words (potential domain terms)
    const capitalizedPattern = /[A-Z][a-z]+(?:[A-Z][a-z]+)*/g;
    const matches = text.match(capitalizedPattern) ?? [];

    // Filter out common words
    const commonWords = new Set([
      'The',
      'This',
      'That',
      'These',
      'Those',
      'Error',
      'Warning',
      'Type',
      'Cannot',
      'Could',
      'Should',
      'Would',
    ]);

    return matches.filter((term) => term.length > 3 && !commonWords.has(term));
  }

  /**
   * Sort gaps by severity (highest first).
   */
  private sortGapsBySeverity(gaps: Gap[]): Gap[] {
    return [...gaps].sort((a, b) => GAP_SEVERITY[b.type] - GAP_SEVERITY[a.type]);
  }

  /**
   * Get human-readable location name.
   */
  private getLocationName(location: GapLocation): string {
    const names: Record<GapLocation, string> = {
      claude_md: 'CLAUDE.md',
      global_config: '~/.claude/settings.json',
      project_config: '.claude/settings.json',
      mcp_config: '.mcp.json',
      skill: '.claude/skills/',
      other: 'configuration',
    };
    return names[location];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new GapAnalyzer instance.
 *
 * @returns GapAnalyzer instance
 */
export function createGapAnalyzer(): GapAnalyzer {
  return new GapAnalyzer();
}
