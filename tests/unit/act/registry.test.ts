/**
 * Tests for ACTSubagentRegistry
 *
 * @module act/__tests__/registry.test
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ACTSubagentRegistry } from "../../../src/act/registry.js";
import type { ACTInstructions, AgentDefinition } from "../../../src/act/types.js";
import { DEFAULT_ACT_TOOLS } from "../../../src/act/types.js";

// Test fixture: valid ACTInstructions
const createTestInstructions = (
  overrides: Partial<ACTInstructions> = {}
): ACTInstructions => ({
  name: "test-analyzer",
  displayName: "Test Analyzer",
  description: "Analyzes test configurations",
  prompt: "You are a test analyzer...",
  tools: [...DEFAULT_ACT_TOOLS],
  actTypes: ["claude-code"],
  priority: 50,
  ...overrides,
});

describe("ACTSubagentRegistry", () => {
  let registry: ACTSubagentRegistry;

  beforeEach(() => {
    registry = new ACTSubagentRegistry();
  });

  describe("register()", () => {
    it("should register valid instructions", () => {
      const instructions = createTestInstructions();
      registry.register(instructions);
      expect(registry.get("test-analyzer")).toEqual(instructions);
    });

    it("should throw on duplicate name", () => {
      const instructions = createTestInstructions();
      registry.register(instructions);
      expect(() => registry.register(instructions)).toThrow(
        "Subagent with name 'test-analyzer' is already registered"
      );
    });

    it("should throw on invalid instructions (Task in tools)", () => {
      const instructions = createTestInstructions({
        tools: ["discover_configs", "Task"],
      });
      expect(() => registry.register(instructions)).toThrow();
    });

    it("should throw on invalid name format", () => {
      const instructions = createTestInstructions({
        name: "Invalid Name", // has uppercase and space
      });
      expect(() => registry.register(instructions)).toThrow();
    });
  });

  describe("get()", () => {
    it("should return undefined for unknown name", () => {
      expect(registry.get("unknown")).toBeUndefined();
    });

    it("should return registered instructions", () => {
      const instructions = createTestInstructions();
      registry.register(instructions);
      expect(registry.get("test-analyzer")).toEqual(instructions);
    });
  });

  describe("list()", () => {
    it("should return empty array when no registrations", () => {
      expect(registry.list()).toEqual([]);
    });

    it("should return all registered instructions", () => {
      const inst1 = createTestInstructions({ name: "analyzer-1" });
      const inst2 = createTestInstructions({ name: "analyzer-2" });
      registry.register(inst1);
      registry.register(inst2);

      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list).toContainEqual(inst1);
      expect(list).toContainEqual(inst2);
    });
  });

  // T013: Unit test for getForACTType() mapping
  describe("getForACTType()", () => {
    it("should return undefined when no match", () => {
      expect(registry.getForACTType("cursor")).toBeUndefined();
    });

    it("should return matching instructions for ACT type", () => {
      const instructions = createTestInstructions({
        actTypes: ["claude-code"],
      });
      registry.register(instructions);
      expect(registry.getForACTType("claude-code")).toEqual(instructions);
    });

    it("should return highest priority when multiple match", () => {
      const lowPriority = createTestInstructions({
        name: "low-priority",
        actTypes: ["claude-code"],
        priority: 10,
      });
      const highPriority = createTestInstructions({
        name: "high-priority",
        actTypes: ["claude-code"],
        priority: 100,
      });

      registry.register(lowPriority);
      registry.register(highPriority);

      expect(registry.getForACTType("claude-code")).toEqual(highPriority);
    });

    it("should match any type in actTypes array", () => {
      const instructions = createTestInstructions({
        actTypes: ["agents-md", "unknown"],
      });
      registry.register(instructions);

      expect(registry.getForACTType("agents-md")).toEqual(instructions);
      expect(registry.getForACTType("unknown")).toEqual(instructions);
    });
  });

  // T011: Unit test for toAgentsOption() returns Record<string, AgentDefinition>
  describe("toAgentsOption()", () => {
    it("should return empty object when no registrations", () => {
      expect(registry.toAgentsOption()).toEqual({});
    });

    it("should return Record<string, AgentDefinition>", () => {
      const instructions = createTestInstructions();
      registry.register(instructions);

      const agents = registry.toAgentsOption();

      // Should have the right key
      expect(agents).toHaveProperty("test-analyzer");

      // Should be a valid AgentDefinition
      const agent = agents["test-analyzer"] as AgentDefinition;
      expect(agent.description).toBe(instructions.description);
      expect(agent.prompt).toBe(instructions.prompt);
      expect(agent.tools).toEqual(instructions.tools);
    });

    it("should exclude internal metadata (displayName, actTypes, priority)", () => {
      const instructions = createTestInstructions();
      registry.register(instructions);

      const agents = registry.toAgentsOption();
      const agent = agents["test-analyzer"];

      // These should NOT be in AgentDefinition
      expect(agent).not.toHaveProperty("displayName");
      expect(agent).not.toHaveProperty("actTypes");
      expect(agent).not.toHaveProperty("priority");
      expect(agent).not.toHaveProperty("name");
    });

    it("should include model only when not 'inherit'", () => {
      const withModel = createTestInstructions({
        name: "with-model",
        model: "haiku",
      });
      const inheritModel = createTestInstructions({
        name: "inherit-model",
        model: "inherit",
      });
      const noModel = createTestInstructions({
        name: "no-model",
      });

      registry.register(withModel);
      registry.register(inheritModel);
      registry.register(noModel);

      const agents = registry.toAgentsOption();

      expect(agents["with-model"]?.model).toBe("haiku");
      expect(agents["inherit-model"]?.model).toBeUndefined();
      expect(agents["no-model"]?.model).toBeUndefined();
    });

    it("should convert all registered instructions", () => {
      const inst1 = createTestInstructions({ name: "analyzer-1" });
      const inst2 = createTestInstructions({ name: "analyzer-2" });
      registry.register(inst1);
      registry.register(inst2);

      const agents = registry.toAgentsOption();

      expect(Object.keys(agents)).toHaveLength(2);
      expect(agents).toHaveProperty("analyzer-1");
      expect(agents).toHaveProperty("analyzer-2");
    });
  });
});
