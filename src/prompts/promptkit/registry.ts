/**
 * PromptKit Registry
 *
 * Version-aware prompt storage enabling A/B testing and learning over time.
 * Prompts are registered by id+version and can be retrieved by id (latest) or id+version (specific).
 */

import {
  type PromptSpec,
  type StaticPromptSpec,
  type PromptMetadata,
  type PromptMessage,
  getPromptKey,
  PromptIdSchema,
  SemverSchema,
  isStaticPromptSpec,
} from './types';
import { getTelemetryClient } from '../../telemetry';

export type RegisterablePrompt = PromptSpec<unknown> | StaticPromptSpec;

function compareSemver(a: string, b: string): number {
  const aBase = a.split('-')[0] ?? '';
  const bBase = b.split('-')[0] ?? '';
  const aParts = aBase.split('.').map(Number);
  const bParts = bBase.split('.').map(Number);

  const aMajor = aParts[0] ?? 0;
  const aMinor = aParts[1] ?? 0;
  const aPatch = aParts[2] ?? 0;
  const bMajor = bParts[0] ?? 0;
  const bMinor = bParts[1] ?? 0;
  const bPatch = bParts[2] ?? 0;

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  if (aPatch !== bPatch) return aPatch - bPatch;

  const aPrerelease = a.includes('-');
  const bPrerelease = b.includes('-');
  if (aPrerelease && !bPrerelease) return -1;
  if (!aPrerelease && bPrerelease) return 1;

  return 0;
}

export interface PromptRegistryEntry {
  metadata: PromptMetadata;
  prompt: RegisterablePrompt;
}

export class PromptRegistry {
  private readonly prompts: Map<string, PromptRegistryEntry> = new Map();
  private readonly versionsByPromptId: Map<string, string[]> = new Map();

  register<TCtx>(spec: PromptSpec<TCtx>): void;
  register(spec: StaticPromptSpec): void;
  register(spec: RegisterablePrompt): void {
    const idResult = PromptIdSchema.safeParse(spec.id);
    if (!idResult.success) {
      throw new Error(`Invalid prompt ID "${spec.id}": ${idResult.error.message}`);
    }

    const versionResult = SemverSchema.safeParse(spec.version);
    if (!versionResult.success) {
      throw new Error(`Invalid version "${spec.version}": ${versionResult.error.message}`);
    }

    const key = getPromptKey(spec.id, spec.version);

    if (this.prompts.has(key)) {
      throw new Error(`Prompt "${key}" already registered. Use a new version instead.`);
    }

    this.prompts.set(key, {
      metadata: {
        id: spec.id,
        version: spec.version,
        createdAt: spec.createdAt,
        description: spec.description,
        tags: spec.tags,
      },
      prompt: spec,
    });

    const versions = this.versionsByPromptId.get(spec.id) ?? [];
    versions.push(spec.version);
    versions.sort(compareSemver);
    this.versionsByPromptId.set(spec.id, versions);
  }

  get<TCtx = unknown>(
    id: string,
    version?: string
  ): PromptSpec<TCtx> | StaticPromptSpec | undefined {
    const targetVersion = version ?? this.getLatestVersion(id);
    if (!targetVersion) return undefined;

    const key = getPromptKey(id, targetVersion);
    const entry = this.prompts.get(key);
    return entry?.prompt as PromptSpec<TCtx> | StaticPromptSpec | undefined;
  }

  getMetadata(id: string, version?: string): PromptMetadata | undefined {
    const targetVersion = version ?? this.getLatestVersion(id);
    if (!targetVersion) return undefined;

    const key = getPromptKey(id, targetVersion);
    return this.prompts.get(key)?.metadata;
  }

  getLatestVersion(id: string): string | undefined {
    const versions = this.versionsByPromptId.get(id);
    return versions?.[versions.length - 1];
  }

  getVersions(id: string): string[] {
    return [...(this.versionsByPromptId.get(id) ?? [])];
  }

  list(): PromptMetadata[] {
    return Array.from(this.prompts.values()).map((entry) => entry.metadata);
  }

  listByTag(tag: string): PromptMetadata[] {
    return this.list().filter((meta) => meta.tags?.includes(tag));
  }

  has(id: string, version?: string): boolean {
    if (version) {
      return this.prompts.has(getPromptKey(id, version));
    }
    return this.versionsByPromptId.has(id);
  }

  clear(): void {
    this.prompts.clear();
    this.versionsByPromptId.clear();
  }

  get size(): number {
    return this.prompts.size;
  }
}

let globalRegistry: PromptRegistry | undefined;

export function getPromptRegistry(): PromptRegistry {
  if (!globalRegistry) {
    globalRegistry = new PromptRegistry();
  }
  return globalRegistry;
}

export function resetPromptRegistry(): void {
  globalRegistry = undefined;
}

export interface ResolvePromptOptions {
  version?: string;
  sessionId?: string;
  usageContext?: string;
}

export function resolvePrompt<TCtx = void>(
  id: string,
  ctx: TCtx,
  versionOrOptions?: string | ResolvePromptOptions
): PromptMessage[] | undefined {
  const options: ResolvePromptOptions =
    typeof versionOrOptions === 'string' ? { version: versionOrOptions } : (versionOrOptions ?? {});

  const registry = getPromptRegistry();
  const spec = registry.get<TCtx>(id, options.version);

  if (!spec) {
    return undefined;
  }

  const messages = isStaticPromptSpec(spec) ? spec.messages : spec.render(ctx);

  if (options.sessionId && messages) {
    const client = getTelemetryClient();
    if (client.trackPrompt) {
      const contentLength = messages.reduce((sum, m) => sum + m.content.length, 0);
      client.trackPrompt(options.sessionId, {
        promptId: spec.id,
        promptVersion: spec.version,
        promptKey: getPromptKey(spec.id, spec.version),
        usageContext: options.usageContext ?? 'unknown',
        messageCount: messages.length,
        contentLength,
      });
    }
  }

  return messages;
}

export function resolvePromptContent<TCtx = void>(
  id: string,
  ctx: TCtx,
  versionOrOptions?: string | ResolvePromptOptions
): string | undefined {
  const messages = resolvePrompt(id, ctx, versionOrOptions);
  return messages?.[0]?.content;
}
