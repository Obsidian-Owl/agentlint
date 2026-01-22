"""
TruLens Evaluation Configuration for EP10 Recommendation Advisor

This module configures TruLens feedback functions for evaluating
the quality of recommendation advisor outputs per ADR-0011 and ADR-0012.

Feedback functions evaluate:
1. Recommendation specificity - Is the action concrete and actionable?
2. Causal trace validity - Is the traced origin valid and meaningful?
3. Prioritization justification - Is the priority level justified by evidence?
4. Question quality - Are clarifying questions non-leading and balanced?

Usage:
    python -m tests.evals.recommendations.run --scenario rec-01-simple-config
    python -m tests.evals.recommendations.run --all

See ADR-0011 (Testing Strategy) and ADR-0012 (Evaluation Framework).
"""

from typing import Any

# TruLens imports - these will be available when TruLens is installed
try:
    from trulens.core import Feedback, TruSession
    from trulens.providers.openai import OpenAI as TruLensOpenAI
    TRULENS_AVAILABLE = True
except ImportError:
    TRULENS_AVAILABLE = False
    # Define stubs for type checking
    class Feedback:
        def __init__(self, func):
            self.func = func
        def on_input_output(self):
            return self
        def on_output(self):
            return self
    class TruSession:
        def __init__(self, **kwargs):
            pass
    class TruLensOpenAI:
        def relevance(self, *args, **kwargs):
            return 0.5
        def groundedness(self, *args, **kwargs):
            return 0.5
        def coherence(self, *args, **kwargs):
            return 0.5
        def generate_score(self, prompt: str) -> float:
            return 0.5


# =============================================================================
# Session Configuration
# =============================================================================

def get_trulens_session(database_path: str = ".agentlint/evals.db") -> TruSession:
    """
    Initialize TruLens session with local SQLite storage.

    Per Constitution Principle I (Local-First), all evaluation data
    is stored locally.
    """
    return TruSession(database_path=database_path)


# =============================================================================
# Provider Configuration
# =============================================================================

def get_provider() -> TruLensOpenAI:
    """
    Get the TruLens evaluation provider.

    Uses OpenAI as the LLM-as-judge per ADR-0011 recommendation
    to avoid meta-circularity (using Claude to judge Claude).
    """
    return TruLensOpenAI()


# =============================================================================
# Recommendation Feedback Functions
# =============================================================================

def recommendation_specificity(recommendation: dict[str, Any]) -> float:
    """
    Evaluate if a recommendation is specific and actionable.

    Per Constitution Principle III (Causal-First), recommendations should
    be concrete actions the user can take to prevent future issues.

    Args:
        recommendation: A recommendation object with action, target, rationale

    Returns:
        Score from 0 to 1:
        - 1.0: Clear action, specific file/line, concrete change
        - 0.5: Actionable but vague about specifics
        - 0.0: Too abstract to implement
    """
    prompt = f"""
    Rate this recommendation's specificity and actionability from 0 to 1.

    ## Recommendation
    Action: {recommendation.get('action', 'N/A')}
    Target: {recommendation.get('target', 'N/A')}
    Type: {recommendation.get('type', 'N/A')}
    Rationale: {recommendation.get('rationale', 'N/A')}

    ## Evaluation Criteria
    1. **Specificity**: Does it identify specific files, lines, or configurations?
       - Good: "Add error handling section to CLAUDE.md line 50"
       - Bad: "Improve documentation"

    2. **Clarity**: Is the recommended change clearly described?
       - Good: "Add try-catch blocks around API calls in orchestrator.ts"
       - Bad: "Handle errors better"

    3. **Implementability**: Can a developer act on this immediately?
       - Good: Can copy-paste or directly implement
       - Bad: Requires significant research first

    4. **Rationale quality**: Is there clear reasoning for WHY this change helps?
       - Good: Explains the causal link between change and benefit
       - Bad: No explanation or vague "will improve things"

    Rate specificity from 0 to 10:
    - 10: Clear action, specific location, concrete change with rationale
    - 5: Actionable but vague about specifics or missing rationale
    - 0: Too abstract to implement ("improve configuration quality")

    Score (0-10):
    """
    if TRULENS_AVAILABLE:
        raw_score = get_provider().generate_score(prompt)
        # Normalize 0-10 scale to 0-1 for threshold comparison
        return raw_score / 10.0 if raw_score > 1.0 else raw_score
    return 0.5  # Stub for testing


