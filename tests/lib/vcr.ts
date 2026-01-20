/**
 * VCR Recording Infrastructure for Integration Tests
 *
 * Provides recording and playback of API responses for deterministic
 * integration tests. Per ADR-0011, VCR recordings capture real API
 * behavior for high-fidelity integration tests.
 *
 * @module tests/lib/vcr
 */

import { mock, clearMocks } from 'bun-bagel';
import { existsSync } from 'node:fs';

// =============================================================================
// Types
// =============================================================================

/**
 * A single recorded API interaction.
 */
export interface Recording {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
  timestamp: string;
}

/**
 * A cassette file containing multiple recordings.
 */
export interface Cassette {
  version: string;
  name: string;
  createdAt: string;
  recordings: Recording[];
}

/**
 * VCR mode of operation.
 */
export type VCRMode = 'record' | 'playback';

/**
 * Options for VCR operations.
 */
export interface VCROptions {
  /** Mode of operation */
  mode?: VCRMode;
  /** Strict mode - fail if no recording found (default: true in CI) */
  strict?: boolean;
  /** Filter function for recording requests (e.g., to redact secrets) */
  requestFilter?: (request: Recording['request']) => Recording['request'];
  /** Filter function for recording responses */
  responseFilter?: (response: Recording['response']) => Recording['response'];
}

// =============================================================================
// Constants
// =============================================================================

/** Current cassette file version */
const CASSETTE_VERSION = '1.0.0';

/** Check if running in CI environment */
const isCI = process.env.CI === 'true';

/** Default to record mode if VCR_MODE env var is set */
const defaultMode: VCRMode = process.env.VCR_MODE === 'record' ? 'record' : 'playback';

// =============================================================================
// VCR Class
// =============================================================================

/**
 * VCR - Video Cassette Recorder for API responses.
 *
 * Records and plays back API responses for deterministic integration tests.
 */
export class VCR {
  private cassette: Cassette | null = null;
  private cassettePath: string | null = null;
  private mode: VCRMode;
  private strict: boolean;
  private playbackIndex: Map<string, number> = new Map();
  private requestFilter: ((request: Recording['request']) => Recording['request']) | null = null;
  private responseFilter: ((response: Recording['response']) => Recording['response']) | null =
    null;
  private pendingRecordings: Recording[] = [];

  constructor(options: VCROptions = {}) {
    this.mode = options.mode ?? defaultMode;
    this.strict = options.strict ?? isCI;
    this.requestFilter = options.requestFilter ?? null;
    this.responseFilter = options.responseFilter ?? null;
  }

  /**
   * Get the current VCR mode.
   */
  getMode(): VCRMode {
    return this.mode;
  }

  /**
   * Set the VCR mode.
   */
  setMode(mode: VCRMode): void {
    this.mode = mode;
  }

  /**
   * Check if VCR is in strict mode.
   */
  isStrict(): boolean {
    return this.strict;
  }

