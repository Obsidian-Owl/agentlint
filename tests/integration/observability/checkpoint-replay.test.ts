/**
 * T063: Integration test for replay session and trace linkage
 * Tests that replayed sessions create child spans linked to original checkpoint traces.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createSessionRecorder,
  createSessionReplayer,
} from '../../../src/orchestration/checkpoint';
import { traceContextProvider } from '../../../src/observability/trace-context';
import type { SessionCheckpoint } from '../../../src/orchestration/checkpoint-types';
import type { ExportableSpan } from '../../../src/observability/exporters/local-exporter';

/**
 * Test-only span exporter that stores spans in memory.
 */
class TestSpanExporter {
  public spans: ExportableSpan[] = [];

  export(spans: ExportableSpan[]): void {
    this.spans.push(...spans);
  }

  reset(): void {
    this.spans = [];
  }
}

/**
 * Creates a test checkpoint with optional trace context.
 * Extracted to reduce duplication across tests.
 */
function createTestCheckpoint(
  sessionId: string,
  traceContext?: { traceId: string; spanId: string }
): SessionCheckpoint {
  return {
    version: '1.0',
    sessionId,
    timestamp: new Date().toISOString(),
    sequence: 1,
    phase: 'analyze',
    trigger: 'tool_complete',
    toolHistory: [],
    findings: [],
    metrics: {
      toolCalls: 1,
      llmCalls: 0,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      elapsedMs: 100,
    },
    ...(traceContext && {
      workspaceState: { traceContext },
    }),
  };
}

/**
 * Records a checkpoint with trace context within a trace run.
 * Returns the trace context that was used.
 */
async function recordCheckpointWithTrace(
  recorder: ReturnType<typeof createSessionRecorder>,
  sessionId: string
): Promise<{ traceId: string; spanId: string }> {
  let capturedTraceId = '';
  let capturedSpanId = '';

  await traceContextProvider.run(async () => {
    const context = traceContextProvider.getContext();
    capturedTraceId = context!.traceId;
    capturedSpanId = context!.spanId;

    recorder.startRecording(sessionId);

    const checkpoint = createTestCheckpoint(sessionId, {
      traceId: capturedTraceId,
      spanId: capturedSpanId,
    });

    await recorder.recordCheckpoint(checkpoint);
    recorder.stopRecording();
  });

  return { traceId: capturedTraceId, spanId: capturedSpanId };
}

/**
 * Creates a replay span with optional parent linkage.
 * Returns the created span for further assertions.
 */
async function createReplaySpan(
  name: string,
  replayContext: Awaited<
    ReturnType<ReturnType<typeof createSessionReplayer>['replayWithTraceCorrelation']>
  >,
  attributes: Record<string, string | number> = {}
): Promise<void> {
  await traceContextProvider.withSpan(
    {
      name,
      ...(replayContext.originalCheckpointSpanId && {
        parentSpanId: replayContext.originalCheckpointSpanId,
      }),
    },
    async (span) => {
      if (replayContext.originalTraceId) {
        span.setAttribute('original_trace_id', replayContext.originalTraceId);
      }
      span.setAttribute('session_id', replayContext.sessionId);

      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      span.addEvent('replay_started');
    }
  );
}

/**
 * Asserts that replay spans have correct parent linkage.
 */
function assertReplaySpansLinked(
  exporter: TestSpanExporter,
  spanNamePattern: string | RegExp,
  expectedParentSpanId: string,
  expectedTraceId: string,
  expectedCount: number
): void {
  const filter =
    typeof spanNamePattern === 'string'
      ? (s: ExportableSpan) => s.name === spanNamePattern
      : (s: ExportableSpan) => spanNamePattern.test(s.name);

  const spans = exporter.spans.filter(filter);
  expect(spans).toHaveLength(expectedCount);

  for (const span of spans) {
    expect(span.parentSpanId).toBe(expectedParentSpanId);
    expect(span.attributes.original_trace_id).toBe(expectedTraceId);
  }
}

