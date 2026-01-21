/**
 * Configuration hierarchy analysis
 *
 * T067: Main analyzeHierarchy() function
 * T068: Global → project → local hierarchy mapping
 * T069: Conflict detection (contradicting, overlapping)
 *
 * @module tools/config/hierarchy
 */

import * as crypto from 'node:crypto';
import type {
  ConfigHierarchy,
  AnalyzeHierarchyInput,
  AnalyzeHierarchyResult,
  ParsedConfig,
  Skill,
  EffectiveConfig,
  Conflict,
  Section,
  CodeBlock,
  ConfigMetrics,
} from './types';
import { discoverConfigs } from './discovery';
import { parseConfig } from './parse-config';
import { discoverSkills } from './skills';
import { assessQuality } from './quality';

/**
 * Patterns that indicate emphasis markers for conflict detection.
 */
const EMPHASIS_PATTERNS = {
  always: /\bALWAYS\b/gi,
  never: /\bNEVER\b/gi,
  must: /\bMUST\b/gi,
  mustNot: /\bMUST\s+NOT\b/gi,
};

/**
 * Generate a unique conflict ID.
 */
function generateConflictId(type: string, files: string[]): string {
  const hash = crypto
    .createHash('md5')
    .update(`${type}:${files.sort().join(':')}`)
    .digest('hex')
    .slice(0, 8);
  return `conflict-${type}-${hash}`;
}

/**
 * Extract emphasis-marked statements from content.
 */
function extractEmphasisStatements(
  content: string
): Array<{ type: 'always' | 'never' | 'must' | 'must-not'; text: string }> {
  const statements: Array<{
    type: 'always' | 'never' | 'must' | 'must-not';
    text: string;
  }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (EMPHASIS_PATTERNS.always.test(line)) {
      EMPHASIS_PATTERNS.always.lastIndex = 0;
      statements.push({ type: 'always', text: line.trim() });
    }
    if (EMPHASIS_PATTERNS.never.test(line)) {
      EMPHASIS_PATTERNS.never.lastIndex = 0;
      statements.push({ type: 'never', text: line.trim() });
    }
    if (EMPHASIS_PATTERNS.mustNot.test(line)) {
      EMPHASIS_PATTERNS.mustNot.lastIndex = 0;
      statements.push({ type: 'must-not', text: line.trim() });
    } else if (EMPHASIS_PATTERNS.must.test(line)) {
      EMPHASIS_PATTERNS.must.lastIndex = 0;
      statements.push({ type: 'must', text: line.trim() });
    }
  }

  return statements;
}

/**
 * Find potential conflicts between two configs.
 */
