/**
 * Performance tests for security pattern detection
 *
 * Tests that security scanning meets performance targets:
 * - Content scan < 100ms for typical files
 * - File scan < 1s
 *
 * @module tests/performance/security-detector
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { SecretDetector, createSecretDetector } from '../../src/security';

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate a realistic source code file with potential secrets.
 */
function generateSourceFile(lines: number, withSecrets: boolean = true): string {
  const codeTemplates = [
    'import { useState, useEffect } from "react";',
    'const API_URL = process.env.API_URL || "http://localhost:3000";',
    'export function fetchData(endpoint: string) {',
    '  return fetch(`${API_URL}/${endpoint}`).then(r => r.json());',
    '}',
    'interface Config {',
    '  apiKey: string;',
    '  baseUrl: string;',
    '  timeout: number;',
    '}',
    '// TODO: Add error handling',
    'function processRequest(data: unknown) {',
    '  console.log("Processing:", data);',
    '  return data;',
    '}',
    'export const DEFAULT_TIMEOUT = 30000;',
    'const retry = (fn: () => Promise<unknown>, attempts = 3) => {',
    '  return fn().catch(err => attempts > 0 ? retry(fn, attempts - 1) : Promise.reject(err));',
    '};',
  ];

  const secretTemplates = [
    'const API_KEY = "sk-proj-abc123def456ghi789jkl012mno345pqr678stu901";',
    'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";',
    'const GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";',
    'const DB_URL = "postgresql://admin:secretpass123@db.example.com:5432/prod";',
    'const JWT_SECRET = "super-secret-jwt-key-do-not-share";',
    'const STRIPE_KEY = "sk_live_1234567890abcdefghijklmnopqrstuvwxyz";',
  ];

  const result: string[] = [];

  for (let i = 0; i < lines; i++) {
    if (withSecrets && i % 50 === 0 && secretTemplates.length > 0) {
      // Add a secret every 50 lines
      result.push(secretTemplates[Math.floor(i / 50) % secretTemplates.length]!);
    } else {
      result.push(codeTemplates[i % codeTemplates.length]!);
    }
  }

  return result.join('\n');
}

/**
 * Generate a realistic config file with potential secrets.
 */