def recommendation_causal_trace(recommendation: dict[str, Any]) -> float:
    """
    Evaluate if the traced origin is valid and meaningful.

    Per Constitution Principle III (Causal-First), recommendations must
    trace issues to their actual origin, not just correlate symptoms.

    Args:
        recommendation: A recommendation object with tracedOrigin

    Returns:
        Score from 0 to 1:
        - 1.0: Clear causal chain with valid findingId/sessionId/pattern
        - 0.5: Partial trace, some evidence but incomplete
        - 0.0: No trace or invalid/nonsensical origin
    """
    traced_origin = recommendation.get('tracedOrigin', {})

    prompt = f"""
    Evaluate if this traced origin is valid and meaningful.

    ## Recommendation
    Action: {recommendation.get('action', 'N/A')}
    Target: {recommendation.get('target', 'N/A')}
    Type: {recommendation.get('type', 'N/A')}

    ## Traced Origin
    Finding ID: {traced_origin.get('findingId', 'N/A')}
    Session ID: {traced_origin.get('sessionId', 'N/A')}
    Config Gap: {traced_origin.get('configGap', 'N/A')}
    Pattern: {traced_origin.get('pattern', 'N/A')}

    ## Evaluation Criteria
    1. **Presence**: At least ONE origin field must be present and non-empty
       - findingId: Links to EP05/EP06/EP07 finding
       - sessionId: Links to session where issue occurred
       - configGap: Describes what's missing from configuration
       - pattern: Describes recurring pattern identified

    2. **Relevance**: The origin must logically connect to the recommendation
       - Good: "Add error handling docs" traced to "Missing error handling guidance"
       - Bad: "Add error handling docs" traced to "Performance issue in API"

    3. **Specificity**: The origin should be specific, not generic
       - Good: "Pattern: repeated-null-pointer-in-api-layer"
       - Bad: "Pattern: errors"

    4. **Causal link**: There should be a clear WHY connection
       - The origin should explain HOW the issue arose

    Rate causal trace validity from 0 to 10:
    - 10: Clear, specific, relevant origin with logical causal connection
    - 5: Partial trace - present but vague or weakly connected
    - 0: No trace, invalid, or nonsensical connection

    Score (0-10):
    """
    if TRULENS_AVAILABLE:
        raw_score = get_provider().generate_score(prompt)
        # Normalize 0-10 scale to 0-1 for threshold comparison
        return raw_score / 10.0 if raw_score > 1.0 else raw_score
    return 0.5  # Stub for testing


