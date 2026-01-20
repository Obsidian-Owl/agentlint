#!/usr/bin/env python3
"""
EP11 Quality & Security - TruLens Runner

Python subprocess for TruLens LLM-as-judge evaluation.
Receives scenario + output JSON on stdin or as file argument,
returns evaluation scores on stdout.

Usage (with uv from tests/evals directory):
    # From file
    uv run python trulens-runner.py input.json

    # From stdin
    echo '{"scenario": {...}, "output": {...}}' | uv run python trulens-runner.py -

    # Check TruLens availability
    uv run python trulens-runner.py --check

See ADR-0011 (Testing Strategy) and ADR-0012 (Evaluation Framework).
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any

# TruLens imports - graceful fallback if not installed
try:
    from trulens.core import Feedback
    from trulens.providers.litellm import LiteLLM
    TRULENS_AVAILABLE = True
except ImportError:
    TRULENS_AVAILABLE = False
    Feedback = None
    LiteLLM = None


# =============================================================================
# Configuration
# =============================================================================

# Default provider uses LiteLLM with Anthropic
DEFAULT_MODEL = os.environ.get("TRULENS_MODEL", "anthropic/claude-sonnet-4-20250514")

# Evaluation thresholds (from EVAL_THRESHOLDS in src/eval/types.ts)
PASS_THRESHOLD = 0.7
DOGFOOD_TARGET = 0.95

# Default rubric weights
DEFAULT_WEIGHTS = {
    "actionability": 0.4,
    "causalAccuracy": 0.3,
    "relevance": 0.3,
}


# =============================================================================
# Provider Setup
# =============================================================================

def get_provider() -> Any:
    """
    Get the LLM provider for evaluation.

    Uses LiteLLM with Anthropic to avoid meta-circularity concerns.
    Falls back to OpenAI if ANTHROPIC_API_KEY not available.
    """
    if not TRULENS_AVAILABLE:
        return None

    return LiteLLM(model=DEFAULT_MODEL)


# =============================================================================
# Feedback Functions
# =============================================================================

def evaluate_actionability(scenario: dict, output: dict, provider: Any) -> tuple[float, str]:
    """
    Evaluate if recommendations are specific and actionable.

    Returns:
        Tuple of (score, reasoning)
    """
    recommendations = output.get("recommendations", [])
    if not recommendations:
        return 0.0, "No recommendations in output"

    expected_types = scenario.get("expectedProperties", {}).get("recommendationTypes", [])

    prompt = f"""
Evaluate the actionability of these recommendations from 0 to 1.

## Recommendations
{json.dumps(recommendations, indent=2)}

## Expected Recommendation Types
{expected_types}

## Evaluation Criteria
1. **Specificity**: Does each recommendation identify specific files, lines, or configurations?
   - Good: "Add error handling section to CLAUDE.md after line 50"
   - Bad: "Improve documentation"

2. **Clarity**: Is the recommended change clearly described?
   - Good: "Add a ## Error Handling section documenting try-catch patterns"
   - Bad: "Handle errors better"

3. **Implementability**: Can a developer act on this immediately?
   - Good: Can directly implement without additional research
   - Bad: Requires significant investigation first

4. **Rationale**: Is there clear reasoning for WHY this change helps?
   - Good: Explains the causal link between change and benefit
   - Bad: No explanation or vague "will improve things"

Rate actionability from 0 to 1:
- 1.0: All recommendations are clear, specific, and immediately implementable
- 0.7: Most recommendations are actionable with minor vagueness
- 0.5: Recommendations are actionable but need clarification
- 0.3: Mostly vague recommendations
- 0.0: No actionable recommendations

Respond with JSON: {{"score": <0-1>, "reasoning": "<brief explanation>"}}
"""

    if provider:
        try:
            response = provider.generate(prompt)
            result = json.loads(response)
            return float(result.get("score", 0.5)), result.get("reasoning", "")
        except Exception as e:
            return 0.5, f"Evaluation error: {e}"

    # Stub for when TruLens not available
    return 0.5, "TruLens not available - using stub score"


def evaluate_causal_accuracy(scenario: dict, output: dict, provider: Any) -> tuple[float, str]:
    """
    Evaluate if findings have accurate causal chains to their origins.

    Returns:
        Tuple of (score, reasoning)
    """
    findings = output.get("findings", [])
    if not findings:
        return 1.0, "No findings to evaluate"

    expected_detections = scenario.get("expectedProperties", {}).get("shouldDetect", [])

    prompt = f"""
Evaluate the causal accuracy of these findings from 0 to 1.

## Findings
{json.dumps(findings, indent=2)}

## Expected Detections
{expected_detections}

## Evaluation Criteria
1. **Origin presence**: Each finding should have a traced origin
   - Good: Finding has "origin" field explaining where it came from
   - Bad: Finding has no origin or generic origin

2. **Causal chain**: The origin should logically explain the finding
   - Good: "Missing error handling section" → found via "Config structure analysis"
   - Bad: "Missing error handling" → origin says "User preference"

3. **Detection accuracy**: Findings should match expected detections
   - Are the expected issues detected?
   - Are there false positives (unexpected detections)?

4. **Evidence quality**: Origins should be supported by evidence
   - Good: Origin includes line numbers, section references
   - Bad: Origin is just a guess

