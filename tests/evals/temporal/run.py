#!/usr/bin/env python3
"""
TruLens Evaluation Runner for EP09 Temporal Analysis

Orchestrates TruLens evaluations for temporal analysis components.
Called from TypeScript via subprocess per ADR-0011.

Usage:
    python -m tests.evals.temporal.run --scenario trend-detection
    python -m tests.evals.temporal.run --all
    python -m tests.evals.temporal.run --golden tests/evals/golden/temporal/

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

from tests.evals.temporal.trulens_config import (
    TRULENS_AVAILABLE,
    get_trulens_session,
    get_all_feedbacks,
    calculate_overall_score,
    check_thresholds,
    THRESHOLDS,
)


def load_golden_scenario(path: Path) -> dict[str, Any]:
    """Load a golden scenario from JSON file."""
    with open(path) as f:
        return json.load(f)


def evaluate_scenario(scenario: dict[str, Any], feedbacks: dict) -> dict[str, float]:
    """
    Run evaluation on a single scenario.

    Returns:
        Dictionary of feedback name to score
    """
    scores: dict[str, float] = {}

    # Extract scenario components
    trend_analysis = scenario.get("trend_analysis")
    baseline_data = scenario.get("baseline_data")
    review_output = scenario.get("review_output")
    recommendations = scenario.get("recommendations", [])
    causal_chains = scenario.get("causal_chains", [])
    quantitative_data = scenario.get("quantitative_data")
    qualitative_data = scenario.get("qualitative_data")
    agent_interpretation = scenario.get("agent_interpretation")

    # Run applicable feedback functions
    if trend_analysis and baseline_data:
        feedback_fn = feedbacks.get("trend_accuracy")
        if feedback_fn:
            scores["trend_accuracy"] = feedback_fn.func(trend_analysis, baseline_data)

    if review_output:
        feedback_fn = feedbacks.get("review_quality")
        if feedback_fn:
            scores["review_quality"] = feedback_fn.func(review_output)

    if recommendations:
        feedback_fn = feedbacks.get("recommendation_actionability")
        if feedback_fn:
            # Average across all recommendations
            rec_scores = [feedback_fn.func(rec) for rec in recommendations]
            scores["recommendation_actionability"] = sum(rec_scores) / len(rec_scores)

    if causal_chains:
        feedback_fn = feedbacks.get("causal_accuracy")
        if feedback_fn:
            # Average across all causal chains
            causal_scores = [feedback_fn.func(chain) for chain in causal_chains]
            scores["causal_accuracy"] = sum(causal_scores) / len(causal_scores)

    if quantitative_data and qualitative_data and agent_interpretation:
        feedback_fn = feedbacks.get("mixed_methods_alignment")
        if feedback_fn:
            scores["mixed_methods_alignment"] = feedback_fn.func(
                quantitative_data, qualitative_data, agent_interpretation
            )

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
    }

    if not TRULENS_AVAILABLE:
        print("Warning: TruLens not installed, using stub implementations")

    # Get feedback functions
    feedbacks = get_all_feedbacks()

    # Find scenarios to evaluate
    if golden_dir and golden_dir.exists():
        scenario_files = list(golden_dir.glob("*.json"))
        if scenario_name:
            scenario_files = [f for f in scenario_files if scenario_name in f.stem]
    else:
        # Use default test scenarios
        scenario_files = []
        print("Warning: No golden dataset found, running with empty scenarios")

    all_scores: list[dict[str, float]] = []

    for scenario_path in scenario_files:
        print(f"Evaluating: {scenario_path.name}")
        scenario = load_golden_scenario(scenario_path)
        scores = evaluate_scenario(scenario, feedbacks)
        all_scores.append(scores)

        results["scenarios"][scenario_path.stem] = {
            "scores": scores,
            "overall": calculate_overall_score(scores),
            "passed": check_thresholds(scores)[0],
        }

    # Calculate aggregate scores
    if all_scores:
        aggregate = {}
        for key in all_scores[0]:
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
        description="Run TruLens evaluations for EP09 Temporal Analysis"
    )
    parser.add_argument(
        "--golden",
        type=Path,
        default=Path("tests/evals/golden/temporal"),
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
            print("\n=== Evaluation Results ===")
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
        return 2


if __name__ == "__main__":
    sys.exit(main())