def recommendation_prioritization(recommendations: list[dict[str, Any]]) -> float:
    """
    Evaluate if priority assignments are justified by evidence.

    Per Constitution Principle III, recommendations should be prioritized
    by compounding impact - a fix that prevents 10 future issues is
    higher priority than one that fixes 1 past issue.

    Args:
        recommendations: List of recommendations with priority levels

    Returns:
        Score from 0 to 1:
        - 1.0: Priorities clearly justified by impact/evidence
        - 0.5: Reasonable priorities but weak justification
        - 0.0: Arbitrary or inconsistent priorities
    """
    # Format recommendations for evaluation
    rec_summaries = []
    for i, rec in enumerate(recommendations, 1):
        rec_summaries.append(f"""
        {i}. Priority: {rec.get('priority', 'N/A')}
           Type: {rec.get('type', 'N/A')}
           Action: {rec.get('action', 'N/A')}
           Rationale: {rec.get('rationale', 'N/A')}
           Pattern: {rec.get('tracedOrigin', {}).get('pattern', 'N/A')}
        """)

    prompt = f"""
    Evaluate if these recommendations have justified priority assignments.

    ## Recommendations (sorted by priority)
    {''.join(rec_summaries)}

    ## Priority Guidelines
    - **high**: Compounding impact, blocks other work, critical safety/security
      Examples: Missing critical guidance, repeated failures, security gaps
    - **medium**: Improves efficiency, prevents future issues
      Examples: Optimization, clarity improvement, maintenance
    - **low**: Nice-to-have, minimal impact
      Examples: Style, minor enhancements, edge cases

    ## Evaluation Criteria
    1. **Compounding value**: Higher priority for fixes preventing multiple issues
       - Systemic issues that affect many areas should be HIGH
       - One-off fixes should be LOW unless critical

    2. **Evidence alignment**: Priority should match the evidence
       - Pattern-based recommendations (affecting many sessions) = higher
       - Single finding recommendations = depends on severity

    3. **Type alignment**: Recommendation type should inform priority
       - Systemic recommendations often warrant HIGH priority
       - Symptomatic recommendations rarely warrant HIGH unless critical

    4. **Consistency**: Similar recommendations should have similar priorities

    Rate prioritization justification from 0 to 10:
    - 10: All priorities clearly justified by impact and evidence
    - 5: Reasonable priorities but some weak or inconsistent
    - 0: Arbitrary priorities with no clear justification

    Score (0-10):
    """
    if TRULENS_AVAILABLE:
        raw_score = get_provider().generate_score(prompt)
        # Normalize 0-10 scale to 0-1 for threshold comparison
        return raw_score / 10.0 if raw_score > 1.0 else raw_score
    return 0.5  # Stub for testing


def advisor_question_quality(questions: list[dict[str, Any]]) -> float:
    """
    Evaluate if clarifying questions are non-leading and balanced.

    Per Constitution Principle IV (Mixed-Methods), questions should
    capture authentic user preferences, not lead to expected answers.

    Args:
        questions: List of clarifying question objects

    Returns:
        Score from 0 to 1:
        - 1.0: Questions are neutral, balanced, capture nuance
        - 0.5: Mostly balanced but some leading elements
        - 0.0: Leading questions that bias responses
    """
    # Format questions for evaluation
    q_summaries = []
    for i, q in enumerate(questions, 1):
        options_str = ""
        if q.get('options'):
            options_str = "\n".join([
                f"      - {opt.get('label', 'N/A')}: {opt.get('description', 'N/A')}"
                for opt in q.get('options', [])
            ])
        q_summaries.append(f"""
        {i}. Question: {q.get('question', 'N/A')}
           Context: {q.get('context', 'N/A')}
           Options:
{options_str}
           Default: {q.get('defaultAnswer', 'N/A')}
        """)

    prompt = f"""
    Evaluate if these clarifying questions are non-leading and balanced.

    ## Clarifying Questions
    {''.join(q_summaries)}

    ## Evaluation Criteria
    1. **Non-leading prompts**: Questions should not suggest expected answers
       - Bad: "How much has workflow efficiency improved?"
       - Good: "How would you describe changes in workflow efficiency?"
       - Bad: "Should we use the obviously better option A?"
       - Good: "Which approach would you prefer: A or B?"

    2. **Balanced options**: All options should be presented fairly
       - Bad: "A (recommended), B (not recommended)"
       - Good: "A (tradeoff X), B (tradeoff Y)"
       - Each option should have similar detail level

    3. **Neutral framing**: Context should not bias toward an answer
       - Bad: "Most developers prefer approach A..."
       - Good: "Both approaches have tradeoffs..."

    4. **Default justification**: If default provided, it should be evidence-based
       - Good: "Default: A (based on finding frequency)"
       - Bad: "Default: A (because it's better)"

    5. **Question necessity**: Questions should be asked only when truly needed
       - Multiple valid approaches exist
       - Tradeoffs affect user preference
       - Risk of incorrect assumption is high

    Rate question quality from 0 to 10:
    - 10: Neutral questions, balanced options, fair defaults
    - 5: Mostly balanced but some leading elements or biased framing
    - 0: Leading questions, biased options, or manipulative defaults

    Score (0-10):
    """
    if TRULENS_AVAILABLE:
        raw_score = get_provider().generate_score(prompt)
        # Normalize 0-10 scale to 0-1 for threshold comparison
        return raw_score / 10.0 if raw_score > 1.0 else raw_score
    return 0.5  # Stub for testing


