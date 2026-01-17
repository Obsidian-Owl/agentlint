/**
 * T060-T063: Skill Discovery and Parsing
 *
 * Discovers and parses SKILL.md files with frontmatter validation
 * and bundled file cataloging.
 *
 * @module tools/config/skills
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import { parseConfig } from './parse-config';
import { parseFrontmatterSync } from '../../parsers/frontmatter';
import type {
  Skill,
  Section,
  BundledFile,
  BundledFileType,
  ParseWarning,
  WarningCode,
} from './types';

// =============================================================================
// Constants
// =============================================================================

/** Maximum length for skill name */
const MAX_NAME_LENGTH = 64;

/** Maximum length for skill description */
const MAX_DESCRIPTION_LENGTH = 200;

/** Bundled file directory types */
const BUNDLED_DIRS: Array<{ dir: string; type: BundledFileType }> = [
  { dir: 'scripts', type: 'script' },
  { dir: 'references', type: 'reference' },
  { dir: 'assets', type: 'asset' },
];

/** Default exclusion patterns for skill discovery */
const DEFAULT_EXCLUSIONS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  'venv',
  '.venv',
];

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Discover all SKILL.md files in a directory.
 *
 * @param options - Discovery options
 * @returns Array of parsed Skill objects
 */
export async function discoverSkills(options: {
  cwd: string;
  maxDepth?: number;
  exclude?: string[];
}): Promise<Skill[]> {
  const { cwd, maxDepth = 10, exclude = [] } = options;

  // Build exclusion patterns
  const exclusions = [...DEFAULT_EXCLUSIONS, ...exclude];
  const ignorePatterns = exclusions.map((e) => `**/${e}/**`);

  // Search for SKILL.md files (case-insensitive)
  const patterns = ['**/SKILL.md', '**/skill.md'];

  try {
    const skillPaths = await fg(patterns, {
      cwd,
      absolute: true,
      ignore: ignorePatterns,
      deep: maxDepth,
      onlyFiles: true,
      caseSensitiveMatch: false,
    });

    // Parse each skill
    const skills: Skill[] = [];
    for (const skillPath of skillPaths) {
      try {
        const skillDir = path.dirname(skillPath);
        const skill = await parseSkill(skillDir);
        skills.push(skill);
      } catch (error) {
        // Log error but continue discovering other skills
        console.warn(`Warning: Failed to parse skill at ${skillPath}:`, error);
      }
    }

    return skills;
  } catch (error) {
    // Return empty array on glob failure
    console.warn('Warning: Skill discovery failed:', error);
    return [];
  }
}

/**
 * Parse a SKILL.md file and its bundled files from a directory.
 *
 * @param skillDir - Directory containing SKILL.md
 * @returns Parsed Skill object
 */
export async function parseSkill(skillDir: string): Promise<Skill> {
  const warnings: ParseWarning[] = [];

  // Find SKILL.md (case-insensitive)
  const skillFileName = findSkillFile(skillDir);
  if (!skillFileName) {
    throw new Error(`No SKILL.md found in ${skillDir}`);
  }

  const skillPath = path.join(skillDir, skillFileName);
  const content = fs.readFileSync(skillPath, 'utf-8');

  // Parse frontmatter
  const frontmatterResult = parseFrontmatterSync(content);
  warnings.push(...frontmatterResult.warnings);

  const frontmatter = frontmatterResult.frontmatter || {};

  // Extract and validate required fields
  const { name, nameWarning } = extractName(frontmatter, skillDir);
  if (nameWarning) warnings.push(nameWarning);

  const { description, descWarning } = extractDescription(frontmatter);
  if (descWarning) warnings.push(descWarning);

  // Extract optional fields
  const allowedTools = extractAllowedTools(frontmatter);
  const model = extractString(frontmatter, 'model');
  const userInvocable = extractBoolean(frontmatter, 'user_invocable', true);
  const disableModelInvocation = extractBoolean(frontmatter, 'disable_model_invocation', false);

  // Parse content sections using parseConfig
  const contentSections = await extractContentSections(skillPath);

  // Discover bundled files
  const bundledFiles = discoverBundledFiles(skillDir);

  const skill: Skill = {
    path: skillPath,
    name,
    description,
    userInvocable,
    disableModelInvocation,
    contentSections,
    bundledFiles,
    warnings,
  };

  // Only add optional properties if they're defined
  if (allowedTools !== undefined) {
    skill.allowedTools = allowedTools;
  }
  if (model !== undefined) {
    skill.model = model;
  }

  return skill;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find SKILL.md file (case-insensitive).
 */
function findSkillFile(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.toLowerCase() === 'skill.md') {
        return file;
      }
    }
  } catch {
    // Directory not readable
  }
  return null;
}

