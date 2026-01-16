/**
 * Inspect the structure returned by tool()
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const testTool = tool({
  name: 'test_tool',
  description: 'A test tool',
  schema: z.object({
    input: z.string(),
  }),
  handler: async ({ input }) => {
    return `Result: ${input}`;
  },
});

console.log('Tool structure inspection:');
console.log('typeof testTool:', typeof testTool);
console.log('testTool keys:', Object.keys(testTool));
console.log('testTool:', JSON.stringify(testTool, null, 2));

// Check if it's the definition itself
console.log('\nDirect properties:');
for (const [key, value] of Object.entries(testTool)) {
  console.log(`  ${key}: ${typeof value}`);
}

// Create MCP server and inspect
const server = createSdkMcpServer('test', [testTool]);
console.log('\nMCP Server structure:');
console.log('typeof server:', typeof server);
console.log('server keys:', Object.keys(server));
