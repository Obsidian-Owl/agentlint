#!/usr/bin/env bash
# check-prerequisites.sh - Validate required artifacts exist for task generation
# Part of dev.tasks skill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

usage() {
    cat <<EOF
Usage: check-prerequisites.sh [OPTIONS]

Validate that required artifacts exist before generating tasks.

Options:
  --json        Output result as JSON
  --strict      Fail if optional artifacts are missing
  -h, --help    Show this help message

Required artifacts:
  - spec.md     Feature specification with user stories
  - plan.md     Implementation plan with technical context

Optional artifacts (enhance task generation):
  - data-model.md    Entity definitions
  - research.md      Technical decisions
  - contracts/       API/interface definitions
  - quickstart.md    Usage scenarios

Examples:
  check-prerequisites.sh
  check-prerequisites.sh --json
  check-prerequisites.sh --strict
EOF
}

# Parse arguments
JSON_OUTPUT=false
STRICT_MODE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --strict)
            STRICT_MODE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Error: Unknown option $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

# Load feature context
eval "$(get_feature_paths)"

# Track validation results
ERRORS=()
WARNINGS=()
AVAILABLE_DOCS=()

# Validate feature branch
if [[ -z "$EPIC_ID" ]]; then
    ERRORS+=("Not on a feature branch. Expected branch like 'ep01-feature-name'")
fi

# Validate feature directory
if [[ -z "$FEATURE_DIR" ]] || [[ ! -d "$FEATURE_DIR" ]]; then
    ERRORS+=("Feature directory not found. Run /dev.specify first.")
fi

# Check required artifacts
if [[ -n "$FEATURE_DIR" ]]; then
    # Required: spec.md
    if [[ -f "$FEATURE_DIR/spec.md" ]]; then
        AVAILABLE_DOCS+=("spec.md")
    else
        ERRORS+=("spec.md not found. Run /dev.specify first.")
    fi

    # Required: plan.md
    if [[ -f "$FEATURE_DIR/plan.md" ]]; then
        AVAILABLE_DOCS+=("plan.md")
    else
        ERRORS+=("plan.md not found. Run /dev.plan first.")
    fi

    # Optional: data-model.md
    if [[ -f "$FEATURE_DIR/data-model.md" ]]; then
        AVAILABLE_DOCS+=("data-model.md")
    else
        WARNINGS+=("data-model.md not found (optional - will generate basic tasks)")
    fi

    # Optional: research.md
    if [[ -f "$FEATURE_DIR/research.md" ]]; then
        AVAILABLE_DOCS+=("research.md")
    else
        WARNINGS+=("research.md not found (optional)")
    fi

    # Optional: contracts/
    if [[ -d "$FEATURE_DIR/contracts" ]] && [[ -n "$(ls -A "$FEATURE_DIR/contracts" 2>/dev/null)" ]]; then
        AVAILABLE_DOCS+=("contracts/")
    else
        WARNINGS+=("contracts/ not found or empty (optional)")
    fi

    # Optional: quickstart.md
    if [[ -f "$FEATURE_DIR/quickstart.md" ]]; then
        AVAILABLE_DOCS+=("quickstart.md")
    else
        WARNINGS+=("quickstart.md not found (optional)")
    fi
fi

# Determine exit status
EXIT_CODE=0
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    EXIT_CODE=1
elif $STRICT_MODE && [[ ${#WARNINGS[@]} -gt 0 ]]; then
    EXIT_CODE=1
fi

# Output result
if $JSON_OUTPUT; then
    # Convert arrays to JSON
    errors_json="[]"
    warnings_json="[]"
    docs_json="[]"

    if [[ ${#ERRORS[@]} -gt 0 ]]; then
        errors_json=$(printf '%s\n' "${ERRORS[@]}" | jq -R . | jq -s .)
    fi

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        warnings_json=$(printf '%s\n' "${WARNINGS[@]}" | jq -R . | jq -s .)
    fi

    if [[ ${#AVAILABLE_DOCS[@]} -gt 0 ]]; then
        docs_json=$(printf '%s\n' "${AVAILABLE_DOCS[@]}" | jq -R . | jq -s .)
    fi

    cat <<JSON
{
  "valid": $([ $EXIT_CODE -eq 0 ] && echo "true" || echo "false"),
  "EPIC_ID": "${EPIC_ID:-}",
  "FEATURE_DIR": "${FEATURE_DIR:-}",
  "FEATURE_SPEC": "${FEATURE_DIR:+$FEATURE_DIR/spec.md}",
  "IMPL_PLAN": "${FEATURE_DIR:+$FEATURE_DIR/plan.md}",
  "TASKS": "${FEATURE_DIR:+$FEATURE_DIR/tasks.md}",
  "BRANCH": "$CURRENT_BRANCH",
  "HAS_GIT": $(has_git && echo "true" || echo "false"),
  "AVAILABLE_DOCS": $docs_json,
  "ERRORS": $errors_json,
  "WARNINGS": $warnings_json
}
JSON
else
    echo "Prerequisite Check for Task Generation"
    echo "======================================="
    echo ""
    echo "Feature: ${EPIC_ID:-unknown}"
    echo "Branch:  $CURRENT_BRANCH"
    echo "Directory: ${FEATURE_DIR:-not found}"
    echo ""

    if [[ ${#AVAILABLE_DOCS[@]} -gt 0 ]]; then
        echo "Available artifacts:"
        for doc in "${AVAILABLE_DOCS[@]}"; do
            echo "  ✓ $doc"
        done
        echo ""
    fi

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo "Warnings:"
        for warn in "${WARNINGS[@]}"; do
            echo "  ⚠ $warn"
        done
        echo ""
    fi

    if [[ ${#ERRORS[@]} -gt 0 ]]; then
        echo "Errors:"
        for err in "${ERRORS[@]}"; do
            echo "  ✗ $err"
        done
        echo ""
        echo "Status: FAILED - Fix errors before generating tasks"
    else
        echo "Status: READY for task generation"
    fi
fi

exit $EXIT_CODE
