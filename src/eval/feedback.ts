/**
 * EP11 Quality & Security - Feedback Collection
 *
 * Collects user feedback on recommendations to track their effectiveness.
 * Implements opt-in feedback collection per Constitution Principle I (Local-First).
 *
 * @module eval/feedback
 */

import type {
  IFeedbackCollector,
  IOutcomeStorage,
  FeedbackPrompt,
  OutcomePrompt,
  OutcomeTrackingConfig,
  RecommendationType,
  FeedbackResponse,
} from '../../specs/ep11-quality-security/contracts/outcome';

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default outcome tracking configuration.
 * Feedback collection is opt-in by default per Constitution.
 */
export const DEFAULT_FEEDBACK_CONFIG: OutcomeTrackingConfig = {
  collectFeedback: false, // Opt-in per Constitution Principle I
  maxPromptsPerSession: 3, // Don't be annoying
  followUpDelayDays: 7, // Give time for user to evaluate
};

// =============================================================================
// FeedbackCollector Implementation
// =============================================================================

/**
 * Extended feedback prompt with recommendation type.
 * Used internally to track the type for outcome recording.
 */
export interface ExtendedFeedbackPrompt extends FeedbackPrompt {
  /** Recommendation type for outcome tracking */
  recommendationType: RecommendationType;
}

/**
 * Implements IFeedbackCollector for tracking recommendation outcomes.
 *
 * Features:
 * - Opt-in feedback collection (disabled by default)
 * - Session-based prompt limiting to avoid annoyance
 * - Follow-up prompts after delay period
 * - Explicit feedback recording
 *
 * @example
 * ```typescript
 * const collector = new FeedbackCollector(storage, {
 *   collectFeedback: true,
 *   maxPromptsPerSession: 3,
 *   followUpDelayDays: 7,
 * });
 *
 * // After analysis generates recommendations
 * const prompts = collector.getPromptsForSession(recommendations);
 *
 * // After user responds
 * for (const prompt of prompts) {
 *   prompt.response = userResponse;
 *   await collector.recordFeedback(prompt);
 * }
 * ```
 */
export class FeedbackCollector implements IFeedbackCollector {
  private storage: IOutcomeStorage;
  private config: OutcomeTrackingConfig;
  private sessionPromptCount: number = 0;
  private currentSessionId: string | null = null;
  private promptTypes: Map<string, RecommendationType> = new Map();

  /**
   * Create a new FeedbackCollector.
   *
   * @param storage - Outcome storage for persistence
   * @param config - Configuration options
   */
  constructor(storage: IOutcomeStorage, config?: Partial<OutcomeTrackingConfig>) {
    this.storage = storage;
    this.config = {
      ...DEFAULT_FEEDBACK_CONFIG,
      ...config,
    };
  }

  /**
   * Check if feedback collection is enabled.
   */
  isEnabled(): boolean {
    return this.config.collectFeedback;
  }

  /**
   * Check if we should prompt for feedback this session.
   * Returns true if enabled and haven't hit the prompt limit.
   */
  async shouldPrompt(): Promise<boolean> {
    return this.isEnabled() && this.sessionPromptCount < this.config.maxPromptsPerSession;
  }

  /**
   * Get prompts for recommendations to ask about.
   * Respects the max prompts per session limit.
   *
   * @param recommendations - Recommendations from the analysis
   * @returns Prompts to show the user (up to maxPromptsPerSession)
   */
  getPromptsForSession(
    recommendations: Array<{ id: string; summary: string; type: RecommendationType }>
  ): FeedbackPrompt[] {
    if (!this.isEnabled()) {
      return [];
    }

    // Calculate remaining prompts allowed
    const remaining = this.config.maxPromptsPerSession - this.sessionPromptCount;
    if (remaining <= 0) {
      return [];
    }

    // Take only as many as we're allowed to prompt about
    const selected = recommendations.slice(0, remaining);

    // Store recommendation types for later use in recordFeedback
    for (const rec of selected) {
      this.promptTypes.set(rec.id, rec.type);
    }

    return selected.map((rec) => ({
      recommendationId: rec.id,
      summary: rec.summary,
    }));
  }

  /**
   * Record user feedback for a recommendation.
   * Creates an outcome record in storage.
   *
   * @param prompt - The prompt with user's response
   */
  async recordFeedback(prompt: FeedbackPrompt): Promise<void> {
    if (!prompt.response) {
      return; // No response to record
    }

    // Increment prompt count
    this.sessionPromptCount++;

    // Map response to implemented status
    const implemented = this.mapResponseToImplemented(prompt.response);

    // Get recommendation type (stored during getPromptsForSession)
    const recommendationType = this.promptTypes.get(prompt.recommendationId) ?? 'preventive';

    // Create outcome record
    await this.storage.createOutcome({
      sessionId: this.currentSessionId ?? `session-${Date.now()}`,
      recommendationId: prompt.recommendationId,
      recommendationType,
      recommendationSummary: prompt.summary,
      implemented,
      implementationDate: implemented === true ? new Date().toISOString() : null,
      helped: null, // Will be filled in during follow-up
      outcomeNotes: null,
      configChangedAfter: null,
      similarIssueRecurred: null,
    });
  }

  /**
   * Get pending follow-up prompts for recommendations
   * that were implemented but not yet rated.
   */
  async getPendingFollowUps(): Promise<OutcomePrompt[]> {
    const pending = await this.storage.getPendingFollowUps(this.config.followUpDelayDays);

    return pending.map((outcome) => ({
      recommendationId: outcome.recommendationId,
      summary: outcome.recommendationSummary,
    }));
  }

  /**
   * Record follow-up outcome for a recommendation.
   *
   * @param prompt - The follow-up prompt with user's response
   */
  async recordFollowUp(prompt: OutcomePrompt): Promise<void> {
    const outcomes = await this.storage.getOutcomesByRecommendation(prompt.recommendationId);

    for (const outcome of outcomes) {
      await this.storage.updateOutcome(outcome.id, {
        helped: prompt.helped ?? null,
        outcomeNotes: prompt.notes ?? null,
      });
    }
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Start a new feedback session.
   * Resets the prompt count and clears stored types.
   *
   * @param sessionId - The session identifier
   */
  startSession(sessionId: string): void {
    this.currentSessionId = sessionId;
    this.sessionPromptCount = 0;
    this.promptTypes.clear();
  }

  /**
   * End the current feedback session.
   */
  endSession(): void {
    this.currentSessionId = null;
    this.sessionPromptCount = 0;
    this.promptTypes.clear();
  }

  /**
   * Get the current session ID.
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get the number of prompts shown this session.
   */
  getPromptCount(): number {
    return this.sessionPromptCount;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Map a feedback response to an implemented status.
   */
  private mapResponseToImplemented(response: FeedbackResponse): boolean | null {
    switch (response) {
      case 'will_implement':
      case 'already_done':
        return true;
      case 'not_relevant':
        return false;
      case 'maybe_later':
      case 'skip':
      default:
        return null;
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new FeedbackCollector.
 *
 * @param storage - Outcome storage for persistence
 * @param config - Configuration options
 * @returns An IFeedbackCollector implementation
 *
 * @example
 * ```typescript
 * const storage = createOutcomeStorage('~/.agentlint/outcomes.db');
 * const collector = createFeedbackCollector(storage, {
 *   collectFeedback: true,
 * });
 * ```
 */
export function createFeedbackCollector(
  storage: IOutcomeStorage,
  config?: Partial<OutcomeTrackingConfig>
): FeedbackCollector {
  return new FeedbackCollector(storage, config);
}
