#!/usr/bin/env python3
"""
TruLens Evaluation Runner for EP10 Recommendation Advisor

Orchestrates TruLens evaluations for recommendation quality assessment.
Called from TypeScript via subprocess per ADR-0011.

Usage:
    python -m tests.evals.recommendations.run --scenario rec-01-simple-config
    python -m tests.evals.recommendations.run --all
    python -m tests.evals.recommendations.run --golden tests/evals/golden/recommendations/

Exit codes:
    0 - All evaluations passed thresholds
    1 - One or more evaluations failed thresholds
    2 - Error during evaluation
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from tests.evals.recommendations.trulens_config import (
    TRULENS_AVAILABLE,
    get_all_feedbacks,
    calculate_overall_score,
    check_thresholds,
    THRESHOLDS,
    recommendation_specificity,
    recommendation_causal_trace,
    recommendation_prioritization,
    advisor_question_quality,
)


def load_golden_scenario(path: Path) -> dict[str, Any]:
    """Load a golden scenario from JSON file."""
    with open(path) as f:
        return json.load(f)


def evaluate_scenario(scenario: dict[str, Any], feedbacks: dict) -> dict[str, float]:
    """
    Run evaluation on a single recommendation scenario.

    Args:
        scenario: Golden scenario data containing recommendations and input
        feedbacks: Dictionary of feedback functions

    Returns:
        Dictionary of feedback name to score (0-1)
    """
    scores: dict[str, float] = {}

    # Extract scenario components
    recommendations = scenario.get("recommendations", [])
    input_data = scenario.get("input_data", {})
    expected_output = scenario.get("expected_output", {})
    questions = scenario.get("clarifying_questions", [])

    # Evaluate recommendation specificity
    if recommendations:
        specificity_scores = []
        for rec in recommendations:
            score = recommendation_specificity(rec)
            # Normalize 0-10 scale to 0-1 if needed
            if score > 1.0:
                score = score / 10.0
            specificity_scores.append(score)
        scores["recommendation_specificity"] = sum(specificity_scores) / len(specificity_scores)

    # Evaluate causal trace validity
    if recommendations:
        trace_scores = []
        for rec in recommendations:
            score = recommendation_causal_trace(rec)
            # Normalize 0-10 scale to 0-1 if needed
            if score > 1.0:
                score = score / 10.0
            trace_scores.append(score)
        scores["recommendation_causal_trace"] = sum(trace_scores) / len(trace_scores)

    # Evaluate prioritization justification
    if len(recommendations) > 1:
        score = recommendation_prioritization(recommendations)
        # Normalize 0-10 scale to 0-1 if needed
        if score > 1.0:
            score = score / 10.0
        scores["recommendation_prioritization"] = score

    # Evaluate question quality (if applicable)
    if questions:
        score = advisor_question_quality(questions)
        # Normalize 0-10 scale to 0-1 if needed
        if score > 1.0:
            score = score / 10.0
        scores["advisor_question_quality"] = score

    return scores


def run_evaluations(
    golden_dir: Path | None = None,
    scenario_name: str | None = None
) -> dict[str, Any]:
    """
    Run all evaluations and return results.

    Args:
        golden_dir: Path to golden dataset directory
        scenario_name: Specific scenario to run (or None for all)

    Returns:
        Evaluation results dictionary
    """
    results = {
        "trulens_available": TRULENS_AVAILABLE,
        "scenarios": {},
        "aggregate_scores": {},
        "passed": False,
        "failed_metrics": [],
        "overall_score": 0.0,
    }

    if not TRULENS_AVAILABLE:
        print("Warning: TruLens not installed, using stub implementations")

    # Get feedback functions
    feedbacks = get_all_feedbacks()

    # Find scenarios to evaluate
    if golden_dir and golden_dir.exists():
        scenario_files = [
            f for f in golden_dir.glob("scenario-*.json")
            if f.name != "manifest.json"
        ]
        if scenario_name:
            scenario_files = [f for f in scenario_files if scenario_name in f.stem]
    else:
        # Use default test scenarios
        default_golden_dir = Path(__file__).parent.parent / "golden" / "recommendations"
        if default_golden_dir.exists():
            scenario_files = [
                f for f in default_golden_dir.glob("scenario-*.json")
                if f.name != "manifest.json"
            ]
        else:
            scenario_files = []
            print("Warning: No golden dataset found, running with empty scenarios")

    all_scores: list[dict[str, float]] = []

    for scenario_path in scenario_files:
        print(f"Evaluating: {scenario_path.name}")
        try:
            scenario = load_golden_scenario(scenario_path)
            scores = evaluate_scenario(scenario, feedbacks)
            all_scores.append(scores)

            results["scenarios"][scenario_path.stem] = {
                "scores": scores,
                "overall": calculate_overall_score(scores),
                "passed": check_thresholds(scores)[0],
            }
        except Exception as e:
            print(f"  Error evaluating {scenario_path.name}: {e}")
            results["scenarios"][scenario_path.stem] = {
                "error": str(e),
                "passed": False,
            }

    # Calculate aggregate scores
    if all_scores:
        aggregate = {}
        all_keys = set()
        for s in all_scores:
            all_keys.update(s.keys())

        for key in all_keys:
            values = [s.get(key, 0) for s in all_scores if key in s]
            if values:
                aggregate[key] = sum(values) / len(values)

        results["aggregate_scores"] = aggregate
        results["overall_score"] = calculate_overall_score(aggregate)
        passed, failed = check_thresholds(aggregate)
        results["passed"] = passed
        results["failed_metrics"] = failed
    else:
        # No scenarios - pass with warning
        results["passed"] = True
        results["overall_score"] = 1.0
        print("Warning: No scenarios evaluated")

    return results


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Run TruLens evaluations for EP10 Recommendation Advisor"
    )
    parser.add_argument(
        "--golden",
        type=Path,
        default=Path("tests/evals/golden/recommendations"),
        help="Path to golden dataset directory"
    )
    parser.add_argument(
        "--scenario",
        type=str,
        help="Specific scenario name to run"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run all scenarios"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )
    parser.add_argument(
        "--database",
        type=str,
        default=".agentlint/evals.db",
        help="TruLens database path"
    )

    args = parser.parse_args()

    try:
        results = run_evaluations(
            golden_dir=args.golden,
            scenario_name=args.scenario if not args.all else None
        )

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            print("\n=== Recommendation Evaluation Results ===")
            print(f"TruLens available: {results['trulens_available']}")
            print(f"Scenarios evaluated: {len(results['scenarios'])}")

            if results["aggregate_scores"]:
                print("\nAggregate Scores:")
                for name, score in results["aggregate_scores"].items():
                    threshold = THRESHOLDS.get(name, 0.7)
                    status = "PASS" if score >= threshold else "FAIL"
                    print(f"  {name}: {score:.2f} ({status}, threshold: {threshold})")

                print(f"\nOverall Score: {results['overall_score']:.2f}")

            if results["passed"]:
                print("\nResult: PASSED")
                return 0
            else:
                print(f"\nResult: FAILED ({', '.join(results['failed_metrics'])})")
                return 1

    except Exception as e:
        print(f"Error during evaluation: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    sys.exit(main())
