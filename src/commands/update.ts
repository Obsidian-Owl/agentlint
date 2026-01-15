/**
 * Self-update command for agentlint CLI
 *
 * Downloads and installs the latest version from GitHub Releases.
 */

import { getVersion } from '../version';
import { NetworkError, ChecksumMismatchError, ExitCode } from '../errors';
import type { Platform, Architecture } from '../types';

// =============================================================================
// Configuration
// =============================================================================

const REPO = 'Obsidian-Owl/agentlint';
const GITHUB_API = 'https://api.github.com';
const GITHUB_RELEASES = `https://github.com/${REPO}/releases/download`;

// =============================================================================
// Types
// =============================================================================

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

export interface UpdateResult {
  updated: boolean;
  currentVersion: string;
  latestVersion: string;
  message: string;
}

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Get current platform identifier
 */
export function getCurrentPlatform(): Platform {
  const platform = process.platform;
  if (platform === 'darwin') return 'darwin';
  if (platform === 'linux') return 'linux';
  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Get current architecture identifier
 */
export function getCurrentArch(): Architecture {
  const arch = process.arch;
  if (arch === 'arm64') return 'arm64';
  if (arch === 'x64') return 'x64';
  throw new Error(`Unsupported architecture: ${arch}`);
}

/**
 * Get binary filename for current platform
 */
export function getBinaryFilename(): string {
  const platform = getCurrentPlatform();
  const arch = getCurrentArch();
  return `agentlint-${platform}-${arch}`;
}

// =============================================================================
// Version Comparison
// =============================================================================

/**
 * Parse version string to comparable parts
 */
export function parseVersion(version: string): [number, number, number] {
  const clean = version.replace(/^v/, '');
  const parts = clean.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);

  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1;
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1;
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
  return 0;
}

// =============================================================================
// Network Operations
// =============================================================================

/**
 * Fetch latest release info from GitHub
 */
export async function fetchLatestRelease(): Promise<GitHubRelease> {
  const url = `${GITHUB_API}/repos/${REPO}/releases/latest`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'agentlint-cli',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new NetworkError('No releases found');
      }
      throw new NetworkError(`GitHub API error: ${response.status}`);
    }

    return (await response.json()) as GitHubRelease;
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    throw new NetworkError(`Failed to fetch release info: ${String(error)}`);
  }
}

/**
 * Download binary from GitHub release
 */
export async function downloadBinary(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'agentlint-cli',
      },
    });

    if (!response.ok) {
      throw new NetworkError(`Failed to download binary: ${response.status}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    throw new NetworkError(`Download failed: ${String(error)}`);
  }
}

/**
 * Fetch checksums file from release
 */
export async function fetchChecksums(version: string): Promise<Map<string, string>> {
  const url = `${GITHUB_RELEASES}/${version}/checksums.txt`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'agentlint-cli',
      },
    });

    if (!response.ok) {
      throw new NetworkError(`Failed to fetch checksums: ${response.status}`);
    }

    const text = await response.text();
    const checksums = new Map<string, string>();

    for (const line of text.split('\n')) {
      const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
      if (match && match[1] && match[2]) {
        checksums.set(match[2], match[1]);
      }
    }

    return checksums;
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    throw new NetworkError(`Failed to fetch checksums: ${String(error)}`);
  }
}

// =============================================================================
// Checksum Verification
// =============================================================================

/**
 * Calculate SHA-256 checksum of data
 */
export async function calculateChecksum(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify binary checksum
 */
export async function verifyChecksum(data: ArrayBuffer, expectedChecksum: string): Promise<void> {
  const actualChecksum = await calculateChecksum(data);

  if (actualChecksum !== expectedChecksum) {
    throw new ChecksumMismatchError(expectedChecksum, actualChecksum);
  }
}

// =============================================================================
// Installation
// =============================================================================

/**
 * Get path to current executable
 */
export function getExecutablePath(): string {
  // In Bun, use Bun.main or process.execPath
  if (typeof Bun !== 'undefined' && Bun.main) {
    // If running as compiled binary, Bun.main is the binary path
    return process.execPath;
  }
  return process.execPath;
}

/**
 * Replace current binary with new one
 */
export async function replaceBinary(newBinaryData: ArrayBuffer, targetPath: string): Promise<void> {
  const tempPath = `${targetPath}.new`;
  const backupPath = `${targetPath}.bak`;

  try {
    // Write new binary to temp location
    await Bun.write(tempPath, newBinaryData);

    // Make executable
    const { chmod } = await import('node:fs/promises');
    await chmod(tempPath, 0o755);

    // Backup current binary
    const { rename, unlink } = await import('node:fs/promises');
    try {
      await rename(targetPath, backupPath);
    } catch {
      // No existing binary to backup
    }

    // Move new binary into place
    await rename(tempPath, targetPath);

    // Remove backup
    try {
      await unlink(backupPath);
    } catch {
      // Ignore cleanup errors
    }
  } catch (error) {
    // Cleanup on failure
    const { unlink } = await import('node:fs/promises');
    try {
      await unlink(tempPath);
    } catch {
      // Ignore
    }
    throw error;
  }
}

// =============================================================================
// Main Update Command
// =============================================================================

/**
 * Check for and install updates
 */
export async function update(options: { force?: boolean } = {}): Promise<UpdateResult> {
  const currentVersion = getVersion().version;

  // Fetch latest release
  console.log('Checking for updates...');
  const release = await fetchLatestRelease();
  const latestVersion = release.tag_name.replace(/^v/, '');

  // Compare versions
  const comparison = compareVersions(currentVersion, latestVersion);

  if (comparison >= 0 && !options.force) {
    return {
      updated: false,
      currentVersion,
      latestVersion,
      message: `Already up to date (v${currentVersion})`,
    };
  }

  console.log(`Updating from v${currentVersion} to v${latestVersion}...`);

  // Find binary for current platform
  const binaryFilename = getBinaryFilename();
  const asset = release.assets.find((a) => a.name === binaryFilename);

  if (!asset) {
    throw new NetworkError(`No binary found for ${binaryFilename}`);
  }

  // Download checksums
  console.log('Verifying checksums...');
  const checksums = await fetchChecksums(release.tag_name);
  const expectedChecksum = checksums.get(binaryFilename);

  if (!expectedChecksum) {
    throw new NetworkError(`No checksum found for ${binaryFilename}`);
  }

  // Download binary
  console.log('Downloading update...');
  const binaryData = await downloadBinary(asset.browser_download_url);

  // Verify checksum
  await verifyChecksum(binaryData, expectedChecksum);
  console.log('Checksum verified');

  // Replace binary
  console.log('Installing update...');
  const execPath = getExecutablePath();
  await replaceBinary(binaryData, execPath);

  return {
    updated: true,
    currentVersion,
    latestVersion,
    message: `Successfully updated from v${currentVersion} to v${latestVersion}`,
  };
}

/**
 * Run update command and handle output
 */
export async function runUpdate(args: string[] = []): Promise<number> {
  const force = args.includes('--force') || args.includes('-f');

  try {
    const result = await update({ force });
    console.log(result.message);
    return ExitCode.Success;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Update failed: ${error.message}`);
    } else {
      console.error(`Update failed: ${String(error)}`);
    }
    return ExitCode.NetworkError;
  }
}