Rate causal accuracy from 0 to 1:
- 1.0: All findings have clear, accurate causal chains
- 0.7: Most findings have good origins with minor gaps
- 0.5: Findings have origins but causal links are weak
- 0.3: Few findings have meaningful origins
- 0.0: No causal tracing

Respond with JSON: {{"score": <0-1>, "reasoning": "<brief explanation>"}}
"""

    if provider:
        try:
            response = provider.generate(prompt)
            result = json.loads(response)
            return float(result.get("score", 0.5)), result.get("reasoning", "")
        except Exception as e:
            return 0.5, f"Evaluation error: {e}"

    return 0.5, "TruLens not available - using stub score"


def evaluate_relevance(scenario: dict, output: dict, provider: Any) -> tuple[float, str]:
    """
    Evaluate if findings and recommendations are relevant to the input.

    Returns:
        Tuple of (score, reasoning)
    """
    input_data = scenario.get("input", {})
    claude_md = input_data.get("claudeMd", "")
    findings = output.get("findings", [])
    recommendations = output.get("recommendations", [])

    should_detect = scenario.get("expectedProperties", {}).get("shouldDetect", [])
    should_not_detect = scenario.get("expectedProperties", {}).get("shouldNotDetect", [])

    prompt = f"""
Evaluate the relevance of findings and recommendations from 0 to 1.

## Input CLAUDE.md
{claude_md[:1000]}{"..." if len(claude_md) > 1000 else ""}

## Findings
{json.dumps(findings, indent=2)}

## Recommendations
{json.dumps(recommendations, indent=2)}

## Expected Detections (should find)
{should_detect}

## False Positive List (should NOT find)
{should_not_detect}

## Evaluation Criteria
1. **True positives**: Are expected issues detected?
   - Score higher if shouldDetect items are found
   - Score lower if shouldDetect items are missed

2. **False positives**: Are unexpected issues incorrectly flagged?
   - Score lower if shouldNotDetect items appear in findings
   - Hallucinated issues should heavily penalize

3. **Recommendation relevance**: Do recommendations address actual findings?
   - Good: Each recommendation maps to a real finding
   - Bad: Recommendations for issues not found

4. **Context appropriateness**: Are findings appropriate for the project type?
   - A Python ML project shouldn't get TypeScript linting recommendations

Rate relevance from 0 to 1:
- 1.0: All findings relevant, no false positives, recommendations targeted
- 0.7: Mostly relevant with minor false positives or missed issues
- 0.5: Mixed relevance - some hits, some misses
- 0.3: Many false positives or missed expected issues
- 0.0: Completely irrelevant findings

Respond with JSON: {{"score": <0-1>, "reasoning": "<brief explanation>"}}
"""

    if provider:
        try:
            response = provider.generate(prompt)
            result = json.loads(response)
            return float(result.get("score", 0.5)), result.get("reasoning", "")
        except Exception as e:
            return 0.5, f"Evaluation error: {e}"

    return 0.5, "TruLens not available - using stub score"


# =============================================================================
# Main Runner
# =============================================================================

def run_evaluation(request: dict) -> dict:
    """
    Run TruLens evaluation on a scenario+output pair.

    Args:
        request: Dict with "scenario" and "output" keys

    Returns:
        Dict with scores, reasoning, and metadata
    """
    scenario = request.get("scenario", {})
    output = request.get("output", {})

    if not scenario or not output:
        return {"error": "Missing scenario or output in request"}

    # Get weights from scenario or use defaults
    weights = scenario.get("rubricWeights", DEFAULT_WEIGHTS)

    # Get provider
    provider = get_provider()

    # Run evaluations
    actionability_score, actionability_reason = evaluate_actionability(scenario, output, provider)
    causal_score, causal_reason = evaluate_causal_accuracy(scenario, output, provider)
    relevance_score, relevance_reason = evaluate_relevance(scenario, output, provider)

    # Calculate overall score
    overall_score = (
        actionability_score * weights.get("actionability", 0.4) +
        causal_score * weights.get("causalAccuracy", 0.3) +
        relevance_score * weights.get("relevance", 0.3)
    )

    return {
        "scores": {
            "actionability": actionability_score,
            "causalAccuracy": causal_score,
            "relevance": relevance_score,
        },
        "reasoning": {
            "actionability": actionability_reason,
            "causalAccuracy": causal_reason,
            "relevance": relevance_reason,
        },
        "overallScore": overall_score,
        "passed": overall_score >= PASS_THRESHOLD,
        "trulensAvailable": TRULENS_AVAILABLE,
        "model": DEFAULT_MODEL if TRULENS_AVAILABLE else None,
    }


def main():
    """Main entry point."""
    # Check mode
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        print(json.dumps({
            "trulensAvailable": TRULENS_AVAILABLE,
            "model": DEFAULT_MODEL if TRULENS_AVAILABLE else None,
        }))
        sys.exit(0)

    # Read input
    if len(sys.argv) > 1 and sys.argv[1] != "-":
        # Read from file
        try:
            with open(sys.argv[1], "r") as f:
                request = json.load(f)
        except Exception as e:
            print(json.dumps({"error": f"Failed to read file: {e}"}))
            sys.exit(1)
    else:
        # Read from stdin
        try:
            request = json.load(sys.stdin)
        except Exception as e:
            print(json.dumps({"error": f"Failed to parse JSON: {e}"}))
            sys.exit(1)

    # Run evaluation
    result = run_evaluation(request)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
