/**
 * Unit tests for temporal/utils/git.ts
 *
 * Tests git utilities for commit extraction and repository detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getCurrentCommit,
  getCommitInfo,
  isGitRepository,
  getRepositoryRoot,
  getCurrentBranch,
  getCommitsBetweenHashes,
  getCommitDetailsBetweenHashes,
} from '../git';

describe('temporal/utils/git', () => {
  // Test in the actual project directory (which is a git repo)
  const projectDir = process.cwd();

  // Test in a non-git directory
  const nonGitDir = join(tmpdir(), 'agentlint-test-non-git');

  beforeEach(() => {
    // Create non-git test directory
    if (!existsSync(nonGitDir)) {
      mkdirSync(nonGitDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up
    if (existsSync(nonGitDir)) {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  describe('getCurrentCommit', () => {
    it('should return a commit hash in a git repository', async () => {
      const commit = await getCurrentCommit({ cwd: projectDir });

      expect(commit).not.toBeNull();
      expect(commit).toMatch(/^[a-f0-9]{40}$/); // Full SHA-1 hash
    });

    it('should return null in a non-git directory', async () => {
      const commit = await getCurrentCommit({ cwd: nonGitDir });

      expect(commit).toBeNull();
    });

    it('should respect the cwd option', async () => {
      const commit = await getCurrentCommit({ cwd: projectDir });

      expect(commit).not.toBeNull();
    });

    it('should handle timeout gracefully', async () => {
      // A very short timeout should still work for local git commands
      const commit = await getCurrentCommit({ cwd: projectDir, timeout: 5000 });

      expect(commit).not.toBeNull();
    });
  });

  describe('getCommitInfo', () => {
    it('should return commit info for HEAD', async () => {
      const info = await getCommitInfo('HEAD', { cwd: projectDir });

      expect(info).not.toBeNull();
      expect(info?.hash).toMatch(/^[a-f0-9]{40}$/);
      expect(info?.shortHash).toMatch(/^[a-f0-9]{7}$/);
    });

    it('should include author and date when available', async () => {
      const info = await getCommitInfo('HEAD', { cwd: projectDir });

      expect(info).not.toBeNull();
      expect(info?.author).toBeTruthy();
      expect(info?.date).toBeTruthy();
      expect(info?.subject).toBeTruthy();
    });

    it('should return null for non-existent commit', async () => {
      const info = await getCommitInfo('nonexistent12345', { cwd: projectDir });

      expect(info).toBeNull();
    });

    it('should return null in a non-git directory', async () => {
      const info = await getCommitInfo('HEAD', { cwd: nonGitDir });

      expect(info).toBeNull();
    });
  });

  describe('isGitRepository', () => {
    it('should return true for a git repository', async () => {
      const isRepo = await isGitRepository({ cwd: projectDir });

      expect(isRepo).toBe(true);
    });

    it('should return false for a non-git directory', async () => {
      const isRepo = await isGitRepository({ cwd: nonGitDir });

      expect(isRepo).toBe(false);
    });

    it('should return false for a non-existent directory', async () => {
      const isRepo = await isGitRepository({ cwd: '/non/existent/path' });

      expect(isRepo).toBe(false);
    });
  });

  describe('getRepositoryRoot', () => {
    it('should return the repository root for a git repository', async () => {
      const root = await getRepositoryRoot({ cwd: projectDir });

      expect(root).not.toBeNull();
      // Should return an absolute path
      expect(root?.startsWith('/')).toBe(true);
    });

    it('should return null for a non-git directory', async () => {
      const root = await getRepositoryRoot({ cwd: nonGitDir });

      expect(root).toBeNull();
    });

    it('should work from nested directories', async () => {
      // Create a nested directory in the project
      const nestedDir = join(projectDir, 'src', 'temporal');
      const root = await getRepositoryRoot({ cwd: nestedDir });

      expect(root).not.toBeNull();
      // The root should be the project directory (or ancestor)
      expect(root).toBeTruthy();
    });
  });

  describe('getCurrentBranch', () => {
    it('should return the current branch name', async () => {
      const branch = await getCurrentBranch({ cwd: projectDir });

      // Should return a branch name (may be null if in detached HEAD state)
      // In normal development, this should return the current branch
      if (branch !== null) {
        expect(branch.length).toBeGreaterThan(0);
        expect(branch).not.toBe('HEAD');
      }
    });

    it('should return null for a non-git directory', async () => {
      const branch = await getCurrentBranch({ cwd: nonGitDir });

      expect(branch).toBeNull();
    });
  });

  describe('getCommitsBetweenHashes', () => {
    it('should return commits between two valid hashes', async () => {
      // Get current commit and a parent to test with
      const currentCommit = await getCurrentCommit({ cwd: projectDir });

      if (currentCommit) {
        // Get the parent commit - use ~1 for reliability in shallow clones
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
        const parentCommit = parentOutput.trim();

        // Validate we got a valid hash
        if (
          parentCommit &&
          /^[a-f0-9]{7,40}$/.test(parentCommit) &&
          parentCommit !== currentCommit
        ) {
          const commits = await getCommitsBetweenHashes(parentCommit, currentCommit, {
            cwd: projectDir,
          });

          // Should return some commits between parent and current
          expect(commits.length).toBeGreaterThan(0);
          // Each commit should have the format "hash: message"
          for (const commit of commits) {
            expect(commit).toMatch(/^[a-f0-9]+: .+/);
          }
        }
      }
    });

    it('should return empty array for invalid hashes', async () => {
      const commits = await getCommitsBetweenHashes('invalidhash123', 'invalidhash456', {
        cwd: projectDir,
      });

      expect(commits).toEqual([]);
    });

    it('should return empty array for non-git directory', async () => {
      const commits = await getCommitsBetweenHashes('abc123', 'def456', { cwd: nonGitDir });

      expect(commits).toEqual([]);
    });
  });

  describe('getCommitDetailsBetweenHashes', () => {
    it('should return detailed commit info between two valid hashes', async () => {
      // Get current commit and a parent to test with
      const currentCommit = await getCurrentCommit({ cwd: projectDir });

      if (currentCommit) {
        // Get a parent commit - use HEAD~1 for reliability in shallow clones
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
        const parentCommit = parentOutput.trim();

        // Validate we got a valid hash
        if (
          parentCommit &&
          /^[a-f0-9]{7,40}$/.test(parentCommit) &&
          parentCommit !== currentCommit
        ) {
          const commits = await getCommitDetailsBetweenHashes(parentCommit, currentCommit, {
            cwd: projectDir,
          });

          // Should return some commits between parent and current
          expect(commits.length).toBeGreaterThan(0);

          // Each commit should have full info
          for (const commit of commits) {
            expect(commit.hash).toMatch(/^[a-f0-9]{40}$/);
            expect(commit.shortHash).toMatch(/^[a-f0-9]{7}$/);
            expect(commit.author).toBeTruthy();
            expect(commit.date).toBeTruthy();
            expect(commit.subject).toBeTruthy();
          }
        }
      }
    });

    it('should return empty array for invalid hashes', async () => {
      const commits = await getCommitDetailsBetweenHashes('invalidhash123', 'invalidhash456', {
        cwd: projectDir,
      });

      expect(commits).toEqual([]);
    });

    it('should return empty array for non-git directory', async () => {
      const commits = await getCommitDetailsBetweenHashes('abc123', 'def456', { cwd: nonGitDir });

      expect(commits).toEqual([]);
    });
  });
});
