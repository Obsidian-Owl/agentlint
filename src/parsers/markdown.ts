/**
 * Markdown parser using unified/remark
 *
 * T013: Wrapper around unified ecosystem for parsing CLAUDE.md and similar files.
 *
 * @module parsers/markdown
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import type { Root, Heading, RootContent } from 'mdast';
import type { Position, ParseWarning, WarningCode } from '../tools/config/types';

/**
 * Extracted heading information.
 */
export interface HeadingInfo {
  /** Heading text */
  text: string;
  /** Heading level (1-6) */
  level: number;
  /** Position in source */
  position?: Position;
}

/**
 * Extracted code block information.
 */
export interface CodeBlockInfo {
  /** Language identifier */
  language?: string;
  /** Code content */
  content: string;
  /** Additional meta after language */
  meta?: string;
  /** Position in source */
  position?: Position;
  /** Line count */
  lineCount: number;
}

/**
 * Result of parsing markdown.
 */
export interface MarkdownParseResult {
  /** mdast AST root node */
  ast: Root;
  /** Original content */
  raw: string;
  /** Line count */
  lineCount: number;
  /** Extracted headings */
  headings: HeadingInfo[];
  /** Extracted code blocks */
  codeBlocks: CodeBlockInfo[];
  /** Parse warnings */
  warnings: ParseWarning[];
}

/**
 * Convert mdast position to our Position type.
 */
function convertPosition(pos: Root['position']): Position | undefined {
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

/**
 * Check for unclosed code blocks in content.
 */
function detectUnclosedCodeBlocks(content: string): ParseWarning[] {
  const warnings: ParseWarning[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockFence = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line?.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockStart = i + 1;
        codeBlockFence = fenceMatch[1] ?? '';
      } else if (line?.startsWith(codeBlockFence)) {
        inCodeBlock = false;
        codeBlockFence = '';
      }
    }
  }

  if (inCodeBlock) {
    warnings.push({
      code: 'UNCLOSED_CODE_BLOCK' as WarningCode,
      message: `Unclosed code block starting at line ${codeBlockStart}`,
      position: {
        start: { line: codeBlockStart, column: 1 },
        end: { line: lines.length, column: 1 },
      },
      recoverable: true,
    });
  }

  return warnings;
}

/**
 * Parse markdown content into AST with extracted information.
 *
 * @param content - Markdown content to parse
 * @returns Parsed markdown result
 */
export async function parseMarkdown(content: string): Promise<MarkdownParseResult> {
  const warnings: ParseWarning[] = [];

  // Check for unclosed code blocks
  warnings.push(...detectUnclosedCodeBlocks(content));

  // Create unified processor with plugins
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm);

  // Parse content
  const ast = processor.parse(content);

  // Extract headings
  const headings: HeadingInfo[] = [];
  const codeBlocks: CodeBlockInfo[] = [];

  function visit(node: RootContent | Root): void {
    if (node.type === 'heading') {
      const heading = node;
      const headingInfo: HeadingInfo = {
        text: extractHeadingText(heading),
        level: heading.depth,
      };
      const pos = convertPosition(heading.position);
      if (pos) headingInfo.position = pos;
      headings.push(headingInfo);
    }

    if (node.type === 'code') {
      const code = node;
      const blockInfo: CodeBlockInfo = {
        content: code.value,
        lineCount: code.value.split('\n').length,
      };
      if (code.lang) blockInfo.language = code.lang;
      if (code.meta) blockInfo.meta = code.meta;
      const pos = convertPosition(code.position);
      if (pos) blockInfo.position = pos;
      codeBlocks.push(blockInfo);
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child as RootContent);
      }
    }
  }

  visit(ast);

  return await Promise.resolve({
    ast,
    raw: content,
    lineCount: content.split('\n').length,
    headings,
    codeBlocks,
    warnings,
  });
}

/**
 * Parse markdown content synchronously.
 * Useful for simple parsing without async overhead.
 */
export function parseMarkdownSync(content: string): MarkdownParseResult {
  const warnings: ParseWarning[] = [];

  warnings.push(...detectUnclosedCodeBlocks(content));

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm);

  const ast = processor.parse(content);

  const headings: HeadingInfo[] = [];
  const codeBlocks: CodeBlockInfo[] = [];

  function visit(node: RootContent | Root): void {
    if (node.type === 'heading') {
      const heading = node;
      const headingInfo: HeadingInfo = {
        text: extractHeadingText(heading),
        level: heading.depth,
      };
      const pos = convertPosition(heading.position);
      if (pos) headingInfo.position = pos;
      headings.push(headingInfo);
    }

    if (node.type === 'code') {
      const code = node;
      const blockInfo: CodeBlockInfo = {
        content: code.value,
        lineCount: code.value.split('\n').length,
      };
      if (code.lang) blockInfo.language = code.lang;
      if (code.meta) blockInfo.meta = code.meta;
      const pos = convertPosition(code.position);
      if (pos) blockInfo.position = pos;
      codeBlocks.push(blockInfo);
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child as RootContent);
      }
    }
  }

  visit(ast);

  return {
    ast,
    raw: content,
    lineCount: content.split('\n').length,
    headings,
    codeBlocks,
    warnings,
  };
}
