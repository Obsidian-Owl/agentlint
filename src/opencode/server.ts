import { createOpencodeServer } from '@opencode-ai/sdk';
import type { AgentConfig } from '@opencode-ai/sdk';
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { buildOpencodeAgents } from '../act/index.js';
import { createDebugLogger } from '../debug/logger.js';
import { DEBUG_NAMESPACES } from '../debug/namespaces.js';

/**
 * Simple hash function for consistent port generation.
 * Converts a string to a 32-bit integer hash.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic port number for a project directory.
 * Uses IANA dynamic/private port range (49152-65535).
 * Same project path always returns same port.
 */
export function getProjectPort(projectPath: string): number {
  const PORT_MIN = 49152;
  const PORT_MAX = 65535;
  const range = PORT_MAX - PORT_MIN;
  const hash = hashString(projectPath);
  return PORT_MIN + (hash % range);
}

/**
 * Get the path to the server lockfile for a project directory.
 */
function getServerLockPath(cwd: string): string {
  return join(cwd, '.agentlint', '.server-port');
}

/**
 * Write the server port and PID to the lockfile.
 */
function writeServerLock(cwd: string, port: number, pid: number): void {
  const lockPath = getServerLockPath(cwd);
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ port, pid }), 'utf-8');
}

/**
 * Read the server port and PID from the lockfile.
 * Returns null if the lockfile doesn't exist or can't be read.
 */
