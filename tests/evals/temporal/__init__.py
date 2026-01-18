"""
EP09 Temporal Analysis Evaluation Module

This module provides TruLens-based behavioral evaluation for temporal
analysis components per ADR-0011 and ADR-0012.

Usage:
    from tests.evals.temporal import get_all_feedbacks, check_thresholds

See trulens.config.py for feedback function implementations.
"""

from .trulens_config import (
    # Session
    get_trulens_session,
    get_provider,
    # Feedback functions
    get_standard_feedbacks,
    get_temporal_feedbacks,
    get_all_feedbacks,
    # Individual feedback functions
    trend_accuracy,
    review_quality,
    recommendation_actionability,
    causal_accuracy,
    mixed_methods_alignment,
    # Thresholds
    THRESHOLDS,
    WEIGHTS,
    calculate_overall_score,
    check_thresholds,
    # Constants
    TRULENS_AVAILABLE,
)

__all__ = [
    "get_trulens_session",
    "get_provider",
    "get_standard_feedbacks",
    "get_temporal_feedbacks",
    "get_all_feedbacks",
    "trend_accuracy",
    "review_quality",
    "recommendation_actionability",
    "causal_accuracy",
    "mixed_methods_alignment",
    "THRESHOLDS",
    "WEIGHTS",
    "calculate_overall_score",
    "check_thresholds",
    "TRULENS_AVAILABLE",
]
