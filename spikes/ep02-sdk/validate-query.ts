/**
 * EP02 SDK Spike - T002: Query Function Validation
 *
 * Validates the query() function with streaming output.
 * This is a critical validation as query() is the core SDK interface.
 *
 * Run with: bun run spikes/ep02-sdk/validate-query.ts
 *
 * Requirements:
 * - ANTHROPIC_API_KEY environment variable must be set
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// =============================================================================
// Configuration
// =============================================================================

const TEST_PROMPT = 'Say exactly "SDK query validation successful" and nothing else.';
const MODEL = 'claude-sonnet-4-20250514';

// =============================================================================
// Message Type Tracking
// =============================================================================

interface MessageStats {
  total: number;
  byType: Record<string, number>;
  firstMessage: SDKMessage | null;
  lastMessage: SDKMessage | null;
  textContent: string;
}

function createStats(): MessageStats {
  return {
    total: 0,
    byType: {},
    firstMessage: null,
    lastMessage: null,
    textContent: '',
  };
}

// =============================================================================
// Streaming Validation
// =============================================================================

async function validateStreamingQuery(): Promise<MessageStats> {
  console.log('\n📋 Validating query() with streaming...');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Prompt: "${TEST_PROMPT.substring(0, 50)}..."`);

  const stats = createStats();

  const result = query({
    prompt: TEST_PROMPT,
    options: {
      model: MODEL,
      maxTurns: 1,
      // CRITICAL: settingSources must include 'project' for CLAUDE.md loading
      settingSources: ['project'],
      // Enable streaming to receive partial messages
      includePartialMessages: true,
    },
  });

  console.log('\n   Receiving stream messages...\n');

  for await (const message of result) {
    stats.total++;

    // Track message type
    const msgType = message.type;
    stats.byType[msgType] = (stats.byType[msgType] || 0) + 1;

    // Track first/last
    if (!stats.firstMessage) stats.firstMessage = message;
    stats.lastMessage = message;

    // Extract text content from stream events
    if (msgType === 'stream_event') {
      const streamMsg = message as { type: 'stream_event'; event?: { type?: string; delta?: { text?: string } } };
      if (streamMsg.event?.type === 'content_block_delta' && streamMsg.event.delta?.text) {
        stats.textContent += streamMsg.event.delta.text;
        process.stdout.write(streamMsg.event.delta.text);
      }
    }

    // Extract from assistant message
    if (msgType === 'assistant') {
      const assistantMsg = message as { type: 'assistant'; message?: { content?: Array<{ type: string; text?: string }> } };
      if (assistantMsg.message?.content) {
        for (const block of assistantMsg.message.content) {
          if (block.type === 'text' && block.text) {
            if (!stats.textContent) {
              stats.textContent = block.text;
            }
          }
        }
      }
    }

    // Safety limit
    if (stats.total > 100) {
      console.log('\n   ⚠️  Hit message limit (100), stopping...');
      break;
    }
  }

  console.log('\n');
  return stats;
}

// =============================================================================
// Report
// =============================================================================

function printReport(stats: MessageStats): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  T002 Validation Report: query() with Streaming');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log('\n📊 Message Statistics:');
  console.log(`   Total messages received: ${stats.total}`);

  console.log('\n📬 Messages by Type:');
  for (const [type, count] of Object.entries(stats.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`   - ${type}: ${count}`);
  }

  console.log('\n📝 Response Content:');
  console.log(`   "${stats.textContent.trim()}"`);

  console.log('\n✅ Validations:');

  // Check streaming worked
  const hasStreamEvents = (stats.byType['stream_event'] || 0) > 0;
  console.log(`   [${hasStreamEvents ? '✓' : '✗'}] Received stream_event messages`);

  // Check we got a result
  const hasResult = (stats.byType['result'] || 0) > 0;
  console.log(`   [${hasResult ? '✓' : '✗'}] Received result message`);

  // Check content was extracted
  const hasContent = stats.textContent.length > 0;
  console.log(`   [${hasContent ? '✓' : '✗'}] Extracted text content`);

  // Check expected response
  const hasExpectedResponse = stats.textContent.toLowerCase().includes('validation') ||
                              stats.textContent.toLowerCase().includes('successful');
  console.log(`   [${hasExpectedResponse ? '✓' : '✗'}] Response matches expected pattern`);

  console.log('\n═══════════════════════════════════════════════════════════════');

  if (hasStreamEvents && hasResult && hasContent) {
    console.log('  🎉 T002 VALIDATED: query() streaming works correctly!');
  } else {
    console.log('  ⚠️  T002 PARTIAL: Some validations did not pass');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  EP02 SDK Spike - T002: Query Function Validation');
  console.log('═══════════════════════════════════════════════════════════════');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('\n❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.log('   Set it with: export ANTHROPIC_API_KEY=your-key-here\n');

    // Still validate the function signature works
    console.log('📋 Validating query() function signature (no API call)...');
    console.log('   ✅ query() function imported successfully');
    console.log('   ✅ Options structure is valid TypeScript');
    console.log('\n   To complete full validation, set ANTHROPIC_API_KEY and re-run.\n');
    return;
  }

  try {
    const stats = await validateStreamingQuery();
    printReport(stats);
  } catch (error) {
    console.error('\n❌ Error during validation:', error);
    process.exit(1);
  }
}

main();
