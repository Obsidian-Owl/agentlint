/**
 * Conversation Session Persistence
 *
 * Saves and loads conversation history to disk for session continuity.
 * Uses the .agentlint directory for storage.
 *
 * @module tui/welcome/session-persistence
 */

import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

import type { ConversationMessage } from '../types';
import type { WelcomeContext } from './types';
import { ensureDir, atomicWriteJson } from '../../persistence/common';

// Zod schema for conversation session file validation (security hardening)
const ConversationSessionFileSchema = z.object({
  version: z.literal('1.0.0'),
  session: z.object({
    id: z.string().uuid(),
    projectPath: z.string().min(1).max(1000),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(100000),
        timestamp: z.string().datetime().optional(),
      })
    ),
    welcomeContext: z.object({}).passthrough(),
  }),
});

// =============================================================================
// Types
// =============================================================================

export interface ConversationSession {
  id: string;
  projectPath: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  welcomeContext: WelcomeContext;
}

interface ConversationSessionFile {
  version: '1.0.0';
  session: ConversationSession;
}

// =============================================================================
// Constants
// =============================================================================

const SESSIONS_DIR = join(homedir(), '.agentlint', 'conversations');
const CURRENT_SESSION_FILE = 'current.json';
const SESSION_VERSION = '1.0.0';

// =============================================================================
// Public API
// =============================================================================

/**
 * Save the current conversation session to disk.
 */
export async function saveConversationSession(session: ConversationSession): Promise<string> {
  await ensureDir(SESSIONS_DIR);

  const fileContent: ConversationSessionFile = {
    version: SESSION_VERSION,
    session: {
      ...session,
      updatedAt: new Date().toISOString(),
    },
  };

  const filePath = join(SESSIONS_DIR, CURRENT_SESSION_FILE);
  await atomicWriteJson(filePath, fileContent);

  return filePath;
}

/**
 * Load the current conversation session from disk.
 */
export async function loadConversationSession(): Promise<ConversationSession | null> {
  const filePath = join(SESSIONS_DIR, CURRENT_SESSION_FILE);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = await Bun.file(filePath).text();
    const parsed: unknown = JSON.parse(content);

    const result = ConversationSessionFileSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }

    return result.data.session as unknown as ConversationSession;
  } catch {
    return null;
  }
}

/**
 * Clear the current conversation session.
 */
export async function clearConversationSession(): Promise<void> {
  const filePath = join(SESSIONS_DIR, CURRENT_SESSION_FILE);

  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Create a new conversation session.
 */
export function createConversationSession(
  projectPath: string,
  welcomeContext: WelcomeContext
): ConversationSession {
  return {
    id: crypto.randomUUID(),
    projectPath,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    welcomeContext,
  };
}

/**
 * Add a message to a conversation session.
 */
export function addMessageToSession(
  session: ConversationSession,
  message: ConversationMessage
): ConversationSession {
  return {
    ...session,
    updatedAt: new Date().toISOString(),
    messages: [...session.messages, message],
  };
}

/**
 * Check if a session is for the current project.
 */
export function isSessionForProject(session: ConversationSession, projectPath: string): boolean {
  return session.projectPath === projectPath;
}

/**
 * Check if a session is stale (older than the given hours).
 */
export function isSessionStale(session: ConversationSession, maxAgeHours: number): boolean {
  const updatedAt = new Date(session.updatedAt);
  const now = new Date();
  const ageMs = now.getTime() - updatedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}
