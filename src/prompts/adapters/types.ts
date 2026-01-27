import type { PromptMessage, PromptSpec, StaticPromptSpec } from '../promptkit/types';

export interface PromptAdapter<TProviderMessage = unknown> {
  readonly name: string;

  toSystemPrompt(messages: PromptMessage[]): string;

  toProviderMessages(messages: PromptMessage[]): TProviderMessage[];

  renderSpec<TCtx>(spec: PromptSpec<TCtx>, ctx: TCtx): TProviderMessage[];

  renderStaticSpec(spec: StaticPromptSpec): TProviderMessage[];
}
