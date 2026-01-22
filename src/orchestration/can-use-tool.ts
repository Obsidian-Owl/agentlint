/**
 * EP02 Orchestration Core - canUseTool Callback Handler
 *
 * Implements ADR-0021: Conversational Interaction Model
 *
 * Handles human-in-the-loop interactions:
 * - AskUserQuestion: Routes to interactive question presenter
 * - Tool approvals: Prompts user before destructive operations
 *
 * @module orchestration/can-use-tool
 */

import * as readline from 'node:readline';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { presentQuestionsInteractive } from '../cli/components/question-presenter';
import type { ClarifyingQuestion } from '../recommendations/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for canUseTool callback behavior.
 */
export interface CanUseToolOptions {
  /** Whether to run in non-interactive mode (auto-allow all) */
  nonInteractive?: boolean;
  /** Whether to show verbose output */
  verbose?: boolean;
  /** Custom logger for output */
  log?: (message: string) => void;
}

/**
 * AskUserQuestion input structure from the SDK.
 */
interface AskUserQuestionInput {
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description?: string;
    }>;
    multiSelect?: boolean;
  }>;
  answers?: Record<string, string>;
}

// =============================================================================
// Tool Approval
// =============================================================================

/**
 * Prompt user for tool approval via readline.
 *
 * @param toolName - Name of the tool requesting approval
 * @param input - Tool input parameters
 * @returns User's approval decision
 */
async function promptForToolApproval(
  toolName: string,
  input: Record<string, unknown>
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('');
    console.log(`Tool: ${toolName}`);

    // Show relevant details based on tool type
    if (toolName === 'Bash' && input.command) {
      console.log(`Command: ${input.command}`);
      if (input.description) {
        console.log(`Description: ${input.description}`);
      }
    } else if (toolName === 'Write' && input.file_path) {
      console.log(`File: ${input.file_path}`);
    } else if (toolName === 'Edit' && input.file_path) {
      console.log(`File: ${input.file_path}`);
    } else {
      // Generic input display
      const preview = JSON.stringify(input).slice(0, 200);
      console.log(`Input: ${preview}${preview.length >= 200 ? '...' : ''}`);
    }

    console.log('');
    rl.question('Allow this action? [Y/n]: ', (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      // Default to yes if user just presses enter
      resolve(trimmed === '' || trimmed === 'y' || trimmed === 'yes');
    });
  });
}

// =============================================================================
// AskUserQuestion Handler
// =============================================================================

/**
 * Convert SDK AskUserQuestion input to ClarifyingQuestion format.
 */
function convertToQuestions(input: AskUserQuestionInput): ClarifyingQuestion[] {
  return input.questions.map((q) => {
    const question: ClarifyingQuestion = {
      question: q.question,
      context: q.header,
      options: q.options.map((opt) => ({
        label: opt.label,
        description: opt.description ?? '',
      })),
    };
    if (q.options[0]?.label !== undefined) {
      question.defaultAnswer = q.options[0].label;
    }
    return question;
  });
}

/**
 * Handle AskUserQuestion tool call.
 *
 * Presents questions to user and returns their answers.
 *
 * @param input - AskUserQuestion input from SDK
 * @returns PermissionResult with answers
 */
async function handleAskUserQuestion(input: AskUserQuestionInput): Promise<PermissionResult> {
  const questions = convertToQuestions(input);
  const answersMap = await presentQuestionsInteractive(questions, { allowSkip: true });

  // Convert Map to Record for SDK
  const answers: Record<string, string> = {};
  for (const [questionText, answer] of answersMap) {
    answers[questionText] = answer.answer;
  }

  return {
    behavior: 'allow',
    updatedInput: {
      questions: input.questions,
      answers,
    },
  };
}

// =============================================================================
// Main Callback
// =============================================================================

/**
 * Create a canUseTool callback for the orchestrator.
 *
 * This callback enables human-in-the-loop interactions:
 * - AskUserQuestion: Presents questions interactively
 * - Other tools: Prompts for approval before execution
 *
 * @param options - Callback options
 * @returns canUseTool callback function
 *
 * @example
 * ```typescript
 * const canUseTool = createCanUseToolCallback({ nonInteractive: false });
 *
 * const response = await query({
 *   prompt: task,
 *   options: { canUseTool },
 * });
 * ```
 */
export function createCanUseToolCallback(
  options: CanUseToolOptions = {}
): (
  toolName: string,
  input: Record<string, unknown>,
  context: unknown
) => Promise<PermissionResult> {
  const { nonInteractive = false, verbose = false, log = console.log } = options;

  return async (
    toolName: string,
    input: Record<string, unknown>,
    _context: unknown
  ): Promise<PermissionResult> => {
    // Non-interactive mode: auto-allow everything
    if (nonInteractive) {
      if (verbose) {
        log(`[canUseTool] Auto-allowing ${toolName} (non-interactive mode)`);
      }
      return { behavior: 'allow', updatedInput: input };
    }

    // Handle AskUserQuestion specially
    if (toolName === 'AskUserQuestion') {
      if (verbose) {
        log(`[canUseTool] Presenting questions to user`);
      }
      return handleAskUserQuestion(input as unknown as AskUserQuestionInput);
    }

    // Tools that typically don't need approval
    const safeTools = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];
    if (safeTools.includes(toolName)) {
      return { behavior: 'allow', updatedInput: input };
    }

    // Agentlint's own MCP tools - allow by default
    if (toolName.startsWith('mcp__agentlint__')) {
      return { behavior: 'allow', updatedInput: input };
    }

    // Prompt user for approval on other tools
    if (verbose) {
      log(`[canUseTool] Requesting approval for ${toolName}`);
    }

    const approved = await promptForToolApproval(toolName, input);

    if (approved) {
      return { behavior: 'allow', updatedInput: input };
    } else {
      return {
        behavior: 'deny',
        message: 'User denied this action. Try a different approach or ask for clarification.',
      };
    }
  };
}