  /**
   * Load a cassette file for playback.
   *
   * @param cassettePath - Path to the cassette JSON file
   * @throws {Error} If in strict mode and cassette doesn't exist
   */
  async load(cassettePath: string): Promise<void> {
    this.cassettePath = cassettePath;
    this.playbackIndex.clear();
    this.pendingRecordings = [];

    if (!existsSync(cassettePath)) {
      if (this.strict && this.mode === 'playback') {
        throw new Error(
          `VCR: Cassette not found at ${cassettePath}\n` +
            `Run 'bun run record' locally and commit the recordings.`
        );
      }
      // Start with empty cassette
      this.cassette = {
        version: CASSETTE_VERSION,
        name: cassettePath,
        createdAt: new Date().toISOString(),
        recordings: [],
      };
      return;
    }

    try {
      const file = Bun.file(cassettePath);
      const data = await file.json();
      this.cassette = data as Cassette;
    } catch (error) {
      throw new Error(
        `VCR: Failed to load cassette at ${cassettePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save the current cassette (for record mode).
   *
   * @param cassettePath - Optional path to save to (defaults to loaded path)
   */
  async save(cassettePath?: string): Promise<void> {
    const savePath = cassettePath ?? this.cassettePath;

    if (!savePath) {
      throw new Error('VCR: No cassette path specified');
    }

    if (this.mode !== 'record') {
      throw new Error('VCR: Cannot save cassette in playback mode');
    }

    const cassette: Cassette = {
      version: CASSETTE_VERSION,
      name: savePath,
      createdAt: new Date().toISOString(),
      recordings: this.pendingRecordings,
    };

    await Bun.write(savePath, JSON.stringify(cassette, null, 2));
  }

  /**
   * Set up fetch mocks for playback.
   * Call this after loading a cassette.
   *
   * Note: bun-bagel uses static mock options, so we set up the first
   * recording for each URL. For sequential playback of multiple calls
   * to the same URL, use findRecording() with manual fetch interception.
   */
  setupMocks(): void {
    if (!this.cassette) {
      throw new Error('VCR: No cassette loaded. Call load() first.');
    }

    if (this.mode === 'record') {
      // In record mode, we intercept to record, not mock
      this.setupRecordingInterceptor();
      return;
    }

    // Group recordings by URL for sequential playback
    const recordingsByUrl = new Map<string, Recording[]>();
    for (const recording of this.cassette.recordings) {
      const key = `${recording.request.method}:${recording.request.url}`;
      if (!recordingsByUrl.has(key)) {
        recordingsByUrl.set(key, []);
      }
      const recordings = recordingsByUrl.get(key);
      if (recordings) {
        recordings.push(recording);
      }
    }

    // Set up mock for each URL using first recording
    // bun-bagel uses static options, so sequential playback requires manual handling
    for (const [, recordings] of recordingsByUrl) {
      const firstRecording = recordings[0];
      if (!firstRecording) continue;

      const url = firstRecording.request.url;

      mock(url, {
        method: firstRecording.request.method,
        response: {
          status: firstRecording.response.status,
          headers: firstRecording.response.headers,
          data: firstRecording.response.body,
        },
      });
    }
  }

  /**
   * Set up interceptor for recording mode.
   */
  private setupRecordingInterceptor(): void {
    // In record mode, we use a global fetch interceptor
    // Note: This is a simplified implementation. For full recording,
    // you may need to override the global fetch function.
    console.log('VCR: Recording mode active. API calls will be recorded.');
  }

  /**
   * Record a request/response pair (for record mode).
   *
   * @param request - The request details
   * @param response - The response details
   */
  recordInteraction(request: Recording['request'], response: Recording['response']): void {
    if (this.mode !== 'record') {
      return;
    }

    const filteredRequest = this.requestFilter !== null ? this.requestFilter(request) : request;
    const filteredResponse =
      this.responseFilter !== null ? this.responseFilter(response) : response;

    this.pendingRecordings.push({
      request: filteredRequest,
      response: filteredResponse,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Find a recording matching the request.
   *
   * @param url - Request URL
   * @param method - HTTP method
   * @returns The matching recording or undefined
   */
  findRecording(url: string, method = 'GET'): Recording | undefined {
    if (!this.cassette) {
      return undefined;
    }

    const key = `${method}:${url}`;
    const index = this.playbackIndex.get(key) ?? 0;

    const matching = this.cassette.recordings.filter(
      (r) => r.request.method === method && r.request.url === url
    );

    const recording = matching[index];
    if (recording) {
      this.playbackIndex.set(key, index + 1);
    }
    return recording;
  }

  /**
   * Clean up mocks after test.
   */
  cleanup(): void {
    clearMocks();
    this.playbackIndex.clear();
  }

  /**
   * Reset VCR state completely.
   */
  reset(): void {
    this.cleanup();
    this.cassette = null;
    this.cassettePath = null;
    this.pendingRecordings = [];
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Default VCR instance for convenience.
 */
export const vcr = new VCR();

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a filter that redacts authorization headers.
 */
export function createAuthRedactFilter(): (request: Recording['request']) => Recording['request'] {
  return (request) => ({
    ...request,
    headers: {
      ...request.headers,
      authorization: request.headers.authorization ? '[REDACTED]' : undefined,
      'x-api-key': request.headers['x-api-key'] ? '[REDACTED]' : undefined,
    } as Record<string, string>,
  });
}

/**
 * Helper to use VCR in a test suite.
 *
 * @example
 * ```typescript
 * import { useVCR } from '../lib/vcr';
 *
 * describe('My Test', () => {
 *   useVCR('tests/integration/recordings/my-test.json');
 *
 *   it('works with recorded responses', async () => {
 *     // Test runs against recorded responses
 *   });
 * });
 * ```
 */
export function useVCR(cassettePath: string, options?: VCROptions): void {
  const testVcr = new VCR(options);

  // Note: This is a helper pattern. In actual Bun tests, you'd use:
  // beforeAll(async () => { await vcr.load(path); vcr.setupMocks(); });
  // afterAll(() => { vcr.cleanup(); });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { beforeAll, afterAll } = require('bun:test');

  beforeAll(async () => {
    await testVcr.load(cassettePath);
    testVcr.setupMocks();
  });

  afterAll(() => {
    testVcr.cleanup();
  });
}

/**
 * Helper to use VCR in strict mode (CI-friendly).
 *
 * This wrapper enforces strict mode, ensuring tests fail if cassettes are missing.
 * Use this for integration tests that must be deterministic in CI.
 *
 * @example
 * ```typescript
 * import { useStrictVCR } from '../lib/vcr';
 *
 * describe('My Integration Test', () => {
 *   useStrictVCR('tests/integration/recordings/my-test.json');
 *
 *   it('replays recorded responses deterministically', async () => {
 *     // Test runs against recorded responses
 *     // Fails if cassette is missing (CI behavior)
 *   });
 * });
 * ```
 */
export function useStrictVCR(cassettePath: string, additionalOptions?: Omit<VCROptions, 'strict'>): void {
  useVCR(cassettePath, { ...additionalOptions, strict: true });
}

/**
 * Create a strict VCR instance for CI environments.
 *
 * Use this when you need more control over the VCR instance than useStrictVCR provides.
 *
 * @param options - Additional VCR options (strict is always true)
 * @returns VCR instance configured for strict mode
 *
 * @example
 * ```typescript
 * const vcr = createStrictVCR();
 * await vcr.load('path/to/cassette.json');
 * vcr.setupMocks();
 * // ... run tests ...
 * vcr.cleanup();
 * ```
 */
export function createStrictVCR(options?: Omit<VCROptions, 'strict'>): VCR {
  return new VCR({ ...options, strict: true });
}

/**
 * Check if VCR recording mode should be enabled.
 *
 * This helper checks the VCR_MODE environment variable.
 *
 * @returns True if VCR_MODE=record
 */
export function shouldRecord(): boolean {
  return process.env.VCR_MODE === 'record';
}

/**
 * Check if running in CI environment.
 *
 * @returns True if CI=true environment variable is set
 */
export function isCIEnvironment(): boolean {
  return process.env.CI === 'true';
}
