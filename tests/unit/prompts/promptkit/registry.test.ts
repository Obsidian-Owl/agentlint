import { describe, it, expect, beforeEach } from 'bun:test';
import {
  PromptRegistry,
  resetPromptRegistry,
  getPromptRegistry,
  type PromptSpec,
  type StaticPromptSpec,
} from '../../../../src/prompts/promptkit';

const createTestPromptSpec = (overrides: Partial<PromptSpec<void>> = {}): PromptSpec<void> => ({
  id: 'test/prompt',
  version: '1.0.0',
  createdAt: '2026-01-27T00:00:00Z',
  description: 'Test prompt',
  render: () => [{ role: 'system', content: 'Test content' }],
  ...overrides,
});

const createStaticPromptSpec = (overrides: Partial<StaticPromptSpec> = {}): StaticPromptSpec => ({
  id: 'test/static',
  version: '1.0.0',
  createdAt: '2026-01-27T00:00:00Z',
  description: 'Static test prompt',
  messages: [{ role: 'system', content: 'Static content' }],
  ...overrides,
});

describe('PromptRegistry', () => {
  let registry: PromptRegistry;

  beforeEach(() => {
    registry = new PromptRegistry();
  });

  describe('register()', () => {
    it('should register valid prompt spec', () => {
      const spec = createTestPromptSpec();
      registry.register(spec);
      expect(registry.has('test/prompt')).toBe(true);
    });

    it('should register static prompt spec', () => {
      const spec = createStaticPromptSpec();
      registry.register(spec);
      expect(registry.has('test/static')).toBe(true);
    });

    it('should throw on duplicate id+version', () => {
      const spec = createTestPromptSpec();
      registry.register(spec);
      expect(() => registry.register(spec)).toThrow(/already registered/);
    });

    it('should allow same id with different version', () => {
      registry.register(createTestPromptSpec({ version: '1.0.0' }));
      registry.register(createTestPromptSpec({ version: '1.1.0' }));
      expect(registry.getVersions('test/prompt')).toEqual(['1.0.0', '1.1.0']);
    });

    it('should throw on invalid id format', () => {
      const spec = createTestPromptSpec({ id: 'invalid_id' });
      expect(() => registry.register(spec)).toThrow(/Invalid prompt ID/);
    });

    it('should throw on invalid version format', () => {
      const spec = createTestPromptSpec({ version: 'v1' });
      expect(() => registry.register(spec)).toThrow(/Invalid version/);
    });
  });

  describe('get()', () => {
    it('should retrieve prompt by id (latest version)', () => {
      registry.register(createTestPromptSpec({ version: '1.0.0' }));
      registry.register(createTestPromptSpec({ version: '2.0.0' }));
      const prompt = registry.get('test/prompt');
      expect(prompt?.version).toBe('2.0.0');
    });

    it('should retrieve prompt by id+version', () => {
      registry.register(createTestPromptSpec({ version: '1.0.0' }));
      registry.register(createTestPromptSpec({ version: '2.0.0' }));
      const prompt = registry.get('test/prompt', '1.0.0');
      expect(prompt?.version).toBe('1.0.0');
    });

    it('should return undefined for non-existent prompt', () => {
      expect(registry.get('non/existent')).toBeUndefined();
    });

    it('should return undefined for non-existent version', () => {
      registry.register(createTestPromptSpec({ version: '1.0.0' }));
      expect(registry.get('test/prompt', '9.9.9')).toBeUndefined();
    });
  });

  describe('getVersions()', () => {
    it('should return sorted versions', () => {
      registry.register(createTestPromptSpec({ version: '1.1.0' }));
      registry.register(createTestPromptSpec({ version: '1.0.0' }));
      registry.register(createTestPromptSpec({ version: '2.0.0' }));
      expect(registry.getVersions('test/prompt')).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    it('should handle prerelease versions correctly', () => {
      registry.register(createTestPromptSpec({ version: '1.0.0-beta' }));
      registry.register(createTestPromptSpec({ version: '1.0.0' }));
      const versions = registry.getVersions('test/prompt');
      expect(versions[0]).toBe('1.0.0-beta');
      expect(versions[1]).toBe('1.0.0');
    });

    it('should return empty array for non-existent prompt', () => {
      expect(registry.getVersions('non/existent')).toEqual([]);
    });
  });

  describe('list()', () => {
    it('should return all registered prompts metadata', () => {
      registry.register(createTestPromptSpec({ id: 'test/one', version: '1.0.0' }));
      registry.register(createTestPromptSpec({ id: 'test/two', version: '1.0.0' }));
      const list = registry.list();
      expect(list.length).toBe(2);
      expect(list.map((m) => m.id)).toContain('test/one');
      expect(list.map((m) => m.id)).toContain('test/two');
    });
  });

  describe('listByTag()', () => {
    it('should filter prompts by tag', () => {
      registry.register(createTestPromptSpec({ id: 'test/one', tags: ['welcome'] }));
      registry.register(createTestPromptSpec({ id: 'test/two', tags: ['analysis'] }));
      const welcome = registry.listByTag('welcome');
      expect(welcome.length).toBe(1);
      expect(welcome[0]?.id).toBe('test/one');
    });
  });

  describe('has()', () => {
    it('should return true for existing prompt', () => {
      registry.register(createTestPromptSpec());
      expect(registry.has('test/prompt')).toBe(true);
    });

    it('should return true for existing prompt+version', () => {
      registry.register(createTestPromptSpec());
      expect(registry.has('test/prompt', '1.0.0')).toBe(true);
    });

    it('should return false for non-existing prompt', () => {
      expect(registry.has('non/existent')).toBe(false);
    });

    it('should return false for non-existing version', () => {
      registry.register(createTestPromptSpec());
      expect(registry.has('test/prompt', '9.9.9')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all prompts', () => {
      registry.register(createTestPromptSpec());
      registry.clear();
      expect(registry.size).toBe(0);
      expect(registry.has('test/prompt')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return count of registered prompts', () => {
      expect(registry.size).toBe(0);
      registry.register(createTestPromptSpec({ version: '1.0.0' }));
      expect(registry.size).toBe(1);
      registry.register(createTestPromptSpec({ version: '2.0.0' }));
      expect(registry.size).toBe(2);
    });
  });
});

describe('getPromptRegistry()', () => {
  beforeEach(() => {
    resetPromptRegistry();
  });

  it('should return singleton instance', () => {
    const r1 = getPromptRegistry();
    const r2 = getPromptRegistry();
    expect(r1).toBe(r2);
  });

  it('should reset correctly', () => {
    const r1 = getPromptRegistry();
    r1.register(createTestPromptSpec());
    expect(r1.size).toBe(1);

    resetPromptRegistry();
    const r2 = getPromptRegistry();
    expect(r2.size).toBe(0);
    expect(r1).not.toBe(r2);
  });
});
