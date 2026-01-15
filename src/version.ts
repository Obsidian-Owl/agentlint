/**
 * Version information for agentlint CLI
 */

import { version as packageVersion } from '../package.json';

/**
 * Version information returned by --version
 */
export interface VersionInfo {
  /** Package version */
  version: string;
  /** Bun version (if running in Bun) */
  bunVersion?: string;
  /** Node.js version (if running in Node) */
  nodeVersion?: string;
  /** Platform identifier */
  platform: string;
  /** Architecture identifier */
  arch: string;
}

/**
 * Get current version information
 */
export function getVersion(): VersionInfo {
  const info: VersionInfo = {
    version: packageVersion,
    platform: process.platform,
    arch: process.arch,
  };

  // Detect runtime
  if (typeof Bun !== 'undefined') {
    info.bunVersion = Bun.version;
  } else if (typeof process !== 'undefined' && process.versions.node) {
    info.nodeVersion = process.versions.node;
  }

  return info;
}

/**
 * Format version info for display
 */
export function formatVersion(info: VersionInfo): string {
  const lines = [`agentlint v${info.version}`];

  if (info.bunVersion !== undefined) {
    lines.push(`Bun ${info.bunVersion}`);
  } else if (info.nodeVersion !== undefined) {
    lines.push(`Node.js ${info.nodeVersion}`);
  }

  lines.push(`${info.platform}-${info.arch}`);

  return lines.join('\n');
}
