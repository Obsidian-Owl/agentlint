import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { PromptMessage, PromptSpec, StaticPromptSpec } from '../promptkit/types';
import type { PromptAdapter } from './types';

type SDKRole = 'user' | 'assistant';

interface SDKTextBlock {
  type: 'text';
  text: string;
}

interface SDKMessageWithContent {
  role: SDKRole;
  content: SDKTextBlock[];
}

function toSDKRole(role: PromptMessage['role']): SDKRole {
  if (role === 'system' || role === 'developer') {
    return 'user';
  }
  return role;
}

function toSDKMessage(message: PromptMessage): SDKMessageWithContent {
  return {
    role: toSDKRole(message.role),
    content: [{ type: 'text', text: message.content }],
  };
}

export const claudeAgentSdkAdapter: PromptAdapter<SDKMessage> = {
  name: 'claude-agent-sdk',

  toSystemPrompt(messages: PromptMessage[]): string {
    const systemMessages = messages.filter((m) => m.role === 'system' || m.role === 'developer');
    return systemMessages.map((m) => m.content).join('\n\n');
  },

  toProviderMessages(messages: PromptMessage[]): SDKMessage[] {
    const nonSystemMessages = messages.filter((m) => m.role === 'user');
    return nonSystemMessages.map(toSDKMessage) as unknown as SDKMessage[];
  },

  renderSpec<TCtx>(spec: PromptSpec<TCtx>, ctx: TCtx): SDKMessage[] {
    const messages = spec.render(ctx);
    return this.toProviderMessages(messages);
  },

  renderStaticSpec(spec: StaticPromptSpec): SDKMessage[] {
    return this.toProviderMessages(spec.messages);
  },
};

export function getSystemPromptFromSpec<TCtx>(spec: PromptSpec<TCtx>, ctx: TCtx): string {
  const messages = spec.render(ctx);
  return claudeAgentSdkAdapter.toSystemPrompt(messages);
}

export function getSystemPromptFromStaticSpec(spec: StaticPromptSpec): string {
  return claudeAgentSdkAdapter.toSystemPrompt(spec.messages);
}
