/**
 * EP01: Project Setup - Type Definitions
 *
 * These interfaces define the contracts for project configuration,
 * binary distribution, and release management.
 */

// =============================================================================
// Binary Distribution
// =============================================================================

/**
 * Supported operating systems for binary distribution
 */
export type Platform = 'darwin' | 'linux'

/**
 * Supported CPU architectures
 */
export type Architecture = 'arm64' | 'x64'

/**
 * Represents a compiled native executable
 */
export interface Binary {
  /** Operating system */
  platform: Platform
  /** CPU architecture */
  architecture: Architecture
  /** SemVer version (e.g., "0.1.0") */
  version: string
  /** SHA-256 checksum (64 hex characters) */
  checksum: string
  /** Binary filename (e.g., "agentlint-darwin-arm64") */
  filename: string
  /** File size in bytes */
  size: number
}

/**
 * All platform targets for binary compilation
 */
export const PLATFORM_TARGETS: readonly { platform: Platform; architecture: Architecture }[] = [
  { platform: 'darwin', architecture: 'arm64' },
  { platform: 'darwin', architecture: 'x64' },
  { platform: 'linux', architecture: 'arm64' },
  { platform: 'linux', architecture: 'x64' },
] as const

// =============================================================================
// Release Management
// =============================================================================

/**
 * Represents a versioned release on GitHub Releases
 */
export interface Release {
  /** Git tag (e.g., "v0.1.0") */
  tag: string
  /** Platform binaries (should be 4 entries) */
  binaries: Binary[]
  /** Release notes (auto-generated from commits) */
  changelog?: string
  /** ISO-8601 publication timestamp */
  publishedAt: string
  /** Published npm version (matches tag without "v" prefix) */
  npmVersion: string
}

// =============================================================================
// CLI Interface
// =============================================================================

/**
 * CLI exit codes
 */
export const ExitCode = {
  Success: 0,
  GeneralError: 1,
  InvalidArgument: 2,
  NetworkError: 3,
  ChecksumMismatch: 4,
} as const

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode]

/**
 * Version information returned by --version
 */
export interface VersionInfo {
  /** Package version */
  version: string
  /** Bun version (if running in Bun) */
  bunVersion?: string
  /** Node.js version (if running in Node) */
  nodeVersion?: string
  /** Platform identifier */
  platform: string
  /** Architecture identifier */
  arch: string
}

// =============================================================================
// Update Command
// =============================================================================

/**
 * Options for the update command
 */
export interface UpdateOptions {
  /** Force update even if already on latest */
  force?: boolean
  /** Specific version to update to */
  version?: string
}

/**
 * Result of an update operation
 */
export interface UpdateResult {
  /** Whether an update was performed */
  updated: boolean
  /** Previous version (if updated) */
  previousVersion?: string
  /** New version (if updated) */
  newVersion?: string
  /** Reason if not updated */
  reason?: 'already_latest' | 'network_error' | 'checksum_mismatch'
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
} as const