function findConflicts(config1: ParsedConfig, config2: ParsedConfig): Conflict[] {
  const conflicts: Conflict[] = [];

  // Extract emphasis statements from both configs
  const statements1 = extractEmphasisStatements(config1.raw);
  const statements2 = extractEmphasisStatements(config2.raw);

  // Check for ALWAYS in one config vs NEVER in another about similar topics
  for (const s1 of statements1) {
    for (const s2 of statements2) {
      // Check for contradicting emphasis (ALWAYS vs NEVER or similar)
      if (
        (s1.type === 'always' && s2.type === 'never') ||
        (s1.type === 'never' && s2.type === 'always') ||
        (s1.type === 'must' && s2.type === 'must-not') ||
        (s1.type === 'must-not' && s2.type === 'must')
      ) {
        // Extract keywords to compare topics (simple heuristic)
        const words1 = s1.text
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        const words2 = s2.text
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        const commonWords = words1.filter((w) => words2.includes(w));

        // If they share significant words, it might be a conflict
        if (commonWords.length >= 2) {
          conflicts.push({
            id: generateConflictId('contradicting', [config1.file.path, config2.file.path]),
            type: 'contradicting',
            description: `Potential contradiction: "${s1.text.slice(0, 50)}..." vs "${s2.text.slice(0, 50)}..."`,
            files: [config1.file, config2.file],
            positions: [],
            severity: 'high',
            resolution: `Review and reconcile the conflicting guidance between ${config1.file.relativePath} and ${config2.file.relativePath}`,
          });
        }
      }
    }
  }

  // Check for overlapping sections (same section titles with similar content)
  for (const section1 of config1.sections) {
    for (const section2 of config2.sections) {
      if (
        section1.title.toLowerCase() === section2.title.toLowerCase() &&
        section1.content.length > 20 &&
        section2.content.length > 20
      ) {
        // Check content similarity (simple approach: shared words)
        const words1 = section1.content
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        const words2 = section2.content
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        const commonWords = words1.filter((w) => words2.includes(w));
        const similarity = commonWords.length / Math.max(words1.length, words2.length);

        if (similarity > 0.5) {
          conflicts.push({
            id: generateConflictId('overlapping', [
              config1.file.path,
              config2.file.path,
              section1.title,
            ]),
            type: 'overlapping',
            description: `Overlapping section "${section1.title}" appears in both configs with similar content`,
            files: [config1.file, config2.file],
            positions: [section1.position, section2.position],
            severity: 'low',
            resolution: `Consider consolidating the "${section1.title}" section into a single location`,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Merge sections from multiple configs.
 */
function mergeSections(configs: ParsedConfig[]): Section[] {
  const allSections: Section[] = [];
  for (const config of configs) {
    allSections.push(...config.sections);
  }
  return allSections;
}

/**
 * Merge code blocks from multiple configs.
 */
function mergeCodeBlocks(configs: ParsedConfig[]): CodeBlock[] {
  const allBlocks: CodeBlock[] = [];
  for (const config of configs) {
    allBlocks.push(...config.codeBlocks);
  }
  return allBlocks;
}

/**
 * Aggregate metrics from multiple configs.
 */
function aggregateMetrics(configs: ParsedConfig[]): ConfigMetrics {
  const aggregate: ConfigMetrics = {
    lineCount: 0,
    tokenEstimate: 0,
    sectionCount: 0,
    maxHeadingDepth: 0,
    codeBlockCount: 0,
    codeBlockLanguages: [],
    emphasisMarkerCount: {
      must: 0,
      important: 0,
      critical: 0,
      never: 0,
      always: 0,
      total: 0,
    },
    linkCount: 0,
    wordCount: 0,
  };

  const allLanguages = new Set<string>();

  for (const config of configs) {
    const m = config.metrics;
    aggregate.lineCount += m.lineCount;
    aggregate.tokenEstimate += m.tokenEstimate;
    aggregate.sectionCount += m.sectionCount;
    aggregate.maxHeadingDepth = Math.max(aggregate.maxHeadingDepth, m.maxHeadingDepth);
    aggregate.codeBlockCount += m.codeBlockCount;
    aggregate.linkCount += m.linkCount;
    aggregate.wordCount += m.wordCount;

    // Merge languages
    for (const lang of m.codeBlockLanguages) {
      allLanguages.add(lang);
    }

    // Aggregate emphasis markers
    aggregate.emphasisMarkerCount.must += m.emphasisMarkerCount.must;
    aggregate.emphasisMarkerCount.important += m.emphasisMarkerCount.important;
    aggregate.emphasisMarkerCount.critical += m.emphasisMarkerCount.critical;
    aggregate.emphasisMarkerCount.never += m.emphasisMarkerCount.never;
    aggregate.emphasisMarkerCount.always += m.emphasisMarkerCount.always;
    aggregate.emphasisMarkerCount.total += m.emphasisMarkerCount.total;
  }

  aggregate.codeBlockLanguages = Array.from(allLanguages);

  return aggregate;
}

/**
 * Build the effective configuration from all parsed configs.
 */
function buildEffectiveConfig(configs: ParsedConfig[]): EffectiveConfig {
  return {
    sections: mergeSections(configs),
    codeBlocks: mergeCodeBlocks(configs),
    aggregateMetrics: aggregateMetrics(configs),
    fileCount: configs.length,
  };
}

/**
 * Get issue summary from multiple configs for hierarchy summary.
 * Per ADR-0019, returns raw counts instead of grades.
 */
function getIssuesSummary(configs: ParsedConfig[]): { totalIssues: number; criticalIssues: number } {
  let totalIssues = 0;
  let criticalIssues = 0;

  for (const config of configs) {
    const quality = assessQuality(config);
    totalIssues += quality.issues.length;
    criticalIssues += quality.issues.filter((i) => i.severity === 'critical').length;
  }

  return { totalIssues, criticalIssues };
}

/**
 * Analyze configuration hierarchy for a project.
 *
 * @param input - Analysis options
 * @returns Hierarchy analysis results with conflicts
 */
export async function analyzeHierarchy(
  input: AnalyzeHierarchyInput
): Promise<AnalyzeHierarchyResult> {
  const { cwd, includeGlobal = false } = input;

  // Discover all config files
  const discoveryResult = await discoverConfigs({
    cwd,
    includeGlobal,
    parseSkills: true,
  });

  // Parse all discovered configs
  const parsedConfigs: ParsedConfig[] = [];
  let projectConfig: ParsedConfig | undefined;
  const localConfigs: ParsedConfig[] = [];

  for (const file of discoveryResult.files) {
    // Skip non-markdown configs for now (settings.json, etc.)
    if (file.type !== 'claude-md' && file.type !== 'agents-md') {
      continue;
    }

    try {
      const parsed = await parseConfig(file.path);

      // Override the parsed file's level with the discovered file's level
      // (discovery has the correct cwd-relative level information)
      parsed.file.level = file.level;
      parsed.file.relativePath = file.relativePath;

      parsedConfigs.push(parsed);

      if (file.level === 'project') {
        projectConfig = parsed;
      } else if (file.level === 'local') {
        localConfigs.push(parsed);
      } else if (file.level === 'global' && includeGlobal) {
        // Global config is handled separately
      }
    } catch (error) {
      // Log warning but continue
      console.warn(`Warning: Failed to parse ${file.path}:`, error);
    }
  }

  // Get skills from discovery or parse them
  const skills: Skill[] = discoveryResult.parsedSkills || [];

  // If no parsed skills, try to discover them
  if (skills.length === 0) {
    try {
      const discoveredSkills = await discoverSkills({ cwd, maxDepth: 10 });
      skills.push(...discoveredSkills);
    } catch {
      // Skills discovery failed, continue without skills
    }
  }

  // Detect conflicts between configs
  const allConflicts: Conflict[] = [];
  const seenConflictIds = new Set<string>();

  // Compare project config with local configs
  if (projectConfig) {
    for (const localConfig of localConfigs) {
      const conflicts = findConflicts(projectConfig, localConfig);
      for (const conflict of conflicts) {
        if (!seenConflictIds.has(conflict.id)) {
          seenConflictIds.add(conflict.id);
          allConflicts.push(conflict);
        }
      }
    }
  }

  // Compare local configs with each other
  for (let i = 0; i < localConfigs.length; i++) {
    for (let j = i + 1; j < localConfigs.length; j++) {
      const configI = localConfigs[i];
      const configJ = localConfigs[j];
      if (configI && configJ) {
        const conflicts = findConflicts(configI, configJ);
        for (const conflict of conflicts) {
          if (!seenConflictIds.has(conflict.id)) {
            seenConflictIds.add(conflict.id);
            allConflicts.push(conflict);
          }
        }
      }
    }
  }

  // Build the hierarchy (omit optional fields if undefined due to exactOptionalPropertyTypes)
  const hierarchy: ConfigHierarchy = {
    local: localConfigs,
    skills,
    effectiveConfig: buildEffectiveConfig(parsedConfigs),
    conflicts: allConflicts,
  };

  // Only add project if it exists
  if (projectConfig !== undefined) {
    hierarchy.project = projectConfig;
  }

  // Get issue counts (per ADR-0019, raw data instead of grades)
  const issuesSummary = getIssuesSummary(parsedConfigs);

  // Build summary
  const summary = {
    globalConfigExists: includeGlobal
      ? discoveryResult.files.some((f) => f.level === 'global')
      : false,
    projectConfigExists: projectConfig !== undefined,
    localConfigCount: localConfigs.length,
    skillCount: skills.length,
    conflictCount: allConflicts.length,
    totalIssues: issuesSummary.totalIssues,
    criticalIssues: issuesSummary.criticalIssues,
  };

  return {
    hierarchy,
    summary,
  };
}