function generateConfigFile(hasSecrets: boolean = true): string {
  if (hasSecrets) {
    return JSON.stringify(
      {
        database: {
          host: 'localhost',
          port: 5432,
          username: 'admin',
          password: 'super_secret_password_123',
        },
        api: {
          key: 'sk-proj-abc123def456ghi789',
          secret: 'very-secret-api-secret',
        },
        aws: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      database: {
        host: 'localhost',
        port: 5432,
        username: 'admin',
        passwordFromEnv: 'DB_PASSWORD',
      },
      api: {
        keyFromEnv: 'API_KEY',
      },
    },
    null,
    2
  );
}

/**
 * Generate an environment file with secrets.
 */
function generateEnvFile(): string {
  return `
DATABASE_URL=postgresql://user:password123@localhost:5432/mydb
API_KEY=sk-proj-abc123def456ghi789jkl012mno345pqr678
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_1234567890abcdefghijklmnopqrstuvwxyz
JWT_SECRET=my-super-secret-jwt-key
REDIS_URL=redis://:password@localhost:6379
`.trim();
}

// =============================================================================
// Performance Tests
// =============================================================================

describe('Security Detector Performance', () => {
  const testDir = join(tmpdir(), 'agentlint-security-perf');
  let detector: SecretDetector;

  beforeAll(async () => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Create detector with patterns loaded
    detector = createSecretDetector();
    await detector.loadPatterns();
  });

  afterAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('Content scanning', () => {
    it('should scan 1KB content in < 50ms', async () => {
      const content = generateSourceFile(50, true);

      const startTime = performance.now();
      const results = await detector.scanFile('test.ts', content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(50);
      console.log(`Scanned 1KB in ${elapsed.toFixed(2)}ms, found ${results.candidateCount} candidates`);
    });

    it('should scan 10KB content in < 100ms', async () => {
      const content = generateSourceFile(500, true);

      const startTime = performance.now();
      const results = await detector.scanFile('test.ts', content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(100);
      console.log(`Scanned 10KB in ${elapsed.toFixed(2)}ms, found ${results.candidateCount} candidates`);
    });

    it('should scan 100KB content in < 500ms', async () => {
      const content = generateSourceFile(5000, true);

      const startTime = performance.now();
      const results = await detector.scanFile('test.ts', content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(500);
      console.log(`Scanned 100KB in ${elapsed.toFixed(2)}ms, found ${results.candidateCount} candidates`);
    });

    it('should scan 500KB content in < 2000ms', async () => {
      const content = generateSourceFile(25000, true);

      const startTime = performance.now();
      const results = await detector.scanFile('test.ts', content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(2000);
      console.log(`Scanned 500KB in ${elapsed.toFixed(2)}ms, found ${results.candidateCount} candidates`);
    });
  });

  describe('File scanning', () => {
    it('should scan a source file in < 1s', async () => {
      const filePath = join(testDir, 'source.ts');
      const content = generateSourceFile(1000, true);
      writeFileSync(filePath, content);

      const startTime = performance.now();
      const results = await detector.scanFile(filePath, content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(1000);
      console.log(`Scanned source file in ${elapsed.toFixed(2)}ms`);
    });

    it('should scan a config file in < 200ms', async () => {
      const filePath = join(testDir, 'config.json');
      const content = generateConfigFile(true);
      writeFileSync(filePath, content);

      const startTime = performance.now();
      const results = await detector.scanFile(filePath, content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(200);
      console.log(`Scanned config file in ${elapsed.toFixed(2)}ms`);
    });

    it('should scan an env file in < 200ms', async () => {
      const filePath = join(testDir, '.env');
      const content = generateEnvFile();
      writeFileSync(filePath, content);

      const startTime = performance.now();
      const results = await detector.scanFile(filePath, content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(200);
      console.log(`Scanned env file in ${elapsed.toFixed(2)}ms`);
    });

    it('should handle large files (1MB) in < 10s', async () => {
      const filePath = join(testDir, 'large.ts');
      const content = generateSourceFile(50000, true);
      writeFileSync(filePath, content);

      const startTime = performance.now();
      const results = await detector.scanFile(filePath, content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(10000);
      console.log(`Scanned 1MB file in ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Batch file scanning', () => {
    it('should scan 10 files in < 5s', async () => {
      const scanDir = join(testDir, 'small-project');
      mkdirSync(scanDir, { recursive: true });

      // Create 10 files
      const files: Array<{ path: string; content: string }> = [];
      for (let i = 0; i < 10; i++) {
        const filePath = join(scanDir, `file${i}.ts`);
        const content = generateSourceFile(100, i % 3 === 0);
        writeFileSync(filePath, content);
        files.push({ path: filePath, content });
      }

      const startTime = performance.now();

      // Scan all files
      const results: unknown[] = [];
      for (const file of files) {
        const scanResults = await detector.scanFile(file.path, file.content);
        results.push(scanResults);
      }

      const elapsed = performance.now() - startTime;

      expect(results.length).toBe(10);
      expect(elapsed).toBeLessThan(5000);
      console.log(`Scanned 10 files in ${elapsed.toFixed(2)}ms`);
    });

    it('should scan 50 files in < 30s', async () => {
      const scanDir = join(testDir, 'medium-project');
      mkdirSync(scanDir, { recursive: true });

      // Create 50 files
      const files: Array<{ path: string; content: string }> = [];
      for (let i = 0; i < 50; i++) {
        const filePath = join(scanDir, `file${i}.ts`);
        const content = generateSourceFile(50, i % 5 === 0);
        writeFileSync(filePath, content);
        files.push({ path: filePath, content });
      }

      const startTime = performance.now();

      const results: unknown[] = [];
      for (const file of files) {
        const scanResults = await detector.scanFile(file.path, file.content);
        results.push(scanResults);
      }

      const elapsed = performance.now() - startTime;

      expect(results.length).toBe(50);
      expect(elapsed).toBeLessThan(30000);
      console.log(`Scanned 50 files in ${elapsed.toFixed(2)}ms`);
    });
  });

  describe('Pattern efficiency', () => {
    it('should handle content with no secrets efficiently', async () => {
      // Generate truly clean content with no secret-like patterns
      const cleanContent = Array(1000)
        .fill(null)
        .map((_, i) => `function process${i}(data: unknown): boolean { return data !== null; }`)
        .join('\n');

      const startTime = performance.now();
      const results = await detector.scanFile('clean.ts', cleanContent);
      const elapsed = performance.now() - startTime;

      expect(results.candidateCount).toBe(0);
      expect(elapsed).toBeLessThan(200);
      console.log(`Clean file scan: ${elapsed.toFixed(2)}ms`);
    });

    it('should handle content with many potential secrets efficiently', async () => {
      // Every line has a potential secret-like pattern
      const secretLines = Array(500)
        .fill(null)
        .map(
          (_, i) =>
            `const KEY_${i} = "sk-proj-${crypto.randomUUID().replace(/-/g, '')}";`
        )
        .join('\n');

      const startTime = performance.now();
      const results = await detector.scanFile('secrets.ts', secretLines);
      const elapsed = performance.now() - startTime;

      expect(results.candidateCount).toBeGreaterThanOrEqual(0);
      expect(elapsed).toBeLessThan(1000);
      console.log(`500 potential secrets scan: ${elapsed.toFixed(2)}ms, found ${results.candidateCount}`);
    });

    it('should handle mixed content efficiently', async () => {
      const content =
        generateSourceFile(1000, true) +
        '\n' +
        generateConfigFile(true) +
        '\n' +
        generateEnvFile();

      const startTime = performance.now();
      const results = await detector.scanFile('mixed.ts', content);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(500);
      console.log(`Mixed content scan: ${elapsed.toFixed(2)}ms, found ${results.candidateCount}`);
    });
  });

  describe('Repeated scanning efficiency', () => {
    it('should maintain consistent performance over 100 iterations', async () => {
      const content = generateSourceFile(100, true);
      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        await detector.scanFile('test.ts', content);
        times.push(performance.now() - startTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      expect(avgTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(200);

      console.log(
        `100 iterations: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty content quickly', async () => {
      const startTime = performance.now();
      const results = await detector.scanFile('empty.ts', '');
      const elapsed = performance.now() - startTime;

      expect(results.candidateCount).toBe(0);
      expect(elapsed).toBeLessThan(10);
    });

    it('should handle very long lines efficiently', async () => {
      const longLine = 'x'.repeat(100000) + 'AKIAIOSFODNN7EXAMPLE' + 'y'.repeat(100000);

      const startTime = performance.now();
      const results = await detector.scanFile('longline.ts', longLine);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(500);
      console.log(`Long line scan: ${elapsed.toFixed(2)}ms`);
    });

    it('should handle unicode content gracefully', async () => {
      const unicodeContent =
        '// 你好世界 🚀 αβγ\n' +
        'const API_KEY = "AKIAIOSFODNN7EXAMPLE";\n' +
        '// More unicode: カタカナ ひらがな\n';

      const startTime = performance.now();
      const results = await detector.scanFile('unicode.ts', unicodeContent);
      const elapsed = performance.now() - startTime;

      expect(results).toBeDefined();
      expect(elapsed).toBeLessThan(50);
    });
  });
});
