/**
 * EP15 Session Intelligence - Permission Event Extraction
 *
 * Extracts permission approval/denial events from session logs.
 * Per FR-022: Tool extracts permission approval/denial events.
 * Per US-008: Permission patterns per tool/command are available.
 *
 * @module sessions/extraction/permissions
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Permission decision types.
 */
export const PERMISSION_DECISIONS = ['approved', 'denied', 'auto_approved'] as const;

/**
 * Tools that typically require user permission.
 */
export const PERMISSION_REQUIRED_TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'NotebookEdit',
  'Task',
  'Skill',
] as const;

/**
 * Tools that are safe and auto-approved.
 */
export const SAFE_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'AskUserQuestion',
  'TaskList',
  'TaskGet',
  'TaskUpdate',
  'TaskCreate',
] as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Permission decision type.
 */
export type PermissionDecision = (typeof PERMISSION_DECISIONS)[number];

/**
 * A permission event from a session.
 */
export interface PermissionEvent {
  /** Tool that requested permission */
  toolName: string;

  /** Permission decision */
  decision: PermissionDecision;

  /** ISO timestamp */
  timestamp: string;

  /** Turn index in session (1-based) */
  turnIndex: number;

  /** Tool input parameters (optional, may be omitted for privacy) */
  toolInput?: Record<string, unknown>;

  /** Command for Bash tool (extracted from input) */
  command?: string;

  /** File path for file tools (extracted from input) */
  filePath?: string;

  /** Reason for denial (if denied) */
  denialReason?: string;

  /** Whether this was auto-approved due to safe tool list or config */
  wasAutoApproved?: boolean;
}

/**
 * Input for creating a permission event.
 */
export interface CreatePermissionEventInput {
  toolName: string;
  toolInput: Record<string, unknown>;
  decision: PermissionDecision;
  timestamp: string;
  turnIndex: number;
  denialReason?: string;
}

/**
 * Aggregated permission pattern for a tool.
 */
export interface PermissionPattern {
  /** Tool name */
  toolName: string;

  /** Total permission requests */
  totalCount: number;

  /** Number approved */
  approvedCount: number;

  /** Number denied */
  deniedCount: number;

  /** Number auto-approved */
  autoApprovedCount: number;

  /** Approval rate (approved / total, excluding auto-approved) */
  approvalRate: number;

  /** Whether this tool has significant denials (friction candidate) */
  isFrictionCandidate: boolean;

  /** Command patterns for Bash (command -> count) */
  commandPatterns?: Record<string, number>;

  /** File patterns for file tools */
  filePatterns?: Record<string, number>;
}

/**
 * Options for extracting permission events.
 */
export interface ExtractPermissionOptions {
  /** Whether to infer permissions from tool_use/tool_result pairs */
  inferFromToolUse?: boolean;
}

/**
 * Session entry type for permission extraction.
 */
interface SessionEntry {
  type: string;
  timestamp: string;
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
  };
  toolResult?: {
    toolUseId: string;
    isError?: boolean;
  };
  permissionRequest?: {
    toolName: string;
    toolInput: Record<string, unknown>;
    decision: 'approved' | 'denied' | 'auto_approved';
    timestamp: string;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a tool typically requires permission.
 *
 * @param toolName - Name of the tool
 * @returns True if permission is typically required
 */
export function isPermissionRequired(toolName: string): boolean {
  // Agentlint's own MCP tools don't need permission
  if (toolName.startsWith('mcp__agentlint__')) {
    return false;
  }

  // Safe tools don't need permission
  if ((SAFE_TOOLS as readonly string[]).includes(toolName)) {
    return false;
  }

  // Permission-required tools
  if ((PERMISSION_REQUIRED_TOOLS as readonly string[]).includes(toolName)) {
    return true;
  }

  // External MCP tools typically need permission
  if (toolName.startsWith('mcp__')) {
    return true;
  }

  // Unknown tools - assume permission required
  return true;
}

/**
 * Extract command from tool input.
 */
function extractCommand(toolInput: Record<string, unknown>): string | undefined {
  if (typeof toolInput.command === 'string') {
    return toolInput.command;
  }
  return undefined;
}

/**
 * Extract file path from tool input.
 */
function extractFilePath(toolInput: Record<string, unknown>): string | undefined {
  if (typeof toolInput.file_path === 'string') {
    return toolInput.file_path;
  }
  return undefined;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a permission event.
 *
 * @param input - Event creation input
 * @returns PermissionEvent
 */
export function createPermissionEvent(input: CreatePermissionEventInput): PermissionEvent {
  const event: PermissionEvent = {
    toolName: input.toolName,
    decision: input.decision,
    timestamp: input.timestamp,
    turnIndex: input.turnIndex,
    wasAutoApproved: input.decision === 'auto_approved',
  };

  // Store tool input (could be filtered for privacy in production)
  if (input.toolInput) {
    event.toolInput = input.toolInput;

    // Extract command for Bash
    const command = extractCommand(input.toolInput);
    if (command) {
      event.command = command;
    }

    // Extract file path for file tools
    const filePath = extractFilePath(input.toolInput);
    if (filePath) {
      event.filePath = filePath;
    }
  }

  // Add denial reason if present
  if (input.denialReason) {
    event.denialReason = input.denialReason;
  }

  return event;
}

// =============================================================================
// Extraction Functions
// =============================================================================

/**
 * Extract permission events from session entries.
 *
 * @param entries - Session entries
 * @param options - Extraction options
 * @returns Array of permission events
 */
export function extractPermissionEvents(
  entries: SessionEntry[],
  options: ExtractPermissionOptions = {}
): PermissionEvent[] {
  const events: PermissionEvent[] = [];
  let turnIndex = 0;

  // Track pending tool uses for inference
  const pendingToolUses = new Map<
    string,
    { toolName: string; toolInput: Record<string, unknown>; timestamp: string; turnIndex: number }
  >();

  for (const entry of entries) {
    // Track turn index
    if (entry.type === 'user' || entry.type === 'assistant') {
      turnIndex++;
    }

    // Extract from explicit permission entries
    if (entry.type === 'permission' && entry.permissionRequest) {
      const pr = entry.permissionRequest;
      events.push(
        createPermissionEvent({
          toolName: pr.toolName,
          toolInput: pr.toolInput,
          decision: pr.decision,
          timestamp: pr.timestamp,
          turnIndex,
        })
      );
      continue;
    }

    // Infer from tool_use/tool_result if enabled
    if (options.inferFromToolUse) {
      // Track tool uses
      if (entry.type === 'assistant' && entry.message?.content) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use' && block.name) {
            // Only track tools that require permission
            if (isPermissionRequired(block.name)) {
              pendingToolUses.set(block.name, {
                toolName: block.name,
                toolInput: block.input ?? {},
                timestamp: entry.timestamp,
                turnIndex,
              });
            }
          }
        }
      }

      // Match tool results
      if (entry.type === 'tool_result' && entry.toolResult) {
        // Find matching tool use
        for (const [toolName, pending] of pendingToolUses.entries()) {
          // Infer approval since tool was executed
          events.push(
            createPermissionEvent({
              toolName: pending.toolName,
              toolInput: pending.toolInput,
              decision: 'approved',
              timestamp: pending.timestamp,
              turnIndex: pending.turnIndex,
            })
          );
          pendingToolUses.delete(toolName);
          break; // Only match first
        }
      }
    }
  }

  return events;
}

