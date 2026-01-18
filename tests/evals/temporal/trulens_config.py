"""
TruLens Evaluation Configuration for EP09 Temporal Analysis

This module configures TruLens feedback functions for evaluating
the quality of temporal analysis outputs per ADR-0011 and ADR-0012.

Feedback functions evaluate:
1. Trend accuracy - Do detected trends match actual patterns?
2. Review quality - Are qualitative reviews non-leading and balanced?
3. Actionability - Are recommendations specific and implementable?
4. Causal accuracy - Do traced causes actually explain effects?

Usage:
    python -m tests.evals.temporal.run --scenario trend-detection
    python -m tests.evals.temporal.run --all

See ADR-0011 (Testing Strategy) and ADR-0012 (Evaluation Framework).
"""

from typing import Any

# TruLens imports - these will be available when TruLens is installed
# For now, we define the interfaces and feedback function logic
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
# Standard Feedback Functions
# =============================================================================

def get_standard_feedbacks(provider: TruLensOpenAI) -> dict[str, Feedback]:
    """
    Standard TruLens feedback functions for general quality.

    Returns:
        Dictionary of feedback function name to Feedback object.
    """
    return {
        "relevance": Feedback(provider.relevance).on_input_output(),
        "groundedness": Feedback(provider.groundedness).on_input_output(),
        "coherence": Feedback(provider.coherence).on_output(),
    }


# =============================================================================
# Temporal Analysis Feedback Functions
# =============================================================================

def trend_accuracy(trend_analysis: dict[str, Any], baseline_data: dict[str, Any]) -> float:
    """
    Evaluate if detected trends accurately reflect the underlying data.

    Per ADR-0019, tools return raw statistical data (slopes, R-squared).
    This evaluator checks if the agent's trend interpretation is accurate.

    Args:
        trend_analysis: The agent's trend analysis output
        baseline_data: The raw baseline metrics data

    Returns:
        Score from 0 to 1:
        - 1.0: Trend interpretation matches statistical evidence
        - 0.5: Partially accurate, some misinterpretation
        - 0.0: Trend interpretation contradicts the data
    """
    prompt = f"""
    Evaluate if this trend analysis accurately reflects the underlying data.

    ## Statistical Data (Ground Truth)
    {baseline_data}

    ## Agent's Trend Analysis
    {trend_analysis}

    ## Evaluation Criteria
    - Does the agent correctly identify increasing/decreasing/stable patterns?
    - Are inflection points accurately located?
    - Does the agent appropriately acknowledge uncertainty (low R-squared)?
    - Are correlations correctly interpreted (not causation)?

    Rate accuracy from 0 to 1:
    - 1.0: Interpretation fully matches the statistical evidence
    - 0.5: Partially accurate, some patterns missed or misinterpreted
    - 0.0: Interpretation contradicts or ignores the data

    Score (0-1):
    """
    if TRULENS_AVAILABLE:
        return get_provider().generate_score(prompt)
    return 0.5  # Stub for testing


def review_quality(review_output: dict[str, Any]) -> float:
    """
    Evaluate if qualitative review prompts are non-leading and balanced.

    Per Constitution Principle IV (Mixed-Methods), qualitative reviews
    should capture authentic user experience, not lead to expected answers.

    Args:
        review_output: The qualitative review session output

    Returns:
        Score from 0 to 1:
        - 1.0: Questions are neutral, balanced, capture nuance
        - 0.5: Mostly balanced but some leading elements
        - 0.0: Leading questions that bias responses
    """
    prompt = f"""
    Evaluate the quality of this qualitative review session.

    ## Review Output
    {review_output}

    ## Evaluation Criteria
    1. **Non-leading prompts**: Questions should not suggest expected answers
       - Bad: "How much has workflow efficiency improved?"
       - Good: "How would you describe changes in workflow efficiency?"

    2. **Balanced dimensions**: All 6 review dimensions should be represented
       - Workflow efficiency, Configuration quality, Context utilization
       - Error patterns, Tool usage, Session continuity

    3. **Sentiment extraction**: Sentiment values should match qualitative content
       - Positive observations should have positive sentiment
       - Negative observations should have negative sentiment
       - Mixed should be near neutral

    4. **Theme identification**: Themes should emerge from content, not be imposed

    Rate quality from 0 to 1:
    - 1.0: Neutral questions, balanced coverage, accurate sentiment
    - 0.5: Mostly balanced but some leading or missing dimensions
    - 0.0: Leading questions or significant sentiment misalignment

    Score (0-1):
    """
    if TRULENS_AVAILABLE:
        return get_provider().generate_score(prompt)
    return 0.5  # Stub for testing


def recommendation_actionability(recommendation: dict[str, Any]) -> float:
    """
    Evaluate if a recommendation is specific and implementable.

    Per Constitution Principle III (Causal-First), recommendations should
    be concrete actions the user can take to prevent future issues.

    Args:
        recommendation: A single recommendation from the analysis

    Returns:
        Score from 0 to 1:
        - 1.0: Clear action, specific file/line, concrete change
        - 0.5: Actionable but vague about specifics
        - 0.0: Too abstract to implement
    """
    prompt = f"""
    Rate this recommendation's actionability from 0 to 1.

    ## Recommendation
    {recommendation}

    ## Evaluation Criteria
    1. **Specificity**: Does it identify specific files, lines, or configurations?
    2. **Clarity**: Is the recommended change clearly described?
    3. **Implementability**: Can a developer act on this immediately?
    4. **Rationale**: Is there clear reasoning for why this change helps?

    Rate actionability from 0 to 1:
    - 1.0: Clear action, specific location, concrete change with rationale
    - 0.5: Actionable but vague about specifics or missing rationale
    - 0.0: Too abstract to implement ("improve configuration quality")

    Score (0-1):
    """
    if TRULENS_AVAILABLE:
        return get_provider().generate_score(prompt)
    return 0.5  # Stub for testing


