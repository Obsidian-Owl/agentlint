/**
 * ACT Subagent Registry
 *
 * Manages registration and lookup of ACT subagent instructions.
 *
 * @module act/registry
 */

import type { ACTType } from '../tools/types.js';
import type { AgentDefinition, ACTInstructions } from './types.js';
import { ACTInstructionsSchema } from './types.js';

/**
 * T009: Interface for the ACT subagent registry.
 */
export interface IACTSubagentRegistry {
  /**
   * Register a new subagent instruction set.
   * @throws Error if name is already registered
   */
  register(instructions: ACTInstructions): void;

  /**
   * Get instructions by name.
   */
  get(name: string): ACTInstructions | undefined;

  /**
   * List all registered instructions.
   */
  list(): ACTInstructions[];

  /**
   * Get the best-matching instructions for an ACT type.
   * Returns the highest-priority instructions that handle this type.
   */
  getForACTType(actType: ACTType): ACTInstructions | undefined;

  /**
   * Convert registry to SDK agents option format.
   * @returns Record<string, AgentDefinition> for SDK query options
   */
  toAgentsOption(): Record<string, AgentDefinition>;
}

/**
 * T010: ACT Subagent Registry implementation.
 *
 * Manages the lifecycle of ACT subagent instructions:
 * - Registration with validation
 * - Lookup by name or ACT type
 * - Conversion to SDK format
 */
export class ACTSubagentRegistry implements IACTSubagentRegistry {
  private readonly subagents: Map<string, ACTInstructions> = new Map();

  /**
   * Register a new subagent instruction set.
   * @param instructions - The ACTInstructions to register
   * @throws Error if name is already registered
   * @throws ZodError if instructions fail validation
   */
  register(instructions: ACTInstructions): void {
    // Validate against schema
    ACTInstructionsSchema.parse(instructions);

    if (this.subagents.has(instructions.name)) {
      throw new Error(`Subagent with name '${instructions.name}' is already registered`);
    }

    this.subagents.set(instructions.name, instructions);
  }

  /**
   * Get instructions by name.
   */
  get(name: string): ACTInstructions | undefined {
    return this.subagents.get(name);
  }

  /**
   * List all registered instructions.
   */
  list(): ACTInstructions[] {
    return Array.from(this.subagents.values());
  }

  /**
   * Get the best-matching instructions for an ACT type.
   * Returns the highest-priority instructions that handle this type.
   */
  getForACTType(actType: ACTType): ACTInstructions | undefined {
    const matches = this.list().filter((inst) =>
      inst.actTypes.includes(actType as ACTInstructions['actTypes'][number])
    );

    if (matches.length === 0) {
      return undefined;
    }

    // Return highest priority match
    return matches.reduce((best, current) => (current.priority > best.priority ? current : best));
  }

  /**
   * Convert registry to SDK agents option format.
   *
   * Maps ACTInstructions to AgentDefinition objects, dropping
   * internal metadata (displayName, actTypes, priority).
   *
   * @returns Record<string, AgentDefinition> for SDK query options
   */
  toAgentsOption(): Record<string, AgentDefinition> {
    const agents: Record<string, AgentDefinition> = {};

    for (const instructions of this.subagents.values()) {
      const agentDef: AgentDefinition = {
        description: instructions.description,
        prompt: instructions.prompt,
        tools: [...instructions.tools],
      };

      // Only include model if not 'inherit' (SDK default)
      if (instructions.model && instructions.model !== 'inherit') {
        agentDef.model = instructions.model;
      }

      agents[instructions.name] = agentDef;
    }

    return agents;
  }
}
