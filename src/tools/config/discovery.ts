/**
 * Configuration file discovery
 *
 * T022: Main discoverConfigs() function
 * T023: CLAUDE.md detection
 * T024: AGENTS.md detection
 * T025: .claude/ directory structure detection
 * T026: Configurable exclusion patterns
 *
 * @module tools/config/discovery
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import fg from 'fast-glob';
import type {
  ConfigFile,
  ConfigType,
  ACTType,
  HierarchyLevel,
  DiscoverConfigsInput,
  DiscoverConfigsResult,
  Skill,
} from './types';
import { parseSkill } from './skills';
import { redact } from '../../debug/redaction';

/**
 * Default directory patterns to exclude from discovery.
 * These are common directories that should never contain user configs.
 */
export const DEFAULT_EXCLUSIONS = [
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'vendor',
  '.turbo',
  '.vercel',
  '.cache',
] as const;

/**
 * Config file patterns to search for.
 * Extended for AGE-666 to include more Claude config types.
 * Extended for remediation to include rules, agents, and commands.
 *
 * Official Claude Code structure:
 * - Skills: .claude/skills/<name>/SKILL.md (subdirectory with SKILL.md)
 * - Rules: .claude/rules/**\/*.md (any .md files, supports subdirs, path targeting)
 * - Agents: .claude/agents/*.md (markdown with YAML frontmatter)
 * - Commands: .claude/commands/*.md (legacy, merged into skills)
 */
const CONFIG_PATTERNS = {
  claudeMd: ['**/CLAUDE.md', '**/claude.md'],
  agentsMd: ['**/AGENTS.md', '**/agents.md'],
  settings: ['**/settings.json', '**/.claude/settings.json'],
  settingsLocal: ['**/.claude/settings.local.json'],
  mcpJson: ['**/.mcp.json'],
  hooks: ['**/.claude/hooks/*'],
  // FIX: Skills are in subdirectories: skills/<name>/SKILL.md
  skillMd: ['**/.claude/skills/*/SKILL.md', '**/SKILL.md'],
  // NEW: Rules - any .md in rules/ recursively
  rules: ['**/.claude/rules/**/*.md'],
  // NEW: Agents (subagents) - .md files in agents/
  agents: ['**/.claude/agents/*.md'],
  // NEW: Commands (legacy, deprecated but supported)
  commands: ['**/.claude/commands/*.md'],
} as const;

/**
 * Determine ConfigType from file path.
 * Extended for AGE-666 to handle more Claude config types.
 * Extended for remediation to detect rules, agents, and commands.
 */
function getConfigType(filePath: string): ConfigType {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const basename = path.basename(filePath).toLowerCase();
  const parentDir = path.basename(path.dirname(filePath));
  const grandparentDir = path.basename(path.dirname(path.dirname(filePath)));

  if (basename === 'claude.md') {
    return 'claude-md';
  }
  if (basename === 'agents.md') {
    return 'agents-md';
  }
  // .claude/settings.local.json (AGE-666)
  if (basename === 'settings.local.json' && parentDir === '.claude') {
    return 'claude-settings-local';
  }
  // .claude/settings.json or any settings.json
  if (basename === 'settings.json' && parentDir === '.claude') {
    return 'claude-settings';
  }
  if (basename === 'settings.json') {
    return 'claude-settings';
  }
  // .mcp.json (AGE-666)
  if (basename === '.mcp.json') {
    return 'mcp-json';
  }
  // .claude/hooks/* (AGE-666)
  if (parentDir === 'hooks' && grandparentDir === '.claude') {
    return 'claude-hook';
  }

  // Exclude README.md files - they are documentation, not config definitions
  if (basename === 'readme.md') {
    return 'unknown';
  }

  // Detect new Claude Code config types by path structure
  const pathParts = normalizedPath.split('/');
  const claudeIdx = pathParts.indexOf('.claude');

  if (claudeIdx !== -1 && claudeIdx + 1 < pathParts.length) {
    const subdir = pathParts[claudeIdx + 1];

    // .claude/rules/**/*.md - rule files (any .md recursively)
    if (subdir === 'rules' && basename.endsWith('.md')) {
      return 'claude-rule';
    }
    // .claude/agents/*.md - agent/subagent definitions
    if (subdir === 'agents' && basename.endsWith('.md')) {
      return 'claude-agent';
    }
    // .claude/commands/*.md - legacy slash commands (deprecated but supported)
    if (subdir === 'commands' && basename.endsWith('.md')) {
      return 'claude-command';
    }
    // .claude/skills/*/SKILL.md - skill definitions (directory structure)
    if (subdir === 'skills' && basename === 'skill.md') {
      return 'skill-md';
    }
  }

  // Standalone SKILL.md files (outside .claude directory)
  if (basename === 'skill.md') {
    return 'skill-md';
  }

  return 'unknown';
}