def causal_accuracy(causal_chain: dict[str, Any]) -> float:
    """
    Evaluate if the traced cause actually explains the observed effect.

    Per Constitution Principle III (Causal-First), the analysis should
    trace issues to their actual origin, not just correlate symptoms.

    Args:
        causal_chain: The agent's causal analysis with evidence

    Returns:
        Score from 0 to 1:
        - 1.0: Clear causal chain from config gap to observed problem
        - 0.5: Plausible connection but not proven
        - 0.0: No causal connection or wrong attribution
    """
    prompt = f"""
    Evaluate if this causal analysis correctly identifies the root cause.

    ## Causal Analysis
    {causal_chain}

    ## Evaluation Criteria
    1. **Causal chain completeness**: Does it trace from symptom to root cause?
    2. **Evidence strength**: Is the causal link supported by data?
    3. **Temporal ordering**: Does the cause precede the effect?
    4. **Alternative explanations**: Are other potential causes considered?
    5. **Mechanism clarity**: Is there a clear explanation of HOW the cause led to the effect?

    Rate causal accuracy from 0 to 1:
    - 1.0: Clear, evidence-supported causal chain with mechanism explanation
    - 0.5: Plausible connection but weak evidence or missing mechanism
    - 0.0: No causal connection, correlation mistaken for causation, or wrong attribution

    Score (0-1):
    """
    if TRULENS_AVAILABLE:
        return get_provider().generate_score(prompt)
    return 0.5  # Stub for testing


def mixed_methods_alignment(
    quantitative_data: dict[str, Any],
    qualitative_data: dict[str, Any],
    agent_interpretation: str
) -> float:
    """
    Evaluate if agent correctly identifies alignment/divergence between
    quantitative metrics and qualitative sentiment.

    Per Constitution Principle IV (Mixed-Methods), the agent should
    synthesize both data types and identify when they diverge.

    Args:
        quantitative_data: Numerical metrics (trends, deltas)
        qualitative_data: Review sentiment and themes
        agent_interpretation: Agent's synthesis of both

    Returns:
        Score from 0 to 1:
        - 1.0: Correctly identifies alignment or divergence with explanation
        - 0.5: Partial synthesis, misses some patterns
        - 0.0: Fails to notice divergence or misinterprets alignment
    """
    prompt = f"""
    Evaluate if the agent correctly synthesizes quantitative and qualitative data.

    ## Quantitative Data (Metrics)
    {quantitative_data}

    ## Qualitative Data (Reviews)
    {qualitative_data}

    ## Agent's Interpretation
    {agent_interpretation}

    ## Evaluation Criteria
    1. **Alignment detection**: When metrics improve and sentiment improves, did the agent note alignment?
    2. **Divergence detection**: When metrics improve but sentiment worsens (or vice versa), did the agent flag this?
    3. **Root cause exploration**: For divergences, did the agent suggest possible explanations?
    4. **Synthesis quality**: Does the interpretation combine both data sources meaningfully?

    Rate mixed-methods synthesis from 0 to 1:
    - 1.0: Correctly identifies patterns, explains alignment/divergence with insight
    - 0.5: Partial synthesis, notices some patterns but misses others
    - 0.0: Fails to synthesize, treats data sources independently, or misses divergence

    Score (0-1):
    """
    if TRULENS_AVAILABLE:
        return get_provider().generate_score(prompt)
    return 0.5  # Stub for testing


# =============================================================================
# Feedback Function Registry
# =============================================================================

def get_temporal_feedbacks(provider: TruLensOpenAI | None = None) -> dict[str, Feedback]:
    """
    Get all temporal analysis feedback functions.

    Returns:
        Dictionary of feedback function name to Feedback object.
    """
    return {
        "trend_accuracy": Feedback(trend_accuracy),
        "review_quality": Feedback(review_quality),
        "recommendation_actionability": Feedback(recommendation_actionability),
        "causal_accuracy": Feedback(causal_accuracy),
        "mixed_methods_alignment": Feedback(mixed_methods_alignment),
    }


def get_all_feedbacks() -> dict[str, Feedback]:
    """
    Get all feedback functions (standard + temporal).

    Returns:
        Dictionary of all feedback functions.
    """
    provider = get_provider() if TRULENS_AVAILABLE else None
    feedbacks = {}

    if provider:
        feedbacks.update(get_standard_feedbacks(provider))

    feedbacks.update(get_temporal_feedbacks(provider))

    return feedbacks


# =============================================================================
# Evaluation Thresholds
# =============================================================================

# Minimum scores required for release gates (ADR-0012)
THRESHOLDS = {
    "trend_accuracy": 0.7,
    "review_quality": 0.7,
    "recommendation_actionability": 0.7,
    "causal_accuracy": 0.7,
    "mixed_methods_alignment": 0.7,
    "overall": 0.7,  # Weighted average of all scores
}

# Weights for calculating overall score
WEIGHTS = {
    "trend_accuracy": 0.25,
    "review_quality": 0.20,
    "recommendation_actionability": 0.20,
    "causal_accuracy": 0.25,
    "mixed_methods_alignment": 0.10,
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
    "get_standard_feedbacks",
    "get_temporal_feedbacks",
    "get_all_feedbacks",
    # Individual feedback functions
    "trend_accuracy",
    "review_quality",
    "recommendation_actionability",
    "causal_accuracy",
    "mixed_methods_alignment",
    # Thresholds
    "THRESHOLDS",
    "WEIGHTS",
    "calculate_overall_score",
    "check_thresholds",
    # Constants
    "TRULENS_AVAILABLE",
]