# =============================================================================
# Feedback Function Registry
# =============================================================================

def get_recommendation_feedbacks(provider: TruLensOpenAI | None = None) -> dict[str, Feedback]:
    """
    Get all recommendation advisor feedback functions.

    Returns:
        Dictionary of feedback function name to Feedback object.
    """
    return {
        "recommendation_specificity": Feedback(recommendation_specificity),
        "recommendation_causal_trace": Feedback(recommendation_causal_trace),
        "recommendation_prioritization": Feedback(recommendation_prioritization),
        "advisor_question_quality": Feedback(advisor_question_quality),
    }


def get_all_feedbacks() -> dict[str, Feedback]:
    """
    Get all feedback functions for recommendations.

    Returns:
        Dictionary of all feedback functions.
    """
    return get_recommendation_feedbacks()


# =============================================================================
# Evaluation Thresholds
# =============================================================================

# Minimum scores required for release gates (ADR-0012)
THRESHOLDS = {
    "recommendation_specificity": 0.7,
    "recommendation_causal_trace": 0.7,
    "recommendation_prioritization": 0.7,
    "advisor_question_quality": 0.7,
    "overall": 0.7,  # Weighted average of all scores
}

# Weights for calculating overall score
WEIGHTS = {
    "recommendation_specificity": 0.30,
    "recommendation_causal_trace": 0.30,
    "recommendation_prioritization": 0.20,
    "advisor_question_quality": 0.20,
}


def calculate_overall_score(scores: dict[str, float]) -> float:
    """
    Calculate weighted overall score from individual feedback scores.

    Args:
        scores: Dictionary of feedback name to score (0-1)

    Returns:
        Weighted overall score (0-1)
    """
    total_weight = 0.0
    weighted_sum = 0.0

    for name, weight in WEIGHTS.items():
        if name in scores:
            weighted_sum += scores[name] * weight
            total_weight += weight

    if total_weight == 0:
        return 0.0

    return weighted_sum / total_weight


def check_thresholds(scores: dict[str, float]) -> tuple[bool, list[str]]:
    """
    Check if scores meet minimum thresholds.

    Args:
        scores: Dictionary of feedback name to score (0-1)

    Returns:
        Tuple of (passed, list of failed metrics)
    """
    failed = []

    for name, threshold in THRESHOLDS.items():
        if name == "overall":
            overall = calculate_overall_score(scores)
            if overall < threshold:
                failed.append(f"overall ({overall:.2f} < {threshold})")
        elif name in scores:
            if scores[name] < threshold:
                failed.append(f"{name} ({scores[name]:.2f} < {threshold})")

    return len(failed) == 0, failed


# =============================================================================
# Module Exports
# =============================================================================

__all__ = [
    # Session
    "get_trulens_session",
    "get_provider",
    # Feedback functions
    "get_recommendation_feedbacks",
    "get_all_feedbacks",
    # Individual feedback functions
    "recommendation_specificity",
    "recommendation_causal_trace",
    "recommendation_prioritization",
    "advisor_question_quality",
    # Thresholds
    "THRESHOLDS",
    "WEIGHTS",
    "calculate_overall_score",
    "check_thresholds",
    # Constants
    "TRULENS_AVAILABLE",
]
