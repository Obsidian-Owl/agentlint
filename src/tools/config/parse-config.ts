/**
 * T033-T037: Configuration file parser
 *
 * Parses AI configuration files (CLAUDE.md, AGENTS.md, settings.json)
 * into structured ParsedConfig objects with AST, sections, code blocks,
 * metrics, and warnings.
 *
 * @module tools/config/parse-config
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Root, Heading, RootContent } from 'mdast';
import { parseMarkdownSync } from '../../parsers/markdown';
import { parseFrontmatterSync } from '../../parsers/frontmatter';
import { parseJsonConfigSync } from '../../parsers/json-config';
import { ConfigNotFoundError, ConfigParseError } from '../../errors/config';
import type {
  ParsedConfig,
  ConfigFile,
  ConfigMetrics,
  Section,
  CodeBlock,
  ParseWarning,
  Position,
  ConfigType,
  HierarchyLevel,
  ACTType,
  WarningCode,
} from './types';
import { extractMetrics, createJsonMetrics, createEmptyMetrics } from './metrics';

// =============================================================================
// Main Parsing Functions
// =============================================================================

/**
 * Parse a configuration file into structured data.
 *
 * @param filePath - Absolute path to the configuration file
 * @returns Parsed configuration with AST, sections, metrics, and warnings
 * @throws ConfigNotFoundError if file doesn't exist
 */
export async function parseConfig(filePath: string): Promise<ParsedConfig> {
  return await Promise.resolve(parseConfigSync(filePath));
}

/**
 * Parse a configuration file synchronously.
 *
 * @param filePath - Absolute path to the configuration file
 * @returns Parsed configuration with AST, sections, metrics, and warnings
 * @throws ConfigNotFoundError if file doesn't exist
 */
export function parseConfigSync(filePath: string): ParsedConfig {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    throw new ConfigNotFoundError(filePath);
  }

  // Read file content
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new ConfigParseError(`Failed to read file: ${(error as Error).message}`, {
      filePath,
      cause: error as Error,
    });
  }

  // Handle BOM (Byte Order Mark)
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  // Determine file type and parse accordingly
  const fileName = path.basename(filePath);
  const isJson = fileName.endsWith('.json');

  if (isJson) {
    return parseJsonConfigFile(filePath, content);
  } else {
    return parseMarkdownConfigFile(filePath, content);
  }
}

/**
 * Parse multiple configuration files efficiently.
 *
 * @param files - Array of ConfigFile objects to parse
 * @returns Array of parsed configurations
 */
export async function parseConfigBatch(files: ConfigFile[]): Promise<ParsedConfig[]> {
  return Promise.all(files.map((file) => parseConfig(file.path)));
}

/**
 * Parse settings.json specifically for settings config tests.
 * This is a convenience function that wraps parseConfig.
 *
 * @param filePath - Path to settings.json file
 * @returns Parsed configuration
 */
export async function parseSettingsConfig(filePath: string): Promise<ParsedConfig> {
  return parseConfig(filePath);
}

// =============================================================================
// JSON Config Parsing
// =============================================================================

/**
 * Parse a JSON configuration file (settings.json).
 */
function parseJsonConfigFile(filePath: string, content: string): ParsedConfig {
  const warnings: ParseWarning[] = [];
  const fileName = path.basename(filePath);

  // Create base file metadata
  const stats = fs.statSync(filePath);
  const file: ConfigFile = {
    path: filePath,
    relativePath: fileName,
    type: 'claude-settings' as ConfigType,
    size: stats.size,
    lastModified: stats.mtime,
    level: determineHierarchyLevel(filePath),
    actType: 'claude-code' as ACTType,
  };

  // Handle empty content
  if (!content || content.trim() === '') {
    warnings.push({
      code: 'INVALID_JSON' as WarningCode,
      message: 'Empty JSON file',
      recoverable: true,
    });

    return createEmptyParsedConfig(file, content, warnings);
  }

  // Parse JSON
  const jsonResult = parseJsonConfigSync(content, {
    validateSchema: true,
    validateModelNames: true,
  });

  if (!jsonResult.success) {
    const warning: ParseWarning = {
      code: 'INVALID_JSON' as WarningCode,
      message: jsonResult.error.message,
      recoverable: true,
    };
    if (jsonResult.error.position) {
      warning.position = jsonResult.error.position;
    }
    warnings.push(warning);

    return createEmptyParsedConfig(file, content, warnings);
  }

  // Add any warnings from JSON parsing
  warnings.push(...jsonResult.warnings);

  // Create metrics for JSON file
  const metrics = createJsonMetrics(content);

  // Create a synthetic root AST node for JSON
  const ast: Root = {
    type: 'root',
    children: [],
  };

  return {
    file,
    ast,
    frontmatter: jsonResult.config as Record<string, unknown>,
    metrics,
    sections: [],
    codeBlocks: [],
    warnings,
    raw: content,
  };
}

