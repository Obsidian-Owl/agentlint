/**
 * Tests for ACT module public API
 *
 * @module act/__tests__/index.test
 */

import { describe, it, expect } from 'bun:test';
import { buildACTSubagents } from '../../../src/act/index.js';

// T012: Unit test for buildACTSubagents() returns all registered subagents
describe('buildACTSubagents()', () => {
  it('should return a Record<string, AgentDefinition>', () => {
    const agents = buildACTSubagents();
    expect(typeof agents).toBe('object');
    expect(agents).not.toBeNull();
  });

  it('should return subagents with required AgentDefinition fields', () => {
    const agents = buildACTSubagents();

    for (const [name, agent] of Object.entries(agents)) {
      // All agents should have name as key
      expect(typeof name).toBe('string');

      // All agents should have required fields
      expect(agent).toHaveProperty('description');
      expect(agent).toHaveProperty('prompt');

      // description and prompt should be non-empty strings
      expect(typeof agent.description).toBe('string');
      expect(agent.description.length).toBeGreaterThan(0);
      expect(typeof agent.prompt).toBe('string');
      expect(agent.prompt.length).toBeGreaterThan(0);
    }
  });

  it('should not include Task tool in any subagent', () => {
    const agents = buildACTSubagents();

    for (const agent of Object.values(agents)) {
      if (agent.tools) {
        expect(agent.tools).not.toContain('Task');
      }
    }
  });
});