describe('Checkpoint Replay Trace Integration', () => {
  let tempDir: string;
  let originalTraceId: string;
  let originalSpanId: string;
  let testExporter: TestSpanExporter;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agentlint-replay-test-'));
    testExporter = new TestSpanExporter();
    traceContextProvider.registerExporter(testExporter);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    testExporter.reset();
  });

  it('should record checkpoint with trace context', async () => {
    const recorder = createSessionRecorder({ storageDir: tempDir });

    const { traceId, spanId } = await recordCheckpointWithTrace(recorder, 'test-session');
    originalTraceId = traceId;
    originalSpanId = spanId;

    // Verify checkpoint was saved
    const checkpoints = await recorder.getCheckpoints('test-session');
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0]?.workspaceState?.traceContext).toBeDefined();
  });

  it('should replay session with trace correlation', async () => {
    const recorder = createSessionRecorder({ storageDir: tempDir });
    const replayer = createSessionReplayer(recorder);

    // First, create a checkpoint with trace context
    const { traceId, spanId } = await recordCheckpointWithTrace(recorder, 'replay-session');
    originalTraceId = traceId;
    originalSpanId = spanId;

    // Now replay with trace correlation
    const replayContext = await replayer.replayWithTraceCorrelation('replay-session');

    expect(replayContext).toBeDefined();
    expect(replayContext.originalTraceId).toBe(originalTraceId);
    expect(replayContext.originalCheckpointSpanId).toBe(originalSpanId);
  });

  it('should create child spans linked to original checkpoint', async () => {
    const recorder = createSessionRecorder({ storageDir: tempDir });
    const replayer = createSessionReplayer(recorder);

    // Create checkpoint with trace
    const { traceId, spanId } = await recordCheckpointWithTrace(recorder, 'linked-session');
    originalTraceId = traceId;
    originalSpanId = spanId;

    // Replay and create child span
    const replayContext = await replayer.replayWithTraceCorrelation('linked-session');
    await createReplaySpan('replay-resumed-analysis', replayContext);

    // Verify child span was created with correct parent
    assertReplaySpansLinked(
      testExporter,
      'replay-resumed-analysis',
      originalSpanId,
      originalTraceId,
      1
    );
  });

  it('should handle replay of session without trace context', async () => {
    const recorder = createSessionRecorder({ storageDir: tempDir });
    const replayer = createSessionReplayer(recorder);

    // Create checkpoint WITHOUT trace context (legacy format)
    recorder.startRecording('legacy-session');

    const checkpoint = createTestCheckpoint('legacy-session'); // No trace context

    await recorder.recordCheckpoint(checkpoint);
    recorder.stopRecording();

    // Replay should work without trace context
    const replayContext = await replayer.replayWithTraceCorrelation('legacy-session');

    expect(replayContext).toBeDefined();
    expect(replayContext.sessionId).toBe('legacy-session');
    expect(replayContext.originalTraceId).toBeUndefined();
    expect(replayContext.originalCheckpointSpanId).toBeUndefined();
  });

  it('should create new trace for replay without original context', async () => {
    const recorder = createSessionRecorder({ storageDir: tempDir });
    const replayer = createSessionReplayer(recorder);

    // Create legacy checkpoint
    recorder.startRecording('new-trace-session');

    const checkpoint = createTestCheckpoint('new-trace-session'); // No trace context

    await recorder.recordCheckpoint(checkpoint);
    recorder.stopRecording();

    const replayContext = await replayer.replayWithTraceCorrelation('new-trace-session');

    // Create new trace for replay
    await traceContextProvider.run(async () => {
      await traceContextProvider.withSpan({ name: 'replay-new-trace' }, async (span) => {
        span.setAttribute('session_id', replayContext.sessionId);
        span.addEvent('replay_started_new_trace');
      });
    });

    // Verify new trace was created
    const replaySpans = testExporter.spans.filter((s) => s.name === 'replay-new-trace');
    expect(replaySpans).toHaveLength(1);
    expect(replaySpans[0]?.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should preserve trace correlation through multiple replay operations', async () => {
    const recorder = createSessionRecorder({ storageDir: tempDir });
    const replayer = createSessionReplayer(recorder);

    // Create initial checkpoint with trace
    const { traceId, spanId } = await recordCheckpointWithTrace(recorder, 'multi-replay-session');
    originalTraceId = traceId;
    originalSpanId = spanId;

    // Replay multiple times
    const replayContext = await replayer.replayWithTraceCorrelation('multi-replay-session');
    for (let i = 0; i < 3; i++) {
      await createReplaySpan(`replay-operation-${i}`, replayContext, { replay_iteration: i });
    }

    // Verify all replay operations linked to original
    assertReplaySpansLinked(testExporter, /^replay-operation-/, originalSpanId, originalTraceId, 3);
  });
});