// =============================================================================
// Markdown Config Parsing
// =============================================================================

/**
 * Parse a markdown configuration file (CLAUDE.md, AGENTS.md).
 */
function parseMarkdownConfigFile(filePath: string, content: string): ParsedConfig {
  const warnings: ParseWarning[] = [];
  const fileName = path.basename(filePath);

  // Create base file metadata
  const stats = fs.statSync(filePath);
  const file: ConfigFile = {
    path: filePath,
    relativePath: fileName,
    type: determineConfigType(fileName),
    size: stats.size,
    lastModified: stats.mtime,
    level: determineHierarchyLevel(filePath),
    actType: 'claude-code' as ACTType,
  };

  // Handle empty content
  if (!content || content.trim() === '') {
    return createEmptyParsedConfig(file, content, warnings);
  }

  // Check for binary content
  if (isBinaryContent(content)) {
    warnings.push({
      code: 'INVALID_YAML' as WarningCode,
      message: 'File appears to contain binary content',
      recoverable: true,
    });
    return createEmptyParsedConfig(file, content, warnings);
  }

  // Parse frontmatter first
  const frontmatterResult = parseFrontmatterSync(content);
  warnings.push(...frontmatterResult.warnings);

  // Parse markdown (use content after frontmatter for cleaner AST)
  const markdownResult = parseMarkdownSync(content);
  warnings.push(...markdownResult.warnings);

  // Extract sections with hierarchy (T034)
  const sections = extractSections(markdownResult.ast, content);

  // Extract code blocks with positions (T035)
  const codeBlocks = extractCodeBlocks(markdownResult.ast);

  // Calculate metrics
  const metrics = calculateMetrics(content, markdownResult, sections, codeBlocks);

  const result: ParsedConfig = {
    file,
    ast: markdownResult.ast,
    metrics,
    sections,
    codeBlocks,
    warnings,
    raw: content,
  };

  if (frontmatterResult.frontmatter) {
    result.frontmatter = frontmatterResult.frontmatter;
  }

  return result;
}

// =============================================================================
// Section Extraction (T034)
// =============================================================================

/**
 * Extract sections with hierarchy from AST.
 * Sections are defined by headings and include content until the next heading.
 */
function extractSections(ast: Root, rawContent: string): Section[] {
  const lines = rawContent.split('\n');
  const headings: Array<{
    heading: Heading;
    index: number;
    text: string;
    level: number;
    position: Position;
  }> = [];

  // First pass: collect all headings
  let nodeIndex = 0;
  for (const child of ast.children) {
    if (child.type === 'heading') {
      const heading = child;
      const text = extractHeadingText(heading);
      const position = convertMdastPosition(heading.position);

      if (position) {
        headings.push({
          heading,
          index: nodeIndex,
          text,
          level: heading.depth,
          position,
        });
      }
    }
    nodeIndex++;
  }

  if (headings.length === 0) {
    return [];
  }

  // Second pass: create sections with content
  const sections: Section[] = [];
  const sectionIds = new Set<string>();

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i]!;
    const next = headings[i + 1];

    // Calculate end position
    const startLine = current.position.start.line;
    const endLine = next ? next.position.start.line - 1 : lines.length;

    // Extract content (lines between this heading and next)
    const contentLines = lines.slice(startLine, endLine);
    const content = contentLines.join('\n').trim();

    // Generate unique ID
    const baseId = generateSectionId(current.text);
    let uniqueId = baseId;
    let counter = 1;
    while (sectionIds.has(uniqueId)) {
      uniqueId = `${baseId}-${counter}`;
      counter++;
    }
    sectionIds.add(uniqueId);

    // Calculate line count
    const lineCount = endLine - startLine + 1;

    const section: Section = {
      id: uniqueId,
      title: current.text,
      level: current.level,
      content,
      children: [],
      position: {
        start: current.position.start,
        end: {
          line: endLine,
          column: (lines[endLine - 1]?.length ?? 0) + 1,
          offset: calculateOffset(lines, endLine),
        },
      },
      lineCount,
    };

    sections.push(section);
  }

  // Build hierarchy (nest children under parents)
  return buildSectionHierarchy(sections);
}

/**
 * Build hierarchical section structure.
 * Lower-level headings become children of higher-level ones.
 */
