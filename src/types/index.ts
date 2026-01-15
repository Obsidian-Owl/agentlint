/**
 * Core type definitions for agentlint CLI
 *
 * These types define the contracts for binary distribution and release management.
 */

// =============================================================================
// Platform & Architecture
// =============================================================================

/**
 * Supported operating systems for binary distribution
 */
export type Platform = 'darwin' | 'linux';

/**
 * Supported CPU architectures
 */
export type Architecture = 'arm64' | 'x64';

/**
 * All platform targets for binary compilation
 */
export const PLATFORM_TARGETS: readonly { platform: Platform; architecture: Architecture }[] = [
  { platform: 'darwin', architecture: 'arm64' },
  { platform: 'darwin', architecture: 'x64' },
  { platform: 'linux', architecture: 'arm64' },
  { platform: 'linux', architecture: 'x64' },
] as const;

// =============================================================================
// Binary Distribution
// =============================================================================

/**
 * Represents a compiled native executable
 */
export interface Binary {
  /** Operating system */
  platform: Platform;
  /** CPU architecture */
  architecture: Architecture;
  /** SemVer version (e.g., "0.1.0") */
  version: string;
  /** SHA-256 checksum (64 hex characters) */
  checksum: string;
  /** Binary filename (e.g., "agentlint-darwin-arm64") */
  filename: string;
  /** File size in bytes */
  size: number;
}

// =============================================================================
// Release Management
// =============================================================================

/**
 * Represents a versioned release on GitHub Releases
 */
export interface Release {
  /** Git tag (e.g., "v0.1.0") */
  tag: string;
  /** Platform binaries (should be 4 entries) */
  binaries: Binary[];
  /** Release notes (auto-generated from commits) */
  changelog?: string;
  /** ISO-8601 publication timestamp */
  publishedAt: string;
  /** Published npm version (matches tag without "v" prefix) */
  npmVersion: string;
}

// =============================================================================
// Installation
// =============================================================================

/**
 * Installation locations
 */
export const InstallPaths = {
  /** Default binary installation directory */
  binDir: '~/.agentlint/bin',
  /** Binary executable name */
  binary: 'agentlint',
  /** Full default path */
  fullPath: '~/.agentlint/bin/agentlint',
} as const;
