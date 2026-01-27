/**
 * Opencode SDK Migration - Hybrid Session Manager
 *
 * Manages sessions using both Opencode SDK and agentlint metadata.
 * Opencode handles base session, agentlint adds findings and checkpoints.
 *
 * @module opencode/sessions
 */

import type { AgentlintOpencodeClient } from './client';

export interface SessionMetadata {
  sessionId: string;
  title: string;
  findings: string[];
  phase: string;
  toolCache: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface IHybridSessionManager {
  startSession(title: string): Promise<SessionMetadata>;
  saveCheckpoint(sessionId: string, metadata: Partial<SessionMetadata>): void;
  resumeSession(sessionId: string): SessionMetadata | null;
  getSession(sessionId: string): SessionMetadata | null;
}

export class HybridSessionManager implements IHybridSessionManager {
  private sessions: Map<string, SessionMetadata> = new Map();

  constructor(private client: AgentlintOpencodeClient) {}

  async startSession(title: string): Promise<SessionMetadata> {
    const opencodeSession = await this.client.createSession({ title });

    const metadata: SessionMetadata = {
      sessionId: opencodeSession.id,
      title,
      findings: [],
      phase: 'initial',
      toolCache: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(opencodeSession.id, metadata);
    return metadata;
  }

  saveCheckpoint(sessionId: string, updates: Partial<SessionMetadata>): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated: SessionMetadata = {
      ...existing,
      ...updates,
      sessionId,
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updated);
  }

  resumeSession(sessionId: string): SessionMetadata | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getSession(sessionId: string): SessionMetadata | null {
    return this.sessions.get(sessionId) ?? null;
  }
}