/**
 * Determine ACTType from ConfigType.
 * Extended for AGE-666 to handle more Claude config types.
 * Extended for remediation to handle rules, agents, and commands.
 */
function getACTType(configType: ConfigType): ACTType {
  switch (configType) {
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
      return 'agents-md';
    case 'cursor-rules':
      return 'cursor';
    default:
      return 'unknown';
  }
}

/**
 * Determine hierarchy level from file path.
 */
function getHierarchyLevel(filePath: string, cwd: string, isGlobal: boolean): HierarchyLevel {
  if (isGlobal) {
    return 'global';
  }

  const relativePath = path.relative(cwd, filePath);
  const depth = relativePath.split(path.sep).length - 1;

  // Root level config (depth 0, e.g., CLAUDE.md directly in cwd)
  if (depth === 0) {
    return 'project';
  }

  // Any nested config is 'local'
  return 'local';
}

/**
 * Build exclusion patterns for fast-glob.
 */
function buildExclusionPatterns(customExclusions: string[] = []): string[] {
  const allExclusions = [...DEFAULT_EXCLUSIONS, ...customExclusions];
  return allExclusions.map((dir) => `**/${dir}/**`);
}

/**
 * Get file metadata (size, lastModified).
 */
function getFileMetadata(filePath: string): { size: number; lastModified: Date } | null {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      lastModified: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Discover global configs in ~/.claude/ directory.
 */
async function discoverGlobalConfigs(): Promise<ConfigFile[]> {
  const results: ConfigFile[] = [];
  const homeDir = os.homedir();
  const globalClaudeDir = path.join(homeDir, '.claude');
  const globalClaudeMd = path.join(globalClaudeDir, 'CLAUDE.md');

  // Check for ~/.claude/CLAUDE.md
  if (fs.existsSync(globalClaudeMd)) {
    const metadata = getFileMetadata(globalClaudeMd);
    if (metadata) {
      results.push({
        path: globalClaudeMd,
        relativePath: '.claude/CLAUDE.md',
        type: 'claude-md',
        size: metadata.size,
        lastModified: metadata.lastModified,
        level: 'global',
        actType: 'claude-code',
      });
    }
  }

  // Check for ~/.claude/settings.json
  const globalSettings = path.join(globalClaudeDir, 'settings.json');
  if (fs.existsSync(globalSettings)) {
    const metadata = getFileMetadata(globalSettings);
    if (metadata) {
      results.push({
        path: globalSettings,
        relativePath: '.claude/settings.json',
        type: 'claude-settings',
        size: metadata.size,
        lastModified: metadata.lastModified,
        level: 'global',
        actType: 'claude-code',
      });
    }
  }

  return await Promise.resolve(results);
}

/**
 * Discover all AI configuration files in a project.
 *
 * @param input - Discovery options
 * @returns Discovery results with files, skills, and metadata
 */
export async function discoverConfigs(input: DiscoverConfigsInput): Promise<DiscoverConfigsResult> {
  const startTime = Date.now();
  const {
    cwd,
    includeGlobal = false,
    exclude = [],
    maxDepth = 20,
    parseSkills: shouldParseSkills = false,
  } = input;

  const results: ConfigFile[] = [];
  const skills: Array<{ path: string; type: 'skill-md' }> = [];
  let filesScanned = 0;
  let directoriesExcluded = 0;

  // Check if cwd exists
  if (!fs.existsSync(cwd)) {
    return {
      files: [],
      skills: [],
      filesScanned: 0,
      directoriesExcluded: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // Build exclusion patterns
  const ignorePatterns = buildExclusionPatterns(exclude);

  // Count excluded directories (rough estimate)
  for (const exclusion of [...DEFAULT_EXCLUSIONS, ...exclude]) {
    const exclusionPath = path.join(cwd, exclusion);
    if (fs.existsSync(exclusionPath)) {
      directoriesExcluded++;
    }
  }

  // Build glob patterns for all config types (AGE-666: expanded patterns)
  // Extended for remediation to include rules, agents, and commands
  const allPatterns = [
    ...CONFIG_PATTERNS.claudeMd,
    ...CONFIG_PATTERNS.agentsMd,
    ...CONFIG_PATTERNS.settings,
    ...CONFIG_PATTERNS.settingsLocal,
    ...CONFIG_PATTERNS.mcpJson,
    ...CONFIG_PATTERNS.hooks,
    ...CONFIG_PATTERNS.skillMd,
    ...CONFIG_PATTERNS.rules,
    ...CONFIG_PATTERNS.agents,
    ...CONFIG_PATTERNS.commands,
  ];

  try {
    // Use fast-glob for efficient file discovery
    const entries = await fg(allPatterns, {
      cwd,
      ignore: ignorePatterns,
      deep: maxDepth,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      suppressErrors: true,
      stats: true,
    });

    filesScanned = entries.length;

    for (const entry of entries) {
      // Handle both string and Entry objects
      const filePath = typeof entry === 'string' ? entry : entry.path;
      const configType = getConfigType(filePath);

      // Skip unknown types
      if (configType === 'unknown') {
        continue;
      }

      const metadata = getFileMetadata(filePath);
      if (!metadata) {
        continue;
      }

      const relativePath = path.relative(cwd, filePath);
      const level = getHierarchyLevel(filePath, cwd, false);
      const actType = getACTType(configType);

      if (configType === 'skill-md') {
        skills.push({ path: relativePath, type: 'skill-md' });
      }

      results.push({
        path: filePath,
        relativePath,
        type: configType,
        size: metadata.size,
        lastModified: metadata.lastModified,
        level,
        actType,
      });
    }
  } catch (error) {
    // Handle discovery errors gracefully
    console.error(
      'Config discovery error:',
      error instanceof Error ? redact(error.message) : 'unknown error'
    );
  }

  // Add global configs if requested
  if (includeGlobal) {
    const globalConfigs = await discoverGlobalConfigs();
    results.push(...globalConfigs);
  }

  // Optionally parse skills into full Skill objects
  let parsedSkills: Skill[] | undefined;
  if (shouldParseSkills && skills.length > 0) {
    parsedSkills = [];
    for (const skillInfo of skills) {
      try {
        const skillPath = path.isAbsolute(skillInfo.path)
          ? skillInfo.path
          : path.join(cwd, skillInfo.path);
        const skillDir = path.dirname(skillPath);
        const skill = await parseSkill(skillDir);
        parsedSkills.push(skill);
      } catch (error) {
        // Log warning but continue with other skills
        console.warn(
          `Warning: Failed to parse skill ${skillInfo.path}:`,
          error instanceof Error ? redact(error.message) : 'unknown error'
        );
      }
    }
  }

  const returnValue: DiscoverConfigsResult = {
    files: results,
    skills,
    filesScanned,
    directoriesExcluded,
    durationMs: Date.now() - startTime,
  };

  // Only include parsedSkills if it was populated
  if (parsedSkills !== undefined) {
    returnValue.parsedSkills = parsedSkills;
  }

  return returnValue;
}

/**
 * Synchronous version of discoverConfigs for simpler use cases.
 */
export function discoverConfigsSync(input: DiscoverConfigsInput): DiscoverConfigsResult {
  const startTime = Date.now();
  const { cwd, includeGlobal = false, exclude = [], maxDepth = 20 } = input;

  const results: ConfigFile[] = [];
  const skills: Array<{ path: string; type: 'skill-md' }> = [];
  let filesScanned = 0;
  let directoriesExcluded = 0;

  // Check if cwd exists
  if (!fs.existsSync(cwd)) {
    return {
      files: [],
      skills: [],
      filesScanned: 0,
      directoriesExcluded: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // Build exclusion patterns
  const ignorePatterns = buildExclusionPatterns(exclude);

  // Count excluded directories
  for (const exclusion of [...DEFAULT_EXCLUSIONS, ...exclude]) {
    const exclusionPath = path.join(cwd, exclusion);
    if (fs.existsSync(exclusionPath)) {
      directoriesExcluded++;
    }
  }

  // Build glob patterns (AGE-666: expanded patterns)
  // Extended for remediation to include rules, agents, and commands
  const allPatterns = [
    ...CONFIG_PATTERNS.claudeMd,
    ...CONFIG_PATTERNS.agentsMd,
    ...CONFIG_PATTERNS.settings,
    ...CONFIG_PATTERNS.settingsLocal,
    ...CONFIG_PATTERNS.mcpJson,
    ...CONFIG_PATTERNS.hooks,
    ...CONFIG_PATTERNS.skillMd,
    ...CONFIG_PATTERNS.rules,
    ...CONFIG_PATTERNS.agents,
    ...CONFIG_PATTERNS.commands,
  ];

  try {
    const entries = fg.sync(allPatterns, {
      cwd,
      ignore: ignorePatterns,
      deep: maxDepth,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      suppressErrors: true,
    });

    filesScanned = entries.length;

    for (const filePath of entries) {
      const configType = getConfigType(filePath);

      if (configType === 'unknown') {
        continue;
      }

      const metadata = getFileMetadata(filePath);
      if (!metadata) {
        continue;
      }

      const relativePath = path.relative(cwd, filePath);
      const level = getHierarchyLevel(filePath, cwd, false);
      const actType = getACTType(configType);

      if (configType === 'skill-md') {
        skills.push({ path: relativePath, type: 'skill-md' });
      }

      results.push({
        path: filePath,
        relativePath,
        type: configType,
        size: metadata.size,
        lastModified: metadata.lastModified,
        level,
        actType,
      });
    }
  } catch (error) {
    console.error(
      'Config discovery error:',
      error instanceof Error ? redact(error.message) : 'unknown error'
    );
  }

  // Add global configs if requested (sync)
  if (includeGlobal) {
    const homeDir = os.homedir();
    const globalClaudeDir = path.join(homeDir, '.claude');
    const globalClaudeMd = path.join(globalClaudeDir, 'CLAUDE.md');

    if (fs.existsSync(globalClaudeMd)) {
      const metadata = getFileMetadata(globalClaudeMd);
      if (metadata) {
        results.push({
          path: globalClaudeMd,
          relativePath: '.claude/CLAUDE.md',
          type: 'claude-md',
          size: metadata.size,
          lastModified: metadata.lastModified,
          level: 'global',
          actType: 'claude-code',
        });
      }
    }

    const globalSettings = path.join(globalClaudeDir, 'settings.json');
    if (fs.existsSync(globalSettings)) {
      const metadata = getFileMetadata(globalSettings);
      if (metadata) {
        results.push({
          path: globalSettings,
          relativePath: '.claude/settings.json',
          type: 'claude-settings',
          size: metadata.size,
          lastModified: metadata.lastModified,
          level: 'global',
          actType: 'claude-code',
        });
      }
    }
  }

  return {
    files: results,
    skills,
    filesScanned,
    directoriesExcluded,
    durationMs: Date.now() - startTime,
  };
}