function buildSectionHierarchy(flatSections: Section[]): Section[] {
  const result: Section[] = [];
  const stack: Section[] = [];

  for (const section of flatSections) {
    // Pop from stack until we find a parent with lower level
    while (stack.length > 0 && stack[stack.length - 1]!.level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level section
      result.push(section);
    } else {
      // Child of current stack top
      stack[stack.length - 1]!.children.push(section);
    }

    stack.push(section);
  }

  return result;
}

/**
 * Generate a URL-safe section ID from heading text.
 */
function generateSectionId(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'section'
  );
}

/**
 * Extract text content from heading node.
 */
function extractHeadingText(heading: Heading): string {
  return heading.children
    .map((child) => {
      if (child.type === 'text') return child.value;
      if (child.type === 'inlineCode') return child.value;
      return '';
    })
    .join('');
}

// =============================================================================
// Code Block Extraction (T035)
// =============================================================================

/**
 * Extract code blocks with full position information.
 */
function extractCodeBlocks(ast: Root): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];

  function visit(node: RootContent | Root): void {
    if (node.type === 'code') {
      const code = node;
      const position = convertMdastPosition(code.position);

      if (position) {
        const block: CodeBlock = {
          content: code.value,
          position,
          lineCount: code.value.split('\n').length,
        };

        if (code.lang) {
          block.language = code.lang;
        }
        if (code.meta) {
          block.meta = code.meta;
        }

        codeBlocks.push(block);
      }
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child as RootContent);
      }
    }
  }

  visit(ast);
  return codeBlocks;
}

// =============================================================================
// Position Tracking (T036)
// =============================================================================

/**
 * Convert mdast position to our Position type.
 */
function convertMdastPosition(pos: Heading['position']): Position | undefined {
  if (!pos) return undefined;

  const result: Position = {
    start: {
      line: pos.start.line,
      column: pos.start.column,
    },
    end: {
      line: pos.end.line,
      column: pos.end.column,
    },
  };

  if (pos.start.offset !== undefined) {
    result.start.offset = pos.start.offset;
  }
  if (pos.end.offset !== undefined) {
    result.end.offset = pos.end.offset;
  }

  return result;
}

/**
 * Calculate character offset for a given line number.
 */
function calculateOffset(lines: string[], lineNumber: number): number {
  let offset = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for newline
  }
  return offset;
}

// =============================================================================
// Metrics Calculation
// =============================================================================

/**
 * Calculate configuration metrics from parsed content.
 * Delegates to the metrics module for actual calculations.
 */
function calculateMetrics(
  content: string,
  markdownResult: ReturnType<typeof parseMarkdownSync>,
  sections: Section[],
  codeBlocks: CodeBlock[]
): ConfigMetrics {
  return extractMetrics(content, markdownResult.ast, markdownResult.headings, sections, codeBlocks);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine config type from filename.
 */
function determineConfigType(fileName: string): ConfigType {
  const lower = fileName.toLowerCase();
  if (lower === 'claude.md') return 'claude-md';
  if (lower === 'agents.md') return 'agents-md';
  if (lower === 'settings.json') return 'claude-settings';
  if (lower === 'skill.md') return 'skill-md';
  return 'claude-md'; // Default
}

/**
 * Determine hierarchy level from file path.
 */
function determineHierarchyLevel(filePath: string): HierarchyLevel {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const globalPath = path.join(homeDir, '.claude');

  if (filePath.startsWith(globalPath)) {
    return 'global';
  }

  // Simple heuristic: if path has multiple directory levels, it's local
  const relativePath = filePath.split(path.sep);
  const depth = relativePath.filter((p) => p !== '' && p !== '.').length;

  // Root level configs (single directory depth) are project level
  if (depth <= 2) {
    return 'project';
  }

  return 'local';
}

/**
 * Check if content appears to be binary.
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes or high concentration of control characters
  let controlCount = 0;
  const checkLength = Math.min(content.length, 1000);

  for (let i = 0; i < checkLength; i++) {
    const charCode = content.charCodeAt(i);
    // Null byte is a strong indicator of binary
    if (charCode === 0) return true;
    // Count other control characters (except common ones like tab, newline)
    if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
      controlCount++;
    }
  }

  // If more than 10% are control characters, likely binary
  return controlCount > checkLength * 0.1;
}

/**
 * Create an empty ParsedConfig for error cases.
 */
function createEmptyParsedConfig(
  file: ConfigFile,
  content: string,
  warnings: ParseWarning[]
): ParsedConfig {
  return {
    file,
    ast: { type: 'root', children: [] },
    metrics: createEmptyMetrics(content),
    sections: [],
    codeBlocks: [],
    warnings,
    raw: content,
  };
}
