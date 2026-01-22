/**
 * Wiring Test Utilities
 *
 * Helper functions for verifying that components are actually integrated
 * into the system, not just built and tested in isolation.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import * as path from 'path';

export interface ExportInfo {
  name: string;
  type: 'function' | 'const' | 'class' | 'interface' | 'type';
  file: string;
  line: number;
}

export interface ImportInfo {
  symbol: string;
  fromFile: string;
  toFile: string;
}

/**
 * Simple glob implementation using fs
 */
function globSync(pattern: string, options?: { ignore?: string[] }): string[] {
  const results: string[] = [];
  const ignorePatterns = options?.ignore ?? [];

  // Extract base directory from pattern
  const parts = pattern.split('**/');
  const baseDir = parts[0] || '.';
  const extensions = pattern.match(/\.\{([^}]+)\}/)?.[1]?.split(',') ?? ['.ts'];

  function shouldIgnore(filePath: string): boolean {
    return ignorePatterns.some((p) => {
      if (p.includes('**/')) {
        const suffix = p.replace('**/', '');
        return filePath.includes(suffix);
      }
      return filePath.includes(p);
    });
  }

  function walkDir(dir: string): void {
    if (!existsSync(dir)) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);

        if (shouldIgnore(fullPath)) continue;

        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (stat.isFile()) {
            const ext = path.extname(entry);
            if (extensions.some((e) => ext === `.${e}` || ext === e)) {
              results.push(fullPath);
            }
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walkDir(baseDir);
  return results;
}

/**
 * Extract all exports from a TypeScript file
 */
export function getExports(filePath: string): ExportInfo[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const exports: ExportInfo[] = [];

  const exportRegex = /^export\s+(function|const|class|interface|type)\s+(\w+)/;

  lines.forEach((line, index) => {
    const match = line.match(exportRegex);
    if (match && match[1] && match[2]) {
      exports.push({
        name: match[2],
        type: match[1] as ExportInfo['type'],
        file: filePath,
        line: index + 1,
      });
    }
  });

  // Also check for named exports: export { X, Y }
  const namedExportRegex = /^export\s*\{([^}]+)\}/;
  lines.forEach((line, index) => {
    const match = line.match(namedExportRegex);
    if (match && match[1]) {
      const names = match[1].split(',').map((n) => n.trim().split(' as ')[0]?.trim());
      names.forEach((name) => {
        if (name && !exports.some((e) => e.name === name)) {
          exports.push({
            name,
            type: 'const', // Default, actual type unknown
            file: filePath,
            line: index + 1,
          });
        }
      });
    }
  });

  return exports;
}

/**
 * Find all files that import a given symbol
 */
export function findImporters(symbol: string, searchDir: string = 'src'): string[] {
  const files = globSync(`${searchDir}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/*.d.ts'],
  });

  const importers: string[] = [];
  const importRegex = new RegExp(`import\\s*.*\\b${symbol}\\b.*from`);

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      if (importRegex.test(content)) {
        importers.push(file);
      }
    } catch {
      // Skip files we can't read
    }
  }

  return importers;
}

/**
 * Check if an export has an import path to an entry point
 */
export function hasImportPath(
  exportInfo: ExportInfo,
  entryPoint: string,
  searchDir: string = 'src'
): boolean {
  const visited = new Set<string>();

  function traceImports(currentSymbol: string, currentFile: string): boolean {
    if (visited.has(currentFile)) {
      return false;
    }
    visited.add(currentFile);

    // Check if we've reached the entry point
    if (currentFile.includes(entryPoint)) {
      return true;
    }

    // Find files that import from the current file
    const files = globSync(`${searchDir}/**/*.{ts,tsx}`, {
      ignore: ['**/node_modules/**', '**/*.d.ts'],
    });

    const currentFileName = path.basename(currentFile, path.extname(currentFile));

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');

        // Check for imports from this file
        const importPatterns = [
          // Relative imports: import { X } from './file'
          new RegExp(`from\\s+['"]\\.\\.?/[^'"]*${currentFileName}['"]`),
          // Also check if importing the symbol specifically
          new RegExp(`import\\s*.*\\b${currentSymbol}\\b.*from`),
        ];

        for (const pattern of importPatterns) {
          if (pattern.test(content)) {
            // Found an import, trace from this file
            const fileExports = getExports(file);
            for (const exp of fileExports) {
              if (traceImports(exp.name, file)) {
                return true;
              }
            }
            // Also check the file itself as a potential entry point
            if (file.includes(entryPoint)) {
              return true;
            }
          }
        }
      } catch {
        // Skip files we can't read
      }
    }

    return false;
  }

  return traceImports(exportInfo.name, exportInfo.file);
}

/**
 * Check if an export is only used by tests
 */
export function isTestOnlyUsage(symbol: string, sourceFile: string): boolean {
  const srcImporters = findImporters(symbol, 'src');
  const testImporters = findImporters(symbol, 'tests');

  // Filter out self-imports
  const srcImportersFiltered = srcImporters.filter((f) => f !== sourceFile);

  return srcImportersFiltered.length === 0 && testImporters.length > 0;
}

/**
 * Get all entry points for the application
 */
export function getEntryPoints(): string[] {
  return [
    'src/cli.ts',
    'src/cli/program.ts',
    'src/orchestration/tool-registry.ts',
    'src/orchestration/orchestrator.ts',
  ];
}

/**
 * Analyze wiring status for all exports in a directory
 */
export interface WiringReport {
  totalExports: number;
  integrated: ExportInfo[];
  testOnly: ExportInfo[];
  unintegrated: ExportInfo[];
}

export function analyzeWiring(directory: string = 'src'): WiringReport {
  const files = globSync(`${directory}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/*.d.ts', '**/index.ts'],
  });

  const report: WiringReport = {
    totalExports: 0,
    integrated: [],
    testOnly: [],
    unintegrated: [],
  };

  const entryPoints = getEntryPoints();

  for (const file of files) {
    const exports = getExports(file);
    report.totalExports += exports.length;

    for (const exp of exports) {
      const importers = findImporters(exp.name, directory);
      const importersFiltered = importers.filter((f) => f !== file);

      if (importersFiltered.length === 0) {
        // No imports from src/
        if (isTestOnlyUsage(exp.name, file)) {
          report.testOnly.push(exp);
        } else {
          report.unintegrated.push(exp);
        }
      } else {
        // Has imports, check if reaches entry point
        let reachesEntry = false;
        for (const entry of entryPoints) {
          if (hasImportPath(exp, entry, directory)) {
            reachesEntry = true;
            break;
          }
        }

        if (reachesEntry) {
          report.integrated.push(exp);
        } else {
          // Imported but doesn't reach entry point (disconnected subgraph)
          report.unintegrated.push(exp);
        }
      }
    }
  }

  return report;
}
