/**
 * EP02 SDK Spike - Type Imports Validation
 *
 * This file validates that all required SDK types can be imported.
 * If this compiles, the SDK is correctly installed.
 */

// Core SDK functions
import {
  query,
  tool,
  createSdkMcpServer,
} from '@anthropic-ai/claude-agent-sdk';

// SDK Types - these are the types we need for EP02
import type {
  SDKMessage,
  SdkMcpToolDefinition,
  McpSdkServerConfigWithInstance,
} from '@anthropic-ai/claude-agent-sdk';

// Re-export for validation
export {
  query,
  tool,
  createSdkMcpServer,
};

export type {
  SDKMessage,
  SdkMcpToolDefinition,
  McpSdkServerConfigWithInstance,
};

// Zod for tool schema validation
import { z } from 'zod';
export { z };

// Type validation - ensure these types are usable
type ValidateSDKMessage = SDKMessage;
type ValidateToolDef = SdkMcpToolDefinition<unknown>;
type ValidateMcpServer = McpSdkServerConfigWithInstance;

// Log success if this module is executed
console.log('✅ SDK type imports validated successfully');
console.log('   - query() function: available');
console.log('   - tool() function: available');
console.log('   - createSdkMcpServer() function: available');
console.log('   - SDKMessage type: available');
console.log('   - SdkMcpToolDefinition type: available');
console.log('   - McpSdkServerConfigWithInstance type: available');
console.log('   - zod: available');