/**
 * Extract and validate name from frontmatter.
 */
function extractName(
  frontmatter: Record<string, unknown>,
  skillDir: string
): { name: string; nameWarning?: ParseWarning } {
  const raw = frontmatter.name;

  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    // Derive name from directory
    const dirName = path.basename(skillDir);
    return {
      name: truncate(dirName, MAX_NAME_LENGTH),
      nameWarning: {
        code: 'MISSING_REQUIRED_FIELD' as WarningCode,
        message: 'Missing required field: name. Using directory name as fallback.',
        recoverable: true,
      },
    };
  }

  return {
    name: truncate(raw.trim(), MAX_NAME_LENGTH),
  };
}

/**
 * Extract and validate description from frontmatter.
 */
function extractDescription(frontmatter: Record<string, unknown>): {
  description: string;
  descWarning?: ParseWarning;
} {
  const raw = frontmatter.description;

  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return {
      description: '',
      descWarning: {
        code: 'MISSING_REQUIRED_FIELD' as WarningCode,
        message: 'Missing required field: description',
        recoverable: true,
      },
    };
  }

  return {
    description: truncate(raw.trim(), MAX_DESCRIPTION_LENGTH),
  };
}

/**
 * Extract allowed_tools as array.
 */
function extractAllowedTools(frontmatter: Record<string, unknown>): string[] | undefined {
  const raw = frontmatter.allowed_tools || frontmatter.allowedTools;

  if (!raw) return undefined;

  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter((t) => t.length > 0);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  return undefined;
}

/**
 * Extract string field from frontmatter.
 */
function extractString(frontmatter: Record<string, unknown>, key: string): string | undefined {
  const raw = frontmatter[key];
  if (!raw || typeof raw !== 'string') return undefined;
  return raw.trim();
}

/**
 * Extract boolean field from frontmatter.
 */
function extractBoolean(
  frontmatter: Record<string, unknown>,
  key: string,
  defaultValue: boolean
): boolean {
  const raw = frontmatter[key];

  if (raw === undefined || raw === null) return defaultValue;

  if (typeof raw === 'boolean') return raw;

  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim();
    if (lower === 'true' || lower === 'yes' || lower === '1') return true;
    if (lower === 'false' || lower === 'no' || lower === '0') return false;
  }

  return defaultValue;
}

/**
 * Truncate string to max length.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength);
}

/**
 * Extract content sections from SKILL.md using parseConfig.
 */
async function extractContentSections(skillPath: string): Promise<Section[]> {
  try {
    const parsed = await parseConfig(skillPath);
    return parsed.sections;
  } catch {
    // Return empty sections on parse error
    return [];
  }
}

/**
 * Discover bundled files in scripts/, references/, assets/ directories.
 */
function discoverBundledFiles(skillDir: string): BundledFile[] {
  const files: BundledFile[] = [];

  for (const { dir, type } of BUNDLED_DIRS) {
    const dirPath = path.join(skillDir, dir);

    if (!fs.existsSync(dirPath)) continue;

    try {
      const filesInDir = walkDirectory(dirPath);

      for (const filePath of filesInDir) {
        const relativePath = path.relative(skillDir, filePath);
        const stats = fs.statSync(filePath);

        files.push({
          path: relativePath,
          type,
          size: stats.size,
        });
      }
    } catch {
      // Skip unreadable directories
    }
  }

  return files;
}

/**
 * Recursively walk a directory and return all file paths.
 */
function walkDirectory(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...walkDirectory(fullPath));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Return empty on error
  }

  return files;
}