// =============================================================================
// Aggregation Functions
// =============================================================================

/**
 * Aggregate permission events into patterns per tool.
 *
 * @param events - Permission events
 * @returns Array of permission patterns
 */
export function aggregatePermissionPatterns(events: PermissionEvent[]): PermissionPattern[] {
  if (events.length === 0) {
    return [];
  }

  // Group by tool name
  const byTool = new Map<
    string,
    {
      events: PermissionEvent[];
      approved: number;
      denied: number;
      autoApproved: number;
      commands: Map<string, number>;
      files: Map<string, number>;
    }
  >();

  for (const event of events) {
    const existing = byTool.get(event.toolName) ?? {
      events: [] as PermissionEvent[],
      approved: 0,
      denied: 0,
      autoApproved: 0,
      commands: new Map<string, number>(),
      files: new Map<string, number>(),
    };

    existing.events.push(event);

    switch (event.decision) {
      case 'approved':
        existing.approved++;
        break;
      case 'denied':
        existing.denied++;
        break;
      case 'auto_approved':
        existing.autoApproved++;
        break;
    }

    // Track command patterns
    if (event.command) {
      existing.commands.set(event.command, (existing.commands.get(event.command) ?? 0) + 1);
    }

    // Track file patterns
    if (event.filePath) {
      existing.files.set(event.filePath, (existing.files.get(event.filePath) ?? 0) + 1);
    }

    byTool.set(event.toolName, existing);
  }

  // Convert to patterns
  const patterns: PermissionPattern[] = [];

  for (const [toolName, data] of byTool.entries()) {
    const totalCount = data.events.length;
    const manualDecisions = data.approved + data.denied;
    const approvalRate = manualDecisions > 0 ? data.approved / manualDecisions : 1;

    const pattern: PermissionPattern = {
      toolName,
      totalCount,
      approvedCount: data.approved,
      deniedCount: data.denied,
      autoApprovedCount: data.autoApproved,
      approvalRate,
      isFrictionCandidate: data.denied > 0,
    };

    // Add command patterns for Bash
    if (data.commands.size > 0) {
      pattern.commandPatterns = Object.fromEntries(data.commands);
    }

    // Add file patterns
    if (data.files.size > 0) {
      pattern.filePatterns = Object.fromEntries(data.files);
    }

    patterns.push(pattern);
  }

  return patterns;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Filter permission events by decision.
 *
 * @param events - Permission events
 * @param decision - Decision to filter by
 * @returns Filtered events
 */
export function filterByDecision(
  events: PermissionEvent[],
  decision: PermissionDecision
): PermissionEvent[] {
  return events.filter((e) => e.decision === decision);
}

/**
 * Get denied events (friction candidates).
 *
 * @param events - Permission events
 * @returns Denied events
 */
export function getDeniedEvents(events: PermissionEvent[]): PermissionEvent[] {
  return filterByDecision(events, 'denied');
}

/**
 * Count events by tool.
 *
 * @param events - Permission events
 * @returns Map of tool name to count
 */
export function countByTool(events: PermissionEvent[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const event of events) {
    counts.set(event.toolName, (counts.get(event.toolName) ?? 0) + 1);
  }

  return counts;
}
