/**
 * EP03 Persistence Layer - Learnings Storage
 *
 * Provides file operations for learnings stored as Markdown with YAML frontmatter.
 * Supports both project-scoped (.agentlint/learnings/) and global-scoped
 * (~/.agentlint/learnings/) storage.
 *
 * @module persistence/learnings/storage
 */

import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import type { Learning, CreateLearningInput, LearningScope, LearningOrigin } from '../types';
import { ensureDir } from '../common';

// =============================================================================
// Constants
// =============================================================================

/** Current learning file format version */
export const LEARNING_VERSION = '1.0.0';

/** Default project-local learnings directory */
const DEFAULT_PROJECT_LEARNINGS_DIR = join(process.cwd(), '.agentlint', 'learnings');

/** Default global learnings directory */
const DEFAULT_GLOBAL_LEARNINGS_DIR = join(homedir(), '.agentlint', 'learnings');

// =============================================================================
// Types
// =============================================================================

/**
 * Options for save operation.
 */
interface SaveLearningOptions {
  /** Base directory for learnings */
  baseDir?: string;
}

/**
 * Options for load operation.
 */
interface LoadLearningOptions {
  /** Base directory for learnings */
  baseDir?: string;
}

/**
 * Result of save operation.
 */
interface SaveLearningResult {
  /** Learning ID */
  id: string;
  /** Path to saved file */
  filePath: string;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the learnings directory path for a scope.
 *
 * @param scope - 'project' or 'global'
 * @param customDir - Optional custom directory override
 * @returns Path to learnings directory
 */
export function getLearningsDir(scope: LearningScope, customDir?: string): string {
  if (customDir) {
    return customDir;
  }
  return scope === 'global' ? DEFAULT_GLOBAL_LEARNINGS_DIR : DEFAULT_PROJECT_LEARNINGS_DIR;
}

/**
 * Save a learning to disk as Markdown with YAML frontmatter.
 *
 * @param input - The learning input to save
 * @param options - Storage options
 * @returns Result containing ID and file path
 */
export async function saveLearning(
  input: CreateLearningInput,
  options: SaveLearningOptions = {}
): Promise<SaveLearningResult> {
  const baseDir = options.baseDir ?? getLearningsDir(input.scope);

  // Ensure directory exists
  await ensureDir(baseDir);

  // Generate ID and create learning object
  const id = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  const learning: Learning = {
    id,
    version: LEARNING_VERSION,
    createdAt: now,
    updatedAt: now,
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    category: input.category,
    scope: input.scope,
    ...(input.origin !== undefined && { origin: input.origin }),
  };

  // Generate filename: YYYY-MM-DD-slug-id.md
  const datePrefix = now.split('T')[0];
  const slug = slugify(input.title);
  const filename = `${datePrefix}-${slug}-${id}.md`;
  const filePath = join(baseDir, filename);

  // Serialize to markdown with YAML frontmatter
  const markdown = serializeLearning(learning);
  await Bun.write(filePath, markdown);

  return { id, filePath };
}

/**
 * Load a learning by ID.
 *
 * @param learningId - The learning ID (short UUID)
 * @param options - Storage options
 * @returns The learning, or null if not found or invalid
 */
export async function loadLearning(
  learningId: string,
  options: LoadLearningOptions = {}
): Promise<Learning | null> {
  const baseDir = options.baseDir ?? DEFAULT_PROJECT_LEARNINGS_DIR;

  if (!existsSync(baseDir)) {
    return null;
  }

  // Find file matching this ID
  const files = readdirSync(baseDir);
  const matchingFile = files.find((f) => f.endsWith('.md') && f.includes(`-${learningId}.md`));

  if (!matchingFile) {
    return null;
  }

  const filePath = join(baseDir, matchingFile);

  try {
    const content = await Bun.file(filePath).text();
    const learning = parseLearning(content);

    if (!learning) {
      return null;
    }

    // Warn on version mismatch but still return
    if (learning.version !== LEARNING_VERSION) {
      console.warn(
        `Learning file version mismatch: expected ${LEARNING_VERSION}, got ${learning.version}`
      );
    }

    return learning;
  } catch {
    return null;
  }
}

/**
 * List all learning IDs in a directory.
 *
 * @param options - Storage options
 * @returns Array of learning IDs
 */
export function listLearnings(options: LoadLearningOptions = {}): string[] {
  const baseDir = options.baseDir ?? DEFAULT_PROJECT_LEARNINGS_DIR;

  if (!existsSync(baseDir)) {
    return [];
  }

  const files = readdirSync(baseDir);
  return files
    .filter((f) => f.endsWith('.md'))
    .map((f) => extractIdFromFilename(f))
    .filter((id): id is string => id !== null);
}

/**
 * Delete a learning by ID.
 *
 * @param learningId - The learning ID
 * @param options - Storage options
 * @returns True if deleted, false if not found
 */
export function deleteLearning(
  learningId: string,
  options: LoadLearningOptions = {}
): boolean {
  const baseDir = options.baseDir ?? DEFAULT_PROJECT_LEARNINGS_DIR;

  if (!existsSync(baseDir)) {
    return false;
  }

  const files = readdirSync(baseDir);
  const matchingFile = files.find((f) => f.endsWith('.md') && f.includes(`-${learningId}.md`));

  if (!matchingFile) {
    return false;
  }

  const filePath = join(baseDir, matchingFile);
  unlinkSync(filePath);
  return true;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert title to URL-friendly slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Extract learning ID from filename.
 * Expects format: YYYY-MM-DD-slug-id.md
 */
function extractIdFromFilename(filename: string): string | null {
  const match = filename.match(/-([a-f0-9]+)\.md$/);
  return match?.[1] ?? null;
}

/**
 * Serialize a learning to Markdown with YAML frontmatter.
 */
function serializeLearning(learning: Learning): string {
  const frontmatter: Record<string, unknown> = {
    id: learning.id,
    version: learning.version,
    createdAt: learning.createdAt,
    updatedAt: learning.updatedAt,
    title: learning.title,
    category: learning.category,
    scope: learning.scope,
    tags: learning.tags,
  };

  if (learning.origin) {
    frontmatter.origin = learning.origin;
  }

  const yaml = serializeYaml(frontmatter);

  return `---\n${yaml}---\n\n${learning.content}\n`;
}

/**
 * Parse a learning from Markdown with YAML frontmatter.
 */
function parseLearning(markdown: string): Learning | null {
  try {
    // Split frontmatter from content
    const parts = markdown.split('---');
    if (parts.length < 3) {
      return null;
    }

    const yamlContent = parts[1]?.trim();
    const markdownContent = parts.slice(2).join('---').trim();

    if (!yamlContent) {
      return null;
    }

    // Parse YAML frontmatter
    const frontmatter = parseYaml(yamlContent);
    if (!frontmatter || !frontmatter.id || !frontmatter.title) {
      return null;
    }

    const learning: Learning = {
      id: typeof frontmatter.id === 'string' ? frontmatter.id : '',
      version: typeof frontmatter.version === 'string' ? frontmatter.version : LEARNING_VERSION,
      createdAt: typeof frontmatter.createdAt === 'string' ? frontmatter.createdAt : new Date().toISOString(),
      updatedAt: typeof frontmatter.updatedAt === 'string' ? frontmatter.updatedAt : new Date().toISOString(),
      title: typeof frontmatter.title === 'string' ? frontmatter.title : '',
      content: markdownContent,
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((t): t is string => typeof t === 'string') : [],
      category: frontmatter.category as Learning['category'],
      scope: frontmatter.scope as Learning['scope'],
    };

    if (frontmatter.origin) {
      learning.origin = frontmatter.origin as LearningOrigin;
    }

    return learning;
  } catch {
    return null;
  }
}

/**
 * Simple YAML serializer for frontmatter.
 * Handles basic types: string, number, boolean, array, object.
 */
function serializeYaml(obj: Record<string, unknown>, indent = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${prefix}${key}: []`);
      } else {
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          lines.push(`${prefix}  - ${formatYamlValue(item)}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${prefix}${key}:`);
      lines.push(serializeYaml(value as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${prefix}${key}: ${formatYamlValue(value)}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Format a single YAML value.
 */
function formatYamlValue(value: unknown): string {
  if (typeof value === 'string') {
    // Quote strings that might be misinterpreted
    if (value.includes(':') || value.includes('#') || value.includes("'") || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return `"${value}"`;
  }
  return String(value);
}

/**
 * Simple YAML parser for frontmatter.
 * Handles basic types we serialize.
 */
function parseYaml(yaml: string): Record<string, unknown> | null {
  try {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: result, indent: -1 }];
    let currentArray: unknown[] | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);

      // Handle array items
      if (trimmed.startsWith('- ')) {
        const value = parseYamlScalar(trimmed.slice(2).trim());
        if (currentArray) {
          currentArray.push(value);
        }
        continue;
      }

      // Handle key-value pairs
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.slice(0, colonIndex).trim();
      const rawValue = trimmed.slice(colonIndex + 1).trim();

      // Determine current object based on indent
      while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
        stack.pop();
      }
      const current = stack[stack.length - 1]!.obj;

      if (rawValue === '' || rawValue === '[]') {
        // Nested object or empty array
        if (rawValue === '[]') {
          current[key] = [];
        } else {
          const nextLine = lines[lines.indexOf(line) + 1];
          if (nextLine && nextLine.trim().startsWith('- ')) {
            // It's an array
            currentArray = [];
            current[key] = currentArray;
          } else {
            // It's a nested object
            const nestedObj: Record<string, unknown> = {};
            current[key] = nestedObj;
            stack.push({ obj: nestedObj, indent });
            currentArray = null;
          }
        }
      } else {
        // Simple value
        current[key] = parseYamlScalar(rawValue);
        currentArray = null;
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Parse a YAML scalar value.
 */
function parseYamlScalar(value: string): string | number | boolean {
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Number
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;

  return value;
}
