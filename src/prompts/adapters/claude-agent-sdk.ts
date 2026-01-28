import type { PromptMessage, PromptSpec, StaticPromptSpec } from '../promptkit/types';
import type { PromptAdapter } from './types';

interface ProviderMessage {
  role: 'user' | 'assistant';
  content: Array<{ type: 'text'; text: string }>;
}

function toProviderRole(role: PromptMessage['role']): 'user' | 'assistant' {
  if (role === 'system' || role === 'developer') {
    return 'user';
  }
  return role;
}

function toProviderMessage(message: PromptMessage): ProviderMessage {
  return {
    role: toProviderRole(message.role),
    content: [{ type: 'text', text: message.content }],
  };
}

export const claudeAgentSdkAdapter: PromptAdapter<ProviderMessage> = {
  name: 'claude-agent-sdk',

  toSystemPrompt(messages: PromptMessage[]): string {
    const systemMessages = messages.filter((m) => m.role === 'system' || m.role === 'developer');
    return systemMessages.map((m) => m.content).join('\n\n');
  },

  toProviderMessages(messages: PromptMessage[]): ProviderMessage[] {
    const nonSystemMessages = messages.filter((m) => m.role === 'user');
    return nonSystemMessages.map(toProviderMessage);
  },

  renderSpec<TCtx>(spec: PromptSpec<TCtx>, ctx: TCtx): ProviderMessage[] {
    const messages = spec.render(ctx);
    return this.toProviderMessages(messages);
  },

  renderStaticSpec(spec: StaticPromptSpec): ProviderMessage[] {
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
