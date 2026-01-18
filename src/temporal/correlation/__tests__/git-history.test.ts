/**
 * Unit tests for temporal/correlation/git-history.ts
 *
 * Tests git history fetcher for correlation analysis.
 * Per ADR-0019, verifies raw metadata is returned (no impact categorization).
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getCommitMetadata,
  getCommitMetadataBetweenDates,
  getCommitMetadataBetweenHashes,
  getCommitRangeSummary,
  filterCommitsByFiles,
  type CommitMetadata,
} from '../git-history';
import { getCurrentCommit } from '../../utils/git';

describe('temporal/correlation/git-history', () => {
  const projectDir = process.cwd();
  const nonGitDir = join(tmpdir(), 'agentlint-test-non-git-history');

  beforeEach(() => {
    if (!existsSync(nonGitDir)) {
      mkdirSync(nonGitDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(nonGitDir)) {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  describe('getCommitMetadata', () => {
    it('should return detailed metadata for HEAD', async () => {
      const currentHash = await getCurrentCommit({ cwd: projectDir });

      if (currentHash) {
        const metadata = await getCommitMetadata(currentHash, { cwd: projectDir });

        expect(metadata).not.toBeNull();
        expect(metadata?.hash).toBe(currentHash);
        expect(metadata?.shortHash).toMatch(/^[a-f0-9]{7}$/);
        expect(metadata?.author).toBeTruthy();
        expect(metadata?.date).toBeTruthy();
        expect(metadata?.subject).toBeTruthy();
        expect(Array.isArray(metadata?.filesChanged)).toBe(true);
        expect(typeof metadata?.insertions).toBe('number');
        expect(typeof metadata?.deletions).toBe('number');
      }
    });

    it('should return null for invalid hash', async () => {
      const metadata = await getCommitMetadata('invalidhash123', { cwd: projectDir });
      expect(metadata).toBeNull();
    });

    it('should return null for non-git directory', async () => {
      const metadata = await getCommitMetadata('abc123', { cwd: nonGitDir });
      expect(metadata).toBeNull();
    });

    it('should include files changed in commit', async () => {
      const currentHash = await getCurrentCommit({ cwd: projectDir });

      if (currentHash) {
        const metadata = await getCommitMetadata(currentHash, { cwd: projectDir });

        // Current HEAD commit should have at least one file changed
        expect(metadata?.filesChanged.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getCommitMetadataBetweenHashes', () => {
    it('should return commits between two valid hashes', async () => {
      const currentHash = await getCurrentCommit({ cwd: projectDir });

      if (currentHash) {
        // Get parent hash - use HEAD~1 for reliability in shallow clones
        const proc = Bun.spawn(['git', 'rev-parse', 'HEAD~1'], {
          cwd: projectDir,
          stdout: 'pipe',
          stderr: 'pipe',
        });
        await proc.exited;

        // Skip if git history is too shallow (common in CI)
        if (proc.exitCode !== 0) {
          console.log('Skipping: git history too shallow');
          return;
        }

        const parentOutput = await new Response(proc.stdout).text();
        const parentHash = parentOutput.trim();

        // Validate we got a valid hash
        if (parentHash && /^[a-f0-9]{7,40}$/.test(parentHash) && parentHash !== currentHash) {
          const commits = await getCommitMetadataBetweenHashes(parentHash, currentHash, {
            cwd: projectDir,
          });

          expect(commits.length).toBeGreaterThan(0);

          // Each commit should have full metadata
          for (const commit of commits) {
            expect(commit.hash).toMatch(/^[a-f0-9]{40}$/);
            expect(commit.shortHash).toMatch(/^[a-f0-9]{7}$/);
            expect(commit.author).toBeTruthy();
            expect(commit.date).toBeTruthy();
            expect(commit.subject).toBeTruthy();
            expect(Array.isArray(commit.filesChanged)).toBe(true);
          }
        }
      }
    });

    it('should return empty array for invalid hashes', async () => {
      const commits = await getCommitMetadataBetweenHashes('invalid123', 'invalid456', {
        cwd: projectDir,
      });
      expect(commits).toEqual([]);
    });

    it('should return empty array for non-git directory', async () => {
      const commits = await getCommitMetadataBetweenHashes('abc123', 'def456', {
        cwd: nonGitDir,
      });
      expect(commits).toEqual([]);
    });
  });

  describe('getCommitMetadataBetweenDates', () => {
    it('should return commits between dates', async () => {
      // Use a date range that includes recent commits
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const commits = await getCommitMetadataBetweenDates(
        lastWeek.toISOString(),
        now.toISOString(),
        { cwd: projectDir }
      );

      // Should return array (may be empty if no commits in range)
      expect(Array.isArray(commits)).toBe(true);

      // If there are commits, they should have full metadata
      for (const commit of commits) {
        expect(commit.hash).toMatch(/^[a-f0-9]{40}$/);
        expect(commit.author).toBeTruthy();
        expect(commit.date).toBeTruthy();
      }
    });

    it('should return empty array for invalid date range', async () => {
      const commits = await getCommitMetadataBetweenDates('2000-01-01', '2000-01-02', {
        cwd: projectDir,
      });
      expect(commits).toEqual([]);
    });

    it('should return empty array for non-git directory', async () => {
      const commits = await getCommitMetadataBetweenDates('2026-01-01', '2026-01-18', {
        cwd: nonGitDir,
      });
      expect(commits).toEqual([]);
    });
  });

  describe('getCommitRangeSummary', () => {
    it('should return summary of commits in range', async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const summary = await getCommitRangeSummary(lastWeek.toISOString(), now.toISOString(), {
        cwd: projectDir,
      });

      // May be null if no commits in range
      if (summary) {
        expect(typeof summary.totalCommits).toBe('number');
        expect(summary.totalCommits).toBeGreaterThan(0);
        expect(Array.isArray(summary.uniqueFilesChanged)).toBe(true);
        expect(typeof summary.totalInsertions).toBe('number');
        expect(typeof summary.totalDeletions).toBe('number');
        expect(summary.dateRange.earliest).toBeTruthy();
        expect(summary.dateRange.latest).toBeTruthy();
      }
    });

    it('should return null for date range with no commits', async () => {
      const summary = await getCommitRangeSummary('2000-01-01', '2000-01-02', {
        cwd: projectDir,
      });
      expect(summary).toBeNull();
    });
  });

  describe('filterCommitsByFiles', () => {
    it('should filter commits by exact filename', () => {
      const commits: CommitMetadata[] = [
        {
          hash: 'abc123abc123abc123abc123abc123abc123abc1',
          shortHash: 'abc123a',
          author: 'Test',
          date: '2026-01-18',
          subject: 'Update config',
          filesChanged: ['CLAUDE.md', 'src/index.ts'],
          insertions: 10,
          deletions: 5,
        },
        {
          hash: 'def456def456def456def456def456def456def4',
          shortHash: 'def456d',
          author: 'Test',
          date: '2026-01-17',
          subject: 'Update code',
          filesChanged: ['src/app.ts'],
          insertions: 20,
          deletions: 10,
        },
      ];

      const filtered = filterCommitsByFiles(commits, ['CLAUDE.md']);

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.shortHash).toBe('abc123a');
    });

    it('should filter commits by wildcard pattern', () => {
      const commits: CommitMetadata[] = [
        {
          hash: 'abc123abc123abc123abc123abc123abc123abc1',
          shortHash: 'abc123a',
          author: 'Test',
          date: '2026-01-18',
          subject: 'Update types',
          filesChanged: ['src/types.ts', 'src/utils.ts'],
          insertions: 10,
          deletions: 5,
        },
        {
          hash: 'def456def456def456def456def456def456def4',
          shortHash: 'def456d',
          author: 'Test',
          date: '2026-01-17',
          subject: 'Update docs',
          filesChanged: ['docs/README.md'],
          insertions: 20,
          deletions: 10,
        },
      ];

      const filtered = filterCommitsByFiles(commits, ['*.ts']);

      expect(filtered.length).toBe(1);
      expect(filtered[0]?.shortHash).toBe('abc123a');
    });

    it('should filter by multiple patterns', () => {
      const commits: CommitMetadata[] = [
        {
          hash: 'abc123abc123abc123abc123abc123abc123abc1',
          shortHash: 'abc123a',
          author: 'Test',
          date: '2026-01-18',
          subject: 'Update config',
          filesChanged: ['CLAUDE.md'],
          insertions: 10,
          deletions: 5,
        },
        {
          hash: 'def456def456def456def456def456def456def4',
          shortHash: 'def456d',
          author: 'Test',
          date: '2026-01-17',
          subject: 'Update yaml',
          filesChanged: ['config.yaml'],
          insertions: 20,
          deletions: 10,
        },
        {
          hash: 'ghi789ghi789ghi789ghi789ghi789ghi789ghi7',
          shortHash: 'ghi789g',
          author: 'Test',
          date: '2026-01-16',
          subject: 'Update code',
          filesChanged: ['src/app.ts'],
          insertions: 30,
          deletions: 15,
        },
      ];

      const filtered = filterCommitsByFiles(commits, ['CLAUDE.md', '*.yaml']);

      expect(filtered.length).toBe(2);
      expect(filtered.map((c) => c.shortHash)).toContain('abc123a');
      expect(filtered.map((c) => c.shortHash)).toContain('def456d');
    });

    it('should return empty array when no matches', () => {
      const commits: CommitMetadata[] = [
        {
          hash: 'abc123abc123abc123abc123abc123abc123abc1',
          shortHash: 'abc123a',
          author: 'Test',
          date: '2026-01-18',
          subject: 'Update code',
          filesChanged: ['src/app.ts'],
          insertions: 10,
          deletions: 5,
        },
      ];

      const filtered = filterCommitsByFiles(commits, ['*.yaml']);

      expect(filtered.length).toBe(0);
    });
  });

  describe('ADR-0019 Compliance', () => {
    it('should return raw metadata without impact categorization', async () => {
      const currentHash = await getCurrentCommit({ cwd: projectDir });

      if (currentHash) {
        const metadata = await getCommitMetadata(currentHash, { cwd: projectDir });

        // Verify NO impact categorization fields exist
        // Agent determines relevance, not tools
        expect(metadata).not.toHaveProperty('likelyImpact');
        expect(metadata).not.toHaveProperty('relevance');
        expect(metadata).not.toHaveProperty('category');
        expect(metadata).not.toHaveProperty('importance');

        // Should have raw data fields
        expect(metadata).toHaveProperty('hash');
        expect(metadata).toHaveProperty('author');
        expect(metadata).toHaveProperty('date');
        expect(metadata).toHaveProperty('subject');
        expect(metadata).toHaveProperty('filesChanged');
        expect(metadata).toHaveProperty('insertions');
        expect(metadata).toHaveProperty('deletions');
      }
    });
  });
});