function readServerLock(cwd: string): { port: number; pid: number } | null {
  const lockPath = getServerLockPath(cwd);
  if (!existsSync(lockPath)) {
    return null;
  }
  try {
    const content = readFileSync(lockPath, 'utf-8').trim();
    const parsed = JSON.parse(content) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'port' in parsed &&
      'pid' in parsed &&
      typeof parsed.port === 'number' &&
      typeof parsed.pid === 'number'
    ) {
      return { port: parsed.port, pid: parsed.pid };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear the server lockfile.
 */
function clearServerLock(cwd: string): void {
  const lockPath = getServerLockPath(cwd);
  try {
    unlinkSync(lockPath);
  } catch {
    // Ignore errors when clearing lockfile
  }
}

/**
 * Try to kill an orphaned server process.
 * Returns true if the process was killed or doesn't exist.
 */
function tryKillOrphanedServer(cwd: string): boolean {
  const lock = readServerLock(cwd);
  if (!lock) {
    return false;
  }

  try {
    // Check if process exists before attempting to kill
    process.kill(lock.pid, 0); // Signal 0 tests for existence without actually killing
    // If we reach here, process exists - now kill it
    process.kill(lock.pid, 'SIGTERM');
    // Clear the lockfile immediately
    clearServerLock(cwd);
    return true;
  } catch {
    // Process doesn't exist or can't be killed
    // Either way, clear the lockfile
    clearServerLock(cwd);
    return false;
  }
}

export interface OpencodeServerConfig {
  port?: number;
  hostname?: string;
  timeout?: number;
}

export interface PortCheckResult {
  available: boolean;
  healthy: boolean;
  isAgentlint: boolean;
}

export interface IServerManager {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  getPort(): number;
  getUrl(): string;
}

export class OpencodeServerManager implements IServerManager {
  private readonly config: Required<OpencodeServerConfig>;
  private readonly cwd: string;
  private server: { url: string; close(): void } | null = null;
  private running = false;
  private readonly logger = createDebugLogger({
    namespaces: [DEBUG_NAMESPACES.SERVER],
  }).child(DEBUG_NAMESPACES.SERVER);

  constructor(config: OpencodeServerConfig = {}, cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.config = {
      port: config.port ?? getProjectPort(cwd),
      hostname: config.hostname ?? '127.0.0.1',
      timeout: config.timeout ?? 5000,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      // Already running - just return (idempotent)
      this.logger.debug('Server already running, reusing existing instance', {
        port: this.config.port,
      });
      return;
    }

    // Check if we can reuse an existing healthy server
    const canReuse = await this.tryReuseExistingServer();
    if (canReuse) {
      this.logger.info('Reusing existing healthy agentlint server', {
        port: this.config.port,
        url: `http://${this.config.hostname}:${this.config.port}`,
      });
      this.running = true;
      this.server = {
        url: `http://${this.config.hostname}:${this.config.port}`,
        close: (): void => {
          // No-op for reused servers - we don't own the lifecycle
        },
      };
      return;
    }

    // Check if port is available before binding
    let portCheck = await this.checkPortAvailable();
    if (!portCheck.available) {
      if (portCheck.isAgentlint && !portCheck.healthy) {
        // Try to clean up orphaned server
        this.logger.debug('Attempting to clean up orphaned agentlint server', {
          port: this.config.port,
        });

        const killed = tryKillOrphanedServer(this.cwd);
        if (killed) {
          // Wait briefly for the port to be released
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Retry the port check once
          portCheck = await this.checkPortAvailable();
          if (!portCheck.available) {
            throw new Error(
              `Port ${this.config.port} is still occupied after cleanup. ` +
                `Please manually stop the process and try again.`
            );
          }
          // Port is now available, continue startup
          this.logger.info('Successfully cleaned up orphaned server', {
            port: this.config.port,
          });
        } else {
          throw new Error(
            `Port ${this.config.port} is occupied by an unhealthy agentlint server. ` +
              `Cleanup failed. Please stop the existing process before starting a new one.`
          );
        }
      } else {
        throw new Error(
          `Port ${this.config.port} is already in use by another process. ` +
            `Please stop the conflicting process or use a different port.`
        );
      }
    }

    this.logger.debug('Starting new Opencode server', {
      port: this.config.port,
      hostname: this.config.hostname,
    });

    // Disable ALL Claude Code compatibility features from ~/.claude/
    // This prevents oh-my-claudecode hooks, global CLAUDE.md, skills, and other
    // global instructions from leaking into agentlint sessions.
    // Agentlint provides its own prompts and does not use Claude Code conventions.
    // See: https://opencode.ai/docs/rules/
    process.env.OPENCODE_DISABLE_CLAUDE_CODE = '1'; // Disables all .claude support (hooks, prompts, skills)

    // Build isolated config - agentlint should NOT pick up user's ACT configurations
    const isolatedConfig = {
      agent: buildOpencodeAgents() as Record<string, AgentConfig>,
      mcp: {}, // Explicitly empty - don't load target repo's MCP config
      plugin: [], // Don't load global plugins (oh-my-claudecode, etc.)
      instructions: [], // Don't load CLAUDE.md/AGENTS.md from target or global paths
    };

    // Set environment variable with highest precedence in Opencode's config loading order
    // This ensures our isolated config takes priority over all file-based configs
    process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify(isolatedConfig);

    this.server = await createOpencodeServer({
      port: this.config.port,
      hostname: this.config.hostname,
      timeout: this.config.timeout,
      config: isolatedConfig,
    });

    this.running = true;

    // Write lockfile to mark this as an agentlint server with PID
    writeServerLock(this.cwd, this.config.port, process.pid);

    this.logger.info('Opencode server started', { url: this.server.url });
  }

  stop(): void {
    if (!this.server || !this.running) {
      return;
    }

    const serverToClose = this.server;
    this.server = null;
    this.running = false;

    // Clear lockfile
    clearServerLock(this.cwd);

    try {
      serverToClose.close();
    } catch {
      // Server close failure is non-fatal — process is shutting down
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    if (!this.server) {
      return this.config.port;
    }
    const url = new URL(this.server.url);
    return parseInt(url.port, 10);
  }

  getUrl(): string {
    if (!this.server) {
      throw new Error('Server is not running');
    }
    return this.server.url;
  }

  private async checkPortAvailable(): Promise<PortCheckResult> {
    try {
      const response = await fetch(`http://${this.config.hostname}:${this.config.port}/session`, {
        signal: AbortSignal.timeout(1000),
      });

      // Something is listening - check what it is
      if (response.ok) {
        try {
          const body = await response.json();
          // Opencode SDK /session endpoint returns an array of sessions
          const hasSessionEndpoint = Boolean(body && Array.isArray(body));

          // Check if this is an Opencode server we can use:
          // If it has the session endpoint, it's an Opencode server (regardless of lockfile)
          // We can reuse any healthy Opencode server on our expected port
          const lock = readServerLock(this.cwd);
          // Consider it "ours" if it's an Opencode server - lockfile is optional
          // This handles orphaned servers that lost their lockfile
          const isAgentlint = hasSessionEndpoint;

          this.logger.debug('Port check: service responding', {
            port: this.config.port,
            status: response.status,
            hasSessionEndpoint,
            lockPort: lock?.port,
            lockPid: lock?.pid,
            isAgentlint,
          });

          return {
            available: false,
            healthy: true,
            isAgentlint,
          };
        } catch {
          // Response exists but not JSON - probably not agentlint
          this.logger.debug('Port check: non-JSON response', {
            port: this.config.port,
          });
          return {
            available: false,
            healthy: false,
            isAgentlint: false,
          };
        }
      }

      // Non-OK response means unhealthy service
      this.logger.debug('Port check: unhealthy service', {
        port: this.config.port,
        status: response.status,
      });
      return {
        available: false,
        healthy: false,
        isAgentlint: false,
      };
    } catch (error) {
      // Connection refused = port is available
      this.logger.debug('Port check: port available', {
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        available: true,
        healthy: false,
        isAgentlint: false,
      };
    }
  }

  private async tryReuseExistingServer(): Promise<boolean> {
    const portCheck = await this.checkPortAvailable();

    // Port must be occupied by a healthy agentlint server to reuse
    if (!portCheck.available && portCheck.healthy && portCheck.isAgentlint) {
      this.logger.debug('Found healthy agentlint server to reuse', {
        port: this.config.port,
      });
      return true;
    }

    return false;
  }
}
